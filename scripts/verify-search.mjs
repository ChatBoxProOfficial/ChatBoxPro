/**
 * 验证「联网搜索」开关：打开后请求带 tools、界面出现搜索状态、结束后显示引用。
 * 依赖 scripts/mock-upstream.mjs + 指向它的中转。
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8805/'
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
await page.waitForTimeout(500)
await page.locator('.settings-close').click()
await page.waitForSelector('.composer', { timeout: 5000 })

// 打开联网搜索
await page.locator('.model-chip').click()
await page.waitForSelector('.team-row', { timeout: 5000 })
const rows = page.locator('.team-row')
console.log('✓ 面板里的开关行数:', await rows.count())
const searchRow = rows.filter({ hasText: '联网搜索' })
await searchRow.locator('.switch').click()
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/50-websearch-on.png` })
await page.keyboard.press('Escape').catch(() => {})
await page.locator('.pop-mask').click({ position: { x: 5, y: 5 } }).catch(() => {})

// 发消息
await page.fill('.composer-input', '天空为什么是蓝色？')
await page.getByRole('button', { name: '发送' }).click()

// 搜索状态
await page.waitForSelector('.searching-line', { timeout: 15000 })
console.log('✓ 出现「正在搜索」状态')
await page.screenshot({ path: `${OUT}/51-searching.png` })

// 引用
await page.waitForSelector('.citations', { timeout: 20000 })
const cite = await page.locator('.citation-title').first().innerText()
console.log('✓ 引用来源:', cite)
await page.screenshot({ path: `${OUT}/52-citations.png` })

// 上游收到的 tools
const req = JSON.parse(readFileSync('mock-last-request.json', 'utf8'))
console.log('✓ 上游 tools:', JSON.stringify(req.tools))
if (!Array.isArray(req.tools) || req.tools.length !== 2) {
  errors.push('请求里没有带上 tools')
}

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
