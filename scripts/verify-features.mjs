/**
 * 验证六项建议：自动标题、代码块复制、消息复制、token/花费、附件内容可读、编辑/重新生成。
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8808/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/note.txt`, '这是附件的正文内容：请总结这三行。\n第二行。\n第三行。\n')

const errors = []
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  permissions: ['clipboard-read', 'clipboard-write'],
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

// 1) 附件 + 发送
await page.setInputFiles('input[type=file]', `${OUT}/note.txt`)
await page.waitForTimeout(900)
await page.fill('.composer-input', '帮我总结这个附件')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant .md', { timeout: 20000 })
await page.waitForTimeout(600)

// 2) 附件内容是否进了请求
const req = JSON.parse(readFileSync('mock-last-request.json', 'utf8'))
const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')
const content = typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content)
console.log('✓ 请求里含附件正文:', content.includes('这是附件的正文内容'))
if (!content.includes('这是附件的正文内容')) errors.push('附件正文没进请求')

// 3) 自动标题
const title = await page.locator('.title-line').innerText()
console.log('✓ 会话标题:', title)
if (title !== '瑞利散射与天空颜色') errors.push('自动标题没生效')

// 4) 代码块复制按钮
const copyBtns = await page.locator('.code-copy').count()
console.log('✓ 代码块复制按钮数量:', copyBtns)
if (copyBtns === 0) errors.push('代码块没有复制按钮')

// 5) 消息复制 + 缓存命中率
const meta = await page.locator('.msg-head').last().innerText()
console.log('✓ 消息元信息:', meta.replace(/\n/g, ' '))
const actions = await page.locator('.msg-actions').last().innerText()
if (!actions.includes('复制')) errors.push('缺少消息复制按钮')
if (!meta.includes('缓存')) errors.push('消息头部缺缓存命中率')

// 6) 重新生成
const before = await page.locator('.msg.assistant').count()
await page.getByRole('button', { name: '重新生成' }).click()
await page.waitForTimeout(2500)
const after = await page.locator('.msg.assistant').count()
console.log('✓ 重新生成前后助手消息数:', before, '→', after)
if (after !== before) errors.push('重新生成后消息数不对')

// 7) 编辑
await page.locator('.msg-action', { hasText: '编辑' }).first().click()
await page.waitForTimeout(400)
const inputVal = await page.locator('.composer-input').inputValue()
console.log('✓ 编辑后输入框:', inputVal.slice(0, 20))
if (!inputVal.includes('帮我总结')) errors.push('编辑没有把原文放回输入框')

await page.screenshot({ path: `${OUT}/58-features.png` })
// 再截一张有内容的
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(450)
await page.locator('.conv-item').first().click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/59-layout.png` })
await browser.close()

if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
