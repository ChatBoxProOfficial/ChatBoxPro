/**
 * ChatBox Pro 桌面端（Electron 壳）
 *
 * 行为：
 *   1. 如果 CHATBOX_SERVER_URL 指定了服务器，连它（例如家里那台 A8）；
 *   2. 否则先看本机 8787 是否已经在跑；
 *   3. 都没有 → 在进程内启动内置中转服务，再打开窗口。
 *
 * 换句话说：双击 exe 就能用，不需要先手动起服务，也不需要浏览器。
 */
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const { pathToFileURL } = require('node:url')

const PORT = Number(process.env.PORT || 8787)
const LOCAL_URL = `http://127.0.0.1:${PORT}/`
const SMOKE = process.argv.includes('--smoke')
const REMOTE = (process.env.CHATBOX_SERVER_URL || '').trim()

let mainWindow = null
let embeddedServer = null

/* ---------------------------------- 工具 ---------------------------------- */

function isUp(url, timeout = 700) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(timeout, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/** 内置服务：把打包进来的 server 在当前进程里跑起来 */
async function startEmbeddedServer() {
  if (embeddedServer) return
  const dist = path.join(__dirname, 'app')
  const entry = path.join(__dirname, 'server', 'index.mjs')
  if (!fs.existsSync(entry)) throw new Error('内置服务缺失：server/index.mjs')
  process.env.CHATBOX_DIST = dist
  process.env.PORT = String(PORT)
  process.env.HOST = '127.0.0.1'
  // 附件落到用户数据目录，安装目录可能不可写
  process.env.CHATBOX_INBOX = path.join(app.getPath('userData'), 'inbox')
  await import(pathToFileURL(entry).href)
  embeddedServer = true
  // 等端口真正可连
  for (let i = 0; i < 40; i++) {
    if (await isUp(`${LOCAL_URL}api/health`, 300)) return
    await wait(150)
  }
  throw new Error('内置服务启动超时')
}

/* -------------------------------- 窗口状态 -------------------------------- */

const stateFile = () => path.join(app.getPath('userData'), 'window.json')

/* --------------------------------- IPC ---------------------------------- */

function registerIpc() {
  ipcMain.handle('chatbox:open-folder', async (_e, target) => {
    if (typeof target !== 'string' || !target) return 'invalid path'
    try {
      return await shell.openPath(target)
    } catch (e) {
      return String(e && e.message ? e.message : e)
    }
  })

  ipcMain.handle('chatbox:paths', () => ({
    inbox: path.join(app.getPath('userData'), 'inbox'),
    userData: app.getPath('userData'),
  }))
}

function loadBounds() {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8')
    const b = JSON.parse(raw)
    if (b && Number.isFinite(b.width) && Number.isFinite(b.height)) return b
  } catch {
    /* 首次运行或文件损坏，用默认值 */
  }
  return { width: 1180, height: 820 }
}

function saveBounds(win) {
  try {
    if (!win || win.isDestroyed() || win.isMinimized()) return
    const b = win.getBounds()
    fs.writeFileSync(stateFile(), JSON.stringify(b))
  } catch {
    /* 存不下就算了，不能因为窗口位置崩掉 */
  }
}

/* --------------------------------- 主流程 --------------------------------- */

async function resolveTarget() {
  if (REMOTE) return REMOTE
  if (await isUp(`${LOCAL_URL}api/health`)) return LOCAL_URL
  await startEmbeddedServer()
  return LOCAL_URL
}

function createWindow(target) {
  const bounds = loadBounds()
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 420,
    minHeight: 560,
    show: false,
    backgroundColor: '#0f1113',
    title: 'ChatBox Pro',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  mainWindow = win
  Menu.setApplicationMenu(null)

  win.once('ready-to-show', () => {
    if (!SMOKE) win.show()
  })

  // 站点内的链接留在窗口里；外部链接交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith(target)) return { action: 'allow' }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    const ok =
      url.startsWith(target) ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('file://')
    if (!ok) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // 右键菜单：复制 / 粘贴 / 全选（Electron 默认不提供）
  win.webContents.on('context-menu', (_event, params) => {
    const items = []
    const canEdit = params.isEditable
    const hasSelection = Boolean(params.selectionText && params.selectionText.trim())

    if (canEdit) {
      items.push({ label: '剪切', role: 'cut', enabled: hasSelection })
      items.push({ label: '复制', role: 'copy', enabled: hasSelection })
      items.push({ label: '粘贴', role: 'paste' })
      items.push({ type: 'separator' })
      items.push({ label: '全选', role: 'selectAll' })
    } else if (hasSelection) {
      items.push({ label: '复制', role: 'copy' })
      items.push({ type: 'separator' })
      items.push({ label: '全选', role: 'selectAll' })
    } else {
      items.push({ label: '全选', role: 'selectAll' })
    }

    Menu.buildFromTemplate(items).popup({ window: win })
  })

  // F12 调试、Ctrl+R 刷新
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12') {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'r') {
      win.webContents.reload()
      event.preventDefault()
    }
  })

  win.on('close', () => saveBounds(win))
  win.on('closed', () => {
    mainWindow = null
  })

  win.loadURL(target)
  return win
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.chatboxpro.desktop')
    registerIpc()
    let target = LOCAL_URL
    let failure = ''
    try {
      target = await resolveTarget()
    } catch (e) {
      failure = e.message || String(e)
    }

    if (failure) {
      const win = new BrowserWindow({ width: 620, height: 320, backgroundColor: '#0f1113' })
      win.loadURL(
        'data:text/html;charset=utf-8,' +
          encodeURIComponent(
            `<body style="background:#0f1113;color:#e8eaed;font:14px/1.6 system-ui;padding:28px">
               <h3 style="color:#e05a5a">ChatBox Pro 启动失败</h3>
               <p>${failure.replace(/</g, '&lt;')}</p>
               <p style="color:#9aa3ad">可以设置环境变量 CHATBOX_SERVER_URL 指向你的服务器后重试。</p>
             </body>`,
          ),
      )
      return
    }

    const win = createWindow(target)

    if (SMOKE) {
      win.webContents.once('did-finish-load', async () => {
        await wait(1500)
        try {
          const img = await win.webContents.capturePage()
          const out = path.join(process.cwd(), 'smoke-desktop.png')
          fs.writeFileSync(out, img.toPNG())
          console.log('SMOKE_OK', out, target)
        } catch (e) {
          console.log('SMOKE_FAIL', e.message)
        }
        app.exit(0)
      })
    }
  })

  app.on('window-all-closed', () => {
    app.quit()
  })
}
