import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 1200, height: 760 }, colorScheme: 'dark' })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8838/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.getByRole('button', { name: '展开栏目' }).click()
await p.waitForTimeout(450)
await p.locator('.drawer-foot').click()
await p.waitForSelector('.settings-dialog', { timeout: 8000 })
await p.locator('.nav-item').filter({ hasText: '关于 ChatBox Pro' }).click()
await p.waitForTimeout(500)
// 滚动设置内容，触发滚动条显示
await p.locator('.settings-pane').evaluate((el) => el.scrollBy(0, 220))
await p.waitForTimeout(600)
const info = await p.evaluate(() => {
  const el = document.querySelector('.settings-pane')
  if (!el) return null
  const cs = getComputedStyle(el, '::-webkit-scrollbar-thumb')
  return {
    thumb: cs.backgroundColor,
    radius: cs.borderRadius,
    scrollable: el.scrollHeight > el.clientHeight,
    scrollTop: el.scrollTop,
  }
})
console.log('设置面板滚动条:', JSON.stringify(info))
await p.screenshot({ path: 'shots/131-scrollbar-visible.png', clip: { x: 700, y: 160, width: 380, height: 520 } })
await b.close()
