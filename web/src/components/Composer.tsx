import { useRef, useState } from 'react'
import { MODELS, modelLabel, type Attachment } from '../types'

interface Props {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  busy: boolean
  model: string
  onModelChange: (m: string) => void
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
  onModelChange,
  attachments,
  onPickFiles,
  onRemoveAttachment,
  placeholder = '发消息…',
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)

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
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? '展开输入栏' : '收起输入栏'}
        >
          {collapsed ? '展开' : '收起'}
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
          placeholder={placeholder}
        />

        <div className="model-wrap">
          <button
            className="model-chip"
            onClick={() => setModelOpen((v) => !v)}
            title="切换模型"
          >
            {modelLabel(model)}
            <span className="caret">▾</span>
          </button>
          {modelOpen && (
            <>
              <div className="pop-mask" onClick={() => setModelOpen(false)} />
              <div className="pop-menu">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    className={`pop-item${m.id === model ? ' active' : ''}`}
                    onClick={() => {
                      onModelChange(m.id)
                      setModelOpen(false)
                    }}
                  >
                    {m.label}
                  </button>
                ))}
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
    </div>
  )
}
