import { useCallback, useEffect, useRef } from 'react'
import { EFFORTS, type Settings } from '../types'

type Effort = Settings['reasoningEffort']

/** 每个档位对应的粒子速度倍率（越大越快） */
const SPEED: Record<Effort, number> = { off: 0, low: 0.55, high: 1.15, max: 2.1 }

/** 每个档位实际显示的粒子数量：档位越高越多 */
const COUNT: Record<Effort, number> = { off: 0, low: 14, high: 30, max: 56 }

/** 粒子颜色：低档偏紫，高档偏蓝 */
const HUE: Record<Effort, [number, number, number]> = {
  off: [200, 170, 255],
  low: [188, 158, 255],
  high: [160, 168, 255],
  max: [122, 186, 255],
}

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

const KNOB = 24 // 白色旋钮边长（与 CSS 保持一致）
const POOL = 56 // 粒子池大小

interface Dot {
  x: number
  y: number
  r: number
  spd: number
  a: number
}

export default function EffortSlider({ value, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const valueRef = useRef<Effort>(value)
  valueRef.current = value
  const draggingRef = useRef(false)

  const frac = Math.max(0, EFFORTS.indexOf(value)) / (EFFORTS.length - 1)

  /**
   * 粒子铺满「已经走过」的整块区域：
   * - 数量随档位增加（off 0 → max 56），低档就是稀稀拉拉几颗
   * - 整片区域都有，不是只堆在旋钮旁边
   * - 速度随档位提高，飘到左边缘后回到旋钮处重新出现，形成循环
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

    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const resize = () => {
      w = track.clientWidth
      h = track.clientHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      dots = Array.from({ length: POOL }, () => ({
        x: rand(0, Math.max(1, knobX())),
        y: rand(2, Math.max(3, h - 2)),
        r: rand(0.7, 2.0),
        spd: rand(0.5, 1.4),
        a: rand(0.5, 0.95),
      }))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(track)

    const draw = () => {
      const idx = Math.max(0, EFFORTS.indexOf(valueRef.current))
      const kx = knobX()
      const speed = SPEED[valueRef.current] ?? 0
      const count = COUNT[valueRef.current] ?? 0
      const [cr, cg, cb] = HUE[valueRef.current]

      ctx.clearRect(0, 0, w, h)

      // 已走过区域：紫色/蓝色底，靠近旋钮更亮
      if (idx > 0 && kx > 1) {
        const g = ctx.createLinearGradient(0, 0, kx, 0)
        g.addColorStop(0, 'rgba(92, 54, 190, 0.18)')
        g.addColorStop(0.7, 'rgba(120, 76, 224, 0.34)')
        g.addColorStop(1, 'rgba(150, 120, 255, 0.5)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, kx, h)

        // 旋钮周围的光晕，让白块和粒子连成一体
        const glow = ctx.createRadialGradient(kx, h / 2, 2, kx, h / 2, KNOB * 1.6)
        glow.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, 0.42)`)
        glow.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`)
        ctx.fillStyle = glow
        ctx.fillRect(kx - KNOB * 1.6, 0, KNOB * 3.2, h)
      }

      if (count > 0 && speed > 0) {
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i]
          d.x -= d.spd * speed * 0.9

          // 飘出左边界或跑到旋钮右边，就回到旋钮处重新开始
          if (d.x < -3 || d.x > kx + 2) {
            d.x = kx - rand(0, 6)
            d.y = rand(2, Math.max(3, h - 2))
            d.r = rand(0.7, 2.0)
            d.a = rand(0.5, 0.95)
          }

          if (i >= count) continue
          if (d.x > kx) continue

          ctx.beginPath()
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${d.a})`
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
