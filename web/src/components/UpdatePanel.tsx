import { useEffect, useRef, useState } from 'react'
import { APP_VERSION } from '../version'
import type { Settings } from '../types'

interface Manifest {
  version?: string
  notes?: string | string[]
  url?: string
  size?: number
  history?: Array<{ version: string; date?: string; notes: string[] }>
}

type Patch = (p: Partial<Settings>) => void

interface Props {
  updateUrl: string
  onUpdateUrlChange: (url: string) => void
  lastCheck: number
  snoozeUntil: number
  history: Array<{ version: string; date?: string; notes: string[] }>
  patch: Patch
}

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'available'; manifest: Manifest }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; file: string }
  | { kind: 'error'; message: string }

const DAY = 24 * 60 * 60 * 1000

function parseVersion(v: string): number[] {
  const nums = String(v).match(/\d+/g)
  return nums ? nums.map((n) => Number(n)) : []
}

function isNewer(remote: string, local: string): boolean {
  const a = parseVersion(remote)
  const b = parseVersion(local)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

function fmtTime(ts: number): string {
  if (!ts) return '还没有检查过'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

function fmtDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* ------------------------------- 图标 ------------------------------- */
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
  </svg>
)

const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 2.5 2.5L16 9" />
  </svg>
)

const IconUp = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16V8M8.5 11.5 12 8l3.5 3.5" />
  </svg>
)

const IconPause = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 9v6M14 9v6" />
  </svg>
)

const IconHistory = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V10h5.5" />
    <path d="M12 8v4.5l3 1.8" />
  </svg>
)

const IconFeedback = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z" />
    <path d="M12 9v.01M12 12v4" />
  </svg>
)

