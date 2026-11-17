import { useEffect, useState } from 'react'
import { clearApiKey, loadApiKey, maskKey, saveApiKey } from '../secureStore'
import { MODELS, type Settings } from '../types'

interface Props {
  settings: Settings
  onSave: (s: Settings) => void
  onBack: () => void
  onWipe: () => void
}

export default function SettingsScreen({ settings, onSave, onBack, onWipe }: Props) {
  const [draft, setDraft] = useState<Settings>(settings)
  const [key, setKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [showTip, setShowTip] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void loadApiKey().then((k) => {
      setKey(k)
      setHasKey(!!k)
    })
  }, [])

  async function handleSaveKey() {
    const v = keyInput.trim()
    if (!v) return
    await saveApiKey(v)
    setKey(v)
    setHasKey(true)
    setKeyInput('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleClearKey() {
    if (!confirm('清除这台设备上保存的 API Key？')) return
    await clearApiKey()
    setKey('')
    setHasKey(false)
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
        <section className="card">
          <h3>API Key</h3>
          <p className="muted small">
            用你自己的 DeepSeek API Key。Key 只加密保存在这台设备上，请求经你的服务器中转，
            服务器不记录、不落盘。
          </p>
          {hasKey ? (
            <div className="key-row">
              <code>{maskKey(key)}</code>
              <button className="mini danger" onClick={() => void handleClearKey()}>
                清除
              </button>
            </div>
          ) : (
            <p className="warn small">还没有填写 Key，无法发送消息。</p>
          )}
          <div className="row">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
            />
            <button className="primary" onClick={() => void handleSaveKey()} disabled={!keyInput.trim()}>
              保存
            </button>
          </div>
          {saved && <p className="ok small">已加密保存 ✓</p>}
        </section>

        <section className="card">
          <h3>对话</h3>
          <label className="field">
            <span>模型</span>
            <select
              value={draft.model}
              onChange={(e) => setDraft({ ...draft, model: e.target.value })}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>温度 {draft.temperature.toFixed(1)}</span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={draft.temperature}
              onChange={(e) => setDraft({ ...draft, temperature: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>系统提示词（可选）</span>
            <textarea
              rows={3}
              value={draft.systemPrompt}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              placeholder="例如：回答尽量简洁"
            />
          </label>
        </section>

        <section className="card">
          <h3>账号</h3>
          <p className="muted small">只用于侧边栏底部显示，不上传服务器。</p>
          <label className="field">
            <span>显示名称</span>
            <input
              value={draft.userName}
              onChange={(e) => setDraft({ ...draft, userName: e.target.value })}
              placeholder="我"
            />
          </label>
        </section>

        <section className="card">
          <h3>数据</h3>
          <p className="muted small">
            「仅本机」的会话只保存在这台设备的浏览器数据库里，换设备、清除数据都会丢失。
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

        <section className="card">
          <h3>投喂作者</h3>
          <p className="muted small">
            ChatBox Pro 免费使用，不提供任何付费功能。如果它帮到了你，可以自愿投喂一点，
            帮作者分担点电费；不投喂也不影响任何功能。
          </p>
          <button className="ghost" onClick={() => setShowTip(true)}>
            支持一下
          </button>
        </section>

        <section className="card">
          <h3>关于</h3>
          <p className="muted small">
            ChatBox Pro · v0.1.0
            <br />
            当前为「仅本机」模式：会话不离开设备。服务器同步与对话导出到 DSH 仍在开发中。
          </p>
        </section>
      </div>

      <div className="sticky-save">
        <button
          className="primary wide"
          onClick={() => {
            onSave(draft)
            setSaved(true)
            setTimeout(() => setSaved(false), 1500)
          }}
        >
          保存设置
        </button>
      </div>

      {showTip && <TipDialog onClose={() => setShowTip(false)} />}
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
          <img
            className="qr"
            src="tip-qr.png"
            alt="收款二维码"
            onError={() => setImgOk(false)}
          />
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
