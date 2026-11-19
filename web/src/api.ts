import { loadApiKey } from './secureStore'
import { isNativeApp, nativeStream, nativeJson, nativeUpload } from './native'
import type { Attachment, Message, Settings } from './types'
import { SP_SUBAGENT_DEF, TOOL_DEFS } from './tools'

/**
 * 上传附件到服务器 inbox（DSH 那边的「手机文件进工作区」就走这条）。
 * 用原始字节 + query 里的文件名，服务端不用解析 multipart。
 */
export async function uploadFile(
  file: File,
  baseUrl: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Pick<Attachment, 'stored' | 'path' | 'size'>> {
  if (isNativeApp()) return { stored: '', size: file.size }
  const url = `${baseUrl}/upload?name=${encodeURIComponent(file.name)}`
  const buf = await file.arrayBuffer()

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: buf,
  })
  onProgress?.(buf.byteLength, buf.byteLength)

  if (!resp.ok) {
    let msg = `上传失败（${resp.status}）`
    try {
      const j = await resp.json()
      msg = j?.error?.message || msg
    } catch {
      /* 保持默认 */
    }
    throw new Error(msg)
  }
  const j = await resp.json()
  return { stored: j.stored, path: j.path, size: j.size }
}

export interface StreamHandlers {
  onDelta: (text: string, kind: 'content' | 'reasoning') => void
  onDone: () => void
  onError: (message: string) => void
  /** 服务端工具事件（搜索开始/结束等） */
  onToolEvent?: (evt: {
    type: string
    action?: string
    status?: string
  }) => void
  /** 结束时附带的信息：引用来源、是否用过工具 */
  onMeta?: (meta: {
    citations?: Array<{ url: string; title?: string }>
    usedTools?: boolean
  }) => void
  /** 模型请求调用的工具 */
  onToolCalls?: (calls: Array<{ id: string; name: string; arguments: string }>) => void
  /** 服务端生成的会话标题 */
  onTitle?: (title: string) => void
  /** 服务端返回的 token 用量（最后一个 chunk 或独立 usage chunk） */
  onUsage?: (usage: {
    prompt?: number
    cached?: number
    completion?: number
    reasoning?: number
    total?: number
  }) => void
}

/** 没填 Key 时给出的引导文案（不是报错，是提示） */
export const NEED_KEY_TEXT =
  '您还没有填写 API Key，请打开左上角栏目进入设置页，填入自己的 Key 并保存，就能正常使用服务了。'

export class MissingKeyError extends Error {
  constructor() {
    super(NEED_KEY_TEXT)
  }
}

