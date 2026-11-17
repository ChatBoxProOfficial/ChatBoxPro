/**
 * 用本机 Edge（channel: msedge）做无头验证：主界面、侧边栏、发消息、设置。
 *
 * 运行：node scripts/verify.mjs
 * 前提：npm run build 之后，node server/index.mjs 已在 8787 运行。
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8787/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/sample.txt`, '这是用于验证上传的文件\n')

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
  if (/404/.test(t) && m.location()?.url?.includes('tip-qr')) return
  errors.push(t)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.welcome', { timeout: 15000 })
const greeting = await page.locator('.welcome-title').innerText()
console.log('✓ 主界面：', greeting)
await page.screenshot({ path: `${OUT}/10-home.png` })

// 侧边栏
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForSelector('.drawer.show', { timeout: 5000 })
await page.waitForTimeout(450) // 等抽屉滑入动画结束再截图
await page.screenshot({ path: `${OUT}/11-sidebar.png` })
console.log('✓ 侧边栏打开')

const hasNewConv = await page.getByRole('button', { name: /建立一个新的对话/ }).count()
console.log('✓ 新建对话入口：', hasNewConv ? '有' : '缺失')

const foot = await page.locator('.drawer-foot').innerText()
console.log('✓ 底部账号：', foot.replace(/\n/g, ' / '))

// 关侧边栏，测附件上传
await page.locator('.drawer-mask').click({ position: { x: 360, y: 400 } })
await page.waitForTimeout(300)
await page.setInputFiles('input[type=file]', `${OUT}/sample.txt`)
await page.waitForTimeout(1200)
const chip = await page.locator('.attach-chip').count()
console.log('✓ 附件上传：', chip ? '成功显示 chip' : '没有 chip')
await page.screenshot({ path: `${OUT}/12-attach.png` })

// 输入并发送（没填 key，应给出明确提示）
await page.fill('.composer-input', '你好，测试一下新界面')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant', { timeout: 12000 })
await page.waitForSelector('.msg.assistant.hint, .msg.assistant.error', { timeout: 12000 })
const errText = await page.locator('.msg.assistant').last().innerText()
console.log('✓ 无 Key 提示：', errText.replace(/\n/g, ' ').slice(0, 60))
await page.screenshot({ path: `${OUT}/13-chat.png` })

// 模型菜单
await page.locator('.model-chip').click()
await page.waitForSelector('.pop-menu', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/14-model.png` })
console.log('✓ 模型菜单弹出')
await page.locator('.pop-mask').click({ position: { x: 10, y: 10 } })

// 设置（从侧边栏底部）
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(400)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-screen', { timeout: 8000 })
await page.waitForSelector('.settings-index', { timeout: 5000 })
await page.waitForTimeout(450) // 等侧边栏退场动画结束
await page.screenshot({ path: `${OUT}/15-settings.png`, fullPage: true })
const rows = await page.locator('.index-row').count()
console.log('✓ 设置分类数：', rows)

// 进入某个板块
await page.getByRole('button', { name: /管理模型/ }).first().click()
await page.waitForSelector('.model-list', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/16-settings-detail.png` })
console.log('✓ 板块详情打开：管理模型')
await page.getByRole('button', { name: '返回' }).click()
await page.waitForSelector('.settings-index', { timeout: 5000 })
console.log('✓ 返回分类列表')

await browser.close()

if (errors.length) {
  console.log('\n控制台错误：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n控制台无错误 ✓')
}
