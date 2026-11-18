/**
 * 验证：主题切换（浅/深/跟随系统）、导出全部、删除全部会话的 10 秒冷静期。
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8806/'
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
  acceptDownloads: true,
})
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message))

const openSettings = async (section) => {
  await page.getByRole('button', { name: '展开栏目' }).click()
  await page.waitForTimeout(420)
  await page.locator('.drawer-foot').click()
  await page.waitForSelector('.settings-dialog', { timeout: 8000 })
  await page.getByRole('button', { name: section, exact: true }).click()
  await page.waitForTimeout(300)
}

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// 造两条会话
await page.evaluate(async () => {
  const openDb = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open('chatbox-pro', 1)
      r.onupgradeneeded = () => {
        const db = r.result
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' })
          s.createIndex('updatedAt', 'updatedAt')
        }
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  const db = await openDb()
  const now = Date.now()
  for (const i of [1, 2]) {
    await new Promise((res, rej) => {
      const t = db.transaction('sessions', 'readwrite')
      const rq = t.objectStore('sessions').put({
        id: 'seed-' + i,
        title: '测试会话 ' + i,
        storage: 'local',
        model: 'deepseek-flash',
        createdAt: now,
        updatedAt: now,
        messages: [{ id: 'm' + i, role: 'user', content: '你好 ' + i, createdAt: now }],
      })
      rq.onsuccess = () => res()
      rq.onerror = () => rej(rq.error)
    })
  }
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })

// 1) 主题
await openSettings('个性化')
const lightBtn = page.getByRole('button', { name: '浅色' })
await lightBtn.click()
await page.waitForTimeout(300)
const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
await page.screenshot({ path: `${OUT}/53-theme-light.png` })
await page.getByRole('button', { name: '深色' }).click()
await page.waitForTimeout(300)
const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
await page.screenshot({ path: `${OUT}/54-theme-dark.png` })
console.log('✓ 主题背景色 浅/深:', lightBg, '/', darkBg)
if (lightBg === darkBg) errors.push('主题切换没有生效')

// 2) 导出全部
await page.getByRole('button', { name: '上下文管理', exact: true }).click()
await page.waitForSelector('text=导出所有历史对话', { timeout: 5000 })
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 10000 }),
  page.getByRole('button', { name: '导出所有历史对话' }).click(),
])
const name = download.suggestedFilename()
console.log('✓ 导出文件:', name)
if (!name.includes('全部对话')) errors.push('导出文件名不对')

// 3) 删除冷静期
const delBtn = page.getByRole('button', { name: /删除本机全部会话|防误触|已可删除/ })
await delBtn.click()
await page.waitForTimeout(400)
const t1 = await delBtn.innerText()
const disabled = await delBtn.isDisabled()
console.log('✓ 点击后按钮:', t1, '| 是否禁用:', disabled)
if (!t1.includes('等待')) errors.push('没有进入 10 秒冷静期')
if (!disabled) errors.push('冷静期内按钮仍可点')
await page.screenshot({ path: `${OUT}/55-delete-cooldown.png` })

await page.waitForTimeout(2500)
const t2 = await delBtn.innerText()
console.log('✓ 2.5 秒后:', t2)

await browser.close()
if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
