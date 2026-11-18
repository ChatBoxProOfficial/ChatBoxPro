/**
 * 验证：工作目录设置、只读文件工具（list_dir / read_file / search_in_files）、自动压缩开关。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8816/'
const WS = process.env.WS_DIR || 'C:\\Users\\38688\\AppData\\Local\\Temp\\cbp-ws'
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

// 先填 key（加密存在 secureStore，不能直接写 IndexedDB）
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
await page.waitForTimeout(300)

// 工作目录 + 打开工具（直接写 IndexedDB 更快）
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
        { toolsEnabled: true, workspaceDir: ws, theme: 'light' },
        'settings',
      )
      t.oncomplete = () => res()
    })
  },
  { ws: WS },
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// 设置里能看到两个新选项
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(420)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: '上下文管理', exact: true }).click()
await page.waitForTimeout(300)
const autoCard = await page.locator('.card', { hasText: '自动压缩上下文' }).innerText()
console.log('✓ 自动压缩卡片:', autoCard.split('\n').slice(0, 2).join(' / '))
if (!autoCard.includes('超过阈值')) errors.push('缺少自动压缩开关')
await page.screenshot({ path: `${OUT}/76-auto-compact.png` })

await page.getByRole('button', { name: '管理模型保存路径', exact: true }).click()
await page.waitForTimeout(300)
const wsInput = await page.locator('input[placeholder*="F:"]').inputValue()
console.log('✓ 工作目录:', wsInput)
if (wsInput !== WS) errors.push('工作目录没读出来')

await page.locator('.settings-close').click()
await page.waitForTimeout(300)

// 让模型列目录
await page.fill('.composer-input', '看看这个目录里有什么文件')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.tool', { timeout: 25000 })
await page.waitForTimeout(1200)
const toolLine = await page.locator('.msg.tool').last().innerText()
console.log('✓ 工具结果:', toolLine.replace(/\s+/g, ' ').slice(0, 80))
if (!toolLine.includes('README') && !toolLine.includes('src')) {
  errors.push(`文件内容没读到：${toolLine.slice(0, 60)}`)
}
await page.screenshot({ path: `${OUT}/77-file-tool.png` })

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
