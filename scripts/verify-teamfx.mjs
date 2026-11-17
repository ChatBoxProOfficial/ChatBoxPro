/**
 * 验证：max 标签只有在「团队协作开启」后才变成紫→蓝渐变；
 * 开启瞬间紫色粒子从旋钮处渐显出来。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8801/'
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

const team = page.locator('.team-row .switch')
const note = page.locator('.effort-note')
const bgOf = () => note.evaluate((el) => getComputedStyle(el).backgroundImage)
const clsOf = () => note.getAttribute('class')

await page.locator('.effort-tick', { hasText: 'max' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/44-max-no-team.png` })
console.log('✓ max（未开团队）class:', await clsOf(), '| 背景:', (await bgOf()) === 'none' ? '纯色' : '渐变')
if ((await bgOf()) !== 'none') errors.push('未开团队时 max 不该是渐变')

// 开启团队，抓两张：刚开启 & 稳定后
await team.click()
await page.waitForTimeout(120)
await page.screenshot({ path: `${OUT}/45-team-emerging.png` })
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/46-team-settled.png` })

console.log('✓ max（开团队）class:', await clsOf(), '| 背景:', (await bgOf()).includes('gradient') ? '渐变' : '纯色')
if (!(await bgOf()).includes('gradient')) errors.push('开启团队后 max 应该是渐变')

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
