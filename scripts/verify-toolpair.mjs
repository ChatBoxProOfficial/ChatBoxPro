/**
 * 验证：历史里带 tool_calls + tool 消息时，下一次请求不会出现孤儿 tool 消息（400 根因）。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8822/'
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

let chatBodies = []
page.on('request', (r) => {
  if (r.url().includes('/api/chat') && r.method() === 'POST') {
    try {
      chatBodies.push(JSON.parse(r.postData()))
    } catch {}
  }
})

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// key
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(420)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: 'ChatBox Pro 账号与模型', exact: true }).click()
await page.waitForSelector('input[type=password]', { timeout: 5000 })
await page.fill('input[type=password]', 'sk-mock-key')
await page.getByRole('button', { name: '保存', exact: true }).click()
await page.waitForTimeout(300)
await page.locator('.settings-close').click()

// 造一个"跑过工具"的会话：assistant 正文为空但有 tool_calls，后跟 tool 结果
await page.evaluate(async () => {
  const openDb = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open('chatbox-pro', 1)
      r.onupgradeneeded = () => {
        const d = r.result
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv')
        if (!d.objectStoreNames.contains('sessions'))
          d.createObjectStore('sessions', { keyPath: 'id' })
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  const db = await openDb()
  const now = Date.now()
  const messages = [
    { id: 'u1', role: 'user', content: '现在几点了', createdAt: now },
    {
      id: 'a1',
      role: 'assistant',
      content: '',
      createdAt: now + 1,
      toolCalls: [{ id: 'call_x1', name: 'get_current_time', arguments: '{}' }],
    },
    {
      id: 't1',
      role: 'tool',
      content: '2026-11-18 20:30 星期三',
      createdAt: now + 2,
      toolCallId: 'call_x1',
      toolName: 'get_current_time',
    },
    { id: 'a2', role: 'assistant', content: '现在是 20:30。', createdAt: now + 3 },
  ]
  await new Promise((res) => {
    const t = db.transaction('sessions', 'readwrite')
    t.objectStore('sessions').put({
      id: 'pair-1',
      title: '工具配对测试',
      storage: 'local',
      model: 'deepseek-flash',
      createdAt: now,
      updatedAt: now,
      messages,
    })
    t.oncomplete = () => res()
  })
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(420)
await page.locator('.conv-item', { hasText: '工具配对测试' }).click()
await page.waitForTimeout(600)

// 再发一条，看是否 400
await page.fill('.composer-input', '谢谢')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForTimeout(2500)

const err = await page.locator('.msg.assistant.error').count()
console.log('错误消息数:', err, '| 请求数:', chatBodies.length)

const body = chatBodies[chatBodies.length - 1]
if (!body) {
  errors.push('没有发出请求')
} else {
  const msgs = body.messages || []
  let pending = new Set()
  let orphans = 0
  for (const m of msgs) {
    if (m.role === 'tool') {
      if (!pending.has(m.tool_call_id)) orphans++
      pending.delete(m.tool_call_id)
    } else if (m.role === 'assistant' && m.tool_calls?.length) {
      pending = new Set(m.tool_calls.map((c) => c.id))
    } else {
      pending = new Set()
    }
  }
  console.log('孤立 tool 消息数:', orphans)
  console.log(
    '消息序列:',
    msgs.map((m) => (m.role === 'assistant' && m.tool_calls ? 'assistant(tool_calls)' : m.role)).join(' → '),
  )
  if (orphans > 0) errors.push('请求里仍有孤儿 tool 消息')
  if (err > 0) errors.push('界面出现错误消息')
}

await page.screenshot({ path: `${OUT}/94-tool-pair.png` })
await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
