/**
 * 用本机已安装的 Edge（channel: msedge）做无头验证：
 * 打开界面、走一遍主要流程、截图、收集控制台错误。
 *
 * 运行：node scripts/verify.mjs
 * 前提：npm run build 之后，node server/index.mjs 已在 8787 端口运行。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8787/'
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
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  // 可选的资源（打赏二维码还没放进去）不算问题
  if (/404/.test(t) && m.location()?.url?.includes('tip-qr')) return
  errors.push(t)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.list-screen', { timeout: 15000 })
await page.screenshot({ path: `${OUT}/01-list.png` })
console.log('✓ 列表页渲染')

// 新建会话
await page.getByRole('button', { name: /新对话（仅本机）/ }).click()
await page.waitForSelector('.chat-screen', { timeout: 10000 })
await page.screenshot({ path: `${OUT}/02-chat-empty.png` })
console.log('✓ 进入对话页')

// 未填 key 时发送，应出现明确报错而不是沉默
await page.fill('.composer textarea', '你好，测试一下')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant', { timeout: 10000 })
const errText = await page.locator('.msg.assistant').last().innerText()
console.log('✓ 无 Key 时的提示：', errText.slice(0, 60).replace(/\n/g, ' '))
await page.screenshot({ path: `${OUT}/03-chat-nokey.png` })

// 设置页
await page.getByRole('button', { name: '设置' }).click()
await page.waitForSelector('.settings-screen', { timeout: 10000 })
await page.screenshot({ path: `${OUT}/04-settings.png`, fullPage: true })
console.log('✓ 设置页渲染')

// 投喂弹窗
await page.getByRole('button', { name: '支持一下' }).click()
await page.waitForSelector('.modal', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/05-tip.png` })
console.log('✓ 投喂弹窗渲染')

await browser.close()

if (errors.length) {
  console.log('\n控制台错误：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n控制台无错误 ✓')
}
