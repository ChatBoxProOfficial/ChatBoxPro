import { useEffect, useRef } from 'react'

export interface SubStep {
  name: string
  args: string
  result?: string
}

export interface SubRun {
  id: string
  task: string
  status: 'running' | 'done' | 'error'
  reasoning: string
  content: string
  steps: SubStep[]
  startedAt: number
  endedAt?: number
}

interface Props {
  runs: SubRun[]
  onClose: () => void
}

/** 子智能体面板：看模型派了什么活、子智能体在思考什么 */
export default function SubAgentPanel({ runs, onClose }: Props) {
  const bodyRef = useRef<HTMLDivElement | null>(null)

  // 有新内容时自动滚到底
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [runs])

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="sub-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sub-head">
          <span>子智能体</span>
          <button className="settings-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="sub-body" ref={bodyRef}>
          {runs.length === 0 && <p className="muted small">还没有派出子智能体。</p>}

          {runs.map((r) => (
            <div key={r.id} className={`sub-run ${r.status}`}>
              <div className="sub-run-head">
                <span className={`sub-dot ${r.status}`} />
                <span className="sub-run-name">子智能体</span>
                <span className="sub-run-status">
                  {r.status === 'running' ? '进行中' : r.status === 'done' ? '已完成' : '出错'}
                </span>
                <span className="sub-run-steps">{r.steps.length} 步</span>
              </div>

              <div className="sub-block">
                <div className="sub-block-label">主模型交给它的任务</div>
                <div className="sub-task">{r.task}</div>
              </div>

              {r.reasoning && (
                <div className="sub-block">
                  <div className="sub-block-label">它的思考</div>
                  <div className="sub-think">{r.reasoning}</div>
                </div>
              )}

              {r.steps.length > 0 && (
                <div className="sub-block">
                  <div className="sub-block-label">它调用的工具</div>
                  {r.steps.map((st, i) => (
                    <div key={i} className="sub-step">
                      <span className="sub-step-name">{st.name}</span>
                      <span className="sub-step-args">{st.args}</span>
                      {st.result && (
                        <span className="sub-step-result">
                          → {st.result.replace(/\s+/g, ' ').slice(0, 120)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {r.content && (
                <div className="sub-block">
                  <div className="sub-block-label">它的输出</div>
                  <div className="sub-output">{r.content}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
