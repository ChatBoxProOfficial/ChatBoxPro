/**
 * 用假上游验证「流式思维链」能否正确落地到界面。
 *
 * 步骤：mock 上游(8899) → 中转(8788, 指向 mock) → 浏览器填 key → 发消息 → 截图
 * 运行：node scripts/verify-reasoning.mjs
 */
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8788/'
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
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text())
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// 1) 填一个假 Key（不校验有效性，只用来通过前置检查）
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(400)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: 'ChatBox Pro 账号与模型', exact: true }).click()
await page.waitForSelector('input[type=password]', { timeout: 5000 })
await page.fill('input[type=password]', 'sk-mock-test-key')
await page.getByRole('button', { name: '保存', exact: true }).click()
await page.waitForTimeout(600)
await page.locator('.settings-close').click()
await page.waitForSelector('.composer', { timeout: 5000 })

// 2) 发消息
await page.fill('.composer-input', '天空为什么是蓝色的？')
await page.getByRole('button', { name: '发送' }).click()

// 3) 等思维链出现
await page.waitForSelector('.thinking-head', { timeout: 15000 })
await page.screenshot({ path: `${OUT}/24-stream-thinking.png` })
console.log('✓ 流式阶段出现思维链折叠条')

await page.waitForSelector('.msg.assistant .md', { timeout: 20000 })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/25-after-answer.png` })

// 4) 展开思维链看内容
await page.locator('.thinking-head').click()
await page.waitForSelector('.thinking-body', { timeout: 5000 })
const body = await page.locator('.thinking-body').innerText()
console.log('✓ 思维链内容长度：', body.length, '字符')
await page.screenshot({ path: `${OUT}/26-thinking-open.png` })

// 5) 动画结束截图（DSH 与网页版都看一遍）
// 5) 切到 DSH 风格再看一遍
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(400)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: '管理模型', exact: true }).click()
await page.waitForSelector('.radio-list', { timeout: 5000 })
await page.getByText('2 号：仿 DSH').click()
await page.locator('.settings-close').click()
await page.waitForSelector('.thinking-dsh', { timeout: 8000 })
await page.screenshot({ path: `${OUT}/27-dsh-collapsed.png` })
await page.locator('.dsh-head').click()
await page.waitForSelector('.dsh-raw', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/28-dsh-open.png` })
console.log('✓ DSH 风格已渲染（折叠 + 展开）')

await browser.close()

// 6) 断言上游收到的参数
const log = 'mock-last-request.json'
if (existsSync(log)) {
  const req = JSON.parse(readFileSync(log, 'utf8'))
  console.log('✓ 上游收到 model =', req.model)
  console.log('✓ thinking =', JSON.stringify(req.thinking))
  console.log('✓ reasoning_effort =', req.reasoning_effort)
  if (req.model !== 'deepseek-flash') errors.push(`模型名不对：${req.model}`)
  if (req.thinking?.type !== 'enabled') errors.push('thinking 没传 enabled')
  if (!req.reasoning_effort) errors.push('reasoning_effort 没传')
} else {
  errors.push('没有抓到上游请求（mock 未记录）')
}

if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
