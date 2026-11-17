/**
 * 验证新的输入栏（悬浮圆角方块）与模型面板（全名 + 思考强度滑轮）。
 * 运行：node scripts/verify-composer.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8790/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })
await page.screenshot({ path: `${OUT}/30-composer.png` })

// 输入栏不再铺满底部：左右应有留白
const box = await page.locator('.composer-bar').boundingBox()
const vp = page.viewportSize()
console.log('✓ 输入栏宽:', Math.round(box.width), '/ 视口宽:', vp.width)
if (box.width >= vp.width) errors.push('输入栏仍然铺满整个宽度')
if (box.x < 6) errors.push('输入栏左侧没有留白')

// 打开模型面板
await page.locator('.model-chip').click()
await page.waitForSelector('.model-pop', { timeout: 5000 })
await page.waitForTimeout(250)
await page.screenshot({ path: `${OUT}/31-model-pop.png` })

const names = await page.locator('.pop-item-name').allInnerTexts()
console.log('✓ 面板里的模型名:', names.join(' / '))
if (!names.some((n) => n.includes('1017'))) errors.push('没有显示全名（缺 1017）')

// 思考强度滑轮：默认 high → 拖到低档
const ticks = await page.locator('.effort-tick').allInnerTexts()
console.log('✓ 思考强度档位:', ticks.join(' / '))
if (ticks.join(',') !== 'off,low,high,max') errors.push('档位不是 off/low/high/max')

await page.locator('.effort-slider input[type=range]').fill('0')
await page.waitForTimeout(200)
const value = await page.locator('.effort-value').innerText()
console.log('✓ 滑到最左后显示:', value)
if (!value.includes('关闭')) errors.push('off 档没有对应「关闭思考」')

await page.screenshot({ path: `${OUT}/32-model-pop-off.png` })

// 滚回 high
await page.locator('.effort-slider input[type=range]').fill('2')
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/33-model-pop-high.png` })
console.log('✓ 已切回 high')

await browser.close()

if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
