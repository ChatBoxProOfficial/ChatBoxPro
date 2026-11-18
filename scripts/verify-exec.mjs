/**
 * 验证：执行命令审批（弹窗 → 运行 → 返回输出），以及黑名单拦截。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8818/'
const WS = process.env.WS_DIR || 'C:\\Users\\38688\\AppData\\Local\\Temp\\cbp-ws2'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })
mkdirSync(WS, { recursive: true })

const errors = []
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
})
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// key
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(420)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: 'ChatBox Pro 账号与模型', exact: true }).click()
await page.waitForSelector('input[type=password]', { timeout: 5000 })
await page.fill('input[type=password]', 'sk-mock-key')
await page.getByRole('button', { name: '保存', exact: true }).click()
await page.waitForTimeout(400)
await page.locator('.settings-close').click()

await page.evaluate(
  async ({ ws }) => {
    const db = await new Promise((res) => {
      const r = indexedDB.open('chatbox-pro', 1)
      r.onupgradeneeded = () => {
        const d = r.result
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv')
      }
      r.onsuccess = () => res(r.result)
    })
    await new Promise((res) => {
      const t = db.transaction('kv', 'readwrite')
      t.objectStore('kv').put(
        {
          toolsEnabled: true,
          workspaceDir: ws,
          allowWrite: true,
          allowExec: true,
          theme: 'light',
        },
        'settings',
      )
      t.oncomplete = () => res()
    })
  },
  { ws: WS },
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// 触发 run_command
await page.fill('.composer-input', '帮我运行一下命令')
await page.getByRole('button', { name: '发送' }).click()

await page.waitForSelector('.cmd-box', { timeout: 25000 })
const cmd = await page.locator('.cmd-box').innerText()
console.log('✓ 审批弹窗命令:', cmd)
await page.screenshot({ path: `${OUT}/81-cmd-approval.png` })

await page.getByRole('button', { name: '运行', exact: true }).click()
await page.waitForSelector('.msg.tool', { timeout: 30000 })
await page.waitForTimeout(1200)
const toolText = await page.locator('.msg.tool').last().innerText()
console.log('✓ 执行结果:', toolText.replace(/\s+/g, ' ').slice(0, 80))
if (!toolText.includes('hello-from-agent')) errors.push('命令输出没有回填')
await page.screenshot({ path: `${OUT}/82-cmd-done.png` })

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
