import { useEffect, useRef, useState } from 'react'
import { modelFullName, modelShort, type Attachment, type Settings } from '../types'
import EffortSlider, { EFFORT_NOTE } from './EffortSlider'
import Switch from './Switch'
import { useT } from '../i18n'

type Effort = Settings['reasoningEffort']

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  busy: boolean
  model: string
  models: string[]
  onModelChange: (m: string) => void
  effort: Effort
  onEffortChange: (e: Effort) => void
  teamMode: boolean
  onTeamModeChange: (v: boolean) => void
  webSearch: boolean
  onWebSearchChange: (v: boolean) => void
  safety: boolean
  onSafetyChange: (v: boolean) => void
  toolsEnabled: boolean
  onToolsChange: (v: boolean) => void
  attachments: Attachment[]
  onPickFiles: (files: FileList) => void
  onRemoveAttachment: (id: string) => void
  placeholder?: string
}

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  model,
  models,
  onModelChange,
  effort,
  onEffortChange,
  teamMode,
  onTeamModeChange,
  webSearch,
  onWebSearchChange,
  safety,
  onSafetyChange,
  toolsEnabled,
  onToolsChange,
  attachments,
  onPickFiles,
  onRemoveAttachment,
  placeholder,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const t = useT()
  const [collapsed, setCollapsed] = useState(false)
  const [popOpen, setPopOpen] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [liveEffort, setLiveEffort] = useState(effort)

  // 父级状态更新是异步的，这里本地先更新，保证拖动时数字立刻变
  useEffect(() => {
    setLiveEffort(effort)
  }, [effort])

  // Esc 关闭模型面板
  useEffect(() => {
    if (!popOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopOpen(false)
        setAdjusting(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [popOpen])

  const canSend = !!value.trim() || attachments.length > 0

  return (
    <div className={`composer${collapsed ? ' collapsed' : ''}`}>
      {!collapsed && attachments.length > 0 && (
        <div className="attach-tray">
          {attachments.map((a) => (
            <span key={a.id} className={`attach-chip${a.error ? ' bad' : ''}`}>
              <span className="attach-name" title={a.name}>
                {a.name}
              </span>
              <span className="attach-size">
                {a.uploading ? '上传中…' : a.error ? '失败' : humanSize(a.size)}
              </span>
              <button
                className="attach-x"
                onClick={() => onRemoveAttachment(a.id)}
                aria-label="移除附件"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {collapsed ? (
        <button
          className="collapsed-fab"
          onClick={() => setCollapsed(false)}
          title="展开输入栏"
        >
          展开
        </button>
      ) : (
      <div className="composer-bar">
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onPickFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          className="tool-btn"
          onClick={() => fileRef.current?.click()}
          title="上传文件"
          aria-label="上传文件"
        >
          <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
            <path
              d="M16.5 6.5v9a4.5 4.5 0 1 1-9 0V7a3 3 0 0 1 6 0v8.2a1.6 1.6 0 1 1-3.2 0V8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          className="tool-btn text"
          onClick={() => setCollapsed(true)}
          title="收起输入栏"
        >
          收起
        </button>

        <textarea
          className="composer-input"
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (canSend && !busy) onSend()
            }
          }}
          placeholder={placeholder ?? `${t('send', '发送')}…`}
        />

        <div className="model-wrap">
          <button
            className={`model-chip${popOpen ? ' open' : ''}`}
            onClick={() => setPopOpen((v) => !v)}
            title="模型与思考强度"
          >
            {modelShort(model)}
            <span className="chip-effort">{liveEffort}</span>
            <span className="caret">▾</span>
          </button>

          {popOpen && (
            <>
              <div className="pop-mask" onClick={() => setPopOpen(false)} />
              <div className={`model-pop${adjusting ? " adjusting" : ""}`} role="dialog">
                {adjusting ? (
                  <div className="model-area">
                    <div className="adjust-model">
                      <div className="adjust-model-label">当前模型</div>
                      <div className="adjust-model-row">
                        <span className="adjust-model-name">{modelFullName(model)}</span>
                        <span className="adjust-model-effort">{liveEffort}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="model-area">
                    <div className="pop-label">模型</div>
                    {models.map((m) => (
                      <button
                        key={m}
                        className={`pop-item${m === model ? ' active' : ''}`}
                        onClick={() => onModelChange(m)}
                      >
                        <span className="pop-item-name">{modelFullName(m)}</span>
                        {m === model && <span className="pop-tick">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                <div className="pop-divider" />

                <div className="pop-label effort-head">
                  <span className="effort-head-left">
                    <span className={`effort-note ${effort}${teamMode ? " team" : ""}`}>
                      {EFFORT_NOTE[effort]}
                    </span>
                    <span className="effort-title">思考强度</span>
                  </span>
                  <span className="effort-model" title={modelFullName(model)}>
                    {modelFullName(model)}
                  </span>
                </div>

                <EffortSlider
                  value={effort}
                  onChange={(v) => {
                    setLiveEffort(v)
                    onEffortChange(v)
                  }}
                  onAdjustChange={setAdjusting}
                  teamMode={teamMode}
                />

                <div className="pop-divider" />

                <div className="team-row">
                  <span className="team-main">
                    <span className="team-title">子智能体团队协作</span>
                    <span className="team-desc">允许主模型派生只读子智能体处理子任务</span>
                  </span>
                  <Switch checked={teamMode} onChange={onTeamModeChange} />
                </div>

                <div className="team-row">
                  <span className="team-main">
                    <span className="team-title">联网搜索</span>
                    <span className="team-desc">需要最新信息时自动搜索并标注来源（仅 deepseek-flash）</span>
                  </span>
                  <Switch checked={webSearch} onChange={onWebSearchChange} />
                </div>

                <div className="team-row">
                  <span className="team-main">
                    <span className="team-title">内容安全</span>
                    <span className="team-desc">开启官方风控，命中风险内容时拒答</span>
                  </span>
                  <Switch checked={safety} onChange={onSafetyChange} />
                </div>

                <div className="team-row">
                  <span className="team-main">
                    <span className="team-title">本地工具</span>
                    <span className="team-desc">
                      允许模型调用时间、计算、搜索、抓网页（本机执行）
                    </span>
                  </span>
                  <Switch checked={toolsEnabled} onChange={onToolsChange} />
                </div>
              </div>
            </>
          )}
        </div>

        {busy ? (
          <button className="send-circle stop" onClick={onStop} title="停止">
            <span className="stop-square" />
          </button>
        ) : (
          <button
            className="send-circle"
            onClick={onSend}
            disabled={!canSend}
            title="发送"
            aria-label="发送"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 19V5M6 11l6-6 6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      )}
    </div>
  )
}
