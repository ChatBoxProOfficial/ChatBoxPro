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

type SectionId =
  | 'account'
  | 'personalize'
  | 'plugins'
  | 'models'
  | 'context'
  | 'dsh'
  | 'paths'
  | 'about'

const SECTIONS: Array<{ id: SectionId; title: string; desc: string }> = [
  { id: 'account', title: 'ChatBox Pro 账号与模型', desc: 'API Key、默认模型、温度' },
  { id: 'personalize', title: '个性化', desc: '紧凑模式、系统提示词' },
  { id: 'plugins', title: '插件', desc: '扩展功能' },
  { id: 'models', title: '管理模型', desc: '启用哪些模型、自定义模型' },
  { id: 'context', title: '上下文管理', desc: '历史条数、清空本机会话' },
  { id: 'dsh', title: '让 ChatBox Pro 连接到 DeepSeek Harness', desc: '服务器地址与连接测试' },
  { id: 'paths', title: '管理模型保存路径', desc: '附件与导出的存放位置' },
  { id: 'about', title: '关于 ChatBox Pro', desc: '版本、投喂作者' },
]

export default function SettingsScreen({ settings, onChange, onBack, onWipe }: Props) {
  const [section, setSection] = useState<SectionId | null>(null)
  const [tipOpen, setTipOpen] = useState(false)
  const [toast, setToast] = useState('')

  const patch = (p: Partial<Settings>) => onChange({ ...settings, ...p })
  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 1600)
  }

  const current = section ? SECTIONS.find((s) => s.id === section) : null

  return (
    <div className="screen settings-screen">
      <header className="topbar">
        <button
          className="icon-btn"
          onClick={() => (section ? setSection(null) : onBack())}
          aria-label="返回"
        >
          ←
        </button>
        <div className="topbar-title">
          <div className="title-line">{current ? current.title : '设置'}</div>
        </div>
      </header>

      <div className="settings-body">
        {!section && (
          <div className="settings-index">
            {SECTIONS.map((s) => (
              <button key={s.id} className="index-row" onClick={() => setSection(s.id)}>
                <span className="index-main">
                  <span className="index-title">{s.title}</span>
                  <span className="index-desc">{s.desc}</span>
                </span>
                <span className="index-chev">›</span>
              </button>
            ))}
          </div>
        )}

        {section === 'account' && <AccountSection settings={settings} patch={patch} flash={flash} />}
        {section === 'personalize' && <PersonalizeSection settings={settings} patch={patch} />}
        {section === 'plugins' && <PluginsSection />}
        {section === 'models' && <ModelsSection settings={settings} patch={patch} flash={flash} />}
        {section === 'context' && (
          <ContextSection settings={settings} patch={patch} onWipe={onWipe} />
        )}
        {section === 'dsh' && <DshSection settings={settings} patch={patch} />}
        {section === 'paths' && <PathsSection flash={flash} />}
        {section === 'about' && <AboutSection onTip={() => setTipOpen(true)} />}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {tipOpen && <TipDialog onClose={() => setTipOpen(false)} />}
    </div>
  )
}

/* ------------------------------- 各板块 ------------------------------- */

type Patch = (p: Partial<Settings>) => void

