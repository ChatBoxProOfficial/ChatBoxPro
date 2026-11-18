/**
 * 发布更新：生成更新包、写 version.json（指向 GitHub Release），并打印发布步骤。
 *
 *   node scripts/publish-update.mjs --repo 你的名字/chatbox-pro --notes "修复：…|新增：…"
 *   node scripts/publish-update.mjs --repo 你的名字/chatbox-pro --notes "…" --dry-run
 *
 * 说明：
 *   - 更新包上传到 GitHub Releases（不在仓库里，避免仓库变大）
 *   - version.json 放在仓库的 update/ 目录，通过 raw 或 jsDelivr 访问
 *   - 脚本只生成文件与命令，不会自动推送（推送需要你的 GitHub 凭据）
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const releaseDir = resolve(root, 'release')
const appDir = resolve(releaseDir, 'ChatBox Pro-win32-x64')
const updateDir = resolve(root, 'update')

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const repo = arg('repo')
const dryRun = process.argv.includes('--dry-run')
const branch = arg('branch', 'master')
const notesRaw = arg('notes')
const notesFile = arg('notes-file')

if (!repo) {
  console.error('缺少 --repo，例如：--repo xingxing/chatbox-pro')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(resolve(root, 'desktop/package.json'), 'utf8'))
const version = pkg.version || '0.0.0'
const segs = version.split('.')
const display = `Ver.${String(segs[0] ?? 0).padStart(2, '0')}.${String(segs[1] ?? 0).padStart(
  2,
  '0',
)}.${segs.slice(2).join('.') || '0'}`

const zipName = `chatbox-pro-${version}.zip`
const zipPath = resolve(releaseDir, zipName)

if (!existsSync(appDir)) {
  console.error('找不到打包产物：' + appDir)
  console.error('先运行 npm run pack:desktop')
  process.exit(1)
}

// 1) 压缩
if (!existsSync(zipPath) || process.argv.includes('--repack')) {
  if (existsSync(zipPath)) rmSync(zipPath)
  console.log('压缩安装目录…')
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${appDir}\\*" -DestinationPath "${zipPath}" -CompressionLevel Optimal -Force`,
    ],
    { stdio: 'inherit' },
  )
}

const buf = readFileSync(zipPath)
const sha256 = createHash('sha256').update(buf).digest('hex')
const size = statSync(zipPath).size
const sizeMb = (size / 1024 / 1024).toFixed(1)

// 2) version.json
const tag = `v${version}`
const releaseUrl = `https://github.com/${repo}/releases/download/${tag}/${zipName}`
const notes = (() => {
  if (notesFile) {
    // 从 UTF-8 文件读，避免 Windows 命令行传中文变成乱码
    return readFileSync(resolve(root, notesFile), 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
  }
  if (!notesRaw) return ['（在这里写更新内容）']
  if (notesRaw.includes('\uFFFD')) {
    console.warn('⚠ 命令行里的中文可能被转码了，建议改用 --notes-file')
  }
  return notesRaw.split('|').filter(Boolean)
})()

mkdirSync(updateDir, { recursive: true })
const manifestPath = resolve(updateDir, 'version.json')

let history = []
if (existsSync(manifestPath)) {
  try {
    const old = JSON.parse(readFileSync(manifestPath, 'utf8'))
    history = Array.isArray(old.history) ? old.history : []
    // 上一版进历史
    if (old.version && old.version !== display) {
      history.unshift({
        version: old.version,
        date: (old.publishedAt || '').slice(0, 10) || '',
        notes: Array.isArray(old.notes) ? old.notes : [],
      })
    }
  } catch {
    history = []
  }
}

const manifest = {
  version: display,
  url: releaseUrl,
  notes,
  size,
  sha256,
  publishedAt: new Date().toISOString(),
  history: history.slice(0, 20),
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

// 3) 打印步骤
const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/update/version.json`
const jsdelivr = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/update/version.json`

console.log('\n========== 生成完成 ==========')
console.log('版本：' + display)
console.log('安装包：' + zipPath)
console.log('  大小：' + sizeMb + ' MB')
console.log('  sha256：' + sha256.slice(0, 16) + '…')
console.log('清单：' + manifestPath)
console.log('下载地址：' + releaseUrl)

console.log('\n---------- 接下来三步 ----------')
console.log('1) 上传「安装包 + 版本清单」到 GitHub Release：')
console.log(
  `   gh release create ${tag} "${zipPath}" "${manifestPath}" --title "${display}" --notes "${notes.join('；')}"`,
)
console.log('   （没装 gh 的话：网页打开 https://github.com/' + repo + '/releases/new 手动传）')
console.log('\n2) 提交 version.json：')
console.log('   git add update/version.json')
console.log(`   git commit -m "chore: 更新 ${display} 的版本清单"`)
console.log(`   git push origin ${branch}`)
console.log('\n3) 应用默认更新地址（已内置，无需填写）：')
console.log('   https://github.com/' + repo + '/releases/latest/download/version.json')
console.log('   备用（分支直读）：' + rawUrl)

if (dryRun) {
  console.log('\n(--dry-run：以上只是预览，没有做任何推送)')
}
