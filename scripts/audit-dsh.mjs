import { chromium } from 'playwright'
const b = await chromium.launch({ channel: 'msedge', headless: true })
const c = await b.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'dark' })
const p = await c.newPage()
await p.goto('http://127.0.0.1:8787/', { waitUntil: 'networkidle' })
await p.waitForSelector('.composer', { timeout: 15000 })
await p.getByRole('button', { name: '展开栏目' }).click()
await p.waitForTimeout(400)
await p.locator('.drawer-foot').click()
await p.waitForSelector('.settings-dialog', { timeout: 8000 })

// 找到 DSH 这一节
await p.getByRole('button', { name: /连接到 DeepSeek Harness/ }).click()
await p.waitForTimeout(300)
const input = p.locator('.card input').first()

// 1) 一个根本不存在的路径（同端口）
await input.fill('http://127.0.0.1:8787/definitely-not-exist')
await p.getByRole('button', { name: '测试', exact: true }).click()
await p.waitForTimeout(1500)
console.log('404 路径 →', (await p.locator('.card .ok, .card .warn').first().innerText()).replace(/\s+/g, ' '))

// 2) 一个关着的端口
await input.fill('http://127.0.0.1:9999')
await p.getByRole('button', { name: '测试', exact: true }).click()
await p.waitForTimeout(2000)
console.log('关闭端口 →', (await p.locator('.card .ok, .card .warn').first().innerText()).replace(/\s+/g, ' '))

await b.close()
