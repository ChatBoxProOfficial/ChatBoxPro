import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 1200, height: 760 } })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8838/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.getByRole('button', { name: '展开栏目' }).click()
await p.waitForTimeout(450)
await p.locator('.drawer-foot').click()
await p.waitForSelector('.settings-dialog', { timeout: 8000 })
await p.locator('.nav-item').filter({ hasText: '关于 ChatBox Pro' }).click()
await p.waitForTimeout(400)
const m = await p.evaluate(() => {
  const el = document.querySelector('.settings-pane')
  const list = document.querySelector('.msg-list')
  const drawer = document.querySelector('.drawer-list')
  const f = (e) => e ? { offset: e.offsetWidth, client: e.clientWidth, gap: e.offsetWidth - e.clientWidth } : null
  return { pane: f(el), list: f(list), drawer: f(drawer), dpr: window.devicePixelRatio }
})
console.log('滚动条占位（offset-client）:', JSON.stringify(m))
await p.screenshot({ path: 'shots/132-scrollbar-full.png' })
await b.close()
