import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8815/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv') }; r.onsuccess = () => res(r.result) })
  await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ theme: 'light' }, 'settings'); t.oncomplete = () => res() })
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.locator('.model-chip').click()
await p.waitForSelector('.effort-slider', { timeout: 5000 })
// 拖动滑块进入 adjusting 状态
const box = await p.locator('.eslider-track').boundingBox()
await p.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2)
await p.mouse.down()
await p.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2, { steps: 8 })
await p.waitForTimeout(500)
const info = await p.evaluate(() => {
  const n = document.querySelector('.adjust-model-name')
  const e = document.querySelector('.adjust-model-effort')
  return { name: n ? getComputedStyle(n).color : null, effort: e ? getComputedStyle(e).color : null }
})
console.log('调节中 模型名/强度:', JSON.stringify(info))
await p.screenshot({ path: 'shots/75-light-adjusting.png' })
await p.mouse.up()
await b.close()
