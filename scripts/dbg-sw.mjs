import { chromium } from 'playwright'
for (const scheme of ['light', 'dark']) {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme })
  const p = await c.newPage()
  await p.goto('http://127.0.0.1:8814/', { waitUntil: 'networkidle' })
  await p.waitForSelector('.composer', { timeout: 15000 })
  await p.evaluate(async (s) => {
    const db = await new Promise((res) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv') }; r.onsuccess = () => res(r.result) })
    await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ theme: s }, 'settings'); t.oncomplete = () => res() })
  }, scheme)
  await p.reload({ waitUntil: 'networkidle' })
  await p.waitForSelector('.composer', { timeout: 15000 })
  await p.locator('.model-chip').click()
  await p.waitForSelector('.team-row', { timeout: 5000 })
  const first = p.locator('.team-row').first().locator('input[role=switch]')
  console.log(scheme, '第一个开关 checked =', await first.isChecked())
  const m = await p.evaluate(() => {
    const t = document.querySelector('.switch-track')
    const k = document.querySelector('.switch-knob')
    const ts = getComputedStyle(t)
    const ks = getComputedStyle(k)
    return { track: ts.backgroundColor, knob: ks.backgroundColor, knobShadow: ks.boxShadow.slice(0, 40) }
  })
  console.log(scheme, JSON.stringify(m))
  await b.close()
}
