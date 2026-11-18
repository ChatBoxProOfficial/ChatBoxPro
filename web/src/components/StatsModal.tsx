import { useMemo } from 'react'
import type { Session } from '../types'

/** 单价（元 / 百万 tokens），闲时与高峰两档 */
const PRICE: Record<string, { hit: [number, number]; miss: [number, number]; out: [number, number] }> = {
  'deepseek-flash': { hit: [0.02, 0.04], miss: [1, 2], out: [4, 8] },
  'deepseek-v4-pro': { hit: [0.15, 0.3], miss: [4.5, 9], out: [13.5, 27] },
}

/** 北京时间周一至周五 9-12、14-18 为高峰 */
function isPeak(d = new Date()): boolean {
  const bj = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000)
  const day = bj.getDay()
  if (day === 0 || day === 6) return false
  const h = bj.getHours()
  return (h >= 9 && h < 12) || (h >= 14 && h < 18)
}

function fmtTok(n?: number): string {
  if (!n) return '0'
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function fmtMs(ms?: number): string {
  if (!ms || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return `${m}m${s}s`
}

interface Props {
  session: Session
  onClose: () => void
}

export default function StatsModal({ session, onClose }: Props) {
  const stats = useMemo(() => {
    const msgs = session.messages || []
    const turns = msgs.filter((m) => m.role === 'user').length
    const steps = msgs.filter((m) => m.role === 'assistant' && !m.error).length

    let totalMs = 0
    let timed = 0
    let firstTokenSum = 0
    let firstTokenCount = 0
    let prompt = 0
    let cached = 0
    let completion = 0
    let reasoning = 0
    let hasUsage = false
    let lastContext = 0

    for (const m of msgs) {
      if (m.role !== 'assistant' || !m.meta) continue
      const { startedAt, firstTokenAt, endedAt } = m.meta
      if (startedAt && endedAt) {
        totalMs += endedAt - startedAt
        timed++
      }
      if (startedAt && firstTokenAt) {
        firstTokenSum += firstTokenAt - startedAt
        firstTokenCount++
      }
      if (m.usage) {
        hasUsage = true
        prompt += m.usage.prompt || 0
        cached += m.usage.cached || 0
        completion += m.usage.completion || 0
        reasoning += m.usage.reasoning || 0
      }
    }

    // 最近一次带用量的回复，用于算上下文占用
    for (let i = msgs.length - 1; i >= 0; i--) {
      const u = msgs[i].usage
      if (u && (u.prompt || u.cached)) {
        lastContext = (u.prompt || 0) + (u.cached || 0)
        break
      }
    }

    const model = session.model || 'deepseek-flash'
    const p = PRICE[model] || PRICE['deepseek-flash']
    const peakIdx = isPeak() ? 1 : 0
    const cost =
      (cached / 1e6) * p.hit[peakIdx] +
      (prompt / 1e6) * p.miss[peakIdx] +
      (completion / 1e6) * p.out[peakIdx]

    const inputTotal = prompt + cached
    const hitRate = inputTotal > 0 ? (cached / inputTotal) * 100 : null
    const ctxLimit = 1_000_000
    return {
      turns,
      steps,
      totalMs,
      avgMs: timed ? totalMs / timed : 0,
      avgFirst: firstTokenCount ? firstTokenSum / firstTokenCount : 0,
      prompt,
      cached,
      completion,
      reasoning,
      total: prompt + cached + completion,
      hasUsage,
      hitRate,
      lastContext,
      ctxPct: Math.min(100, (lastContext / ctxLimit) * 100),
      cost,
      peak: peakIdx === 1,
      model,
    }
  }, [session])

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-head">
          <span>会话统计</span>
          <button className="settings-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <div className="stat-label">对话轮数</div>
            <div className="stat-value">{stats.turns}</div>
          </div>
          <div className="stat">
            <div className="stat-label">执行步数</div>
            <div className="stat-value">{stats.steps}</div>
          </div>
          <div className="stat">
            <div className="stat-label">累计用时</div>
            <div className="stat-value">{fmtMs(stats.totalMs)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">平均每步</div>
            <div className="stat-value">{fmtMs(stats.avgMs)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">首字延迟</div>
            <div className="stat-value">{fmtMs(stats.avgFirst)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">缓存命中率</div>
            <div className="stat-value">
              {stats.hitRate === null ? '—' : `${stats.hitRate.toFixed(0)}%`}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">上下文占用</div>
            <div className="stat-value">
              {stats.lastContext === 0 ? '—' : `${stats.ctxPct.toFixed(1)}%`}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">估算费用</div>
            <div className="stat-value">
              ¥{stats.cost.toFixed(3)}
              <span className="stat-hint">{stats.peak ? '高峰' : '闲时'}</span>
            </div>
          </div>
        </div>

        <div className="stats-section">
          <div className="stats-title">Token 用量</div>
          {stats.hasUsage ? (
            <>
              <div className="tok-rows">
                <div className="tok-row">
                  <span>输入（未命中缓存）</span>
                  <b>{fmtTok(stats.prompt)}</b>
                </div>
                <div className="tok-row">
                  <span>
                    输入（缓存命中）
                    {stats.hitRate !== null && (
                      <span className="stat-hint">{stats.hitRate.toFixed(0)}%</span>
                    )}
                  </span>
                  <b>{fmtTok(stats.cached)}</b>
                </div>
                <div className="tok-row">
                  <span>输出</span>
                  <b>{fmtTok(stats.completion)}</b>
                </div>
                {stats.reasoning > 0 && (
                  <div className="tok-row muted">
                    <span>其中思考</span>
                    <b>{fmtTok(stats.reasoning)}</b>
                  </div>
                )}
                <div className="tok-row total">
                  <span>合计</span>
                  <b>{fmtTok(stats.total)}</b>
                </div>
              </div>
            </>
          ) : (
            <p className="muted small">这个会话还没有拿到用量数据（旧消息不计）。</p>
          )}
        </div>

        <div className="stats-section">
          <div className="stats-title">
            上下文占用
            <span className="stat-hint">
              {fmtTok(stats.lastContext)} / 1M · {stats.ctxPct.toFixed(1)}%
            </span>
          </div>
          <div className="ctx-bar">
            <div className="ctx-fill" style={{ width: `${Math.max(0.5, stats.ctxPct)}%` }} />
          </div>
          <p className="muted small">
            按最近一次请求的输入 token 计算；模型上下文上限 1M。
          </p>
        </div>
      </div>
    </div>
  )
}
