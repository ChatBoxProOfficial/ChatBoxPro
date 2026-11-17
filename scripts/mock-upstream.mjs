/**
 * 仅用于本地验证的假上游：模拟 DeepSeek 的流式响应。
 * 会先吐 reasoning_content，再吐 content，并记录收到的请求体（便于断言参数）。
 *
 * 用法：node scripts/mock-upstream.mjs [port]
 * 然后让中转服务指向它：DEEPSEEK_BASE_URL=http://127.0.0.1:8899 node server/index.mjs
 */
import http from 'node:http'
import { writeFileSync } from 'node:fs'

const PORT = Number(process.argv[2] || 8899)
const LOG = process.env.MOCK_LOG || 'mock-last-request.json'

const REASONING = [
  '先看用户问的是什么：为什么天空是蓝的。\n',
  '这属于大气光学，核心是瑞利散射。\n',
  '散射强度与波长四次方成反比，蓝光波长短，散射更强。\n',
  '再补充日落变红的解释，最后组织语言输出。',
]
const CONTENT = [
  '因为大气分子对**短波长光**的散射更强（瑞利散射），',
  '蓝光被散射到各个方向的比例远高于红光。',
  '\n\n所以白天抬头时，进入眼睛的散射光以蓝光为主。',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404).end()
    return
  }

  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks).toString('utf8')
  try {
    writeFileSync(LOG, body)
  } catch {
    /* 忽略 */
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  })

  const send = (delta) => {
    res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta }] })}\n\n`)
  }

  for (const piece of REASONING) {
    send({ reasoning_content: piece })
    await sleep(120)
  }
  for (const piece of CONTENT) {
    send({ content: piece })
    await sleep(80)
  }
  res.write('data: [DONE]\n\n')
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock upstream on http://127.0.0.1:${PORT}`)
})
