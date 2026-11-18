import { chromium } from 'playwright'
for (const w of [390, 1200]) {
  const b = await chromium.launch({ channel: 'msedge', headless: true })
  const c = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: w === 390 ? 2 : 1, isMobile: w === 390, hasTouch: w === 390, colorScheme: 'light' })
  const p = await c.newPage()
  await p.goto('http://127.0.0.1:8819/', { waitUntil: 'networkidle' })
  await p.waitForSelector('.composer', { timeout: 15000 })
  await p.getByRole('button', { name: '展开栏目' }).click()
  await p.waitForTimeout(400)
  await p.locator('.drawer-foot').click()
  await p.waitForSelector('.settings-dialog', { timeout: 8000 })
  await p.waitForTimeout(400)
  const count = await p.locator('.nav-icon').count()
  const box = count ? await p.locator('.nav-icon').first().boundingBox() : null
  console.log(w + 'px 图标数:', count, '第一个尺寸:', box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none')
  await p.screenshot({ path: 'shots/88-nav-' + w + '.png' })
  await b.close()
}