function AccountSection({
  settings,
  patch,
  flash,
}: {
  settings: Settings
  patch: Patch
  flash: (s: string) => void
}) {
  const [key, setKey] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    void loadApiKey().then(setKey)
  }, [])

  async function save() {
    const v = keyInput.trim()
    if (!v) return
    await saveApiKey(v)
    setKey(v)
    setKeyInput('')
    setEditing(false)
    flash('已加密保存')
  }

  return (
    <>
      <section className="card">
        <h3>账号</h3>
        <label className="field">
          <span>显示名称</span>
          <input
            value={settings.userName}
            onChange={(e) => patch({ userName: e.target.value })}
            placeholder="我"
          />
        </label>
      </section>

      <section className="card">
        <h3>DeepSeek API Key</h3>
        <p className="muted small">
          只加密保存在这台设备上；请求经服务器中转，服务器不记录、不落盘。
        </p>
        {key && !editing ? (
          <div className="key-row">
            <code>{maskKey(key)}</code>
            <button className="mini" onClick={() => setEditing(true)}>
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
            <button className="primary" onClick={() => void save()} disabled={!keyInput.trim()}>
              保存
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h3>模型</h3>
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
    </>
  )
}

function PersonalizeSection({ settings, patch }: { settings: Settings; patch: Patch }) {
  return (
    <section className="card">
      <label className="switch-row">
        <span>紧凑模式</span>
        <input
          type="checkbox"
          checked={settings.compact}
          onChange={(e) => patch({ compact: e.target.checked })}
        />
      </label>
      <p className="muted small">更小的字号与行距，一屏能看更多内容。</p>

      <label className="field" style={{ marginTop: 14 }}>
        <span>系统提示词</span>
        <textarea
          rows={4}
          value={settings.systemPrompt}
          onChange={(e) => patch({ systemPrompt: e.target.value })}
          placeholder="例如：回答尽量简洁"
        />
      </label>
    </section>
  )
}

function PluginsSection() {
  return (
    <section className="card">
      <h3>插件</h3>
      <p className="muted small">
        之后会支持插件：主题、快捷指令、会话导入导出等。现在还没有可安装的插件。
      </p>
      <div className="empty-slot">暂无插件</div>
    </section>
  )
}

function ModelsSection({
  settings,
  patch,
  flash,
}: {
  settings: Settings
  patch: Patch
  flash: (s: string) => void
}) {
  const [newModel, setNewModel] = useState('')
  const all = Array.from(new Set([...MODELS.map((m) => m.id), ...settings.extraModels]))

  const toggle = (id: string) => {
    const on = settings.enabledModels.includes(id)
    const next = on
      ? settings.enabledModels.filter((m) => m !== id)
      : [...settings.enabledModels, id]
    if (next.length === 0) {
      flash('至少保留一个模型')
      return
    }
    const p: Partial<Settings> = { enabledModels: next }
    if (!next.includes(settings.model)) p.model = next[0]
    patch(p)
  }

  return (
    <>
      <section className="card">
        <h3>启用的模型</h3>
        <p className="muted small">勾选后会出现在输入栏的模型菜单里。</p>
        <div className="model-list">
          {all.map((id) => (
            <label key={id} className="switch-row">
              <span>{modelLabel(id)}</span>
              <input
                type="checkbox"
                checked={settings.enabledModels.includes(id)}
                onChange={() => toggle(id)}
              />
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>添加自定义模型</h3>
        <p className="muted small">填模型 id（跟 API 里一致），添加后即可选用。</p>
        <div className="row">
          <input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="例如 deepseek-chat-v2"
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
        {settings.extraModels.length > 0 && (
          <div className="chips">
            {settings.extraModels.map((m) => (
              <span key={m} className="chip">
                {m}
                <button
                  className="chip-x"
                  onClick={() =>
                    patch({ extraModels: settings.extraModels.filter((x) => x !== m) })
                  }
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function ContextSection({
  settings,
  patch,
  onWipe,
}: {
  settings: Settings
  patch: Patch
  onWipe: () => void
}) {
  return (
    <>
      <section className="card">
        <h3>携带的历史条数</h3>
        <label className="field">
          <span>每次发送带最近多少条消息（0 = 全部）</span>
          <input
            type="number"
            min={0}
            max={200}
            value={settings.contextLimit}
            onChange={(e) => patch({ contextLimit: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <p className="muted small">条数越少，消耗的 token 越少，长会话也不容易卡。</p>
      </section>

      <section className="card">
        <h3>本机会话</h3>
        <p className="muted small">
          「仅本机」的会话只存在这台设备，换设备或清数据就没了。
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
    </>
  )
}

function DshSection({ settings, patch }: { settings: Settings; patch: Patch }) {
  const [state, setState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [msg, setMsg] = useState('')

  async function test() {
    const url = settings.dshUrl.trim()
    if (!url) return
    setState('testing')
    setMsg('')
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 4000)
      await fetch(url, { mode: 'no-cors', signal: ctrl.signal })
      clearTimeout(t)
      setState('ok')
      setMsg('地址可达')
    } catch {
      setState('fail')
      setMsg('连不上，检查地址和网络')
    }
  }

  return (
    <>
      <section className="card">
        <h3>服务器地址</h3>
        <p className="muted small">运行 dsh 的机器地址，例如 http://192.168.1.48:3081。</p>
        <div className="row">
          <input
            value={settings.dshUrl}
            onChange={(e) => {
              patch({ dshUrl: e.target.value })
              setState('idle')
              setMsg('')
            }}
            placeholder="http://192.168.1.48:3081"
          />
          <button className="ghost" onClick={() => void test()} disabled={!settings.dshUrl.trim()}>
            {state === 'testing' ? '测试中…' : '测试'}
          </button>
        </div>
        {msg && (
          <p className={`small ${state === 'ok' ? 'ok' : 'warn'}`}>
            {state === 'ok' ? '✓ ' : '✕ '}
            {msg}
          </p>
        )}
      </section>

      <section className="card">
        <h3>接入后能做什么</h3>
        <p className="muted small">
          · 用 DSH 的会话与文件能力
          <br />
          · 手机上传的文件直接进 DSH 工作区
          <br />
          · 在手机上看 DSH 跑代码的过程
        </p>
        <p className="warn small">深度对接（会话同步、文件进工作区）还在开发中。</p>
      </section>
    </>
  )
}

function PathsSection({ flash }: { flash: (s: string) => void }) {
  const [inbox, setInbox] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/paths')
        if (r.ok) {
          const j = await r.json()
          setInbox(j.inbox || '')
        }
      } catch {
        /* 忽略 */
      }
    })()
  }, [])

  return (
    <section className="card">
      <h3>附件与导出的存放位置</h3>
      <p className="muted small">上传的附件、导出的对话都落在下面这个目录。</p>
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
      <p className="muted small">
        「打开文件夹」只在桌面端可用。
        {!window.chatbox && '（浏览器里打开时不可用）'}
      </p>
    </section>
  )
}

function AboutSection({ onTip }: { onTip: () => void }) {
  return (
    <section className="card">
      <h3>关于 ChatBox Pro</h3>
      <p className="muted small">
        版本 0.2.0 · 本机模式（会话不离开设备）
        <br />
        手机 / 电脑共用一套服务器，自己填自己的 API Key。
      </p>
      <button className="ghost wide" onClick={onTip}>
        投喂作者
      </button>
      <p className="muted small" style={{ marginTop: 8 }}>
        自愿支持，不影响任何功能。
      </p>
    </section>
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
