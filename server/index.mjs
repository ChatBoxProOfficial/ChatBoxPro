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
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(HERE, '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const UPSTREAM = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'

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

async function handleChat(req, res) {
  const key = String(req.headers['x-deepseek-key'] || '').trim()
  if (!key) return send(res, 401, JSON.stringify({ error: { message: '缺少 API Key' } }), {
    'content-type': 'application/json; charset=utf-8',
  })

  let payload
  try {
    payload = await readBody(req)
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
    model: signal.model || 'deepseek-chat',
    messages: Array.isArray(signal.messages) ? signal.messages : [],
    temperature: typeof signal.temperature === 'number' ? signal.temperature : 0.7,
    stream: true,
  })

  try {
    const up = await upstreamRequest('/chat/completions', {
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

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, upstream: UPSTREAM }))
    return
  }
  if (url.pathname === '/api/chat') {
    if (req.method !== 'POST') return send(res, 405, 'method not allowed')
    void handleChat(req, res)
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
