/**
 * 验证：子智能体（顶部横幅 → 面板里能看到任务与思考）。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8820/'
const WS = process.env.WS_DIR || 'C:\\Users\\38688\\AppData\\Local\\Temp\\cbp-ws2'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })

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

// 打开本地工具 + 子智能体团队协作
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
        { toolsEnabled: true, teamMode: true, workspaceDir: ws, theme: 'light' },
        'settings',
      )
      t.oncomplete = () => res()
    })
  },
  { ws: WS },
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

await page.fill('.composer-input', '派个子智能体去查一下瑞利散射')
await page.getByRole('button', { name: '发送' }).click()

// 顶部横幅
await page.waitForSelector('.sub-banner', { timeout: 20000 })
const banner = await page.locator('.sub-banner').innerText()
console.log('✓ 横幅:', banner.replace(/\s+/g, ' '))
if (!banner.includes('子智能体')) errors.push('横幅文案不对')
await page.screenshot({ path: `${OUT}/89-sub-banner.png` })

// 点开面板
await page.locator('.sub-banner').click()
await page.waitForSelector('.sub-modal', { timeout: 8000 })
await page.waitForTimeout(600)
const task = await page.locator('.sub-task').first().innerText()
const think = await page.locator('.sub-think').first().innerText().catch(() => '')
console.log('✓ 交给它的任务:', task.slice(0, 30))
console.log('✓ 它的思考:', think.replace(/\s+/g, ' ').slice(0, 50))
if (!task.includes('瑞利散射')) errors.push('面板里看不到任务')

await page.screenshot({ path: `${OUT}/90-sub-panel.png` })

// 等它跑完
await page.locator('.sub-modal .settings-close').click()
await page.waitForTimeout(300)
await page.waitForSelector('.sub-banner:not(.running)', { timeout: 25000 })
const done = await page.locator('.sub-banner').innerText()
console.log('✓ 结束状态:', done.replace(/\s+/g, ' '))

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
