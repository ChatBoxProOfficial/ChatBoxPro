import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN', colorScheme: 'dark' })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8814/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv') }; r.onsuccess = () => res(r.result) })
  await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ theme: 'dark' }, 'settings'); t.oncomplete = () => res() })
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
console.log('主题:', await p.evaluate(() => document.documentElement.dataset.theme))
await p.locator('.model-chip').click()
await p.waitForSelector('.model-pop', { timeout: 5000 })
await p.waitForTimeout(500)
const note = await p.evaluate(() => {
  const el = document.querySelector('.effort-note')
  const s = getComputedStyle(el)
  return s.color + ' | ' + s.backgroundColor
})
console.log('暗色 沉思徽标:', note)
await p.screenshot({ path: 'shots/73-dark-popover.png' })
await b.close()
