/**
 * 用本机 Edge（channel: msedge）做无头验证：主界面、侧边栏、发消息、设置。
 *
 * 运行：node scripts/verify.mjs
 * 前提：npm run build 之后，node server/index.mjs 已在 8787 运行。
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8787/'
const OUT = 'shots'
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/sample.txt`, '这是用于验证上传的文件\n')

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
page.on('console', (m) => {
  if (m.type() !== 'error') return
  const t = m.text()
  if (/404/.test(t) && m.location()?.url?.includes('tip-qr')) return
  errors.push(t)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForSelector('.welcome', { timeout: 15000 })
const greeting = await page.locator('.welcome-title').innerText()
console.log('✓ 主界面：', greeting)
await page.screenshot({ path: `${OUT}/10-home.png` })

// 侧边栏
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForSelector('.drawer.show', { timeout: 5000 })
await page.waitForTimeout(450) // 等抽屉滑入动画结束再截图
await page.screenshot({ path: `${OUT}/11-sidebar.png` })
console.log('✓ 侧边栏打开')

const hasNewConv = await page.getByRole('button', { name: /建立一个新的对话/ }).count()
console.log('✓ 新建对话入口：', hasNewConv ? '有' : '缺失')

const foot = await page.locator('.drawer-foot').innerText()
console.log('✓ 底部账号：', foot.replace(/\n/g, ' / '))

// 关侧边栏，测附件上传
await page.locator('.drawer-mask').click({ position: { x: 360, y: 400 } })
await page.waitForTimeout(300)
await page.setInputFiles('input[type=file]', `${OUT}/sample.txt`)
await page.waitForTimeout(1200)
const chip = await page.locator('.attach-chip').count()
console.log('✓ 附件上传：', chip ? '成功显示 chip' : '没有 chip')
await page.screenshot({ path: `${OUT}/12-attach.png` })

// 输入并发送（没填 key，应给出明确提示）
await page.fill('.composer-input', '你好，测试一下新界面')
await page.getByRole('button', { name: '发送' }).click()
await page.waitForSelector('.msg.assistant', { timeout: 12000 })
await page.waitForSelector('.msg.assistant.hint, .msg.assistant.error', { timeout: 12000 })
const errText = await page.locator('.msg.assistant').last().innerText()
console.log('✓ 无 Key 提示：', errText.replace(/\n/g, ' ').slice(0, 60))
await page.screenshot({ path: `${OUT}/13-chat.png` })

// 模型菜单
await page.locator('.model-chip').click()
await page.waitForSelector('.model-pop', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/14-model.png` })
console.log('✓ 模型菜单弹出')
await page.locator('.pop-mask').click({ position: { x: 10, y: 10 } })

// 应用内确认框（删除对话）
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(450)
const firstConv = page.locator('.conv-item').first()
await firstConv.hover()
await firstConv.locator('.conv-del').click()
await page.waitForSelector('.confirm-box', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/18-confirm.png` })
const confirmText = await page.locator('.confirm-box').innerText()
console.log('✓ 应用内确认框：', confirmText.replace(/\n/g, ' / ').slice(0, 40))
await page.getByRole('button', { name: '取消' }).click()
await page.waitForSelector('.confirm-box', { state: 'detached', timeout: 5000 })
console.log('✓ 取消后关闭')

// 设置（从侧边栏底部）
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.waitForTimeout(450) // 等侧边栏退场动画结束
await page.screenshot({ path: `${OUT}/15-settings.png` })
const navCount = await page.locator('.nav-item').count()
console.log('✓ 设置左侧分类数：', navCount)

// 切换分类
await page.getByRole('button', { name: '管理模型', exact: true }).click()
await page.waitForSelector('.model-list', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/16-settings-detail.png` })
console.log('✓ 切换到：管理模型')

await page.getByRole('button', { name: '上下文管理', exact: true }).click()
await page.waitForSelector('input[type=number]', { timeout: 5000 })
console.log('✓ 切换到：上下文管理')

// 关闭
await page.locator('.settings-close').click()
await page.waitForSelector('.settings-dialog', { state: 'detached', timeout: 5000 })
await page.waitForSelector('.composer', { timeout: 5000 })
console.log('✓ 关闭弹窗回到主界面')

// 思维链展示：先塞一条带 reasoning 的会话，再分别看两种风格
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
  const session = {
    id: 'demo-reasoning',
    title: '思维链演示',
    storage: 'local',
    model: 'deepseek-reasoner',
    createdAt: now - 60000,
    updatedAt: now,
    messages: [
      { id: 'm1', role: 'user', content: '天空为什么是蓝色的？', createdAt: now - 5000 },
      {
        id: 'm2',
        role: 'assistant',
        content:
          '因为大气里的分子对短波长光的散射更强（**瑞利散射**），蓝光被散射到各个方向的概率比红光高得多。\n\n所以白天抬头，进到眼睛里的散射光以蓝光为主。',
        createdAt: now,
        reasoning:
          '先确定现象：白天天空偏蓝，日落偏红。\n再想机制：瑞利散射强度与波长的四次方成反比，蓝光波长更短，散射更强。\n还要解释日落：路径变长，蓝光被散射殆尽，剩下红橙光。\n最后组织语言，先给结论再给原因。',
        reasoningMs: 3200,
        model: 'deepseek-reasoner',
      },
    ],
  }
  await new Promise((res, rej) => {
    const t = db.transaction('sessions', 'readwrite')
    const rq = t.objectStore('sessions').put(session)
    rq.onsuccess = () => res()
    rq.onerror = () => rej(rq.error)
  })
})
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.composer', { timeout: 15000 })
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(450)
await page.getByText('思维链演示').first().click()
await page.waitForSelector('.thinking-head', { timeout: 8000 })
await page.screenshot({ path: `${OUT}/19-reasoning-web.png` })
console.log('✓ 思维链（网页版）已渲染')

// 展开看内容
await page.locator('.thinking-head').click()
await page.waitForSelector('.thinking-body', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/20-reasoning-web-open.png` })
console.log('✓ 网页版展开思维链正文')

// 换成 DSH 风格
await page.getByRole('button', { name: '展开栏目' }).click()
await page.waitForTimeout(400)
await page.locator('.drawer-foot').click()
await page.waitForSelector('.settings-dialog', { timeout: 8000 })
await page.getByRole('button', { name: '管理模型', exact: true }).click()
await page.waitForSelector('.radio-list', { timeout: 5000 })
await page.getByText('样式二：DSH').click()
await page.screenshot({ path: `${OUT}/21-reasoning-setting.png` })
await page.locator('.settings-close').click()
await page.waitForTimeout(400)
await page.waitForSelector('.thinking-dsh', { timeout: 8000 })
await page.screenshot({ path: `${OUT}/22-reasoning-dsh.png` })
console.log('✓ 思维链（DSH 风格）已渲染')

await page.locator('.dsh-head').click()
await page.waitForSelector('.dsh-raw', { timeout: 5000 })
await page.screenshot({ path: `${OUT}/23-reasoning-dsh-open.png` })
console.log('✓ DSH 风格展开思维链正文')

await browser.close()

// 桌面尺寸下的设置弹窗（两栏布局）
const b2 = await chromium.launch({ channel: 'msedge', headless: true })
const c2 = await b2.newContext({ viewport: { width: 1400, height: 900 }, locale: 'zh-CN' })
const p2 = await c2.newPage()
await p2.goto(BASE, { waitUntil: 'networkidle' })
await p2.waitForSelector('.composer', { timeout: 15000 })
await p2.locator('.icon-btn[aria-label="展开栏目"]').click()
await p2.waitForTimeout(400)
await p2.locator('.drawer-foot').click()
await p2.waitForSelector('.settings-dialog', { timeout: 8000 })
await p2.waitForTimeout(450)
await p2.screenshot({ path: `${OUT}/17-settings-desktop.png` })
console.log('✓ 桌面尺寸设置弹窗已截图')
await b2.close()

if (errors.length) {
  console.log('\n控制台错误：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n控制台无错误 ✓')
}
