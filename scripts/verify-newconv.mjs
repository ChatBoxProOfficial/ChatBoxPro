/**
 * 验证：点「建立一个新的对话」立刻创建会话（侧边栏可见、刷新后仍在），
 * 不需要先发消息。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8804/'
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

// 初始状态：侧边栏应无会话
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(400)
const before = await page.locator('.conv-item').count()
console.log('✓ 初始会话数:', before)

// 点「建立一个新的对话」
await page.getByRole('button', { name: /建立一个新的对话/ }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(450)
const after = await page.locator('.conv-item').count()
const titles = await page.locator('.conv-title').allInnerTexts()
await page.screenshot({ path: `${OUT}/49-new-conv.png` })
console.log('✓ 点击后会话数:', after, '| 列表:', titles.join(' / '))
if (after <= before) errors.push('点了「建立新的对话」没有创建会话')

// 刷新后仍在
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(450)
const persisted = await page.locator('.conv-item').count()
console.log('✓ 刷新后会话数:', persisted)
if (persisted !== after) errors.push('刷新后会话丢了')

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
