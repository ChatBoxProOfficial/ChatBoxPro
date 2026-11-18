import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { streamChat, uploadDocument, uploadFile } from '../api'
import { imageToDataUrl } from '../image'
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
  const [streamMd, setStreamMd] = useState('')

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

  // 流式正文：每 140ms 渲染一次 Markdown，避免逐 token 重排
  useEffect(() => {
    if (!busy) {
      setStreamMd('')
      return
    }
    const t = setInterval(() => setStreamMd(accRef.current), 140)
    return () => clearInterval(t)
  }, [busy])

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
      const TEXT_EXT =
        /\.(txt|md|markdown|json|csv|tsv|log|ya?ml|xml|html?|css|js|ts|tsx|jsx|py|java|c|cc|cpp|h|hpp|go|rs|sql|sh|bat|ps1|toml|ini|conf)$/i

      for (const file of Array.from(files)) {
        const id = newId()
        // 文本类文件直接把内容读出来，才能真正发给模型
        let text: string | undefined
        // 图片：压成 data URL，直接以多模态方式发给模型
        if (file.type.startsWith('image/')) {
          let imageUrl: string | undefined
          try {
            imageUrl = await imageToDataUrl(file)
          } catch {
            imageUrl = undefined
          }
          const imgItem: Attachment = {
            id,
            name: file.name,
            size: file.size,
            uploading: false,
            imageUrl,
            error: imageUrl ? undefined : '图片读取失败',
          }
          setAttachments((prev) => [...prev, imgItem])
          continue
        }

        const isText = TEXT_EXT.test(file.name) || file.type.startsWith('text/')
        if (isText && file.size <= 2 * 1024 * 1024) {
          try {
            text = await file.text()
          } catch {
            text = undefined
          }
        }
        const item: Attachment = {
          id,
          name: file.name,
          size: file.size,
          uploading: true,
          text,
        }
        setAttachments((prev) => [...prev, item])
        try {
          const DOC_EXT = /\.(pdf|docx?|pptx?|xlsx?|epub|mobi|png|jpe?g|webp|gif|bmp|tiff?)$/i
          if (DOC_EXT.test(file.name)) {
            // PDF / Office / 图片：交给官方解析，拿到 file_id
            const isImage = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name)
            const isSheet = /\.(xlsx?|epub|mobi)$/i.test(file.name)
            const purpose = isImage || isSheet ? 'text_recognition' : 'rich_layout_recognition'
            const parsed = await uploadDocument(file, base, purpose)
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === id
                  ? { ...a, ...parsed, purpose, uploading: false }
                  : a,
              ),
            )
          } else {
            const res = await uploadFile(file, base)
            setAttachments((prev) =>
              prev.map((a) => (a.id === id ? { ...a, ...res, uploading: false } : a)),
            )
          }
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

  const run = useCallback(
    async (base: Message[]) => {
      if (busy) return
      setMessages(base)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), base.length))
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
      persist(base)

      const ctrl = new AbortController()
      abortRef.current = ctrl
      let failed = ''
      let citations: Array<{ url: string; title?: string }> = []
      let usedTools = false

      await streamChat(
        base,
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
          onTitle: (t) => {
            const cur = sessionRef.current
            const firstUser = cur.messages.find((m) => m.role === 'user')
            const derived = firstUser
              ? firstUser.content.split('\n\n[附件]')[0].trim().slice(0, 24)
              : ''
            // 只有「还没起名」或「名字来自首条消息」时才用服务端标题覆盖
            if (!cur.title || cur.title === '新对话' || cur.title === derived) {
              const next = { ...cur, title: t }
              sessionRef.current = next
              onPersist(next)
            }
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

      const withReply = [...base, assistant]
      setMessages(withReply)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), withReply.length))
      setAtBottom(true)
      persist(withReply)
    },
    [busy, settings, session.model, persist, scheduleFlush, onPersist],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || busy) return

    const ready = attachments.filter((a) => !a.uploading && !a.error)
    const fileBlocks = ready
      .filter((a) => a.text)
      .map((a) => `\n\n[附件：${a.name}]\n<<<\n${a.text}\n>>>`)
      .join('')

    const attachmentNote =
      ready.length > 0
        ? `\n\n[附件]\n${ready
            .map(
              (a) =>
                `- ${a.name}${a.stored ? `（inbox: ${a.stored}）` : ''}${
                  a.text ? '（内容已附在下方）' : ''
                }`,
            )
            .join('\n')}` + fileBlocks
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
    await run([...messages, userMsg])
  }, [input, attachments, busy, messages, run])

  /** 重新生成最后一条回复 */
  const regenerate = useCallback(async () => {
    if (busy) return
    const base = [...messages]
    while (base.length && base[base.length - 1].role === 'assistant') base.pop()
    if (!base.length) return
    await run(base)
  }, [busy, messages, run])

  /** 编辑某条用户消息：截断它和之后的内容，把原文放回输入框 */
  const editFrom = useCallback(
    (index: number) => {
      if (busy) return
      const target = messages[index]
      if (!target || target.role !== 'user') return
      const base = messages.slice(0, index)
      setInput(target.content.split('\n\n[附件]')[0])
      setMessages(base)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), Math.max(base.length, 1)))
      persist(base)
    },
    [busy, messages, persist],
  )

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
          {shown.map((m, idx) => (
            <MessageRow
              key={m.id}
              msg={m}
              reasoningMode={settings.reasoningDisplay}
              isLastAssistant={idx === shown.length - 1 && m.role === 'assistant'}
              onRegenerate={() => void regenerate()}
              onEdit={() => editFrom(start + idx)}
            />
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
                  <div className="streaming-text streaming-md">
                    <Markdown text={streamMd || streamText} />
                  </div>
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
        safety={settings.safety}
        onSafetyChange={(v) => onSettingsChange({ safety: v })}
        attachments={attachments}
        onPickFiles={(f) => void pickFiles(f)}
        onRemoveAttachment={removeAttachment}
        placeholder={isEmpty ? '问点什么…' : '发消息…'}
      />
    </div>
  )
}

function cacheRate(u: NonNullable<Message['usage']>): string {
  const hit = u.cached || 0
  const total = hit + (u.prompt || 0)
  if (total <= 0) return '—'
  return `${Math.round((hit / total) * 100)}%`
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text)
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

function StatsInline({ msg }: { msg: Message }) {
  const dur =
    msg.meta?.endedAt && msg.meta?.startedAt
      ? fmtDuration(msg.meta.endedAt - msg.meta.startedAt)
      : ''
  const usage = msg.usage
  return (
    <span className="msg-stats">
      {dur && <span>{dur}</span>}
      {usage && (
        <>
          {dur && <span className="meta-sep">·</span>}
          <span>{fmtTokens((usage.prompt || 0) + (usage.cached || 0))} in</span>
          <span className="meta-sep">/</span>
          <span>{fmtTokens(usage.completion || 0)} out</span>
          <span className="meta-sep">·</span>
          <span>缓存 {cacheRate(usage)}</span>
        </>
      )}
    </span>
  )
}

function MessageRow({
  msg,
  reasoningMode,
  isLastAssistant,
  onRegenerate,
  onEdit,
}: {
  msg: Message
  reasoningMode: 'off' | 'web' | 'dsh'
  isLastAssistant?: boolean
  onRegenerate?: () => void
  onEdit?: () => void
}) {
  if (msg.role === 'user') {
    return (
      <div className="msg user">
        {msg.attachments?.some((a) => a.imageUrl) && (
          <div className="bubble-images">
            {msg.attachments
              .filter((a) => a.imageUrl)
              .map((a) => (
                <img key={a.id} src={a.imageUrl} alt={a.name} className="bubble-img" />
              ))}
          </div>
        )}
        <div className="bubble">{msg.content.split('\n\n[附件]')[0]}</div>
        {onEdit && (
          <div className="msg-actions left">
            <button className="msg-action" onClick={onEdit} title="编辑这条消息">
              编辑
            </button>
          </div>
        )}
      </div>
    )
  }

  const showReasoning = msg.reasoning && reasoningMode !== 'off'

  return (
    <div className={`msg assistant${msg.error ? ' error' : ''}`}>
      <div className="msg-head">
        {showReasoning ? (
          <Reasoning
            key={reasoningMode}
            reasoning={msg.reasoning!}
            mode={reasoningMode}
            durationMs={msg.reasoningMs}
            trailing={<StatsInline msg={msg} />}
          />
        ) : (
          <StatsInline msg={msg} />
        )}
      </div>

      <div className="msg-body">
        <Markdown text={msg.content} />

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

      <div className="msg-actions left">
        <button className="msg-action" onClick={() => copyText(msg.content)}>
          复制
        </button>
        {isLastAssistant && onRegenerate && (
          <button className="msg-action" onClick={onRegenerate}>
            重新生成
          </button>
        )}
      </div>
    </div>
  )
}
