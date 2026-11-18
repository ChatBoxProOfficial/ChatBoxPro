/**
 * 验证大文件：大图压缩后内联、超大文本走 Files API。
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8811/'
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

// 1) 大图（4000×3000）
await page.setInputFiles('input[type=file]', `${OUT}/big-photo.jpg`)
await page.waitForTimeout(2000)
const chipImg = await page.locator('.attach-chip').first().innerText()
console.log('✓ 大图附件:', chipImg.replace(/\n/g, ' '))
await page.fill('.composer-input', '这张图里有什么')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant .md', { timeout: 25000 })
await page.waitForTimeout(400)

let req = JSON.parse(readFileSync('mock-last-request.json', 'utf8'))
let users = req.messages.filter((m) => m.role === 'user')
let blocks = Array.isArray(users[users.length - 1]?.content) ? users[users.length - 1].content : []
const img = blocks.find((b) => b.type === 'image_url')
if (!img) {
  errors.push('大图没有 image_url 块')
} else {
  const len = img.image_url.url.length
  console.log('✓ 大图 data URL 长度:', (len / 1024 / 1024).toFixed(2), 'MB')
  if (len > 8 * 1024 * 1024) errors.push('压缩后仍然太大')
}

// 2) 超大文本（8.3MB）
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })
await page.setInputFiles('input[type=file]', `${OUT}/big-note.md`)
await page.waitForTimeout(2500)
const chipTxt = await page.locator('.attach-chip').first().innerText()
console.log('✓ 大文本附件:', chipTxt.replace(/\n/g, ' '))
await page.fill('.composer-input', '总结这个文件')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant .md', { timeout: 25000 })
await page.waitForTimeout(400)

req = JSON.parse(readFileSync('mock-last-request.json', 'utf8'))
users = req.messages.filter((m) => m.role === 'user')
blocks = Array.isArray(users[users.length - 1]?.content) ? users[users.length - 1].content : []
const fileBlock = blocks.find((b) => b.type === 'file')
console.log('✓ 大文本内容块:', blocks.map((b) => b.type).join(' / '))
if (!fileBlock) errors.push('超大文本没有走 Files API')

await page.screenshot({ path: `${OUT}/64-large-files.png` })
await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
