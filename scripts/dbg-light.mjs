import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8814/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
// 切浅色
await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv') }; r.onsuccess = () => res(r.result) })
  await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ theme: 'light' }, 'settings'); t.oncomplete = () => res() })
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
console.log('主题:', await p.evaluate(() => document.documentElement.dataset.theme))
await p.locator('.model-chip').click()
await p.waitForSelector('.model-pop', { timeout: 5000 })
await p.waitForTimeout(400)
await p.screenshot({ path: 'shots/72-light-popover.png' })
// 采样几个元素的颜色
const info = await p.evaluate(() => {
  const g = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const s = getComputedStyle(el)
    return { bg: s.backgroundColor, color: s.color, border: s.borderColor }
  }
  return {
    pop: g('.model-pop'),
    item: g('.model-item'),
    teamRow: g('.team-row'),
    teamTitle: g('.team-title'),
    teamDesc: g('.team-desc'),
    note: g('.effort-note'),
    track: g('.eslider-track'),
    chip: g('.model-chip'),
  }
})
console.log(JSON.stringify(info, null, 1))
await b.close()
