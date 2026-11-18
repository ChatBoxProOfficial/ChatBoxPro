import { useEffect, useState } from 'react'
import { clearApiKey, loadApiKey, maskKey, saveApiKey } from '../secureStore'
import { MODELS, modelLabel, type Settings } from '../types'
import { fetchBalance, listFiles, deleteFile } from '../api'
import type { SessionSummary } from '../db'
import type { Session } from '../types'
import { confirmDialog } from './Confirm'
import Switch from './Switch'

interface Props {
  settings: Settings
  onChange: (s: Settings) => void
  onBack: () => void
  onWipe: () => void
  onExportAll: () => Promise<number>
  sessions: SessionSummary[]
  onCompress: (id: string, keep?: number) => Promise<{ before: number; after: number; session: Session }>
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
  { id: 'account', title: 'ChatBox Pro 账号与模型', desc: 'API Key、默认模型与温度' },
  { id: 'personalize', title: '个性化', desc: '紧凑模式、主题与系统提示词' },
  { id: 'plugins', title: '插件', desc: '扩展能力' },
  { id: 'models', title: '管理模型', desc: '启用模型与自定义模型' },
  { id: 'context', title: '上下文管理', desc: '上下文压缩、历史条数与数据管理' },
  { id: 'dsh', title: '连接 DeepSeek Harness', desc: '服务端地址与连通性检测' },
  { id: 'paths', title: '文件与路径', desc: '存放位置与工具权限' },
  { id: 'about', title: '关于 ChatBox Pro', desc: '版本信息与支持作者' },
]

export default function SettingsScreen({
  settings,
  onChange,
  onBack,
  onWipe,
  onExportAll,
  sessions,
  onCompress,
}: Props) {
  const [section, setSection] = useState<SectionId>('account')
  const [tipOpen, setTipOpen] = useState(false)
  const [toast, setToast] = useState('')

  const patch = (p: Partial<Settings>) => onChange({ ...settings, ...p })
  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 1600)
  }

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onBack])

  return (
    <div className="settings-overlay" onClick={onBack}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <header className="settings-head">
          <div className="settings-title">设置</div>
          <button className="settings-close" onClick={onBack} aria-label="关闭">
            ✕
          </button>
        </header>

        <div className="settings-main">
          <nav className="settings-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`nav-item${s.id === section ? ' active' : ''}`}
                onClick={() => setSection(s.id)}
                title={s.desc}
              >
                <span className="nav-dot" />
                <span className="nav-text">{s.title}</span>
              </button>
            ))}
          </nav>

          <div className="settings-pane">
            {section === 'account' && (
              <AccountSection settings={settings} patch={patch} flash={flash} />
            )}
            {section === 'personalize' && <PersonalizeSection settings={settings} patch={patch} />}
            {section === 'plugins' && <PluginsSection />}
            {section === 'models' && (
              <ModelsSection settings={settings} patch={patch} flash={flash} />
            )}
            {section === 'context' && (
              <ContextSection
                settings={settings}
                patch={patch}
                onWipe={onWipe}
                onExportAll={onExportAll}
                sessions={sessions}
                onCompress={onCompress}
              />
            )}
            {section === 'dsh' && <DshSection settings={settings} patch={patch} />}
            {section === 'paths' && <PathsSection flash={flash} settings={settings} patch={patch} />}
            {section === 'about' && <AboutSection onTip={() => setTipOpen(true)} />}
          </div>
        </div>
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
          仅以加密形式存储于本机。请求经中转转发，服务端不记录、不落盘。
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
                const ok = await confirmDialog({
                  title: '清除 API Key',
                  message: '本机保存的 API Key 将被删除，删除后需重新填写才能发送消息。',
                  confirmText: '清除',
                  danger: true,
                })
                if (!ok) return
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
        <h3>账户余额</h3>
        <BalanceRow baseUrl={settings.baseUrl} />
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

function BalanceRow({ baseUrl }: { baseUrl: string }) {
  const [state, setState] = useState<{ total?: string; granted?: string; toppedUp?: string } | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const r = await fetchBalance(baseUrl)
      setState(r.cny || null)
      if (!r.available) setErr('账户余额不足，请充值后重试')
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const key = await loadApiKey()
      if (key) await load()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      {state ? (
        <>
          <div className="balance-value">¥{state.total}</div>
          <p className="muted small">
            赠送 ¥{state.granted} · 充值 ¥{state.toppedUp}
          </p>
        </>
      ) : (
        <p className="muted small">{loading ? '查询中…' : err || '暂无数据'}</p>
      )}
      {state && err && <p className="warn small">{err}</p>}
      <button className="ghost" onClick={() => void load()} disabled={loading}>
        {loading ? '查询中…' : '刷新余额'}
      </button>
    </div>
  )
}

