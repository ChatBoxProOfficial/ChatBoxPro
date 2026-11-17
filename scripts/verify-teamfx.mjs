/**
 * 验证：团队协作开启时的紫色粒子，以及 max 档标签的紫→蓝渐变。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8799/'
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
const setEffort = async (name) => {
  await page.locator('.effort-tick', { hasText: name }).click()
  await page.waitForTimeout(300)
}

// 1) max + 团队开
await setEffort('max')
await team.click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/41-max-team.png` })
const maxBg = await page.locator('.effort-note').evaluate((el) => getComputedStyle(el).backgroundImage)
console.log('✓ max 标签背景:', maxBg.includes('gradient') ? '渐变' : maxBg)
if (!maxBg.includes('gradient')) errors.push('max 标签不是渐变')

// 2) high + 团队开
await setEffort('high')
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/42-high-team.png` })
const highBg = await page.locator('.effort-note').evaluate((el) => getComputedStyle(el).backgroundImage)
console.log('✓ high 标签背景:', highBg.includes('gradient') ? '渐变(不对)' : '纯色')
if (highBg.includes('gradient')) errors.push('high 标签不该是渐变')

// 3) high 关闭团队
await team.click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/43-high-team-off.png` })

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
