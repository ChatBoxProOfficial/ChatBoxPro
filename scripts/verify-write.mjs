/**
 * 验证：写文件审批（弹窗 diff → 允许 → 真正落盘）。
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8817/'
const WS = process.env.WS_DIR || 'C:\\Users\\38688\\AppData\\Local\\Temp\\cbp-ws2'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })
mkdirSync(WS, { recursive: true })
const target = join(WS, 'note.md')
if (existsSync(target)) rmSync(target)

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

// 工作目录 + 允许写 + 开工具
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
        { toolsEnabled: true, workspaceDir: ws, allowWrite: true, theme: 'light' },
        'settings',
      )
      t.oncomplete = () => res()
    })
  },
  { ws: WS },
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// 让模型写文件
await page.fill('.composer-input', '帮我写一个 note.md')
await page.getByRole('button', { name: '发送' }).click()

await page.waitForSelector('.write-modal', { timeout: 25000 })
const path = await page.locator('.write-path').innerText()
const diff = await page.locator('.write-diff').innerText()
console.log('✓ 审批弹窗 path:', path)
console.log('✓ diff 预览:', diff.replace(/\s+/g, ' ').slice(0, 50))
await page.screenshot({ path: `${OUT}/79-write-approval.png` })
if (!path.includes('note.md')) errors.push('审批弹窗路径不对')
if (!diff.includes('第一行')) errors.push('审批弹窗没有显示内容')

// 允许
await page.getByRole('button', { name: '允许写入' }).click()
await page.waitForSelector('.msg.tool', { timeout: 20000 })
await page.waitForTimeout(1000)
const toolText = await page.locator('.msg.tool').last().innerText()
console.log('✓ 工具结果:', toolText.replace(/\s+/g, ' ').slice(0, 40))

if (!existsSync(target)) {
  errors.push('文件没有真的写出来')
} else {
  const content = readFileSync(target, 'utf8')
  console.log('✓ 落盘内容:', JSON.stringify(content))
  if (!content.includes('第一行')) errors.push('文件内容不对')
}
await page.screenshot({ path: `${OUT}/80-write-done.png` })

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
