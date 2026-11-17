/**
 * 验证：输入栏模型名右侧的强度（更淡）、收起按钮真的收窄了输入栏。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8802/'
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
await page.screenshot({ path: `${OUT}/47-composer-effort.png` })

// 1) 强度文字
const effortText = await page.locator('.chip-effort').innerText()
const chipColor = await page.locator('.model-chip').evaluate((el) => getComputedStyle(el).color)
const effortColor = await page.locator('.chip-effort').evaluate((el) => getComputedStyle(el).color)
console.log('✓ 输入栏强度:', effortText, '| 模型名颜色', chipColor, '| 强度颜色', effortColor)
if (!effortText.trim()) errors.push('没有显示思考强度')
if (chipColor === effortColor) errors.push('强度颜色和模型名一样，不够淡')

// 2) 收起
const bar = page.locator('.composer-bar')
const before = await bar.boundingBox()
await page.locator('.tool-btn.text').click()
await page.waitForTimeout(300)
const after = await bar.boundingBox()
await page.screenshot({ path: `${OUT}/48-composer-collapsed.png` })
console.log('✓ 输入栏高度 收起前/后:', Math.round(before.height), '/', Math.round(after.height))
if (after.height >= before.height - 2) errors.push('收起没有让输入栏变矮')

// 3) 展开回来
await page.locator('.tool-btn.text').click()
await page.waitForTimeout(300)
const back = await bar.boundingBox()
console.log('✓ 展开后高度:', Math.round(back.height))
if (back.height < after.height + 2) errors.push('展开没有恢复')

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
