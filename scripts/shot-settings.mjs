import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8819/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.evaluate(async () => {
  const db = await new Promise((res) => { const r = indexedDB.open('chatbox-pro', 1); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv') }; r.onsuccess = () => res(r.result) })
  await new Promise((res) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put({ theme: 'light' }, 'settings'); t.oncomplete = () => res() })
})
await p.reload({ waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.getByRole('button', { name: '展开栏目' }).click()
await p.waitForTimeout(420)
await p.locator('.drawer-foot').click()
await p.waitForSelector('.settings-dialog', { timeout: 8000 })
const shots = [
  ['个性化', '83-settings-personalize.png'],
  ['上下文管理', '84-settings-context.png'],
  ['文件与路径', '85-settings-paths.png'],
  ['关于 ChatBox Pro', '86-settings-about.png'],
]
for (const [name, file] of shots) {
  await p.getByRole('button', { name, exact: true }).click()
  await p.waitForTimeout(350)
  await p.screenshot({ path: 'shots/' + file })
  console.log('✓', name)
}
await b.close()
