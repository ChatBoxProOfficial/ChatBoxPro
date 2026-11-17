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
  "Let me think about why the sky appears blue.\n\n",
  "The user is asking about daytime sky color, which is a classic atmospheric optics question.\n",
  "Key mechanism: Rayleigh scattering, intensity proportional to 1/lambda^4.\n",
  "  - blue ~450nm, red ~700nm\n",
  "  - (700/450)^4 is about 5.9x stronger scattering for blue\n\n",
  "Also need to mention why sunsets look red: longer path through atmosphere depletes blue.\n",
  "I will answer with the mechanism first, then the sunset contrast.\n",
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
