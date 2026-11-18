/**
 * 验证官方扩展能力：文件解析（file_id 内容块）、内容安全参数、用户元信息。
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8809/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })
// 造一个假的 PDF（内容不需要真，mock 上游只回 id）
writeFileSync(`${OUT}/sample.pdf`, '%PDF-1.4 mock content')

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

// 打开「内容安全」
await page.locator('.model-chip').click()
await page.waitForSelector('.team-row', { timeout: 5000 })
await page.locator('.team-row', { hasText: '内容安全' }).locator('.switch').click()
await page.waitForTimeout(200)
await page.locator('.pop-mask').click({ position: { x: 4, y: 4 } }).catch(() => {})

// 上传 PDF
await page.setInputFiles('input[type=file]', `${OUT}/sample.pdf`)
await page.waitForTimeout(1200)
const chip = await page.locator('.attach-chip').innerText()
console.log('✓ 附件状态:', chip.replace(/\n/g, ' '))

// 发送
await page.fill('.composer-input', '总结这份 PDF')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant .md', { timeout: 20000 })
await page.waitForTimeout(500)

const req = JSON.parse(readFileSync('mock-last-request.json', 'utf8'))
console.log('✓ safety_check:', JSON.stringify(req.safety_check))
const userMsgs = req.messages.filter((m) => m.role === 'user')
const last = userMsgs[userMsgs.length - 1]
const blocks = Array.isArray(last?.content) ? last.content : []
const hasFile = blocks.some((b) => b.type === 'file' && b.file_id)
console.log('✓ 用户消息内容块:', JSON.stringify(blocks.map((b) => b.type)))
const hasReminder = req.messages.some((m) => m.role === 'latest_reminder')
console.log('✓ 是否带 latest_reminder:', hasReminder)
console.log('  reminder 内容:', req.messages.find((m) => m.role === 'latest_reminder')?.content)

if (!req.safety_check) errors.push('没有传 safety_check')
if (!hasFile) errors.push('没有把 file_id 作为内容块发出去')
if (!hasReminder) errors.push('没有 latest_reminder')

await page.screenshot({ path: `${OUT}/61-official-tools.png` })
await browser.close()

if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
