import { useEffect, useState } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type Listener = (o: ConfirmOptions | null) => void

let listener: Listener | null = null
let resolver: ((v: boolean) => void) | null = null

/** 应用内确认框，替代系统 confirm()，样式跟应用一致 */
export function confirmDialog(o: ConfirmOptions): Promise<boolean> {
  if (!listener) return Promise.resolve(window.confirm(`${o.title}\n\n${o.message ?? ''}`))
  listener(o)
  return new Promise<boolean>((resolve) => {
    resolver = resolve
  })
}

export function ConfirmHost() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)

  useEffect(() => {
    listener = (o) => setOpts(o)
    return () => {
      listener = null
    }
  }, [])

  useEffect(() => {
    if (!opts) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false)
      if (e.key === 'Enter') finish(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts])

  function finish(v: boolean) {
    setOpts(null)
    resolver?.(v)
    resolver = null
  }

  if (!opts) return null

  return (
    <div className="confirm-mask" onClick={() => finish(false)}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <h4 className="confirm-title">{opts.title}</h4>
        {opts.message && <p className="confirm-msg">{opts.message}</p>}
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={() => finish(false)}>
            {opts.cancelText || '取消'}
          </button>
          <button
            className={`confirm-ok${opts.danger ? ' danger' : ''}`}
            onClick={() => finish(true)}
            autoFocus
          >
            {opts.confirmText || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
