import { useCallback, useEffect, useRef } from 'react'
import { EFFORTS, type Settings } from '../types'

type Effort = Settings['reasoningEffort']

/** 每个档位对应的粒子速度倍率（越大越快） */
const SPEED: Record<Effort, number> = { off: 0.15, low: 0.7, high: 1.5, max: 2.8 }

/** 档位备注：off 关闭 / low 浮想 / high 沉思 / max 最大 token 消耗 */
export const EFFORT_NOTE: Record<Effort, string> = {
  off: '关闭',
  low: '浮想',
  high: '沉思',
  max: '最大 token 消耗',
}

interface Props {
  value: Effort
  onChange: (e: Effort) => void
}

const KNOB = 38 // 白色旋钮直径

export default function EffortSlider({ value, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const valueRef = useRef<Effort>(value)
  valueRef.current = value
  const draggingRef = useRef(false)

  const frac = Math.max(0, EFFORTS.indexOf(value)) / (EFFORTS.length - 1)

  /** 紫色粒子：只在旋钮走过的区域里动，档位越高跑得越快 */
  useEffect(() => {
    const canvas = canvasRef.current
    const track = trackRef.current
    if (!canvas || !track) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let raf = 0
    let parts: Array<{ x: number; y: number; vx: number; vy: number; r: number; a: number }> = []

    const resize = () => {
      const w = track.clientWidth
      const h = track.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      parts = Array.from({ length: 52 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0.15 + Math.random() * 0.75,
        vy: (Math.random() - 0.5) * 0.6,
        r: 0.7 + Math.random() * 1.9,
        a: 0.3 + Math.random() * 0.6,
      }))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(track)

    const draw = () => {
      const w = track.clientWidth
      const h = track.clientHeight
      const idx = Math.max(0, EFFORTS.indexOf(valueRef.current))
      const f = idx / (EFFORTS.length - 1)
      const fillW = idx === 0 ? 0 : KNOB / 2 + (w - KNOB) * f

      ctx.clearRect(0, 0, w, h)

      // 已走过的区域：紫色渐变底
      if (fillW > 1) {
        const g = ctx.createLinearGradient(0, 0, Math.max(fillW, 1), 0)
        g.addColorStop(0, 'rgba(108, 63, 224, 0.42)')
        g.addColorStop(1, 'rgba(172, 116, 255, 0.72)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, fillW, h)
      }

      const speed = SPEED[valueRef.current] ?? 1
      for (const p of parts) {
        p.x += p.vx * speed
        p.y += p.vy * speed
        if (p.x > fillW + 8) {
          p.x = -6
          p.y = Math.random() * h
        }
        if (p.y < -6) p.y = h + 6
        if (p.y > h + 6) p.y = -6
        if (p.x <= fillW) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(219, 186, 255, ${p.a})`
          ctx.fill()
        }
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  const commit = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track) return
      const rect = track.getBoundingClientRect()
      const usable = rect.width - KNOB
      const f = Math.min(1, Math.max(0, (clientX - rect.left - KNOB / 2) / Math.max(1, usable)))
      const idx = Math.round(f * (EFFORTS.length - 1))
      const next = EFFORTS[idx]
      if (next !== valueRef.current) onChange(next)
    },
    [onChange],
  )

  return (
    <div className="effort-slider">
      <div
        ref={trackRef}
        className="eslider-track"
        role="slider"
        tabIndex={0}
        aria-label="思考强度"
        aria-valuemin={0}
        aria-valuemax={EFFORTS.length - 1}
        aria-valuenow={EFFORTS.indexOf(value)}
        aria-valuetext={EFFORT_NOTE[value]}
        onPointerDown={(e) => {
          draggingRef.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          commit(e.clientX)
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) commit(e.clientX)
        }}
        onPointerUp={(e) => {
          draggingRef.current = false
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => {
          draggingRef.current = false
        }}
        onKeyDown={(e) => {
          const i = EFFORTS.indexOf(value)
          if (e.key === 'ArrowLeft' && i > 0) {
            e.preventDefault()
            onChange(EFFORTS[i - 1])
          }
          if (e.key === 'ArrowRight' && i < EFFORTS.length - 1) {
            e.preventDefault()
            onChange(EFFORTS[i + 1])
          }
        }}
      >
        <canvas ref={canvasRef} className="eslider-canvas" />
        <span
          className="eslider-knob"
          style={{ left: `calc(${KNOB / 2}px + (100% - ${KNOB}px) * ${frac})` }}
        />
      </div>

      <div className="effort-ticks">
        {EFFORTS.map((e) => (
          <span
            key={e}
            className={`effort-tick${e === value ? ' active' : ''}`}
            onClick={() => onChange(e)}
          >
            {e}
          </span>
        ))}
      </div>
    </div>
  )
}
