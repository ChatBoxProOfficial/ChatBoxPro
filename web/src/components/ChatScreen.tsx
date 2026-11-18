import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { streamChat, uploadFile } from '../api'
import { Markdown } from './Markdown'
import Composer from './Composer'
import Reasoning from './Reasoning'
import StatsModal from './StatsModal'
import type { Attachment, Message, Session, Settings } from '../types'
import { newId } from '../types'

interface Props {
  session: Session
  settings: Settings
  onPersist: (s: Session) => void
  onOpenSidebar: () => void
  onExport: (s: Session) => void
  onSettingsChange: (p: Partial<Settings>) => void
}

const INITIAL_WINDOW = 30

export default function ChatScreen({
  session,
  settings,
  onPersist,
  onOpenSidebar,
  onExport,
  onSettingsChange,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(session.messages)
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_WINDOW, Math.max(session.messages.length, 1)),
  )
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const [searching, setSearching] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)

  const accRef = useRef('')
  const reasonRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startAtRef = useRef(0)
  const firstContentAtRef = useRef(0)
  const firstTokenAtRef = useRef(0)
  const usageRef = useRef<Message['usage']>(undefined)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const isEmpty = messages.length === 0

  const persist = useCallback(
    (msgs: Message[], extra?: Partial<Session>) => {
      const base = sessionRef.current
      const firstUser = msgs.find((m) => m.role === 'user' && m.content.trim())
      // 标题只用正文，不要把自动追加的附件清单也算进去
      const titleSource = firstUser ? firstUser.content.split('\n\n[附件]')[0].trim() : ''
      const title =
        base.title && base.title !== '新对话'
          ? base.title
          : titleSource
            ? titleSource.slice(0, 24)
            : '新对话'
      const next: Session = {
        ...base,
        ...extra,
        title,
        messages: msgs,
        updatedAt: Date.now(),
      }
      sessionRef.current = next
      onPersist(next)
    },
    [onPersist],
  )

  /** 流式增量按帧合批，避免每 token 一次 React 渲染 */
  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setStreamText(accRef.current)
      setReasonText(reasonRef.current)
    })
  }, [])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useLayoutEffect(() => {
    if (atBottom) scrollToBottom(false)
  }, [messages.length, streamText.length, atBottom, scrollToBottom])

  const onScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    if (el.scrollTop < 40 && visibleCount < messages.length) {
      const prevHeight = el.scrollHeight
      setVisibleCount((c) => Math.min(c + 30, messages.length))
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight + el.scrollTop
      })
    }
  }, [visibleCount, messages.length])

  const pickFiles = useCallback(
    async (files: FileList) => {
      const base = settings.baseUrl
      for (const file of Array.from(files)) {
        const id = newId()
        const item: Attachment = {
          id,
          name: file.name,
          size: file.size,
          uploading: true,
        }
        setAttachments((prev) => [...prev, item])
        try {
          const res = await uploadFile(file, base)
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, ...res, uploading: false } : a)),
          )
        } catch (e) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, uploading: false, error: (e as Error).message } : a,
            ),
          )
        }
      }
    },
    [settings.baseUrl],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || busy) return

    const ready = attachments.filter((a) => !a.uploading && !a.error)
    const attachmentNote = ready.length
      ? `\n\n[附件]\n${ready.map((a) => `- ${a.name}${a.stored ? `（inbox: ${a.stored}）` : ''}`).join('\n')}`
      : ''

    const userMsg: Message = {
      id: newId(),
      role: 'user',
      content: text + attachmentNote,
      createdAt: Date.now(),
      attachments: ready.length ? ready : undefined,
    }

    setInput('')
    setAttachments([])

    const next = [...messages, userMsg]
    setMessages(next)
    setVisibleCount((c) => Math.min(Math.max(c + 1, 1), next.length))
    setAtBottom(true)
    setBusy(true)
    accRef.current = ''
    reasonRef.current = ''
    startAtRef.current = Date.now()
    firstContentAtRef.current = 0
    firstTokenAtRef.current = 0
    usageRef.current = undefined
    setStreamText('')
    setReasonText('')
    persist(next)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    let failed = ''
    let citations: Array<{ url: string; title?: string }> = []
    let usedTools = false

    await streamChat(
      next,
      { ...settings, model: session.model || settings.model },
      {
        onDelta: (chunk, kind) => {
          if (!firstTokenAtRef.current) firstTokenAtRef.current = Date.now()
          if (kind === 'content') {
            if (!firstContentAtRef.current) firstContentAtRef.current = Date.now()
            accRef.current += chunk
          } else {
            reasonRef.current += chunk
          }
          scheduleFlush()
        },
        onDone: () => {},
        onError: (msg) => {
          failed = msg
        },
        onToolEvent: (evt) => {
          if (evt.type === 'call_started') setSearching(true)
          if (evt.type === 'call_completed') {
            setSearching(false)
            usedTools = true
          }
        },
        onUsage: (u) => {
          usageRef.current = u
        },
        onMeta: (meta) => {
          if (meta.citations?.length) citations = meta.citations
          if (meta.usedTools) usedTools = true
        },
      },
      ctrl.signal,
    )

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    const acc = accRef.current
    const reasons = reasonRef.current
    const startedAt = startAtRef.current
    const firstContentAt = firstContentAtRef.current
    const reasoningMs = reasons
      ? (firstContentAt || Date.now()) - (startedAt || Date.now())
      : 0
    accRef.current = ''
    reasonRef.current = ''
    setStreamText('')
    setReasonText('')
    setBusy(false)
    setSearching(false)
    abortRef.current = null

    const assistant: Message = failed
      ? {
          id: newId(),
          role: 'assistant',
          content: failed,
          createdAt: Date.now(),
          error: true,
        }
      : {
          id: newId(),
          role: 'assistant',
          content: acc,
          createdAt: Date.now(),
          model: session.model,
          reasoning: reasons || undefined,
          reasoningMs: reasons ? reasoningMs : undefined,
          citations: citations.length ? citations : undefined,
          usedTools: usedTools || undefined,
          usage: usageRef.current,
          meta: {
            startedAt: startedAt || undefined,
            firstTokenAt: firstTokenAtRef.current || undefined,
            endedAt: Date.now(),
          },
        }

    const withReply = [...next, assistant]
    setMessages(withReply)
    setVisibleCount((c) => Math.min(Math.max(c + 1, 1), withReply.length))
    setAtBottom(true)
    persist(withReply)
  }, [input, attachments, busy, messages, settings, session.model, persist, scheduleFlush])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setBusy(false)
  }, [])

  const start = Math.max(0, messages.length - visibleCount)
  const shown = messages.slice(start)

  return (
    <div className="screen chat-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={onOpenSidebar} aria-label="展开栏目" title="展开栏目">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="topbar-title">
          <div className="title-line">{isEmpty ? 'ChatBox Pro' : session.title}</div>
          {!isEmpty && <div className="sub-line">{session.model}</div>}
        </div>
        {!isEmpty && (
          <button
            className="icon-btn"
            onClick={() => setStatsOpen(true)}
            aria-label="会话统计"
            title="会话统计"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M5 20V10M12 20V4M19 20v-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        {!isEmpty && (
          <button
            className="icon-btn"
            onClick={() => onExport(sessionRef.current)}
            aria-label="导出"
            title="导出对话"
          >
            ⤓
          </button>
        )}
      </header>

      {isEmpty ? (
        <div className="welcome">
          <h1 className="welcome-title">您好，ChatBox Pro 欢迎您</h1>
          <p className="welcome-sub">有什么可以帮你的？</p>
        </div>
      ) : (
        <div className="msg-list" ref={listRef} onScroll={onScroll}>
          {start > 0 && (
            <button
              className="load-more"
              onClick={() => {
                const el = listRef.current
                const prev = el?.scrollHeight ?? 0
                setVisibleCount((c) => Math.min(c + 30, messages.length))
                requestAnimationFrame(() => {
                  if (el) el.scrollTop = el.scrollHeight - prev + el.scrollTop
                })
              }}
            >
              上滚加载更早的 {start} 条
            </button>
          )}
          {shown.map((m) => (
            <MessageRow key={m.id} msg={m} reasoningMode={settings.reasoningDisplay} />
          ))}

          {(busy || streamText || reasonText) && (
            <div className="msg assistant">
              <div className="msg-role">DeepSeek</div>
              <div className="msg-body">
                {settings.reasoningDisplay !== 'off' && reasonText && (
                  <Reasoning
                    key={settings.reasoningDisplay}
                    reasoning={reasonText}
                    mode={settings.reasoningDisplay}
                    streaming={busy}
                    hasContent={!!streamText}
                    durationMs={Date.now() - startAtRef.current}
                  />
                )}
                {searching && (
                  <div className="searching-line">
                    <span className="searching-dot" />
                    正在搜索…
                  </div>
                )}
                {streamText ? (
                  <div className="streaming-text">{streamText}</div>
                ) : (
                  !reasonText && <span className="cursor">▍</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {!isEmpty && !atBottom && (
        <button
          className="to-bottom"
          onClick={() => {
            setAtBottom(true)
            scrollToBottom(true)
          }}
        >
          ↓ 回到最新
        </button>
      )}

      {statsOpen && (
        <StatsModal session={sessionRef.current} onClose={() => setStatsOpen(false)} />
      )}

      <Composer
        value={input}
        onChange={setInput}
        onSend={() => void send()}
        onStop={stop}
        busy={busy}
        model={session.model || settings.model}
        models={settings.enabledModels.length ? settings.enabledModels : [settings.model]}
        onModelChange={(m) => persist(messages, { model: m })}
        effort={settings.reasoningEffort}
        onEffortChange={(e) => onSettingsChange({ reasoningEffort: e })}
        teamMode={settings.teamMode}
        onTeamModeChange={(v) => onSettingsChange({ teamMode: v })}
        webSearch={settings.webSearch}
        onWebSearchChange={(v) => onSettingsChange({ webSearch: v })}
        attachments={attachments}
        onPickFiles={(f) => void pickFiles(f)}
        onRemoveAttachment={removeAttachment}
        placeholder={isEmpty ? '问点什么…' : '发消息…'}
      />
    </div>
  )
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  return `${m}m${Math.round((ms % 60000) / 1000)}s`
}

function fmtTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function MessageRow({
  msg,
  reasoningMode,
}: {
  msg: Message
  reasoningMode: 'off' | 'web' | 'dsh'
}) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        <div className="bubble">{msg.content}</div>
      </div>
    )
  }
  return (
    <div className={`msg assistant${msg.error ? ' error' : ''}`}>
      <div className="msg-role">DeepSeek</div>
      <div className="msg-body">
        {msg.reasoning && reasoningMode !== 'off' && (
          <Reasoning
            key={reasoningMode}
            reasoning={msg.reasoning}
            mode={reasoningMode}
            durationMs={msg.reasoningMs}
          />
        )}
        <Markdown text={msg.content} />

        {msg.meta?.endedAt && msg.meta?.startedAt && (
          <div className="msg-meta">
            {fmtDuration(msg.meta.endedAt - msg.meta.startedAt)}
            {msg.usage && (
              <>
                <span className="meta-sep">·</span>
                {fmtTokens((msg.usage.prompt || 0) + (msg.usage.cached || 0))} in
                <span className="meta-sep">/</span>
                {fmtTokens(msg.usage.completion || 0)} out
              </>
            )}
          </div>
        )}

        {msg.citations && msg.citations.length > 0 && (
          <div className="citations">
            <div className="citations-label">参考来源</div>
            {msg.citations.map((c, i) => (
              <a
                key={`${c.url}-${i}`}
                className="citation-item"
                href={c.url}
                target="_blank"
                rel="noreferrer"
                title={c.url}
              >
                <span className="citation-index">{i + 1}</span>
                <span className="citation-title">{c.title || c.url}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
