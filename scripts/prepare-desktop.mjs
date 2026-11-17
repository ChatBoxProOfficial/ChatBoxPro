/**
 * 把构建产物整理成桌面壳能直接吃的样子：
 *   desktop/app     ← dist/ 的副本（前端）
 *   desktop/server  ← server/ 的副本（内置中转服务）
 *
 * 这样打包出来的 exe 是自包含的：双击就起服务 + 开窗口。
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const server = resolve(root, 'server')
const target = resolve(root, 'desktop')

if (!existsSync(dist)) {
  console.error('找不到 dist/，先运行 npm run build')
  process.exit(1)
}

for (const [from, to] of [
  [dist, resolve(target, 'app')],
  [server, resolve(target, 'server')],
]) {
  const dest = to
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  cpSync(from, dest, { recursive: true })
  console.log(`✓ ${from} → ${dest}`)
}

// 打赏二维码如果已经放进 dist，这里一并带上（cpSync 已覆盖）
console.log('\n桌面端素材就绪。运行 npm run desktop 预览，或 npm run pack:desktop 打包。')
