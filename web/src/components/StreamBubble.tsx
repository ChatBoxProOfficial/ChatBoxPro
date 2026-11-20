import { useEffect, useState, type MutableRefObject } from 'react'

import Reasoning from './Reasoning'
import { Markdown } from './Markdown'

interface Props {
  /** 流式正文累积（父级只写 ref，不改 state，避免整屏重渲染） */
  accRef: MutableRefObject<string>
  /** 思维链累积 */
  reasonRef: MutableRefObject<string>
  busy: boolean
  display: 'off' | 'web' | 'dsh'
  startAt: number
  searching: boolean
}

/**
 * 流式输出气泡。
 * 自己按 140ms 轮询 ref 里的累积文本，父级 ChatScreen 在流式期间完全不重渲染，
 * 手机上才不会越输出越卡。
 */
export default function StreamBubble({
  accRef,
  reasonRef,
  busy,
  display,
  startAt,
  searching,
}: Props) {
  const [, tick] = useState(0)

  useEffect(() => {
    if (!busy) return
    const id = window.setInterval(() => tick((n) => n + 1), 240)
    return () => window.clearInterval(id)
  }, [busy])

  const text = accRef.current
  const reason = reasonRef.current

  return (
    <div className="msg assistant">
      <div className="msg-role">DeepSeek</div>
      <div className="msg-body">
        {display !== 'off' && reason && (
          <Reasoning
            key={display}
            reasoning={reason}
            mode={display}
            streaming={busy}
            hasContent={!!text}
            durationMs={Date.now() - startAt}
          />
        )}
        {searching && (
          <div className="searching-line">
            <span className="searching-dot" />
            正在搜索…
          </div>
        )}
        {text ? (
          text.length < 2500 ? (
            <div className="streaming-text streaming-md">
              <Markdown text={text} />
            </div>
          ) : (
            <div className="streaming-text streaming-plain">{text}</div>
          )
        ) : (
          !reason && <span className="cursor">▍</span>
        )}
      </div>
    </div>
  )
}