export default function UpdatePanel({
  updateUrl,
  onUpdateUrlChange,
  lastCheck,
  snoozeUntil,
  history,
  patch,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [open, setOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const offRef = useRef<null | (() => void)>(null)

  const bridge = window.chatbox
  const desktop = Boolean(bridge?.checkUpdate)
  const snoozed = snoozeUntil > Date.now()

  useEffect(() => {
    if (!bridge?.onUpdateProgress) return
    offRef.current = bridge.onUpdateProgress((p) => {
      setState({ kind: 'downloading', percent: p.percent })
    })
    return () => offRef.current?.()
  }, [bridge])

  const check = async () => {
    const url = updateUrl.trim()
    if (!url) {
      setState({ kind: 'error', message: '先在下面填写更新信息地址' })
      return
    }
    if (!desktop) {
      setState({ kind: 'error', message: '检查更新只在桌面端可用（浏览器环境请手动下载）' })
      return
    }
    setState({ kind: 'checking' })
    const res = await bridge!.checkUpdate!(url)
    const manifest0 = (res?.manifest || {}) as Manifest
    patch({
      updateLastCheck: Date.now(),
      ...(Array.isArray(manifest0.history) && manifest0.history.length
        ? { updateHistory: manifest0.history.slice(0, 20) }
        : {}),
    })
    if (!res?.ok) {
      setState({ kind: 'error', message: res?.error || '获取版本信息失败' })
      return
    }
    const manifest = (res.manifest || {}) as Manifest
    if (!manifest.version || !manifest.url) {
      setState({ kind: 'error', message: '版本信息格式不对（需要 version 和 url）' })
      return
    }
    if (isNewer(manifest.version, APP_VERSION)) {
      setState({ kind: 'available', manifest })
      setOpen(true)
    } else {
      setState({ kind: 'latest' })
    }
  }

  // 打开这一页就自动检查一次（暂停期间跳过）
  useEffect(() => {
    if (snoozed) return
    if (!updateUrl.trim()) return
    if (!desktop) return
    void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startUpdate = async (manifest: Manifest) => {
    if (!desktop || !manifest.url) return
    setState({ kind: 'downloading', percent: 0 })
    const dl = await bridge!.downloadUpdate!(manifest.url)
    if (!dl?.ok || !dl.file) {
      setState({ kind: 'error', message: dl?.error || '下载失败' })
      return
    }
    setState({ kind: 'ready', file: dl.file })
    const applied = await bridge!.applyUpdate!(dl.file)
    if (!applied?.ok) {
      setState({ kind: 'error', message: applied?.error || '启动更新失败' })
    }
  }

  const notes = (() => {
    if (state.kind !== 'available') return []
    const n = state.manifest.notes
    if (!n) return []
    return Array.isArray(n) ? n : [n]
  })()

  const statusIcon = state.kind === 'latest' ? <IconCheck /> : <IconUp />
  const statusClass =
    state.kind === 'latest' ? 'ok' : state.kind === 'available' ? 'has-update' : 'idle'

  return (
    <>
      <section className="card">
        <h3>更新</h3>

        <div className={`update-status ${statusClass}`}>
          <span className="update-status-icon">
            {state.kind === 'checking' ? <IconRefresh /> : statusIcon}
          </span>
          <span className="update-status-text">
            <span className="update-status-title">
              {state.kind === 'checking' && '正在检查更新…'}
              {state.kind === 'latest' && '你使用的是最新版本'}
              {state.kind === 'available' && `我们发现了更新的版本 ${state.manifest.version}`}
              {(state.kind === 'idle' || state.kind === 'error') && '尚未检查更新'}
              {state.kind === 'downloading' && '正在下载更新…'}
              {state.kind === 'ready' && '正在安装更新…'}
            </span>
            <span className="update-status-sub">
              上次检查：{fmtTime(lastCheck)}
              {snoozed && ` · 已暂停更新至 ${fmtDate(snoozeUntil)}`}
            </span>
          </span>
        </div>

        {state.kind === 'error' && <p className="warn small">✕ {state.message}</p>}

        {state.kind === 'downloading' && (
          <div className="update-progress">
            <div className="update-bar">
              <div className="update-bar-fill" style={{ width: `${state.percent}%` }} />
            </div>
            <p className="muted small">{state.percent}%</p>
          </div>
        )}

        <div className="update-actions">
          <button className="ghost icon-btn-text" onClick={() => void check()} disabled={state.kind === 'checking'}>
            <IconRefresh />
            检查更新
          </button>
          {state.kind === 'available' && (
            <button className="primary icon-btn-text" onClick={() => void startUpdate(state.manifest)}>
              <IconUp />
              立即更新
            </button>
          )}
        </div>

        <div className="update-links">
          <button
            className="update-link"
            onClick={() => {
              if (snoozed) {
                patch({ updateSnoozeUntil: 0 })
              } else {
                patch({ updateSnoozeUntil: Date.now() + 7 * DAY })
              }
            }}
          >
            <IconPause />
            {snoozed ? '恢复更新提醒' : '暂停更新 7 天'}
          </button>

          <button className="update-link" onClick={() => setHistoryOpen(true)}>
            <IconHistory />
            查看更新历史记录
          </button>

          <button className="update-link" onClick={() => setFeedbackOpen(true)}>
            <IconFeedback />
            对产品更新有疑议
          </button>
        </div>

        <label className="field" style={{ marginTop: 12 }}>
          <span>更新信息地址</span>
          <input
            value={updateUrl}
            onChange={(e) => onUpdateUrlChange(e.target.value)}
            placeholder="https://你的域名/chatbox-pro/version.json"
          />
        </label>
        <p className="muted small">
          指向一个 JSON，包含 version、url、notes（可选 history）。桌面端在主进程里读取，不受跨域限制。
        </p>
      </section>

      {/* 更新报告 */}
      {open && state.kind === 'available' && (
        <div className="modal-mask" onClick={() => setOpen(false)}>
          <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-head">
              <span>发现新版本 {state.manifest.version}</span>
              <button className="settings-close" onClick={() => setOpen(false)} aria-label="关闭">
                ✕
              </button>
            </div>
            <div className="doc-body">
              <p className="doc-meta">
                当前版本 {APP_VERSION} → 新版本 {state.manifest.version}
              </p>
              <div className="doc-section">
                <h4>更新内容</h4>
                {notes.length ? (
                  notes.map((n, i) => <p key={i}>· {n}</p>)
                ) : (
                  <p className="muted">（这个版本没有提供更新说明）</p>
                )}
              </div>
              <p className="warn small">
                更新会关闭当前应用、下载新版本并覆盖安装。会话与设置保存在用户目录，不会被删除。
              </p>
            </div>
            <div className="doc-foot">
              <button className="ghost" onClick={() => setOpen(false)}>
                稍后
              </button>
              <button className="primary" onClick={() => void startUpdate(state.manifest)}>
                立即更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 更新历史 */}
      {historyOpen && (
        <div className="modal-mask" onClick={() => setHistoryOpen(false)}>
          <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-head">
              <span>更新历史记录</span>
              <button className="settings-close" onClick={() => setHistoryOpen(false)} aria-label="关闭">
                ✕
              </button>
            </div>
            <div className="doc-body">
              <p className="doc-meta">当前版本 {APP_VERSION}</p>
              {history.length === 0 ? (
                <p className="muted">还没有记录。检查到新版本后，这里会显示历史更新。</p>
              ) : (
                history.map((h, i) => (
                  <div key={`${h.version}-${i}`} className="doc-section">
                    <h4>
                      {h.version}
                      {h.date ? ` · ${h.date}` : ''}
                    </h4>
                    {h.notes.map((n, j) => (
                      <p key={j}>· {n}</p>
                    ))}
                  </div>
                ))
              )}
            </div>
            <div className="doc-foot">
              <button className="ghost" onClick={() => setHistoryOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 反馈疑议 */}
      {feedbackOpen && (
        <div className="modal-mask" onClick={() => setFeedbackOpen(false)}>
          <div className="doc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="doc-head">
              <span>对产品更新有疑议</span>
              <button className="settings-close" onClick={() => setFeedbackOpen(false)} aria-label="关闭">
                ✕
              </button>
            </div>
            <div className="doc-body">
              <div className="doc-section">
                <h4>你可以这样做</h4>
                <p>· 先看「查看更新历史记录」，确认这次改了什么。</p>
                <p>· 想留在旧版本：点「暂停更新 7 天」，期间打开更新页不会自动检查。</p>
                <p>· 更新后出现异常：在「上下文管理 → 导出全部历史对话」备份数据，再反馈问题。</p>
                <p>· 反馈渠道：把问题与版本号（{APP_VERSION}）一起发到下面的邮箱。</p>
                <p>
                  ·{' '}
                  <a className="mail-link" href="mailto:power_of_authority@163.com">
                    power_of_authority@163.com
                  </a>
                </p>
              </div>
              <p className="muted small">
                更新包只会覆盖程序文件，不会改动你的会话与设置。
              </p>
            </div>
            <div className="doc-foot">
              <button className="ghost" onClick={() => setFeedbackOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
