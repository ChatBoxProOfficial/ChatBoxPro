/**
 * ChatBox Pro 中转服务器
 *
 * 职责只有两件：
 *   1. 托管前端静态文件（dist/）
 *   2. 把 /api/chat 的请求转发给 DeepSeek，并把流式响应原样透传回去
 *
 * 安全约定（务必保持）：
 *   - 用户的 API Key 只从请求头 x-deepseek-key 读取，用完即弃；
 *   - 绝不把 Key、请求头、请求体写入任何日志或磁盘；
 *   - 环境变量里不放任何用户 Key。
 */
import http from 'node:http'
import https from 'node:https'
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(HERE, '..')
// 桌面壳会把前端一起打包，可用 CHATBOX_DIST 指定静态目录
const DIST = process.env.CHATBOX_DIST
  ? resolve(process.env.CHATBOX_DIST)
  : join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const UPSTREAM = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
// 上传文件的落地目录（桌面端会指到 userData/inbox，避免装到只读目录里）
const INBOX = process.env.CHATBOX_INBOX
  ? resolve(process.env.CHATBOX_INBOX)
  : join(ROOT, 'inbox')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers })
  res.end(body)
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)
  if (pathname === '/' || pathname === '') pathname = '/index.html'

  // 阻止目录穿越
  const target = normalize(join(DIST, pathname))
  if (!target.startsWith(DIST)) return send(res, 403, 'forbidden')

  let file = target
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')

  // SPA 回退：没有扩展名的路径一律交给 index.html
  if (!existsSync(file)) {
    if (!extname(pathname)) file = join(DIST, 'index.html')
    else return send(res, 404, 'not found')
  }

  const ext = extname(file).toLowerCase()
  const headers = {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
  }
  res.writeHead(200, headers)
  createReadStream(file).pipe(res)
}

/** 读取请求体，带上限 */
function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function upstreamRequest(pathname, { method, headers, body }) {
  const url = new URL(pathname, UPSTREAM)
  const mod = url.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
      },
      resolve,
    )
    req.on('error', reject)
    req.setTimeout(180_000, () => req.destroy(new Error('upstream timeout')))
    if (body) req.write(body)
    req.end()
  })
}

/**
 * 文件解析：把客户端传来的原始字节，按官方 Files API 需要的 multipart 转上去。
 * purpose 必须放在 file 之前（官方要求）。
 */
