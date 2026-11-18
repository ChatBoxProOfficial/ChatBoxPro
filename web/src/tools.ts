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

/** 子智能体允许使用的工具（只读，避免并发写冲突） */
export const SUBAGENT_TOOLS = new Set([
  'list_dir',
  'read_file',
  'search_in_files',
  'web_search',
  'fetch_url',
  'get_current_time',
  'calculate',
])

export const SP_SUBAGENT_DEF: ToolDef = {
  type: 'function',
  function: {
    name: 'spawn_subagent',
    description:
      '把一个相对独立的子任务交给子智能体执行。子智能体有自己的上下文和只读工具（读文件、搜索、抓网页），会跑多步后返回结论。适合"分别去查几件事"这类可以拆开的工作。',
    parameters: {
      type: 'object',
      properties: {
        task: {
          type: 'string',
          description: '要交给子智能体的完整任务描述（它看不到当前对话，必须写清楚背景）',
        },
      },
      required: ['task'],
    },
  },
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
      name: 'list_dir',
      description: '列出工作目录里某个文件夹的内容（文件名/类型）。path 为空表示根目录。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作目录的路径，如 "src"' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取工作目录里某个文本文件的内容（最多 256KB）。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作目录的文件路径，如 "src/app.ts"' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_in_files',
      description: '在工作目录里搜索包含关键词的文件与行号。',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: '要搜索的关键词' },
          path: { type: 'string', description: '限定搜索的起点，默认根目录' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description:
        '把内容写入工作目录里的某个文件（会覆盖原文件，需要用户逐次确认）。新建文件也可以用它。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对工作目录的文件路径' },
          content: { type: 'string', description: '要写入的完整文件内容' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description:
        '在工作目录里执行一条命令并返回输出（需要用户逐次确认）。适合跑测试、构建、查看 git 状态等。',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的完整命令' },
        },
        required: ['command'],
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

async function callFs(op: string, root: string, payload: Record<string, unknown>): Promise<string> {
  if (!root) return '没有设置工作目录，先在设置里选一个文件夹'
  const resp = await fetch('/api/fs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, root, ...payload }),
  })
  const json = await resp.json()
  if (!resp.ok) return `读取失败：${json?.error ?? resp.status}`
  return JSON.stringify(json)
}

/** 读原始文件内容（不存在返回空串） */
export async function readWorkspaceFile(root: string, path: string): Promise<string> {
  if (!root) return ''
  try {
    const resp = await fetch('/api/fs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ op: 'read', root, path }),
    })
    if (!resp.ok) return ''
    const j = await resp.json()
    return typeof j.content === 'string' ? j.content : ''
  } catch {
    return ''
  }
}

export async function executeTool(
  name: string,
  argsJson: string,
  baseUrl: string,
  workspaceDir = '',
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
      case 'list_dir': {
        const raw = await callFs('list', workspaceDir, { path: String(args.path ?? '.') })
        try {
          const j = JSON.parse(raw)
          if (!j.items) return raw
          return `目录 ${j.path}：\n${j.items
            .map((it: { name: string; type: string }) => `${it.type === 'dir' ? '📁' : '📄'} ${it.name}`)
            .join('\n')}`
        } catch {
          return raw
        }
      }
      case 'read_file': {
        const raw = await callFs('read', workspaceDir, { path: String(args.path ?? '') })
        try {
          const j = JSON.parse(raw)
          if (typeof j.content !== 'string') return raw
          return `文件 ${j.path}（${j.size ?? '?'} 字节）\n\n${j.content}`
        } catch {
          return raw
        }
      }
      case 'search_in_files': {
        const raw = await callFs('search', workspaceDir, {
          pattern: String(args.pattern ?? ''),
          path: String(args.path ?? '.'),
        })
        try {
          const j = JSON.parse(raw)
          if (!j.hits) return raw
          if (!j.hits.length) return '没有匹配'
          return j.hits
            .map((h: { file: string; line: number; text: string }) => `${h.file}:${h.line}  ${h.text}`)
            .join('\n')
        } catch {
          return raw
        }
      }
      case 'write_file': {
        const raw = await callFs('write', workspaceDir, {
          path: String(args.path ?? ''),
          content: String(args.content ?? ''),
        })
        try {
          const j = JSON.parse(raw)
          if (!j.path) return raw
          return `已写入 ${j.path}（${j.bytes} 字节）`
        } catch {
          return raw
        }
      }
      case 'run_command': {
        const cmd = String(args.command ?? '')
        if (!cmd) return '缺少命令'
        const resp = await fetch('/api/exec', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ root: workspaceDir, command: cmd }),
        })
        const j = await resp.json()
        if (!resp.ok) return `执行被拒绝：${j?.error ?? resp.status}`
        const parts = []
        parts.push(`退出码：${j.code}${j.timedOut ? '（超时被终止）' : ''}`)
        if (j.stdout) parts.push(`stdout:\n${j.stdout.trim()}`)
        if (j.stderr) parts.push(`stderr:\n${j.stderr.trim()}`)
        if (!j.stdout && !j.stderr) parts.push('（没有输出）')
        return parts.join('\n')
      }
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
