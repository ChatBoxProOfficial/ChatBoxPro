import { useCallback, useEffect, useRef } from 'react'
import { EFFORTS, type Settings } from '../types'

type Effort = Settings['reasoningEffort']

/** 每个档位对应的粒子速度倍率（越大越快） */
const SPEED: Record<Effort, number> = { off: 0, low: 0.55, high: 1.15, max: 2.1 }

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

const KNOB = 26 // 白色旋钮直径（与 CSS 保持一致）
const DOTS = 44 // 粒子数量

interface Dot {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
}

export default function EffortSlider({ value, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const valueRef = useRef<Effort>(value)
  valueRef.current = value
  const draggingRef = useRef(false)

  const frac = Math.max(0, EFFORTS.indexOf(value)) / (EFFORTS.length - 1)

  /**
   * 粒子从旋钮位置向外飘散、边飘边淡出，飘完就在旋钮处重生。
   * 这样看起来粒子是「被旋钮甩出来」的，而不是两套各自为政的东西。
   */
  useEffect(() => {
    const canvas = canvasRef.current
    const track = trackRef.current
    if (!canvas || !track) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let raf = 0
    let dots: Dot[] = []
    let w = 0
    let h = 0

    const knobX = () => {
      const idx = Math.max(0, EFFORTS.indexOf(valueRef.current))
      return KNOB / 2 + (w - KNOB) * (idx / (EFFORTS.length - 1))
    }

    const spawn = (atX: number, spread = 1): Dot => ({
      x: atX + (Math.random() - 0.5) * 6 * spread,
      y: h / 2 + (Math.random() - 0.5) * h * 0.55,
      vx: -(0.12 + Math.random() * 0.5),
      vy: (Math.random() - 0.5) * 0.25,
      r: 0.6 + Math.random() * 1.5,
      life: 0.35 + Math.random() * 0.65,
    })

    const resize = () => {
      w = track.clientWidth
      h = track.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const kx = knobX()
      dots = Array.from({ length: DOTS }, () => {
        const d = spawn(kx)
        d.x = Math.random() * Math.max(1, kx)
        d.life = Math.random()
        return d
      })
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(track)

    const draw = () => {
      const idx = Math.max(0, EFFORTS.indexOf(valueRef.current))
      const kx = knobX()
      const speed = SPEED[valueRef.current] ?? 0
      const active = idx > 0

      ctx.clearRect(0, 0, w, h)

      // 已走过区域的紫色底（从旋钮向左渐隐）
      if (active && kx > 1) {
        const g = ctx.createLinearGradient(0, 0, kx, 0)
        g.addColorStop(0, 'rgba(92, 54, 190, 0.22)')
        g.addColorStop(0.75, 'rgba(126, 78, 226, 0.4)')
        g.addColorStop(1, 'rgba(178, 122, 255, 0.55)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, kx, h)
      }

      // 旋钮周围的紫色光晕，让白点和粒子连成一体
      if (active) {
        const glow = ctx.createRadialGradient(kx, h / 2, 2, kx, h / 2, KNOB * 1.5)
        glow.addColorStop(0, 'rgba(178, 122, 255, 0.45)')
        glow.addColorStop(1, 'rgba(178, 122, 255, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(kx - KNOB * 1.5, 0, KNOB * 3, h)
      }

      // 粒子
      if (active) {
        const boost = 0.55 + speed * 0.85
        for (const d of dots) {
          d.x += d.vx * boost
          d.y += d.vy * boost
          d.life -= 0.0042 * (1 + speed)

          const out = d.x < -4 || d.life <= 0 || d.x > kx + 4
          if (out) {
            const nd = spawn(kx, 0.6)
            d.x = nd.x
            d.y = nd.y
            d.vx = nd.vx
            d.vy = nd.vy
            d.r = nd.r
            d.life = nd.life
          }

          const alpha = Math.max(0, Math.min(1, d.life)) * 0.85
          if (alpha <= 0.02) continue
          ctx.beginPath()
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(226, 199, 255, ${alpha})`
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
