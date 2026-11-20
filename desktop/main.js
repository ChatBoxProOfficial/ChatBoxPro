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
const { app, BrowserWindow, Menu, shell, ipcMain, net } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const { pathToFileURL } = require('node:url')

// 用经典滚动条（配合前端 CSS 的圆角样式，始终可见）
app.commandLine.appendSwitch('disable-features', 'OverlayScrollbar')

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

  // 通用探测：给 DSH 地址做健康检查（主进程发请求，无跨域）
  ipcMain.handle('chatbox:probe', async (_e, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: '地址无效' }
    }
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 4000)
      const resp = await net.fetch(url, { signal: ctrl.signal })
      clearTimeout(timer)
      let json = null
      try {
        json = await resp.json()
      } catch {
        json = null
      }
      const looksDsh = Boolean(json && (json.ok === true || json.service === 'dsh' || json.name === 'dsh'))
      return { ok: true, status: resp.status, json, looksDsh }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) }
    }
  })

  // 读取远端版本信息（在主进程里发请求，避免渲染进程的跨域限制）
  ipcMain.handle('chatbox:check-update', async (_e, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: '更新地址无效（必须是 http/https）' }
    }
    try {
      const headers = { 'cache-control': 'no-cache' }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 15000)
      const resp = await net.fetch(url, { headers, signal: ctrl.signal })
      clearTimeout(timer)
      if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` }
      const json = await resp.json()
      return { ok: true, manifest: json }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) }
    }
  })

  // 下载更新包
  ipcMain.handle('chatbox:download-update', async (event, url, expectedSha256) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return { ok: false, error: '下载地址无效' }
    }
    try {
      const dir = path.join(app.getPath('userData'), 'updates')
      fs.mkdirSync(dir, { recursive: true })
      const file = path.join(dir, 'update.zip')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 20000)
      const resp = await net.fetch(url, { signal: ctrl.signal })
      clearTimeout(timer)
      if (!resp.ok) return { ok: false, error: `HTTP ${resp.status}` }

      const total = Number(resp.headers.get('content-length') || 0)
      const chunks = []
      let received = 0
      const reader = resp.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(Buffer.from(value))
        received += value.length
        if (total > 0) {
          event.sender.send('chatbox:update-progress', {
            received,
            total,
            percent: Math.round((received / total) * 100),
          })
        }
      }
      const buf = Buffer.concat(chunks)
      if (expectedSha256) {
        const crypto = require('node:crypto')
        const actual = crypto.createHash('sha256').update(buf).digest('hex')
        if (actual.toLowerCase() !== String(expectedSha256).toLowerCase()) {
          try {
            fs.unlinkSync(file)
          } catch {
            /* ignore */
          }
          return { ok: false, error: '更新包校验失败（sha256 不匹配），已丢弃，请重试' }
        }
      }
      fs.writeFileSync(file, buf)
      return { ok: true, file, size: received }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) }
    }
  })

  // 应用更新：写一个等待退出的脚本，退出后解压覆盖并重启
  ipcMain.handle('chatbox:apply-update', async (_e, file) => {
    if (typeof file !== 'string' || !fs.existsSync(file)) {
      return { ok: false, error: '更新包不存在' }
    }
    const installDir = path.dirname(app.getPath('exe'))
    const exePath = app.getPath('exe')
    const scriptPath = path.join(path.dirname(file), 'apply-update.ps1')
    const logPath = path.join(path.dirname(file), 'update-error.log')
    const script = [
      '$ErrorActionPreference = "Stop"',
      `$targetPid = ${process.pid}`,
      'while (Get-Process -Id $targetPid -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 400 }',
      'Start-Sleep -Milliseconds 600',
      'try {',
      `  Expand-Archive -LiteralPath "${file}" -DestinationPath "${installDir}" -Force`,
      '} catch {',
      `  "$(Get-Date -Format o) 解压失败: $($_.Exception.Message)" | Out-File -Encoding utf8 "${logPath}"`,
      '}',
      'finally {',
      `  Start-Process "${exePath}"`,
      '}',
    ].join('\r\n')
    try {
      fs.writeFileSync(scriptPath, script, 'utf8')
      const { spawn } = require('node:child_process')
      spawn(
        'powershell.exe',
        ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        { detached: true, stdio: 'ignore', windowsHide: true },
      ).unref()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) }
    }
  })
}

function loadBounds() {
  const fallback = { width: 1180, height: 820 }
  let b = null
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8')
    b = JSON.parse(raw)
  } catch {
    return fallback
  }
  if (!b || !Number.isFinite(b.width) || !Number.isFinite(b.height)) return fallback

  // 上次的显示器可能已经拔掉了：落在任何屏幕之外就回到默认位置
  try {
    const { screen } = require('electron')
    const displays = screen.getAllDisplays()
    const visible = displays.some((d) => {
      const a = d.workArea
      const overlapX = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x)
      const overlapY = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y)
      return overlapX > 120 && overlapY > 80
    })
    if (!visible) return fallback
  } catch {
    /* 拿不到屏幕信息就按原样用 */
  }
  return b
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
