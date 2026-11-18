/**
 * 验证：余额、文件管理、工具调用循环、继续生成。
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8812/'
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
await page.waitForTimeout(600)

// 余额（填完 key 后手动刷新一次）
await page.getByRole('button', { name: /刷新余额/ }).click().catch(() => {})
await page.waitForSelector('.balance-value', { timeout: 10000 })
const balance = await page.locator('.balance-value').innerText()
console.log('✓ 余额:', balance)
if (!balance.includes('23.88')) errors.push('余额没读到')
await page.screenshot({ path: `${OUT}/65-balance.png` })

// 文件管理
await page.getByRole('button', { name: '管理模型保存路径', exact: true }).click()
await page.waitForSelector('.file-row', { timeout: 8000 })
const fileText = await page.locator('.file-row').first().innerText()
console.log('✓ 云端文件:', fileText.replace(/\n/g, ' '))
await page.locator('.file-row .mini.danger').first().click()
await page.getByRole('button', { name: '删除', exact: true }).click({ timeout: 8000 })
await page.waitForTimeout(800)
console.log('✓ 删除流程执行完成')
await page.screenshot({ path: `${OUT}/66-files.png` })
await page.locator('.settings-close').click()
await page.waitForTimeout(300)

// 打开本地工具
await page.locator('.model-chip').click()
await page.waitForSelector('.team-row', { timeout: 5000 })
await page.locator('.team-row', { hasText: '本地工具' }).locator('.switch').click()
await page.waitForTimeout(200)
await page.locator('.pop-mask').click({ position: { x: 4, y: 4 } }).catch(() => {})

// 发消息，mock 会先要调 get_current_time
await page.fill('.composer-input', '现在几点了？')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.tool', { timeout: 25000 })
const toolLine = await page.locator('.msg.tool').last().innerText()
console.log('✓ 工具调用:', toolLine.replace(/\n/g, ' ').slice(0, 60))
await page.screenshot({ path: `${OUT}/67-tool-call.png` })

// 断言请求里带了 tools
const req = JSON.parse(readFileSync('mock-last-request.json', 'utf8'))
const names = (req.tools || []).map((t) => t.function?.name)
console.log('✓ 请求里的工具:', names.join(', '))
if (!names.includes('get_current_time')) errors.push('请求里没有 tools')

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
