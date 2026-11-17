import type { SessionSummary } from '../db'

interface Props {
  sessions: SessionSummary[]
  onOpen: (id: string) => void
  onNew: (storage: 'local' | 'server') => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
  onExport: (id: string) => void
  serverReady: boolean
}

function when(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `${hh}:${mm}`
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`
}

export default function ListScreen({
  sessions,
  onOpen,
  onNew,
  onDelete,
  onOpenSettings,
  onExport,
  serverReady,
}: Props) {
  return (
    <div className="screen list-screen">
      <header className="topbar">
        <div className="topbar-title">
          <div className="title-line">ChatBox Pro</div>
          <div className="sub-line">手机 · 电脑 共用一套会话</div>
        </div>
        <button className="icon-btn" onClick={onOpenSettings} aria-label="设置">
          ⚙
        </button>
      </header>

      <div className="new-bar">
        <button className="primary" onClick={() => onNew('local')}>
          ＋ 新对话（仅本机）
        </button>
        <button
          className="ghost"
          onClick={() => onNew('server')}
          title={serverReady ? '存在服务器上，多端同步' : '服务器同步功能尚未接入'}
          disabled={!serverReady}
        >
          ＋ 新对话（同步）
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && (
          <div className="empty">
            <p>还没有对话。</p>
            <p className="muted">点上面的「新对话」开始。</p>
          </div>
        )}
        {sessions.map((s) => (
          <div key={s.id} className="session-item" onClick={() => onOpen(s.id)}>
            <div className="si-main">
              <div className="si-title">{s.title || '新对话'}</div>
              <div className="si-meta">
                <span className={`tag ${s.storage}`}>
                  {s.storage === 'local' ? '仅本机' : '同步'}
                </span>
                <span>{s.count} 条</span>
                <span>{when(s.updatedAt)}</span>
              </div>
            </div>
            <div className="si-actions" onClick={(e) => e.stopPropagation()}>
              <button className="mini" onClick={() => onExport(s.id)} title="导出">
                ⤓
              </button>
              <button
                className="mini danger"
                onClick={() => {
                  if (confirm(`删除「${s.title || '新对话'}」？本地删除后无法恢复。`)) onDelete(s.id)
                }}
                title="删除"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