async function handleFileParse(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const filename = (url.searchParams.get('name') || 'file').replace(/[\r\n"]/g, '_')
  const purpose = url.searchParams.get('purpose') || 'text_recognition'
  const key = String(req.headers['x-deepseek-key'] || '').trim()
  if (!key) {
    return send(res, 401, JSON.stringify({ error: { message: '缺少 API Key' } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }

  let buf
  try {
    buf = await readBody(req, 100 * 1024 * 1024) // 官方上限 100 MiB
  } catch {
    return send(res, 413, JSON.stringify({ error: { message: '文件太大' } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }

  const boundary = '----dshtransfer' + Math.random().toString(16).slice(2)
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="purpose"\r\n\r\n` +
    `${purpose}\r\n` +
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`
  const tail = `\r\n--${boundary}--\r\n`
  const body = Buffer.concat([Buffer.from(head, 'utf8'), buf, Buffer.from(tail, 'utf8')])

  try {
    const up = await upstreamRequest('/files', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': String(body.length),
      },
      body,
    })
    let data = ''
    up.on('data', (c) => (data += c))
    up.on('end', () => {
      res.writeHead(up.statusCode || 502, {
        'content-type': 'application/json; charset=utf-8',
      })
      res.end(data)
    })
  } catch (e) {
    send(res, 502, JSON.stringify({ error: { message: `文件解析失败：${e.message}` } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
}

/**
 * 上传附件：请求体就是文件原始字节，文件名放 query 里。
 * 比手写 multipart 解析可靠，客户端只发一次 ArrayBuffer。
 */
async function handleUpload(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const rawName = url.searchParams.get('name') || 'file'
  const safe = rawName.replace(/[\\/:*?"<>|\r\n\t]/g, '_').replace(/^\.+/, '').slice(0, 120)

  let body
  try {
    body = await readBody(req, 64 * 1024 * 1024) // 单文件上限 64 MB
  } catch {
    return send(res, 413, JSON.stringify({ error: { message: '文件太大（上限 64MB）' } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
  if (!body.length) {
    return send(res, 400, JSON.stringify({ error: { message: '空文件' } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }

  try {
    mkdirSync(INBOX, { recursive: true })
    // 加时间戳前缀，避免同名覆盖
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const fileName = `${stamp}-${safe}`
    const target = join(INBOX, fileName)
    writeFileSync(target, body)
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(
      JSON.stringify({
        ok: true,
        name: rawName,
        stored: fileName,
        path: target,
        size: body.length,
      }),
    )
  } catch (e) {
    send(res, 500, JSON.stringify({ error: { message: `保存失败：${e.message}` } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
}

async function handleChat(req, res) {
  const key = String(req.headers['x-deepseek-key'] || '').trim()
  if (!key) return send(res, 401, JSON.stringify({ error: { message: '缺少 API Key' } }), {
    'content-type': 'application/json; charset=utf-8',
  })

  let payload
  try {
    payload = await readBody(req, 64 * 1024 * 1024)
  } catch {
    return send(res, 413, 'payload too large')
  }

  let signal
  try {
    signal = JSON.parse(payload.toString('utf8') || '{}')
  } catch {
    return send(res, 400, 'invalid json')
  }
  // 只转发白名单字段，避免把客户端多余的东西带上去
  const forward = JSON.stringify({
    model: signal.model || 'deepseek-flash',
    messages: Array.isArray(signal.messages) ? signal.messages : [],
    temperature: typeof signal.temperature === 'number' ? signal.temperature : 0.7,
    stream: signal.stream === false ? false : true,
    // 思考模式开关与强度（DeepSeek 新接口参数）
    ...(signal.thinking ? { thinking: signal.thinking } : {}),
    // 前缀续写
    ...(signal.prefix_mode ? { prefix_mode: true } : {}),
    // 模型内容安全
    ...(signal.safety_check ? { safety_check: signal.safety_check } : {}),
    // 让服务端生成会话标题
    ...(signal.title ? { title: signal.title } : {}),
    // 让流式响应带上 usage
    ...(signal.stream_options ? { stream_options: signal.stream_options } : {}),
    // 服务端联网工具（只放行官方这两个）
    ...(Array.isArray(signal.tools)
      ? {
          tools: signal.tools.filter(
            (t) =>
              t &&
              (t.type === 'deepseek_web_search' ||
                t.type === 'deepseek_read_url' ||
                (t.type === 'function' && t.function?.name)),
          ),
        }
      : {}),
    ...(signal.reasoning_effort ? { reasoning_effort: signal.reasoning_effort } : {}),
  })

  try {
    const chatPath = signal.prefix_mode ? '/beta/chat/completions' : '/chat/completions'
    const up = await upstreamRequest(chatPath, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: forward,
    })

    if (up.statusCode && up.statusCode >= 400) {
      let detail = ''
      up.on('data', (c) => (detail += c))
      up.on('end', () => {
        let msg = detail.slice(0, 500)
        try {
          msg = JSON.parse(detail)?.error?.message || msg
        } catch {
          /* 保留原文 */
        }
        send(
          res,
          up.statusCode || 502,
          JSON.stringify({ error: { message: msg } }),
          { 'content-type': 'application/json; charset=utf-8' },
        )
      })
      return
    }

    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })

    up.on('data', (chunk) => {
      // 逐块写出：不缓冲，才能保住「边生成边显示」
      if (!res.write(chunk)) {
        up.pause()
        res.once('drain', () => up.resume())
      }
    })
    up.on('end', () => res.end())
    up.on('error', () => res.end())
  } catch (e) {
    send(res, 502, JSON.stringify({ error: { message: `上游请求失败：${e.message}` } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
}

/** 通用 GET 透传（余额、模型列表、文件列表） */
async function handleGet(req, res, pathname) {
  const key = String(req.headers['x-deepseek-key'] || '').trim()
  if (!key) {
    return send(res, 401, JSON.stringify({ error: { message: '缺少 API Key' } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
  try {
    const up = await upstreamRequest(pathname, {
      method: 'GET',
      headers: { authorization: `Bearer ${key}` },
    })
    let data = ''
    up.on('data', (c) => (data += c))
    up.on('end', () => {
      res.writeHead(up.statusCode || 502, {
        'content-type': 'application/json; charset=utf-8',
      })
      res.end(data)
    })
  } catch (e) {
    send(res, 502, JSON.stringify({ error: { message: e.message } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
}

/** 通用 JSON POST 透传（独立搜索、抓取、删除文件） */
async function handlePost(req, res, pathname, method = 'POST') {
  const key = String(req.headers['x-deepseek-key'] || '').trim()
  if (!key) {
    return send(res, 401, JSON.stringify({ error: { message: '缺少 API Key' } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
  let body
  try {
    body = await readBody(req, 2 * 1024 * 1024)
  } catch {
    return send(res, 413, 'payload too large')
  }
  try {
    const up = await upstreamRequest(pathname, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: method === 'DELETE' ? undefined : body,
    })
    let data = ''
    up.on('data', (c) => (data += c))
    up.on('end', () => {
      res.writeHead(up.statusCode || 502, {
        'content-type': 'application/json; charset=utf-8',
      })
      res.end(data)
    })
  } catch (e) {
    send(res, 502, JSON.stringify({ error: { message: e.message } }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
}

/** 只读文件访问：限制在 root 目录内，拒绝越界路径 */
async function handleFs(req, res) {
  let body
  try {
    body = JSON.parse(await readBody(req, 1024 * 1024))
  } catch {
    return send(res, 400, 'bad body')
  }
  const { op, root, path: relPath = '.', pattern = '', maxResults = 40 } = body || {}
  if (typeof root !== 'string' || !root.trim()) {
    return send(res, 400, JSON.stringify({ error: '没有设置工作目录' }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }

  const path = await import('node:path')
  const fsMod = await import('node:fs/promises')
  const rootAbs = path.resolve(root)
  const target = path.resolve(rootAbs, String(relPath || '.'))

  // 防越界
  if (target !== rootAbs && !target.startsWith(rootAbs + path.sep)) {
    return send(res, 403, JSON.stringify({ error: '路径超出工作目录' }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }

  const ok = (data) =>
    send(res, 200, JSON.stringify(data), {
      'content-type': 'application/json; charset=utf-8',
    })

  try {
    if (op === 'list') {
      const entries = await fsMod.readdir(target, { withFileTypes: true })
      const items = entries.slice(0, 200).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'dir' : 'file',
        size: e.isFile() ? undefined : undefined,
      }))
      return ok({ path: path.relative(rootAbs, target) || '.', items })
    }

    if (op === 'read') {
      const stat = await fsMod.stat(target)
      if (!stat.isFile()) return send(res, 400, JSON.stringify({ error: '不是文件' }))
      if (stat.size > 256 * 1024) {
        return ok({
          path: path.relative(rootAbs, target),
          truncated: true,
          content: (await fsMod.readFile(target, 'utf8')).slice(0, 200000),
        })
      }
      return ok({
        path: path.relative(rootAbs, target),
        size: stat.size,
        content: await fsMod.readFile(target, 'utf8'),
      })
    }

    if (op === 'write') {
      const content = String(body.content ?? '')
      if (content.length > 2 * 1024 * 1024) {
        return send(res, 413, JSON.stringify({ error: '内容太大（>2MB）' }))
      }
      await fsMod.mkdir(path.dirname(target), { recursive: true })
      await fsMod.writeFile(target, content, 'utf8')
      return ok({ path: path.relative(rootAbs, target), bytes: Buffer.byteLength(content) })
    }

    if (op === 'search') {
      const needle = String(pattern || '')
      if (!needle) return send(res, 400, JSON.stringify({ error: '缺少关键词' }))
      const hits = []
      const skip = new Set(['node_modules', '.git', 'dist', 'release', 'build', '.next'])
      const walk = async (dir, depth) => {
        if (hits.length >= Number(maxResults) || depth > 6) return
        let entries
        try {
          entries = await fsMod.readdir(dir, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          if (hits.length >= Number(maxResults)) return
          if (skip.has(e.name)) continue
          const full = path.join(dir, e.name)
          if (e.isDirectory()) {
            await walk(full, depth + 1)
          } else if (e.isFile()) {
            try {
              const st = await fsMod.stat(full)
              if (st.size > 512 * 1024) continue
              const text = await fsMod.readFile(full, 'utf8')
              const lines = text.split('\n')
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes(needle)) {
                  hits.push({
                    file: path.relative(rootAbs, full),
                    line: i + 1,
                    text: lines[i].trim().slice(0, 200),
                  })
                  if (hits.length >= Number(maxResults)) break
                }
              }
            } catch {
              /* 二进制等跳过 */
            }
          }
        }
      }
      await walk(target, 0)
      return ok({ hits, count: hits.length })
    }

    return send(res, 400, JSON.stringify({ error: 'unknown op' }))
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: e.message }), {
      'content-type': 'application/json; charset=utf-8',
    })
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, upstream: UPSTREAM }))
    return
  }
  if (url.pathname === '/api/paths') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ inbox: INBOX, dist: DIST }))
    return
  }
  if (url.pathname === '/api/chat') {
    if (req.method !== 'POST') return send(res, 405, 'method not allowed')
    void handleChat(req, res)
    return
  }
  if (url.pathname === '/api/fs') {
    if (req.method !== 'POST') return send(res, 405, 'method not allowed')
    void handleFs(req, res)
    return
  }
  if (url.pathname === '/api/balance') {
    void handleGet(req, res, '/user/balance')
    return
  }
  if (url.pathname === '/api/models') {
    void handleGet(req, res, '/models')
    return
  }
  if (url.pathname === '/api/files/list') {
    void handleGet(req, res, '/files')
    return
  }
  if (url.pathname === '/api/files/delete') {
    const id = url.searchParams.get('id') || ''
    void handlePost(req, res, `/files/${encodeURIComponent(id)}`, 'DELETE')
    return
  }
  if (url.pathname === '/api/search') {
    void handlePost(req, res, '/v1/tools/search')
    return
  }
  if (url.pathname === '/api/fetch') {
    void handlePost(req, res, '/v1/tools/fetch')
    return
  }
  if (url.pathname === '/api/files') {
    if (req.method !== 'POST') return send(res, 405, 'method not allowed')
    void handleFileParse(req, res)
    return
  }
  if (url.pathname === '/api/upload') {
    if (req.method !== 'POST') return send(res, 405, 'method not allowed')
    void handleUpload(req, res)
    return
  }
  if (url.pathname.startsWith('/api/')) return send(res, 404, 'no such api')
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed')

  if (!existsSync(DIST)) {
    return send(res, 503, '前端还没构建：先运行 npm run build')
  }
  serveStatic(req, res)
})

server.listen(PORT, HOST, () => {
  console.log(`ChatBox Pro server: http://${HOST}:${PORT}`)
  console.log(`上游: ${UPSTREAM}`)
  console.log('提示：API Key 只由客户端随请求头传入，本服务不记录。')
})
