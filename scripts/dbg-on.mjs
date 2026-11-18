import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8814/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv') }; r.onsuccess = () => res(r.result) })
  await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ theme: 'light' }, 'settings'); t.oncomplete = () => res() })
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.locator('.model-chip').click()
await p.waitForSelector('.team-row', { timeout: 5000 })
// 打开联网搜索和本地工具，看开启态
await p.locator('.team-row').filter({ hasText: '联网搜索' }).locator('.switch').click()
await p.locator('.team-row').filter({ hasText: '本地工具' }).locator('.switch').click()
await p.waitForTimeout(400)
const colors = await p.evaluate(() => {
  const q = (s) => { const el = document.querySelector(s); return el ? getComputedStyle(el).color : null }
  const onTrack = document.querySelector('.team-row input[role=switch]:checked')?.closest('.switch')?.querySelector('.switch-track')
  return {
    title: q('.effort-title'),
    label: q('.pop-label'),
    modelName: q('.effort-model'),
    onTrack: onTrack ? getComputedStyle(onTrack).backgroundColor : null,
  }
})
console.log(JSON.stringify(colors))
await p.screenshot({ path: 'shots/74-light-popover-on.png' })
await b.close()
