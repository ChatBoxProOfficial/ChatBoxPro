/**
 * 生成更新包 + version.json 模板。
 *
 *   node scripts/make-update.mjs --notes "修复了…|新增了…"
 *
 * 产出（在 release/ 目录）：
 *   chatbox-pro-<版本>.zip   覆盖安装用的压缩包
 *   version.json             放到你的网站上
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const releaseDir = resolve(root, 'release')
const appDir = resolve(releaseDir, 'ChatBox Pro-win32-x64')

const pkg = JSON.parse(readFileSync(resolve(root, 'desktop/package.json'), 'utf8'))
const version = pkg.version || '0.0.0'
// 界面显示用两位对齐格式：1.0.2 → Ver.01.00.2
const segs = version.split('.')
const display = `Ver.${String(segs[0] ?? 0).padStart(2, '0')}.${String(
  segs[1] ?? 0,
).padStart(2, '0')}.${segs.slice(2).join('.') || '0'}`
const zipName = `chatbox-pro-${version}.zip`
const zipPath = resolve(releaseDir, zipName)

const notesArg = process.argv.indexOf('--notes')
const notes =
  notesArg > -1 && process.argv[notesArg + 1]
    ? process.argv[notesArg + 1].split('|').filter(Boolean)
    : ['（在这里写这次更新了什么）']

if (!existsSync(appDir)) {
  console.error('找不到打包产物：' + appDir)
  console.error('先运行 npm run pack:desktop')
  process.exit(1)
}

if (existsSync(zipPath)) rmSync(zipPath)

console.log('打包中：', zipPath)
execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path "${appDir}\\*" -DestinationPath "${zipPath}" -CompressionLevel Optimal -Force`,
  ],
  { stdio: 'inherit' },
)

const buf = readFileSync(zipPath)
const sha256 = createHash('sha256').update(buf).digest('hex')
const size = statSync(zipPath).size

const manifest = {
  version: display,
  url: `https://你的域名/chatbox-pro/${zipName}`,
  notes,
  size,
  sha256,
  publishedAt: new Date().toISOString(),
}

writeFileSync(resolve(releaseDir, 'version.json'), JSON.stringify(manifest, null, 2), 'utf8')

console.log('\n✓ 更新包：' + zipPath)
console.log('  大小：' + (size / 1024 / 1024).toFixed(1) + ' MB')
console.log('  sha256：' + sha256.slice(0, 16) + '…')
console.log('\n✓ 清单：' + resolve(releaseDir, 'version.json'))
console.log(JSON.stringify(manifest, null, 2))
console.log('\n下一步：把 zip 和 version.json 上传到你的网站，')
console.log('然后在 ChatBox Pro 的「设置 → 关于 ChatBox Pro → 更新信息地址」里填 version.json 的网址。')
