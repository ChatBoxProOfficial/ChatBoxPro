import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { streamChat } from '../api'
import { Markdown } from './Markdown'
import type { Message, Session, Settings } from '../types'
import { newId } from '../types'

interface Props {
  session: Session
  settings: Settings
  onPersist: (s: Session) => void
  onBack: () => void
  onOpenSettings: () => void
  onExport: (s: Session) => void
}

const INITIAL_WINDOW = 30

export default function ChatScreen({
  session,
  settings,
  onPersist,
  onBack,
  onOpenSettings,
  onExport,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(session.messages)
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_WINDOW, Math.max(session.messages.length, 1)),
  )
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [atBottom, setAtBottom] = useState(true)

  const accRef = useRef('')
  const reasonRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

  // 每一条发生变化的会话都写回存储
  const persist = useCallback(
    (msgs: Message[], extra?: Partial<Session>) => {
      const base = sessionRef.current
      const firstUser = msgs.find((m) => m.role === 'user' && m.content.trim())
      const title =
        base.title && base.title !== '新对话'
          ? base.title
          : firstUser
            ? firstUser.content.trim().slice(0, 24)
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

  /** 把流式增量按帧合批，避免每个 token 触发一次 React 渲染 */
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
    // 仅在消息数量变化时跟随
  }, [messages.length, streamText.length, atBottom, scrollToBottom])

  const onScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setAtBottom(near)
    if (el.scrollTop < 40 && visibleCount < messages.length) {
      // 顶部回补历史
      const next = Math.min(visibleCount + 30, messages.length)
      const prevHeight = el.scrollHeight
      setVisibleCount(next)
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight + el.scrollTop
      })
    }
  }, [visibleCount, messages.length])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    const userMsg: Message = {
      id: newId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    }
    const next = [...messages, userMsg]
    setMessages(next)
    setVisibleCount((c) => Math.min(Math.max(c + 1, 1), next.length))
    setAtBottom(true)
    setBusy(true)
    accRef.current = ''
    reasonRef.current = ''
    setStreamText('')
    setReasonText('')
    persist(next)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    let failed = ''

    await streamChat(
      next,
      { ...settings },
      {
        onDelta: (chunk, kind) => {
          if (kind === 'content') accRef.current += chunk
          else reasonRef.current += chunk
          scheduleFlush()
        },
        onDone: () => {},
        onError: (msg) => {
          failed = msg
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
    accRef.current = ''
    reasonRef.current = ''
    setStreamText('')
    setReasonText('')
    setBusy(false)
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
          model: settings.model,
        }

    if (reasons && !failed) {
      assistant.content = `> 思考过程\n\n${reasons
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')}\n\n${acc}`
    }

    const withReply = [...next, assistant]
    setMessages(withReply)
    setVisibleCount((c) => Math.min(Math.max(c + 1, 1), withReply.length))
    setAtBottom(true)
    persist(withReply)
  }, [input, busy, messages, settings, persist, scheduleFlush])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setBusy(false)
  }, [])

  const start = Math.max(0, messages.length - visibleCount)
  const shown = messages.slice(start)

  return (
    <div className="screen chat-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          ←
        </button>
        <div className="topbar-title">
          <div className="title-line">{session.title}</div>
          <div className="sub-line">
            {session.storage === 'local' ? '仅本机' : '云端同步'} · {settings.model}
          </div>
        </div>
        <button className="icon-btn" onClick={() => onExport(sessionRef.current)} aria-label="导出">
          ⤓
        </button>
        <button className="icon-btn" onClick={onOpenSettings} aria-label="设置">
          ⚙
        </button>
      </header>

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
          <MessageRow key={m.id} msg={m} />
        ))}

        {(busy || streamText || reasonText) && (
          <div className="msg assistant">
            <div className="msg-role">DeepSeek</div>
            <div className="msg-body">
              {reasonText && <pre className="reasoning">{reasonText}</pre>}
              {streamText ? (
                <div className="streaming-text">{streamText}</div>
              ) : (
                !reasonText && <span className="cursor">▍</span>
              )}
            </div>
          </div>
        )}
      </div>

      {!atBottom && (
        <button className="to-bottom" onClick={() => { setAtBottom(true); scrollToBottom(true) }}>
          ↓ 回到最新
        </button>
      )}

      <div className="composer">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void send()
            }
          }}
          placeholder="发消息…（Enter 发送，Shift+Enter 换行）"
          rows={1}
        />
        {busy ? (
          <button className="send stop" onClick={stop}>
            停止
          </button>
        ) : (
          <button className="send" onClick={() => void send()} disabled={!input.trim()}>
            发送
          </button>
        )}
      </div>
    </div>
  )
}

function MessageRow({ msg }: { msg: Message }) {
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
        <Markdown text={msg.content} />
      </div>
    </div>
  )
}
