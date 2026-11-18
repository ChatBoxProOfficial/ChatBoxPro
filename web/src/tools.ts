/**
 * 本地工具：模型可以调用它们，由我们（客户端/中转）真正执行。
 * 这是从「只能聊天」走向「能干活」的最小一步。
 */
export interface ToolDef {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前日期和时间（含星期），用户问“今天几号”“现在几点”时使用。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: '计算一个算术表达式，例如 "(3+4)*2/7"。只支持数字和 + - * / % ( ) 以及 Math 里的 sqrt/pow/abs。',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: '要计算的表达式' },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '联网搜索，返回若干条结果的标题、链接和摘要。需要最新信息时使用。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索词，1-128 字' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: '抓取一个网页，返回标题和 Markdown 正文。用户给出链接时可用。',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '要抓取的网页地址' },
        },
        required: ['url'],
      },
    },
  },
]

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function safeCalc(expr: string): string {
  // 只允许数字、运算符、括号和少量函数名
  if (!/^[\d+\-*/%().\s]|sqrt|pow|abs/.test(expr) || /[a-z_]{3,}/i.test(expr.replace(/sqrt|pow|abs/g, ''))) {
    throw new Error('表达式里包含不允许的字符')
  }
  const sanitized = expr.replace(/sqrt/g, 'Math.sqrt').replace(/pow/g, 'Math.pow').replace(/abs/g, 'Math.abs')
  const value = Function(`"use strict";return (${sanitized})`)()
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('计算结果无效')
  return String(value)
}

export async function executeTool(
  name: string,
  argsJson: string,
  baseUrl: string,
): Promise<string> {
  let args: Record<string, unknown> = {}
  try {
    args = argsJson ? JSON.parse(argsJson) : {}
  } catch {
    return `参数不是合法 JSON：${argsJson.slice(0, 100)}`
  }

  try {
    switch (name) {
      case 'get_current_time': {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate(),
        ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
          d.getMinutes(),
        ).padStart(2, '0')} ${WEEK[d.getDay()]}`
      }
      case 'calculate':
        return safeCalc(String(args.expression ?? ''))
      case 'web_search': {
        const resp = await fetch(`${baseUrl}/search`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-deepseek-key': await import('./secureStore').then((m) => m.loadApiKey()),
          },
          body: JSON.stringify({ query: String(args.query ?? ''), count: 5 }),
        })
        const json = await resp.json()
        if (!resp.ok) return `搜索失败：${json?.error?.message ?? resp.status}`
        const results = (json.results || []) as Array<{
          title: string
          url: string
          summary: string
        }>
        if (!results.length) return '没有搜到结果'
        return results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.summary}`)
          .join('\n\n')
      }
      case 'fetch_url': {
        const resp = await fetch(`${baseUrl}/fetch`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-deepseek-key': await import('./secureStore').then((m) => m.loadApiKey()),
          },
          body: JSON.stringify({ url: String(args.url ?? '') }),
        })
        const json = await resp.json()
        if (!resp.ok) return `抓取失败：${json?.error?.message ?? resp.status}`
        const content = String(json.content ?? '')
        return `${json.title || ''}\n\n${content.slice(0, 8000)}${
          content.length > 8000 ? '\n…（内容过长已截断）' : ''
        }`
      }
      default:
        return `未知工具：${name}`
    }
  } catch (e) {
    return `工具执行出错：${(e as Error).message}`
  }
}
