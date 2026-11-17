/**
 * 验证：旧的「思维链拼在正文里」的历史消息，打开时会被拆回 reasoning。
 * 运行：node scripts/verify-migration.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8789/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

await page.evaluate(async () => {
  const openDb = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open('chatbox-pro', 1)
      r.onupgradeneeded = () => {
        const db = r.result
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' })
          s.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  const db = await openDb()
  const now = Date.now()
  const session = {
    id: 'legacy-reasoning',
    title: '旧格式会话',
    storage: 'local',
    model: 'deepseek-chat',
    createdAt: now - 10000,
    updatedAt: now,
    messages: [
      { id: 'u1', role: 'user', content: '天空为什么是蓝的？', createdAt: now - 8000 },
      {
        id: 'a1',
        role: 'assistant',
        createdAt: now - 7000,
        content:
          '> 思考过程\n\n> 先确定现象：白天偏蓝。\n> 再想机制：瑞利散射。\n\n因为蓝光波长短，被散射得更厉害。',
      },
    ],
  }
  await new Promise((res, rej) => {
    const t = db.transaction('sessions', 'readwrite')
    const rq = t.objectStore('sessions').put(session)
    rq.onsuccess = () => res()
    rq.onerror = () => rej(rq.error)
  })
})

await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(450)
await page.getByText('旧格式会话').first().click()
await page.waitForSelector('.thinking-head', { timeout: 8000 })

const md = await page.locator('.msg.assistant .md').last().innerText()
const pill = await page.locator('.thinking-head').last().innerText()
await page.screenshot({ path: `${OUT}/29-legacy-migrated.png` })

console.log('✓ 出现思维链折叠条：', pill.replace(/\n/g, ' '))
console.log('✓ 正文：', md.replace(/\n/g, ' ').slice(0, 40))
if (md.includes('思考过程')) {
  console.log('✗ 正文里还残留「思考过程」引用块')
  process.exitCode = 1
} else {
  console.log('✓ 正文已清理干净')
}
if (errors.length) {
  console.log('控制台错误：', errors)
  process.exitCode = 1
}
await browser.close()
