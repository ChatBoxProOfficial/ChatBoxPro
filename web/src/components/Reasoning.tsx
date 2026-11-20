import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Markdown } from './Markdown'

interface Props {
  /** 思维链全文（流式中是已到达的部分） */
  reasoning: string
  /** 展示方式 */
  mode: 'off' | 'web' | 'dsh'
  /** 是否仍在流式输出 */
  streaming?: boolean
  /** 正文是否已经开始出现（网页版据此自动收起） */
  hasContent?: boolean
  /** 思考耗时（毫秒） */
  durationMs?: number
  /** 挂在标题右侧的内容（用量、耗时等） */
  trailing?: ReactNode
}

function secs(ms?: number): string {
  if (!ms || ms < 0) return '0'
  const s = ms / 1000
  if (s < 10) return s.toFixed(1)
  return String(Math.round(s))
}

/**
 * 思维链展示，两种风格：
 * - web：仿 DeepSeek 网页版，「已深度思考（用时 X 秒）」可折叠，思考时自动展开、出正文后自动收起
 * - dsh：仿 DSH，紧凑的「思考过程」折叠块，默认收起
 */
export default function Reasoning({
  reasoning,
  mode,
  streaming = false,
  hasContent = false,
  durationMs,
  trailing,
}: Props) {
  const [open, setOpen] = useState(false)
  const touched = useRef(false)

  // 网页版：思考时自动展开，正文开始后自动收起；用户手动点过就不再自动干预
  useEffect(() => {
    if (mode !== 'web') return
    if (touched.current) return
    if (streaming && !hasContent) setOpen(true)
    else if (hasContent) setOpen(false)
  }, [mode, streaming, hasContent])

  // 自动收起只做一次：正文出现且用户从没手动点过时才收起
  useEffect(() => {
    if (mode !== 'web') return
    if (touched.current) return
    if (hasContent && !streaming) setOpen(false)
  }, [mode, hasContent, streaming])

  if (mode === 'off' || !reasoning) return null

  const toggle = () => {
    touched.current = true
    setOpen((v) => !v)
  }

  if (mode === 'dsh') {
    // 仿 DSH：只做一个可折叠的标题行，内容原样呈现，不做任何美化或改写
    return (
      <div className="thinking-dsh">
        <button className={`dsh-head${open ? ' open' : ''}`} onClick={toggle}>
          <span className={`dsh-chev${open ? ' open' : ''}`}>›</span>
          <span className="dsh-title">{streaming ? '正在思考…' : '思考过程'}</span>
          {trailing}
        </button>
        {open && <div className="dsh-raw">{reasoning}</div>}
      </div>
    )
  }

  // web 风格
  return (
    <div className="thinking">
      <button className={`thinking-head${open ? ' open' : ''}`} onClick={toggle}>
        <span className="thinking-spark" aria-hidden="true">
          ✦
        </span>
        <span className="thinking-label">
          {streaming && !hasContent
            ? '思考中…'
            : durationMs
              ? `已深度思考（用时 ${secs(durationMs)} 秒）`
              : '已深度思考'}
        </span>
        <span className={`thinking-chev${open ? ' open' : ''}`}>›</span>
        {trailing}
      </button>
      {open && (
        <div className="thinking-body">
          {streaming ? <span className="reasoning-plain">{reasoning}</span> : <Markdown text={reasoning} />}
        </div>
      )}
    </div>
  )
}
