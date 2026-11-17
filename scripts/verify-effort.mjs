/**
 * 验证思考强度大滑块：圆角方块、白色旋钮、紫色粒子、档位备注。
 * 运行：node scripts/verify-effort.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.VERIFY_URL || 'http://127.0.0.1:8791/'
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
await page.locator('.model-chip').click()
await page.waitForSelector('.eslider-track', { timeout: 5000 })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/34-effort-high.png` })

const knobAt = async () => {
  const box = await page.locator('.eslider-knob').boundingBox()
  return Math.round(box.x)
}

const highX = await knobAt()
const noteHigh = await page.locator('.effort-note').innerText()
const modelText = await page.locator('.effort-model').innerText()
console.log('✓ high 档备注:', noteHigh, '| 模型:', modelText)
console.log('✓ 旋钮位置(high):', highX)

const trackBox = await page.locator('.eslider-track').boundingBox()
// 拖到最左（off）
await page.locator('.eslider-track').click({ position: { x: 4, y: Math.round(trackBox.height / 2) } })
await page.waitForTimeout(400)
const noteOff = await page.locator('.effort-note').innerText()
const offX = await knobAt()
await page.screenshot({ path: `${OUT}/35-effort-off.png` })
console.log('✓ off 档备注:', noteOff, '| 旋钮位置:', offX)
if (!noteOff.includes('关闭')) errors.push('off 备注不是「关闭」')
if (offX >= highX) errors.push('旋钮没有跟着往左移动')

// 拖到最右（max）
await page.locator('.eslider-track').click({
  position: { x: Math.round(trackBox.width - 4), y: Math.round(trackBox.height / 2) },
})
await page.waitForTimeout(400)
const noteMax = await page.locator('.effort-note').innerText()
await page.screenshot({ path: `${OUT}/36-effort-max.png` })
console.log('✓ max 档备注:', noteMax)
if (!noteMax.includes('最大 token 消耗')) errors.push('max 备注不对')

// 回到 high 看粒子
await page.locator('.effort-tick', { hasText: 'high' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/37-effort-high-again.png` })

const canvasOk = await page.locator('.eslider-canvas').count()
if (!canvasOk) errors.push('没有粒子画布')


// 拖动前的面板高度
const boxBefore = await page.locator('.model-pop').boundingBox()

// 拖动中的状态：完整模型名 + 模型不可切换 + 特效不越过按钮
const tb2 = await page.locator('.eslider-track').boundingBox()
await page.mouse.move(tb2.x + 12, tb2.y + tb2.height / 2)
await page.mouse.down()
await page.mouse.move(tb2.x + tb2.width * 0.8, tb2.y + tb2.height / 2, { steps: 6 })
await page.waitForTimeout(350)
await page.screenshot({ path: `${OUT}/38-adjusting.png` })

const bigName = await page.locator('.adjust-model-name').count()
const listCount = await page.locator('.pop-item').count()
const popCls = await page.locator('.model-pop').getAttribute('class')
const bigText = bigName ? await page.locator('.adjust-model-name').innerText() : ''
console.log(
  '✓ 拖动中：放大模型名', bigName ? `显示「${bigText}」` : '缺失',
  '| 模型列表条数', listCount, '| 面板类', popCls,
)
if (!bigName) errors.push('拖动时没有显示放大的模型名')
if (listCount !== 0) errors.push('拖动时模型列表没有隐藏')
if (!popCls?.includes('adjusting')) errors.push('面板没有进入 adjusting 状态')

const boxDuring = await page.locator('.model-pop').boundingBox()
console.log('✓ 面板高度 拖动前/拖动中:', Math.round(boxBefore.height), '/', Math.round(boxDuring.height))
if (Math.abs(boxBefore.height - boxDuring.height) > 2) errors.push('拖动时面板高度变了')

const effortSide = await page.locator('.adjust-model-effort').innerText()
const styleOf = (sel) =>
  page.locator(sel).evaluate((el) => {
    const c = getComputedStyle(el)
    return { size: c.fontSize, color: c.color, weight: c.fontWeight }
  })
const nameStyle = await styleOf('.adjust-model-name')
const effortStyle = await styleOf('.adjust-model-effort')
console.log('✓ 右侧英文:', effortSide)
console.log('✓ 名称样式:', nameStyle.size, nameStyle.color, nameStyle.weight)
console.log('✓ 英文样式:', effortStyle.size, effortStyle.color, effortStyle.weight)
if (nameStyle.size !== effortStyle.size || nameStyle.color !== effortStyle.color) {
  errors.push('右侧英文与模型名字号/颜色不一致')
}

// 采样画布：按钮右侧不应有像素
const leak = await page.evaluate(() => {
  const c = document.querySelector('.eslider-canvas')
  const knob = document.querySelector('.eslider-knob')
  if (!c || !knob) return -1
  const cr = c.getBoundingClientRect()
  const kr = knob.getBoundingClientRect()
  const scale = c.width / cr.width // 画布是设备像素
  const cx = kr.left + kr.width / 2 - cr.left
  const x = Math.min(c.width - 1, Math.round(cx * scale) + 6)
  const ctx = c.getContext('2d')
  const data = ctx.getImageData(x, 0, 1, c.height).data
  let opaque = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] > 6) opaque++
  return opaque
})
console.log('✓ 按钮右侧不透明像素数:', leak)
if (leak > 0) errors.push('按钮右侧仍有特效像素（漏光）')

await page.mouse.up()
await page.waitForTimeout(200)

// 档位颜色
const colorOf = async (idx) => {
  await page.locator('.effort-tick').nth(idx).click()
  await page.waitForTimeout(220)
  return {
    cls: await page.locator('.effort-note').getAttribute('class'),
    bg: await page.locator('.effort-note').evaluate((el) => getComputedStyle(el).backgroundColor),
    shadow: await page.locator('.effort-note').evaluate((el) => getComputedStyle(el).boxShadow),
  }
}
for (const [i, name] of [[0, 'off'], [1, 'low'], [2, 'high'], [3, 'max']]) {
  const c = await colorOf(i)
  console.log('  ' + name + ':', c.cls, c.bg, c.shadow === 'none' ? '(无光晕)' : '(有光晕)')
}
await page.screenshot({ path: `${OUT}/39-effort-max-final.png` })

await browser.close()

if (errors.length) {
  console.log('\n问题：')
  for (const e of errors) console.log(' -', e)
  process.exitCode = 1
} else {
  console.log('\n全部通过 ✓')
}
