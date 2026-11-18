import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await c.newPage()
let body = null
p.on('request', (r) => {
  if (r.url().includes('/api/chat') && r.method() === 'POST') {
    body = r.postData()
  }
})
await p.goto('http://127.0.0.1:8812/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.locator('.model-chip').click()
await p.waitForSelector('.team-row', { timeout: 5000 })
await p.locator('.team-row').filter({ hasText: '本地工具' }).locator('.switch').click()
await p.waitForTimeout(300)
await p.keyboard.press('Escape')
await p.waitForTimeout(300)
await p.fill('.composer-input', '现在几点了？')
await p.getByRole('button', { name: '发送' }).click()
await p.waitForTimeout(3000)
if (body) {
  const j = JSON.parse(body)
  console.log('浏览器发出的 tools:', JSON.stringify((j.tools||[]).map(t=>t.function?.name || t.type)))
  console.log('keys:', Object.keys(j).join(','))
} else console.log('没有捕获到 /api/chat 请求')
await b.close()
