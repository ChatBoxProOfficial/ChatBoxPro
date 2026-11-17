import { useEffect } from 'react'
import type { SessionSummary } from '../db'

interface Props {
  open: boolean
  onClose: () => void
  sessions: SessionSummary[]
  currentId: string | null
  userName: string
  onNewConversation: () => void
  onOpenSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onOpenSettings: () => void
}

function when(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function Sidebar({
  open,
  onClose,
  sessions,
  currentId,
  userName,
  onNewConversation,
  onOpenSession,
  onDeleteSession,
  onOpenSettings,
}: Props) {
  // Esc 关掉抽屉
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const initial = (userName || '我').trim().slice(0, 1).toUpperCase()

  return (
    <>
      <div className={`drawer-mask${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' show' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <img className="drawer-logo" src="logo.png" alt="" />
          <div className="drawer-name">ChatBox Pro</div>
        </div>

        <button className="new-conv" onClick={onNewConversation}>
          <span className="plus">＋</span>
          建立一个新的对话
        </button>

        <div className="drawer-list">
          {sessions.length === 0 && <div className="drawer-empty">还没有对话</div>}
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`conv-item${s.id === currentId ? ' active' : ''}`}
              onClick={() => onOpenSession(s.id)}
            >
              <div className="conv-main">
                <div className="conv-title">{s.title || '新对话'}</div>
                <div className="conv-meta">
                  {s.count} 条 · {when(s.updatedAt)}
                </div>
              </div>
              <button
                className="conv-del"
                title="删除对话"
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm(`删除「${s.title || '新对话'}」？`)) onDeleteSession(s.id)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button className="drawer-foot" onClick={onOpenSettings}>
          <span className="avatar">{initial}</span>
          <span className="account">
            <span className="account-name">{userName || '我'}</span>
            <span className="account-sub">设置</span>
          </span>
          <span className="gear">⚙</span>
        </button>
      </aside>
    </>
  )
}
