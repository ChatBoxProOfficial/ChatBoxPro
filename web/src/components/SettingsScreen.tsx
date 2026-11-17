import { useEffect, useState } from 'react'
import { clearApiKey, loadApiKey, maskKey, saveApiKey } from '../secureStore'
import { MODELS, modelLabel, type Settings } from '../types'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  onBack: () => void
  onWipe: () => void
}

declare global {
  interface Window {
    chatbox?: {
      openFolder?: (p: string) => Promise<string>
      paths?: () => Promise<{ inbox: string; userData: string }>
    }
  }
}

export default function SettingsScreen({ settings, onChange, onBack, onWipe }: Props) {
  const [key, setKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [editingKey, setEditingKey] = useState(false)
  const [savedFlag, setSavedFlag] = useState('')
  const [tipOpen, setTipOpen] = useState(false)
  const [inbox, setInbox] = useState('')
  const [dshState, setDshState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [dshMsg, setDshMsg] = useState('')
  const [newModel, setNewModel] = useState('')

  const patch = (p: Partial<Settings>) => onChange({ ...settings, ...p })

  useEffect(() => {
    void loadApiKey().then(setKey)
    void (async () => {
      try {
        const r = await fetch('/api/paths')
        if (r.ok) {
          const j = await r.json()
          setInbox(j.inbox || '')
        }
      } catch {
        /* 拿不到就不显示路径 */
      }
    })()
  }, [])

  const flash = (msg: string) => {
    setSavedFlag(msg)
    setTimeout(() => setSavedFlag(''), 1600)
  }

  async function saveKey() {
    const v = keyInput.trim()
    if (!v) return
    await saveApiKey(v)
    setKey(v)
    setKeyInput('')
    setEditingKey(false)
    flash('已加密保存')
  }

  async function testDsh() {
    const url = settings.dshUrl.trim()
    if (!url) return
    setDshState('testing')
    setDshMsg('')
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      const r = await fetch(url, { mode: 'no-cors', signal: ctrl.signal })
      clearTimeout(t)
      setDshState('ok')
      setDshMsg(r ? '地址可达' : '地址可达')
    } catch {
      setDshState('fail')
      setDshMsg('连不上，检查地址与网络')
    }
  }

  const allModels = [...MODELS.map((m) => m.id), ...settings.extraModels]
  const modelOptions = Array.from(new Set(allModels))

  const toggleModel = (id: string) => {
    const on = settings.enabledModels.includes(id)
    const next = on
      ? settings.enabledModels.filter((m) => m !== id)
      : [...settings.enabledModels, id]
    if (next.length === 0) return // 至少留一个
    const p: Partial<Settings> = { enabledModels: next }
    if (!next.includes(settings.model)) p.model = next[0]
    patch(p)
  }

  return (
    <div className="screen settings-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          ←
        </button>
        <div className="topbar-title">
          <div className="title-line">设置</div>
        </div>
      </header>

      <div className="settings-body">
        {/* 1. 账号与模型 */}
        <section className="card">
          <h3>ChatBox Pro 账号与模型</h3>

          <label className="field">
            <span>显示名称</span>
            <input
              value={settings.userName}
              onChange={(e) => patch({ userName: e.target.value })}
              placeholder="我"
            />
          </label>

          <div className="field">
            <span>DeepSeek API Key</span>
            {key && !editingKey ? (
              <div className="key-row">
                <code>{maskKey(key)}</code>
                <button className="mini" onClick={() => setEditingKey(true)}>
                  更换
                </button>
                <button
                  className="mini danger"
                  onClick={async () => {
                    if (!confirm('清除这台设备上的 API Key？')) return
                    await clearApiKey()
                    setKey('')
                    flash('已清除')
                  }}
                >
                  清除
                </button>
              </div>
            ) : (
              <div className="row">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                />
                <button className="primary" onClick={() => void saveKey()} disabled={!keyInput.trim()}>
                  保存
                </button>
              </div>
            )}
            <p className="muted small">
              只加密保存在这台设备上，请求经你的服务器中转，服务器不记录、不落盘。
            </p>
          </div>

          <label className="field">
            <span>默认模型</span>
            <select value={settings.model} onChange={(e) => patch({ model: e.target.value })}>
              {settings.enabledModels.map((id) => (
                <option key={id} value={id}>
                  {modelLabel(id)}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>温度 {settings.temperature.toFixed(1)}</span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={settings.temperature}
              onChange={(e) => patch({ temperature: Number(e.target.value) })}
            />
          </label>
        </section>

        {/* 2. 个性化 */}
        <section className="card">
          <h3>个性化</h3>
          <label className="switch-row">
            <span>紧凑模式</span>
            <input
              type="checkbox"
              checked={settings.compact}
              onChange={(e) => patch({ compact: e.target.checked })}
            />
          </label>
          <p className="muted small">更小的字号与行距，一屏能看更多内容。</p>
          <label className="field">
            <span>系统提示词</span>
            <textarea
              rows={3}
              value={settings.systemPrompt}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
              placeholder="例如：回答尽量简洁"
            />
          </label>
        </section>

        {/* 3. 插件 */}
        <section className="card">
          <h3>插件</h3>
          <p className="muted small">
            ChatBox Pro 之后会支持插件（主题、快捷指令、会话导入导出等）。
            现在还没有可安装的插件。
          </p>
          <div className="empty-slot">暂无插件</div>
        </section>

        {/* 4. 管理模型 */}
        <section className="card">
          <h3>管理模型</h3>
          <p className="muted small">勾选要出现在模型菜单里的模型（至少保留一个）。</p>
          <div className="model-list">
            {modelOptions.map((id) => (
              <label key={id} className="switch-row">
                <span>{modelLabel(id)}</span>
                <input
                  type="checkbox"
                  checked={settings.enabledModels.includes(id)}
                  onChange={() => toggleModel(id)}
                />
              </label>
            ))}
          </div>
          <div className="row">
            <input
              value={newModel}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="自定义模型 id，例如 deepseek-chat-v2"
            />
            <button
              className="ghost"
              disabled={!newModel.trim()}
              onClick={() => {
                const id = newModel.trim()
                if (!id) return
                patch({
                  extraModels: Array.from(new Set([...settings.extraModels, id])),
                  enabledModels: Array.from(new Set([...settings.enabledModels, id])),
                })
                setNewModel('')
              }}
            >
              添加
            </button>
          </div>
        </section>

        {/* 5. 上下文管理 */}
        <section className="card">
          <h3>上下文管理</h3>
          <label className="field">
            <span>每次发送携带的最近消息条数（0 = 全部）</span>
            <input
              type="number"
              min={0}
              max={200}
              value={settings.contextLimit}
              onChange={(e) => patch({ contextLimit: Math.max(0, Number(e.target.value) || 0) })}
            />
          </label>
          <p className="muted small">
            会话越长，发给模型的 token 越多。限制条数能省钱，也能减少卡顿。
          </p>
          <button
            className="danger"
            onClick={() => {
              if (confirm('删除这台设备上的全部会话？此操作无法撤销。')) onWipe()
            }}
          >
            删除本机全部会话
          </button>
        </section>

        {/* 6. 连接 DeepSeek Harness */}
        <section className="card">
          <h3>让 ChatBox Pro 连接到 DeepSeek Harness</h3>
          <p className="muted small">
            填入运行 dsh 的机器地址（例如 http://192.168.1.48:3081）。接入后可以用 DSH 的会话、
            文件与工具能力。
          </p>
          <div className="row">
            <input
              value={settings.dshUrl}
              onChange={(e) => {
                patch({ dshUrl: e.target.value })
                setDshState('idle')
                setDshMsg('')
              }}
              placeholder="http://192.168.1.48:3081"
            />
            <button className="ghost" onClick={() => void testDsh()} disabled={!settings.dshUrl.trim()}>
              {dshState === 'testing' ? '测试中…' : '测试连接'}
            </button>
          </div>
          {dshMsg && (
            <p className={`small ${dshState === 'ok' ? 'ok' : 'warn'}`}>
              {dshState === 'ok' ? '✓ ' : '✕ '}
              {dshMsg}
            </p>
          )}
          <p className="muted small">深度对接（会话同步、文件进工作区）仍在开发中。</p>
        </section>

        {/* 7. 保存路径 */}
        <section className="card">
          <h3>管理模型保存路径</h3>
          <p className="muted small">上传的附件和导出的对话会放在这里：</p>
          <div className="path-box">
            <code>{inbox || '（还没取到路径）'}</code>
          </div>
          <div className="row">
            <button
              className="ghost"
              disabled={!inbox}
              onClick={() => {
                if (inbox) void navigator.clipboard?.writeText(inbox)
                flash('路径已复制')
              }}
            >
              复制路径
            </button>
            <button
              className="ghost"
              disabled={!inbox || !window.chatbox?.openFolder}
              onClick={() => window.chatbox?.openFolder?.(inbox)}
            >
              打开文件夹
            </button>
          </div>
          <p className="muted small">「打开文件夹」只在桌面端可用。</p>
        </section>

        {/* 8. 关于 */}
        <section className="card">
          <h3>关于 ChatBox Pro</h3>
          <p className="muted small">
            版本 0.2.0 · 本机模式（会话不离开设备）
            <br />
            手机 / 电脑共用一套服务器，自己填自己的 API Key。
          </p>
          <button className="ghost wide" onClick={() => setTipOpen(true)}>
            投喂作者
          </button>
          <p className="muted small" style={{ marginTop: 8 }}>
            自愿支持，不影响任何功能。
          </p>
        </section>
      </div>

      {savedFlag && <div className="toast">{savedFlag}</div>}
      {tipOpen && <TipDialog onClose={() => setTipOpen(false)} />}
    </div>
  )
}

function TipDialog({ onClose }: { onClose: () => void }) {
  const [imgOk, setImgOk] = useState(true)
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>投喂作者</h3>
        <p className="muted small">自愿支持，不影响任何功能。谢谢！</p>
        {imgOk ? (
          <img className="qr" src="tip-qr.png" alt="收款二维码" onError={() => setImgOk(false)} />
        ) : (
          <div className="qr placeholder">收款二维码待添加</div>
        )}
        <button className="ghost wide" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
