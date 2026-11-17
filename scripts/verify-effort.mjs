/**
 * 验证思考强度大滑块：圆角方块、白色旋钮、紫色粒子、档位备注。
 * 运行：node scripts/verify-effort.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8791/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

const errors = []
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
})
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })
await page.locator('.model-chip').click()
await page.waitForSelector('.eslider-track', { timeout: 5000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/34-effort-high.png` })

const knobAt = async () => {
  const box = await page.locator('.eslider-knob').boundingBox()
  return Math.round(box.x)
}

const highX = await knobAt()
const noteHigh = await page.locator('.effort-note').innerText()
const modelText = await page.locator('.effort-model').innerText()
console.log('✓ high 档备注:', noteHigh, '| 模型:', modelText)
console.log('✓ 旋钮位置(high):', highX)

const trackBox = await page.locator('.eslider-track').boundingBox()
// 拖到最左（off）
await page.locator('.eslider-track').click({ position: { x: 4, y: Math.round(trackBox.height / 2) } })
await page.waitForTimeout(400)
const noteOff = await page.locator('.effort-note').innerText()
const offX = await knobAt()
await page.screenshot({ path: `${OUT}/35-effort-off.png` })
console.log('✓ off 档备注:', noteOff, '| 旋钮位置:', offX)
if (!noteOff.includes('关闭')) errors.push('off 备注不是「关闭」')
if (offX >= highX) errors.push('旋钮没有跟着往左移动')

// 拖到最右（max）
await page.locator('.eslider-track').click({
  position: { x: Math.round(trackBox.width - 4), y: Math.round(trackBox.height / 2) },
})
await page.waitForTimeout(400)
const noteMax = await page.locator('.effort-note').innerText()
await page.screenshot({ path: `${OUT}/36-effort-max.png` })
console.log('✓ max 档备注:', noteMax)
if (!noteMax.includes('最大 token 消耗')) errors.push('max 备注不对')

// 回到 high 看粒子
await page.locator('.effort-tick', { hasText: 'high' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/37-effort-high-again.png` })

const canvasOk = await page.locator('.eslider-canvas').count()
if (!canvasOk) errors.push('没有粒子画布')

await browser.close()

if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
