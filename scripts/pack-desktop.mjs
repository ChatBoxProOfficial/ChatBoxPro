/**
 * 打包成免安装的绿色目录：release/ChatBoxPro-win32-x64/ChatBoxPro.exe
 * 不需要管理员权限，也不需要安装程序，拷贝整个目录即可运行。
 */
import { packager } from '@electron/packager'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const desktop = resolve(root, 'desktop')
const icon = resolve(root, 'assets', 'chatbox-pro.ico')

// 国内直连 GitHub 经常断，默认走镜像；已装好的 Electron 运行时也在本地缓存里
process.env.ELECTRON_MIRROR ||= 'https://npmmirror.com/mirrors/electron/'

if (!existsSync(resolve(desktop, 'app', 'index.html'))) {
  console.error('desktop/app 不存在，先运行 npm run build:desktop')
  process.exit(1)
}

console.log('打包中（首次会下载 Electron 运行时，请耐心等一会）…')

const out = await packager({
  dir: desktop,
  name: 'ChatBox Pro',
  executableName: 'ChatBoxPro',
  platform: 'win32',
  arch: 'x64',
  out: resolve(root, 'release'),
  overwrite: true,
  prune: true,
  asar: true,
  icon: existsSync(icon) ? icon : undefined,
  appIcon: existsSync(icon) ? icon : undefined,
  // 只保留运行必需的东西
  ignore: [/^\/package-lock\.json$/, /^\/\.git/],
})

console.log('\n✓ 打包完成：')
for (const p of out) console.log('  ', p)
console.log('\n可执行文件：release\\ChatBox Pro-win32-x64\\ChatBoxPro.exe')