/** 把需要解析的文件上传到官方 Files API，拿到 file_id */
export async function uploadDocument(
  file: File,
  baseUrl: string,
  purpose: string,
): Promise<{ fileId: string }> {
  const key = await loadApiKey()
  if (!key) throw new Error('还没有填写 API Key')
  if (isNativeApp()) {
    const b64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const str = String(reader.result || '')
        resolve(str.slice(str.indexOf(',') + 1))
      }
      reader.onerror = () => reject(new Error('读取文件失败'))
      reader.readAsDataURL(file)
    })
    const res = await nativeUpload(
      'https://api.deepseek.com/files',
      key,
      file.name,
      purpose,
      b64,
    )
    if (!res.ok) {
      let msg = `解析失败（${res.status}）`
      try {
        msg = JSON.parse(res.text)?.error?.message || msg
      } catch {
        /* 保留默认 */
      }
      throw new Error(msg)
    }
    const json = JSON.parse(res.text)
    if (!json?.id) throw new Error('解析失败：没有返回 file_id')
    return { fileId: json.id as string }
  }

  const buf = await file.arrayBuffer()
  const url = `${baseUrl}/files?name=${encodeURIComponent(file.name)}&purpose=${encodeURIComponent(purpose)}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'x-deepseek-key': key,
    },
    body: buf,
  })
  const text = await resp.text()
  if (!resp.ok) {
    let msg = `解析失败（${resp.status}）`
    try {
      msg = JSON.parse(text)?.error?.message || msg
    } catch {
      /* 保留默认 */
    }
    throw new Error(msg)
  }
  const json = JSON.parse(text)
  if (!json?.id) throw new Error('解析失败：没有返回 file_id')
  return { fileId: json.id }
}

/** 组装一条用户元信息：日期,星期,平台,语言 */
function buildReminder(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]
  return `${date},${week},,App,中文`
}

/** 把一段对话压缩成摘要（非流式一次请求） */
export async function summarize(
  messages: Message[],
  settings: Settings,
  baseUrl: string,
): Promise<string> {
  const key = await loadApiKey()
  if (!key) throw new Error('还没有填写 API Key')

  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? '用户' : '助手'}：${m.content}`)
    .join('\n\n')

  if (isNativeApp()) {
    const body = JSON.stringify({
      model: settings.model || 'deepseek-flash',
      stream: false,
      temperature: 0.3,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content:
            '把下面这段对话压缩成一段摘要，供之后继续讨论时作为背景。要求：\n' +
            '1. 保留关键事实、结论、数字、专有名词、未完成的事项；\n' +
            '2. 去掉寒暄、重复、无关内容；\n' +
            '3. 用第三人称陈述，不超过 400 字；\n' +
            '4. 直接输出摘要正文，不要任何前缀。\n\n' +
            transcript,
        },
      ],
    })
    const res = await nativeJson('https://api.deepseek.com/chat/completions', key, 'POST', body)
    if (!res.ok) {
      let msg = `压缩失败（${res.status}）`
      try {
        msg = JSON.parse(res.text)?.error?.message || msg
      } catch {
        /* 保留 */
      }
      throw new Error(msg)
    }
    const content = JSON.parse(res.text)?.choices?.[0]?.message?.content
    if (!content) throw new Error('压缩失败：没有返回内容')
    return String(content).trim()
  }
  const resp = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-deepseek-key': key },
    body: JSON.stringify({
      model: settings.model || 'deepseek-flash',
      stream: false,
      temperature: 0.3,
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'user',
          content:
            '把下面这段对话压缩成一段摘要，供之后继续讨论时作为背景。要求：\n' +
            '1. 保留关键事实、结论、数字、专有名词、未完成的事项；\n' +
            '2. 去掉寒暄、重复、无关内容；\n' +
            '3. 用第三人称陈述，不超过 400 字；\n' +
            '4. 直接输出摘要正文，不要任何前缀。\n\n' +
            transcript,
        },
      ],
    }),
  })

  const text = await resp.text()
  if (!resp.ok) {
    let msg = `压缩失败（${resp.status}）`
    try {
      msg = JSON.parse(text)?.error?.message || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const json = JSON.parse(text)
  const content = json?.choices?.[0]?.message?.content
  if (!content) throw new Error('压缩失败：没有返回内容')
  return String(content).trim()
}

/** 把界面上的消息整理成接口需要的载荷 */
/**
 * 工具消息必须紧跟在带 tool_calls 的 assistant 后面。
 * 这里做一次清理：孤立（找不到配对）的 tool 消息直接丢掉，避免 400。
 */
function sanitizeToolMessages(list: Message[]): Message[] {
  const out: Message[] = []
  let pending = new Set<string>()

  for (const m of list) {
    if (m.role === 'tool') {
      const id = m.toolCallId || ''
      if (pending.has(id)) {
        out.push(m)
        pending.delete(id)
      }
      continue
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      pending = new Set(m.toolCalls.map((c) => c.id))
      out.push(m)
      continue
    }
    pending = new Set()
    out.push(m)
  }
  return out
}

function toPayload(messages: Message[], settings: Settings) {
  const out: Array<{ role: string; content: string }> = []
  if (settings.systemPrompt.trim()) {
    out.push({ role: 'system', content: settings.systemPrompt.trim() })
  }
  // 语言指令：跟着界面语言走
  if (settings.lang === 'en') {
    out.push({
      role: 'system',
      content:
        'Always respond in English unless the user explicitly asks for another language.',
    })
  } else if (settings.lang === 'ja') {
    out.push({
      role: 'system',
      content:
        'ユーザーが別の言語を明示的に指定しない限り、常に日本語で回答してください。',
    })
  }

  const reminder = settings.reminder ? buildReminder() : ''
  // 注意：带 tool_calls 的 assistant 即使正文为空也必须保留，否则后面的 tool 会变成孤儿
  const kept = messages.filter(
    (m) =>
      !m.error &&
      (m.content.trim() || (m.toolCalls && m.toolCalls.length > 0) || m.role === 'tool'),
  )
  // 上下文管理：只带最近 N 条（0 = 全部），裁剪后重新配对一次
  const limit = settings.contextLimit > 0 ? settings.contextLimit : kept.length
  const window = sanitizeToolMessages(kept.slice(-limit))
  for (const m of window) {
    if (m.role === 'summary') {
      out.push({ role: 'system', content: `【更早对话的摘要】\n${m.content}` })
      continue
    }
    if (m.role === 'tool') {
      out.push({
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: m.content,
      } as never)
      continue
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      out.push({
        role: 'assistant',
        content: m.content || '',
        tool_calls: m.toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: t.arguments },
        })),
      } as never)
      continue
    }

    if (reminder && m.role === 'user') {
      out.push({ role: 'latest_reminder', content: reminder })
    }
    const files = (m.attachments || []).filter((a) => a.fileId)
    const images = (m.attachments || []).filter((a) => a.imageUrl)
    if (m.role === 'user' && (files.length > 0 || images.length > 0)) {
      out.push({
        role: 'user',
        content: [
          ...images.map((a) => ({
            type: 'image_url',
            image_url: { url: a.imageUrl },
          })),
          ...files.map((f) => ({ type: 'file', file_id: f.fileId })),
          { type: 'text', text: m.content },
        ],
      } as never)
      continue
    }
    if (m.role === 'user' && files.length > 0) {
      // 有需要解析的文件：内容改成块数组
      out.push({
        role: 'user',
        content: [
          ...files.map((f) => ({ type: 'file', file_id: f.fileId })),
          { type: 'text', text: m.content },
        ],
      } as never)
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

/**
 * 通过我们自己的服务器中转，向 DeepSeek 发起流式对话。
 * key 只在请求头里带一次，服务器转发后即丢弃，不落盘、不进日志。
 */
export interface StreamOptions {
  /** 续写模式：把最后一条 assistant 当开头 */
  prefixMode?: boolean
  prefixText?: string
}

export async function streamChat(
  messages: Message[],
  settings: Settings,
  handlers: StreamHandlers,
  signal?: AbortSignal,
  options?: StreamOptions,
): Promise<void> {
  const key = await loadApiKey()
  if (!key) {
    handlers.onError(new MissingKeyError().message)
    return
  }

  const native = isNativeApp()
  const nativeBase = 'https://api.deepseek.com'
  let stream: ReadableStream<Uint8Array> | null = null
  let resp: Response | null = null

  const buildBody = () =>
    JSON.stringify({
      ...(options?.prefixMode ? { prefix_mode: true } : {}),
      model: settings.model,
      messages: options?.prefixMode
        ? [
            ...toPayload(messages.slice(0, -1), settings),
            { role: 'assistant', content: options.prefixText ?? '', prefix: true },
          ]
        : toPayload(messages, settings),
      temperature: settings.temperature,
      stream: true,
      thinking: { type: settings.reasoningEffort === 'off' ? 'disabled' : 'enabled' },
      ...(settings.reasoningEffort === 'off'
        ? {}
        : { reasoning_effort: settings.reasoningEffort || 'high' }),
      stream_options: { include_usage: true },
      ...(settings.toolsEnabled || settings.teamMode
        ? { tools: settings.teamMode ? [...TOOL_DEFS, SP_SUBAGENT_DEF] : TOOL_DEFS }
        : {}),
      ...(settings.webSearch
        ? { tools: [{ type: 'deepseek_web_search' }, { type: 'deepseek_read_url' }] }
        : {}),
      ...(settings.safety ? { safety_check: { level: 'high' } } : {}),
      ...(settings.model === 'deepseek-flash' ? { title: { enabled: true } } : {}),
    })

  try {
    if (native) {
      stream = nativeStream({
        url: `${nativeBase}/chat/completions`,
        apiKey: key,
        body: buildBody(),
        signal,
      })
    } else {
      resp = await fetch(`${settings.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // 中转服务器读取该头并转发给上游，不会记录
          'x-deepseek-key': key,
        },
        body: buildBody(),
        signal,
      })
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    handlers.onError(`网络请求失败：${(e as Error).message}`)
    return
  }

  if (!native && (!resp || !resp.ok || !resp.body)) {
    const text = await resp!.text().catch(() => '')
    let msg = text.slice(0, 400)
    try {
      const j = JSON.parse(text)
      msg = j?.error?.message || j?.message || msg
    } catch {
      /* 保持原文 */
    }
    handlers.onError(`请求失败（${resp!.status}）：${msg || '没有返回内容'}`)
    return
  }

  const toolAcc: Record<number, { id: string; name: string; arguments: string }> = {}
  const source: ReadableStream<Uint8Array> = native ? (stream as ReadableStream<Uint8Array>) : (resp!.body as ReadableStream<Uint8Array>)
  const reader = source.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // 逐条解析 SSE 事件
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const raw = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data:')) continue
          const data = line.slice(5).trim()
          if (!data || data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            // 用量可能在最后一个 chunk 顶层，也可能是独立 usage chunk
            if (json?.usage) {
              const u = json.usage
              const hit =
                u.prompt_cache_hit_tokens ??
                u.prompt_tokens_details?.cached_tokens ??
                0
              // prompt_tokens 含缓存命中；未命中部分单独算，避免重复计数
              const miss =
                u.prompt_cache_miss_tokens ?? Math.max(0, (u.prompt_tokens ?? 0) - hit)
              handlers.onUsage?.({
                prompt: miss,
                cached: hit,
                completion: u.completion_tokens,
                reasoning: u.completion_tokens_details?.reasoning_tokens,
                total: u.total_tokens,
              })
            }

            const choice = json?.choices?.[0]
            const delta = choice?.delta

            // 服务端工具事件（搜索开始/结束）
            const evt = choice?.server_tool_event
            if (evt) {
              handlers.onToolEvent?.({
                type: evt.type,
                action: evt.call?.action?.type,
                status: evt.call?.status,
              })
            }

            if (!delta) continue
            // 不同兼容实现字段名略有差异，两个都认
            const reasoning = delta.reasoning_content ?? delta.reasoning
            if (typeof reasoning === 'string' && reasoning) {
              handlers.onDelta(reasoning, 'reasoning')
            }
            if (typeof delta.content === 'string' && delta.content) {
              handlers.onDelta(delta.content, 'content')
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = typeof tc.index === 'number' ? tc.index : 0
                if (!toolAcc[idx]) {
                  toolAcc[idx] = { id: tc.id ?? '', name: '', arguments: '' }
                }
                if (tc.id) toolAcc[idx].id = tc.id
                const fn = tc.function
                if (fn?.name) toolAcc[idx].name += fn.name
                if (fn?.arguments) toolAcc[idx].arguments += fn.arguments
              }
            }
            // 服务端生成的会话标题
            if (typeof delta?.title === 'string' && delta.title.trim()) {
              handlers.onTitle?.(delta.title.trim())
            }

            // 最后一个 chunk 会带完整的 annotations / server_tool_calls
            const annotations = delta?.annotations
            if (Array.isArray(annotations) && annotations.length) {
              const citations = annotations
                .map((a: any) => a?.url_citation)
                .filter(Boolean)
                .map((c: any) => ({ url: String(c.url || ''), title: c.title }))
                .filter((c: any) => c.url)
              const toolCalls = delta?.server_tool_calls
              handlers.onMeta?.({
                citations,
                usedTools: Array.isArray(toolCalls) ? toolCalls.length > 0 : true,
              })
            } else if (Array.isArray(delta?.server_tool_calls) && delta.server_tool_calls.length) {
              handlers.onMeta?.({ usedTools: true })
            }
          } catch {
            /* 半个 JSON 或心跳，跳过 */
          }
        }
      }
    }
    const calls = Object.values(toolAcc).filter((t) => t.name)
    if (calls.length) handlers.onToolCalls?.(calls)
    handlers.onDone()
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      handlers.onDone()
      return
    }
    handlers.onError(`读取流失败：${(e as Error).message}`)
  }
}

/** 查询账户余额 */
export async function fetchBalance(baseUrl: string): Promise<{
  available: boolean
  cny?: { total: string; granted: string; toppedUp: string }
}> {
  const key = await loadApiKey()
  if (isNativeApp()) {
    const res = await nativeJson('https://api.deepseek.com/user/balance', key)
    const j = JSON.parse(res.text || '{}')
    if (!res.ok) throw new Error(j?.error?.message || `余额查询失败（${res.status}）`)
    const cny0 = (j.balance_infos || []).find((b: any) => b.currency === 'CNY')
    return {
      available: !!j.is_available,
      cny: cny0
        ? {
            total: cny0.total_balance,
            granted: cny0.granted_balance,
            toppedUp: cny0.topped_up_balance,
          }
        : undefined,
    }
  }
  const resp = await fetch(`${baseUrl}/balance`, {
    headers: { 'x-deepseek-key': key },
  })
  const j = await resp.json()
  if (!resp.ok) throw new Error(j?.error?.message || `余额查询失败（${resp.status}）`)
  const cny = (j.balance_infos || []).find((b: any) => b.currency === 'CNY')
  return {
    available: !!j.is_available,
    cny: cny
      ? {
          total: cny.total_balance,
          granted: cny.granted_balance,
          toppedUp: cny.topped_up_balance,
        }
      : undefined,
  }
}

/** 已上传的文件列表 */
export async function listFiles(baseUrl: string) {
  const key = await loadApiKey()
  if (isNativeApp()) {
    const res = await nativeJson('https://api.deepseek.com/files', key)
    const j = JSON.parse(res.text || '{}')
    if (!res.ok) throw new Error(j?.error?.message || `获取文件列表失败（${res.status}）`)
    return (j.data || []).map((f: any) => ({
      id: f.id as string,
      filename: f.filename as string,
      bytes: f.bytes as number,
      purpose: f.purpose as string,
    }))
  }
  const resp = await fetch(`${baseUrl}/files/list`, {
    headers: { 'x-deepseek-key': key },
  })
  const j = await resp.json()
  if (!resp.ok) throw new Error(j?.error?.message || `获取文件列表失败（${resp.status}）`)
  return (j.data || []).map((f: any) => ({
    id: f.id as string,
    filename: f.filename as string,
    bytes: f.bytes as number,
    purpose: f.purpose as string,
  }))
}

/** 删除已上传的文件 */
export async function deleteFile(baseUrl: string, id: string) {
  const key = await loadApiKey()
  if (isNativeApp()) {
    const res = await nativeJson(`https://api.deepseek.com/files/${encodeURIComponent(id)}`, key, 'DELETE')
    if (!res.ok) {
      let msg = `删除失败（${res.status}）`
      try {
        msg = JSON.parse(res.text)?.error?.message || msg
      } catch {
        /* 保留 */
      }
      throw new Error(msg)
    }
    return true
  }
  const resp = await fetch(`${baseUrl}/files/delete?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-deepseek-key': key },
  })
  if (!resp.ok) {
    const j = await resp.json().catch(() => ({}))
    throw new Error(j?.error?.message || `删除失败（${resp.status}）`)
  }
  return true
}
