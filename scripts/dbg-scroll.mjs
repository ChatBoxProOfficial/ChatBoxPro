import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 1200, height: 900 } })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8838/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
// 造一条长会话，让聊天区出现滚动条
await p.evaluate(async () => {
  const openDb = () => new Promise((res, rej) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id' }) }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const db = await openDb()
  const now = Date.now()
  const messages = []
  for (let i = 0; i < 14; i++) {
    messages.push({ id: 'u' + i, role: 'user', content: '第 ' + (i + 1) + ' 个问题：天空为什么是蓝色？', createdAt: now + i * 10 })
    messages.push({ id: 'a' + i, role: 'assistant', content: '因为瑞利散射，波长越短散射越强。这是第 ' + (i + 1) + ' 个回答。', createdAt: now + i * 10 + 5 })
  }
  await new Promise((res) => { const t = db.transaction('sessions', 'readwrite'); t.objectStore('sessions').put({ id: 'scroll-1', title: '滚动条测试', storage: 'local', model: 'deepseek-flash', createdAt: now, updatedAt: now, messages }); t.oncomplete = () => res() })
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.getByRole('button', { name: '展开栏目' }).click()
await p.waitForTimeout(450)
await p.locator('.conv-item', { hasText: '滚动条测试' }).click()
await p.waitForTimeout(700)
// 读滚动条样式
const style = await p.evaluate(() => {
  const el = document.querySelector('.msg-list') || document.body
  const cs = getComputedStyle(el, '::-webkit-scrollbar-thumb')
  const bar = getComputedStyle(el, '::-webkit-scrollbar')
  return { thumb: cs.backgroundColor, radius: cs.borderRadius, width: bar.width }
})
console.log('滚动条样式:', JSON.stringify(style))
await p.screenshot({ path: 'shots/129-scrollbar-dark.png' })
// 浅色
await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv') }; r.onsuccess = () => res(r.result) })
  await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ theme: 'light' }, 'settings'); t.oncomplete = () => res() })
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.getByRole('button', { name: '展开栏目' }).click()
await p.waitForTimeout(450)
await p.locator('.conv-item', { hasText: '滚动条测试' }).click()
await p.waitForTimeout(600)
await p.screenshot({ path: 'shots/130-scrollbar-light.png' })
await b.close()
