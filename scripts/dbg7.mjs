import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const p = await c.newPage()
let cap = null
p.on('request', (r) => {
  if (r.url().includes('/api/chat') && r.method() === 'POST') cap = r.postData()
})
await p.goto('http://127.0.0.1:8812/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.fill('.composer-input', '写一段话')
await p.getByRole('button', { name: '发送' }).click()
await p.waitForSelector('.msg.assistant .md', { timeout: 20000 })
await p.waitForTimeout(600)
await p.getByRole('button', { name: '继续' }).click()
await p.waitForTimeout(2500)
if (cap) {
  const j = JSON.parse(cap)
  const last = j.messages[j.messages.length - 1]
  console.log('最后一个消息 role:', last.role, '| prefix:', last.prefix, '| prefix_mode:', j.prefix_mode)
} else console.log('没捕获到请求')
await p.screenshot({ path: 'shots/68-continue.png' })
await b.close()
