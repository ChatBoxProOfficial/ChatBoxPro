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

// 2) 收起：整条输入栏消失，只剩圆形「展开」
const bar = page.locator('.composer-bar')
const before = await bar.boundingBox()
await page.locator('.tool-btn.text').click()
await page.waitForTimeout(350)
const barAfter = await page.locator('.composer-bar').count()
const fab = page.locator('.collapsed-fab')
const fabVisible = await fab.isVisible()
const fabText = await fab.innerText()
await page.screenshot({ path: `${OUT}/48-composer-collapsed.png` })
console.log('✓ 收起后：输入栏数量', barAfter, '| 圆形按钮', fabVisible ? `可见「${fabText}」` : '缺失')
if (barAfter !== 0) errors.push('收起后输入栏还在')
if (!fabVisible) errors.push('收起后没有圆形展开按钮')

// 3) 点圆形按钮恢复
await fab.click()
await page.waitForTimeout(350)
const back = await page.locator('.composer-bar').boundingBox()
console.log('✓ 展开后输入栏高度:', Math.round(back.height), '（收起前', Math.round(before.height) + '）')
if (Math.abs(back.height - before.height) > 2) errors.push('展开后高度没恢复')

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
