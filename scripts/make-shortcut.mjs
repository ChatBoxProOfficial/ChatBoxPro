/**
 * 生成桌面启动器与快捷方式。
 *
 * VBScript 只认 ANSI 或 UTF-16LE，UTF-8 的中文注释会让它语法报错，
 * 所以这里把 launcher/chatbox-pro.vbs.src（UTF-8，便于编辑）转成
 * UTF-16LE 的 ChatBox Pro.vbs，再建一个不闪黑框的桌面快捷方式。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const src = resolve(root, 'launcher', 'chatbox-pro.vbs.src')
const vbs = resolve(root, 'ChatBox Pro.vbs')
const ico = resolve(root, 'assets', 'chatbox-pro.ico')

if (!existsSync(src)) {
  console.error('缺少 launcher/chatbox-pro.vbs.src')
  process.exit(1)
}

// UTF-8 → UTF-16LE（带 BOM），VBScript 才能正确读中文
const text = readFileSync(src, 'utf8').replace(/^\uFEFF/, '')
const body = Buffer.from(text, 'utf16le')
writeFileSync(vbs, Buffer.concat([Buffer.from([0xff, 0xfe]), body]))
console.log('✓ 生成启动器：', vbs)

if (process.argv.includes('--no-shortcut')) process.exit(0)

const wscript = resolve(process.env.WINDIR || 'C:\\Windows', 'System32', 'wscript.exe')
const esc = (p) => p.replace(/\\/g, '\\\\')

const ps = `
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'ChatBox Pro.lnk'
$sh = New-Object -ComObject WScript.Shell
$s = $sh.CreateShortcut($lnk)
$s.TargetPath = '${esc(wscript)}'
$s.Arguments = '"${esc(vbs)}"'
$s.WorkingDirectory = '${esc(root)}'
$s.Description = 'ChatBox Pro'
${existsSync(ico) ? `$s.IconLocation = '${esc(ico)}'` : ''}
$s.Save()
Write-Output $lnk
`

const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
console.log('✓ 已创建快捷方式：', out.trim())
