/**
 * 把打包好的桌面应用"装"到用户目录并建快捷方式（全程不需要管理员）。
 *
 *   release/ChatBox Pro-win32-x64/  →  %LOCALAPPDATA%\Programs\ChatBoxPro\
 *   桌面快捷方式 → ChatBoxPro.exe（带我们自己的图标）
 *
 * 目标目录是每个用户自己的 Programs 目录，卸载就是删目录 + 删快捷方式。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const release = resolve(root, 'release')

if (!existsSync(release)) {
  console.error('没有 release/，先运行 npm run pack:desktop')
  process.exit(1)
}

const dir = readdirSync(release).find((n) => n.startsWith('ChatBox Pro-'))
if (!dir) {
  console.error('release/ 里没找到打包目录')
  process.exit(1)
}

const src = join(release, dir)
const exeName = 'ChatBoxPro.exe'
if (!existsSync(join(src, exeName))) {
  console.error(`打包目录里没有 ${exeName}`)
  process.exit(1)
}

const dest = resolve(process.env.LOCALAPPDATA || '', 'Programs', 'ChatBoxPro')
if (!dest.startsWith(resolve(process.env.LOCALAPPDATA || ''))) {
  console.error('目标路径异常，已中止')
  process.exit(1)
}

console.log('安装到：', dest)
rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })

const exe = join(dest, exeName)
const ico = resolve(root, 'assets', 'chatbox-pro.ico')
const esc = (p) => p.replace(/\\/g, '\\\\')

const ps = `
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'ChatBox Pro.lnk'
$sh = New-Object -ComObject WScript.Shell
$s = $sh.CreateShortcut($lnk)
$s.TargetPath = '${esc(exe)}'
$s.WorkingDirectory = '${esc(dest)}'
$s.Description = 'ChatBox Pro'
${existsSync(ico) ? `$s.IconLocation = '${esc(ico)}'` : ''}
$s.Save()
Write-Output $lnk
`

const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
console.log('✓ 快捷方式：', out.trim())
console.log('✓ 可执行文件：', exe)
