/**
 * 验证：在「上下文管理」里压缩指定对话。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8813/'
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

// 造一个有 10 条消息的会话
await page.evaluate(async () => {
  const openDb = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open('chatbox-pro', 1)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  const db = await openDb()
  const now = Date.now()
  const messages = []
  for (let i = 0; i < 5; i++) {
    messages.push({ id: `u${i}`, role: 'user', content: `第 ${i + 1} 个问题：天空为什么是蓝色？`, createdAt: now + i * 1000 })
    messages.push({ id: `a${i}`, role: 'assistant', content: `第 ${i + 1} 个回答：因为瑞利散射。`, createdAt: now + i * 1000 + 500 })
  }
  await new Promise((res, rej) => {
    const t = db.transaction('sessions', 'readwrite')
    const rq = t.objectStore('sessions').put({
      id: 'long-1',
      title: '长对话测试',
      storage: 'local',
      model: 'deepseek-flash',
      createdAt: now,
      updatedAt: now,
      messages,
    })
    rq.onsuccess = () => res()
    rq.onerror = () => rej(rq.error)
  })
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// 打开设置 → 上下文管理
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(420)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: '上下文管理', exact: true }).click()
await page.waitForTimeout(300)

await page.waitForSelector('text=压缩指定对话的上下文', { timeout: 5000 })
await page.locator('.card select').first().selectOption({ label: '长对话测试（10 条）' })
await page.screenshot({ path: `${OUT}/69-compress-pick.png` })

await page.getByRole('button', { name: '压缩这个对话' }).click()
await page.getByRole('button', { name: '压缩', exact: true }).click()
await page.waitForSelector('text=完成：', { timeout: 20000 })
const msg = await page.locator('.card', { hasText: '压缩指定对话的上下文' }).locator('p.muted').last().innerText()
console.log('✓ 压缩结果:', msg)
if (!msg.includes('10 条 → 7 条')) errors.push(`压缩结果不对：${msg}`)
await page.screenshot({ path: `${OUT}/70-compress-done.png` })

// 回到对话看摘要块
await page.locator('.settings-close').click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(420)
await page.locator('.conv-item', { hasText: '长对话测试' }).click()
await page.waitForTimeout(600)
await page.waitForSelector('.msg.summary', { timeout: 8000 })
const summary = await page.locator('.summary-body').innerText()
console.log('✓ 摘要:', summary.slice(0, 40))
await page.screenshot({ path: `${OUT}/71-summary-block.png` })

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
