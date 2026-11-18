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
  '\n\n\`\`\`js\nconst scattered = 1 / Math.pow(450e-9, 4)\nconsole.log(scattered)\n\`\`\`\n',
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(404).end()
    return
  }

  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks)

  // 文件解析接口
  if (req.url?.startsWith('/files')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(
      JSON.stringify({
        id: 'file-mock-1',
        object: 'file',
        bytes: raw.length,
        filename: 'mock',
      }),
    )
    return
  }

  const body = raw.toString('utf8')
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

  // 带 server_tool_event 的 chunk（模拟联网搜索）
  const sendEvt = (evt) => {
    res.write(`data: ${JSON.stringify({ choices: [{ index: 0, server_tool_event: evt }] })}\n\n`)
  }

  for (const piece of REASONING) {
    send({ reasoning_content: piece })
    await sleep(120)
  }
  sendEvt({
    type: 'call_started',
    step: 0,
    call: { index: 0, id: 'srvtoolu_mock', type: 'deepseek_web_search', kind: 'search', action: { type: 'search', queries: ['天空为什么是蓝的'] } },
  })
  await sleep(400)
  sendEvt({
    type: 'call_completed',
    step: 0,
    call: {
      index: 0,
      id: 'srvtoolu_mock',
      status: 'completed',
      sources: [{ type: 'url', url: 'https://example.com/rayleigh', title: '瑞利散射 - 示例百科' }],
    },
  })
  await sleep(120)

  for (const piece of CONTENT) {
    send({ content: piece })
    await sleep(80)
  }

  // 最后一个 chunk 带引用
  send({
    title: '瑞利散射与天空颜色',
    annotations: [
      {
        type: 'url_citation',
        url_citation: {
          url: 'https://example.com/rayleigh',
          title: '瑞利散射 - 示例百科',
          start_index: 0,
          end_index: 10,
        },
      },
    ],
    server_tool_calls: [{ index: 0, calls: [{ id: 'srvtoolu_mock', status: 'completed' }] }],
  })
  // 独立 usage chunk（OpenAI 风格：choices 为空）
  res.write(
    `data: ${JSON.stringify({
      choices: [],
      usage: {
        prompt_tokens: 2000,
        completion_tokens: 350,
        prompt_cache_hit_tokens: 800,
        prompt_cache_miss_tokens: 1200,
        total_tokens: 1550,
        completion_tokens_details: { reasoning_tokens: 210 },
      },
    })}\n\n`,
  )

  res.write('data: [DONE]\n\n')
  res.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`mock upstream on http://127.0.0.1:${PORT}`)
})
