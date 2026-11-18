import { useEffect, useMemo, useState } from 'react'
import { db, type SessionSummary } from '../db'
import type { Session } from '../types'
import { useT } from '../i18n'
import { confirmDialog } from './Confirm'

interface Props {
  open: boolean
  onClose: () => void
  sessions: SessionSummary[]
  currentSession: Session | null
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
  currentSession,
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

  const t = useT()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<Array<{ id: string; title: string; snippet: string }>>([])
  const [searching, setSearching] = useState(false)

  // 搜索历史对话（标题 + 消息正文）
  useEffect(() => {
    const query = q.trim()
    if (!query) {
      setHits([])
      return
    }
    let alive = true
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const result: Array<{ id: string; title: string; snippet: string }> = []
        const list = await db.listSessions()
        for (const item of list.slice(0, 200)) {
          if (item.title.includes(query)) {
            result.push({ id: item.id, title: item.title, snippet: '（标题匹配）' })
          }
          const full = (await db.getSession(item.id)) as Session | undefined
          const msgs = full?.messages || []
          for (const m of msgs) {
            const idx = m.content.indexOf(query)
            if (idx >= 0) {
              const start = Math.max(0, idx - 20)
              result.push({
                id: item.id,
                title: item.title || '新对话',
                snippet: `…${m.content.slice(start, start + 60)}…`,
              })
              break
            }
          }
          if (result.length >= 40) break
        }
        if (alive) setHits(result)
      } finally {
        if (alive) setSearching(false)
      }
    }, 200)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [q])

  const initial = (userName || '我').trim().slice(0, 1).toUpperCase()

  // 当前会话简报：轮数 / 缓存命中率 / 上下文占用
  const brief = useMemo(() => {
    const msgs = currentSession?.messages || []
    const rounds = msgs.filter((m) => m.role === 'user').length

    let hit = 0
    let miss = 0
    let lastCtx = 0
    for (const m of msgs) {
      if (!m.usage) continue
      hit += m.usage.cached || 0
      miss += m.usage.prompt || 0
      if ((m.usage.cached || 0) + (m.usage.prompt || 0) > 0) {
        lastCtx = (m.usage.cached || 0) + (m.usage.prompt || 0)
      }
    }
    const total = hit + miss
    return {
      rounds,
      hitRate: total > 0 ? Math.round((hit / total) * 100) : null,
      ctxPct: lastCtx > 0 ? (lastCtx / 1_000_000) * 100 : null,
    }
  }, [currentSession])

  return (
    <>
      <div className={`drawer-mask${open ? ' show' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' show' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <img className="drawer-logo" src="logo.png" alt="" />
          <div className="drawer-name">ChatBox Pro</div>
        </div>

        {currentSession && (
          <div className="side-brief">
            <div className="brief-item">
              <span className="brief-value">{brief.rounds}</span>
              <span className="brief-label">轮数</span>
            </div>
            <div className="brief-item">
              <span className="brief-value">
                {brief.hitRate === null ? '—' : `${brief.hitRate}%`}
              </span>
              <span className="brief-label">缓存命中</span>
            </div>
            <div className="brief-item">
              <span className="brief-value">
                {brief.ctxPct === null ? '—' : `${brief.ctxPct.toFixed(1)}%`}
              </span>
              <span className="brief-label">上下文</span>
            </div>
          </div>
        )}

        <button className="new-conv" onClick={onNewConversation}>
          <span className="plus">＋</span>
          {t('side.new', '建立一个新的对话')}
        </button>

        <div className="side-search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('side.search', '搜索历史对话')}
          />
          {q && (
            <button className="side-search-clear" onClick={() => setQ('')} title="清除">
              ✕
            </button>
          )}
        </div>

        {q.trim() ? (
          <div className="drawer-list">
            {searching && hits.length === 0 && <div className="drawer-empty">搜索中…</div>}
            {!searching && hits.length === 0 && (
              <div className="drawer-empty">{t('side.empty', '没有匹配的对话')}</div>
            )}
            {hits.map((h, i) => (
              <div
                key={`${h.id}-${i}`}
                className="conv-item search-hit"
                onClick={() => {
                  onOpenSession(h.id)
                  setQ('')
                }}
              >
                <div className="conv-main">
                  <div className="conv-title">{h.title}</div>
                  <div className="conv-meta">{h.snippet}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
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
                onClick={async (e) => {
                  e.stopPropagation()
                  const ok = await confirmDialog({
                    title: '删除对话',
                    message: `「${s.title || '新对话'}」将被永久删除，无法恢复。`,
                    confirmText: '删除',
                    danger: true,
                  })
                  if (ok) onDeleteSession(s.id)
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        )}

        <button className="drawer-foot" onClick={onOpenSettings}>
          <span className="avatar">{initial}</span>
          <span className="account">
            <span className="account-name">{userName || '我'}</span>
            <span className="account-sub">{t('side.settings', '设置')}</span>
          </span>
          <span className="gear">⚙</span>
        </button>
      </aside>
    </>
  )
}