function PersonalizeSection({ settings, patch }: { settings: Settings; patch: Patch }) {
  return (
    <section className="card">
      <div className="switch-row">
        <span>紧凑模式</span>
        <Switch
          checked={settings.compact}
          onChange={(v) => patch({ compact: v })}
        />
      </div>
      <p className="muted small">缩小字号与行距，提升单屏信息密度。</p>

      <div className="field" style={{ marginTop: 14 }}>
        <span>主题</span>
        <div className="seg">
          {[
            { id: 'light' as const, label: '浅色' },
            { id: 'dark' as const, label: '深色' },
            { id: 'system' as const, label: '跟随系统' },
          ].map((t) => (
            <button
              key={t.id}
              className={`seg-item${settings.theme === t.id ? ' active' : ''}`}
              onClick={() => patch({ theme: t.id })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="switch-row" style={{ marginTop: 10 }}>
        <span>附带用户元信息</span>
        <Switch
          checked={settings.reminder}
          onChange={(v) => patch({ reminder: v })}
        />
      </div>
      <p className="muted small">
        每轮请求附带当前日期、平台与语言信息（latest_reminder），使回答符合当前时空上下文。
      </p>

      <label className="field" style={{ marginTop: 14 }}>
        <span>系统提示词</span>
        <textarea
          rows={4}
          value={settings.systemPrompt}
          onChange={(e) => patch({ systemPrompt: e.target.value })}
          placeholder="例如：回答保持简洁，先给结论"
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
        插件系统尚未开放，后续将支持主题、快捷指令与会话导入导出等扩展。
      </p>
      <div className="empty-slot">暂无可安装插件</div>
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
        <p className="muted small">勾选的模型会出现在输入栏的模型选择菜单中。</p>
        <div className="model-list">
          {all.map((id) => (
            <div key={id} className="switch-row">
              <span>{modelLabel(id)}</span>
              <Switch
                checked={settings.enabledModels.includes(id)}
                onChange={() => toggle(id)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>思维链展示</h3>
        <div className="switch-row">
          <span>开启思维链展示</span>
          <Switch
            checked={settings.reasoningDisplay !== 'off'}
            onChange={(v) => patch({ reasoningDisplay: v ? 'web' : 'off' })}
          />
        </div>
        <p className="muted small">
          开启后请求思维链（reasoning_content）。关闭时同时禁用模型思考模式，降低 token 消耗。
        </p>

        {settings.reasoningDisplay !== 'off' && (
          <label className="field">
            <span>思考强度</span>
            <select
              value={settings.reasoningEffort}
              onChange={(e) =>
                patch({
                  reasoningEffort: e.target.value as 'off' | 'low' | 'high' | 'max',
                })
              }
            >
              <option value="off">off — 关闭思考（最低开销）</option>
              <option value="low">low — 轻量思考</option>
              <option value="high">high — 默认强度</option>
              <option value="max">max — 面向复杂任务</option>
            </select>
          </label>
        )}

        {settings.reasoningDisplay !== 'off' && (
          <div className="radio-list">
            <label className="radio-row">
              <input
                type="radio"
                name="reasoning-style"
                checked={settings.reasoningDisplay === 'web'}
                onChange={() => patch({ reasoningDisplay: 'web' })}
              />
              <span className="radio-main">
                <span className="radio-title">样式一：DeepSeek 网页版</span>
                <span className="radio-desc">
                  折叠条目显示「已深度思考（用时 X 秒）」；思考时自动展开，正文生成后收起，可随时展开查看。
                </span>
              </span>
            </label>

            <label className="radio-row">
              <input
                type="radio"
                name="reasoning-style"
                checked={settings.reasoningDisplay === 'dsh'}
                onChange={() => patch({ reasoningDisplay: 'dsh' })}
              />
              <span className="radio-main">
                <span className="radio-title">样式二：DSH</span>
                <span className="radio-desc">
                  紧凑的「思考过程」折叠块，默认收起，附耗时标记。
                </span>
              </span>
            </label>
          </div>
        )}
      </section>

      <section className="card">
        <h3>添加自定义模型</h3>
        <p className="muted small">填写与 API 一致的模型 ID，添加后即可选用。</p>
        <div className="row">
          <input
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            placeholder="例如 deepseek-v4-pro"
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
  onExportAll,
  sessions,
  onCompress,
}: {
  settings: Settings
  patch: Patch
  onWipe: () => void
  onExportAll: () => Promise<number>
  sessions: SessionSummary[]
  onCompress: (id: string, keep?: number) => Promise<{ before: number; after: number; session: Session }>
}) {
  const [compressId, setCompressId] = useState('')
  const [compressing, setCompressing] = useState(false)
  const [compressMsg, setCompressMsg] = useState('')
  const [phase, setPhase] = useState<'idle' | 'cooling' | 'ready'>('idle')
  const [left, setLeft] = useState(10)

  useEffect(() => {
    if (phase !== 'cooling') return
    if (left <= 0) {
      setPhase('ready')
      return
    }
    const t = setTimeout(() => setLeft((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, left])

  return (
    <>
      <section className="card">
        <h3>自动压缩上下文</h3>
        <div className="switch-row">
          <span>上下文占用超阈值时自动压缩</span>
          <Switch
            checked={settings.autoCompact}
            onChange={(v) => patch({ autoCompact: v })}
          />
        </div>
        <p className="muted small">
          每轮回答结束后检测上下文占用率。超过阈值时，将早期消息压缩为摘要，仅保留最近 8 条。
        </p>
        <label className="field">
          <span>触发阈值</span>
          <select
            value={settings.compactThreshold}
            onChange={(e) => patch({ compactThreshold: Number(e.target.value) })}
            disabled={!settings.autoCompact}
          >
            <option value={40}>40% — 提前压缩（最省）</option>
            <option value={60}>60% — 均衡（推荐）</option>
            <option value={80}>80% — 保留更多原文</option>
          </select>
        </label>
      </section>

      <section className="card">
        <h3>携带的历史条数</h3>
        <label className="field">
          <span>单次请求携带的最近消息条数（0 表示全部）</span>
          <input
            type="number"
            min={0}
            max={200}
            value={settings.contextLimit}
            onChange={(e) => patch({ contextLimit: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <p className="muted small">条数越少，token 消耗越低，长会话渲染更稳定。</p>
      </section>

      <section className="card">
        <h3>压缩指定对话的上下文</h3>
        <p className="muted small">
          将早期消息交由模型压缩为摘要，仅保留最近若干条，适用于长会话的上下文精简。
        </p>
        <label className="field">
          <span>选择对话</span>
          <select
            value={compressId}
            onChange={(e) => setCompressId(e.target.value)}
          >
            <option value="">请选择会话…</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}（{s.count} 条）
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button
            className="ghost"
            disabled={!compressId || compressing}
            onClick={async () => {
              if (!compressId) return
              const ok = await confirmDialog({
                title: '压缩上下文',
                message: '早期消息将被摘要替换，原文不再保留。建议先导出备份。',
                confirmText: '压缩',
              })
              if (!ok) return
              setCompressing(true)
              setCompressMsg('')
              try {
                const r = await onCompress(compressId)
                setCompressMsg(`完成：${r.before} 条 → ${r.after} 条`)
              } catch (e) {
                setCompressMsg(`失败：${(e as Error).message}`)
              } finally {
                setCompressing(false)
              }
            }}
          >
            {compressing ? '压缩中…' : '压缩所选会话'}
          </button>
        </div>
        {compressMsg && <p className="muted small">{compressMsg}</p>}
      </section>

      <section className="card">
        <h3>本机会话</h3>
        <p className="muted small">
          「仅本机」会话仅存储于当前设备。更换设备或清除数据后将无法恢复。
        </p>
        <div className="row">
          <button
            className="ghost"
            onClick={async () => {
              const n = await onExportAll()
              if (n === 0) {
                // 没有会话时也照常给出反馈
              }
            }}
          >
            导出全部历史对话
          </button>
        </div>
        <p className="muted small">导出单个 JSON 文件，包含全部会话及消息记录。</p>

        <div className="row" style={{ marginTop: 12 }}>
          <button
            className="danger"
            disabled={phase === 'cooling'}
            onClick={async () => {
              if (phase === 'idle') {
                // 先进入 10 秒冷却，防止误触
                setLeft(10)
                setPhase('cooling')
                return
              }
              if (phase === 'cooling') return
              const ok = await confirmDialog({
                title: '删除本机全部会话',
                message: '本机全部会话将被永久删除，此操作不可撤销。',
                confirmText: '全部删除',
                danger: true,
              })
              if (ok) {
                onWipe()
                setPhase('idle')
              }
            }}
          >
            {phase === 'idle'
              ? '删除本机全部会话'
              : phase === 'cooling'
                ? `安全冷却：请等待 ${left} 秒`
                : '已可删除，点击确认'}
          </button>
        </div>
        {phase === 'cooling' && (
          <p className="warn small">10 秒冷却期内按钮保持禁用，用于防止误操作。</p>
        )}
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
      setMsg('连接正常')
    } catch {
      setState('fail')
      setMsg('无法连接，请检查地址与网络')
    }
  }

  return (
    <>
      <section className="card">
        <h3>服务器地址</h3>
        <p className="muted small">运行 DSH 服务的主机地址，例如 http://192.168.1.48:3081</p>
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
            {state === 'testing' ? '检测中…' : '测试'}
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
          · 复用 DSH 的会话与文件能力
          <br />
          · 移动端上传的文件可直接进入 DSH 工作区
          <br />
          · 在移动端查看 DSH 执行代码的实时过程
        </p>
        <p className="warn small">深度对接（会话同步、文件写入工作区）仍在开发中。</p>
      </section>
    </>
  )
}

function PathsSection({ flash, settings, patch }: { flash: (s: string) => void; settings: Settings; patch: Patch }) {
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
      <h3>存放位置与工具权限</h3>
      <p className="muted small">附件与导出文件均存放于以下目录。</p>
      <div className="path-box">
        <code>{inbox || '（未获取到路径）'}</code>
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
        「打开文件夹」仅在桌面端可用。
        {!window.chatbox && '（浏览器环境不可用）'}
      </p>

      <h3 style={{ marginTop: 16 }}>工作目录</h3>
      <p className="muted small">
        模型的读取类工具（list_dir / read_file / search_in_files）可访问该目录下的文件。
        <b>读取不修改</b>。留空则禁用文件读取能力。
      </p>
      <div className="row">
        <input
          value={settings.workspaceDir}
          onChange={(e) => patch({ workspaceDir: e.target.value })}
          placeholder="例如 F:\Projects\chatbox-pro"
        />
      </div>

      <div className="switch-row" style={{ marginTop: 12 }}>
        <span>允许写文件</span>
        <Switch
          checked={settings.allowWrite}
          onChange={(v) => patch({ allowWrite: v })}
        />
      </div>
      <p className="warn small">
        允许模型写入工作目录内的文件。每次写入均需人工确认变更（diff）。
      </p>

      <div className="switch-row" style={{ marginTop: 10 }}>
        <span>允许执行命令</span>
        <Switch
          checked={settings.allowExec}
          onChange={(v) => patch({ allowExec: v })}
        />
      </div>
      <p className="warn small">
        允许模型在工作目录内执行命令。每次执行均需确认完整命令。
        高危命令（format、del /f、shutdown 等）一律拒绝。
      </p>

      <h3 style={{ marginTop: 16 }}>服务端已解析文件</h3>
      <p className="muted small">经解析的 PDF / Office 文件保留在服务端账户中，可在此清理。</p>
      <FileList />
    </section>
  )
}

function FileList() {
  const [files, setFiles] = useState<Array<{ id: string; filename: string; bytes: number }>>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      setFiles(await listFiles('/api'))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void (async () => {
      const key = await loadApiKey()
      if (key) await load()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      {err && <p className="warn small">{err}</p>}
      {files.length === 0 && !loading && <p className="muted small">暂无文件</p>}
      {files.map((f) => (
        <div key={f.id} className="file-row">
          <span className="file-name" title={f.filename}>
            {f.filename}
          </span>
          <span className="muted small">{Math.round(f.bytes / 1024)} KB</span>
          <button
            className="mini danger"
            onClick={async () => {
              const ok = await confirmDialog({
                title: '删除云端文件',
                message: `删除「${f.filename}」？引用该文件的历史会话将无法读取其内容。`,
                confirmText: '删除',
                danger: true,
              })
              if (!ok) return
              try {
                await deleteFile('/api', f.id)
                await load()
              } catch (e) {
                setErr((e as Error).message)
              }
            }}
          >
            ✕
          </button>
        </div>
      ))}
      <button className="ghost" onClick={() => void load()} disabled={loading}>
        {loading ? '刷新中…' : '刷新列表'}
      </button>
    </div>
  )
}

function AboutSection({ onTip }: { onTip: () => void }) {
  return (
    <section className="card">
      <h3>关于 ChatBox Pro</h3>
      <p className="muted small">
        版本 0.2.0 · 本机模式 · 会话数据不离开设备
        <br />
        多端共用同一服务端，用户各自配置自己的 API Key。
      </p>
      <button className="ghost wide" onClick={onTip}>
        支持作者
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
        <h3>支持作者</h3>
        <p className="muted small">自愿支持，不影响任何功能。感谢！</p>
        {imgOk ? (
          <img className="qr" src="tip-qr.png" alt="收款二维码" onError={() => setImgOk(false)} />
        ) : (
          <div className="qr placeholder">收款二维码暂未配置</div>
        )}
        <button className="ghost wide" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}
