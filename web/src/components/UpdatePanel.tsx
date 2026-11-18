import { useEffect, useRef, useState } from 'react'
import { APP_VERSION } from '../version'

interface Manifest {
  version?: string
  notes?: string | string[]
  url?: string
  size?: number
}

interface Props {
  updateUrl: string
  onUpdateUrlChange: (url: string) => void
}

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'latest' }
  | { kind: 'available'; manifest: Manifest }
  | { kind: 'downloading'; percent: number }
  | { kind: 'ready'; file: string }
  | { kind: 'error'; message: string }

/** 把 1.0.2 / Ver.01.00.2 / v1.0.2 统一成 [1,0,2] */
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

export default function UpdatePanel({ updateUrl, onUpdateUrlChange }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [open, setOpen] = useState(false)
  const offRef = useRef<null | (() => void)>(null)

  const bridge = window.chatbox
  const desktop = Boolean(bridge?.checkUpdate)

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

  return (
    <section className="card">
      <h3>软件更新</h3>
      <div className="update-row">
        <span className="update-current">当前版本 {APP_VERSION}</span>
        <button className="ghost" onClick={() => void check()} disabled={state.kind === 'checking'}>
          {state.kind === 'checking' ? '检查中…' : '检查更新'}
        </button>
      </div>

      <label className="field" style={{ marginTop: 10 }}>
        <span>更新信息地址</span>
        <input
          value={updateUrl}
          onChange={(e) => onUpdateUrlChange(e.target.value)}
          placeholder="https://你的域名/chatbox-pro/version.json"
        />
      </label>
      <p className="muted small">
        指向一个 JSON，包含 version、url、notes 三个字段。桌面端会在主进程里读取，不受跨域限制。
      </p>

      {state.kind === 'latest' && <p className="ok small">✓ 已经是最新版本</p>}
      {state.kind === 'error' && <p className="warn small">✕ {state.message}</p>}
      {state.kind === 'downloading' && (
        <div className="update-progress">
          <div className="update-bar">
            <div className="update-bar-fill" style={{ width: `${state.percent}%` }} />
          </div>
          <p className="muted small">正在下载更新… {state.percent}%</p>
        </div>
      )}
      {state.kind === 'ready' && (
        <p className="muted small">下载完成，正在关闭应用并安装，稍后会自动重启…</p>
      )}

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
    </section>
  )
}
