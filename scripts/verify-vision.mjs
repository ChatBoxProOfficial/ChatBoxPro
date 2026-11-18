/**
 * 验证真正的图像理解：图片以 image_url(data URL) 内容块发出，模型能"看"。
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8810/'
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

// 发图片 + 提问
await page.setInputFiles('input[type=file]', `${OUT}/test-photo.jpg`)
await page.waitForTimeout(1200)
const chip = await page.locator('.attach-chip').innerText()
console.log('✓ 附件:', chip.replace(/\n/g, ' '))
await page.screenshot({ path: `${OUT}/62-image-attached.png` })

await page.fill('.composer-input', '这张图片里有什么？')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant .md', { timeout: 20000 })
await page.waitForTimeout(500)

// 断言请求
const req = JSON.parse(readFileSync('mock-last-request.json', 'utf8'))
const users = req.messages.filter((m) => m.role === 'user')
const last = users[users.length - 1]
const blocks = Array.isArray(last?.content) ? last.content : []
const img = blocks.find((b) => b.type === 'image_url')
console.log('✓ 内容块:', blocks.map((b) => b.type).join(' / '))
if (!img) {
  errors.push('没有 image_url 内容块')
} else {
  const url = img.image_url.url
  console.log('✓ 图片是 data URL:', url.slice(0, 30) + '…', '长度', url.length)
  if (!url.startsWith('data:image/')) errors.push('不是 data URL')
}

const reply = await page.locator('.msg.assistant .md').last().innerText()
console.log('✓ 回复:', reply.replace(/\n/g, ' ').slice(0, 40))
await page.screenshot({ path: `${OUT}/63-image-reply.png` })

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
