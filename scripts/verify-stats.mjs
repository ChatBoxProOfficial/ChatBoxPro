/**
 * 验证会话统计：轮数/步数、耗时、token 用量、上下文占用。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8807/'
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

// 填 key
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(400)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: 'ChatBox Pro 账号与模型', exact: true }).click()
await page.waitForSelector('input[type=password]', { timeout: 5000 })
await page.fill('input[type=password]', 'sk-mock-key')
await page.getByRole('button', { name: '保存', exact: true }).click()
await page.waitForTimeout(400)
await page.locator('.settings-close').click()
await page.waitForSelector('.composer', { timeout: 5000 })

// 发一条消息
await page.fill('.composer-input', '天空为什么是蓝色？')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg-meta', { timeout: 20000 })
const meta = await page.locator('.msg-meta').last().innerText()
console.log('✓ 消息底部元信息:', meta.replace(/\n/g, ' '))
if (!/\d/.test(meta)) errors.push('消息底部没有耗时/用量')

// 打开统计
await page.locator('.icon-btn[aria-label="会话统计"]').click()
await page.waitForSelector('.stats-modal', { timeout: 5000 })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/56-stats.png` })

const values = await page.locator('.stat-value').allInnerTexts()
const labels = await page.locator('.stat-label').allInnerTexts()
console.log('✓ 统计卡片:', labels.map((l, i) => `${l}=${values[i]}`).join(' | '))

const tokText = await page.locator('.tok-rows').innerText()
console.log('✓ Token 行:', tokText.replace(/\n/g, ' / '))
if (!tokText.includes('1.2k') && !tokText.includes('1200')) {
  errors.push('token 数字不对')
}

const ctxHint = await page.locator('.stats-title').last().innerText()
console.log('✓ 上下文:', ctxHint.replace(/\n/g, ' '))
const fill = await page.locator('.ctx-fill').evaluate((el) => el.style.width)
console.log('✓ 上下文进度条宽度:', fill)
if (!fill || parseFloat(fill) <= 0) errors.push('上下文进度条没动')

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
