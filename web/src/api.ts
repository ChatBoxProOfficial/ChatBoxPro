import { loadApiKey } from './secureStore'
import type { Attachment, Message, Settings } from './types'

/**
 * 上传附件到服务器 inbox（DSH 那边的「手机文件进工作区」就走这条）。
 * 用原始字节 + query 里的文件名，服务端不用解析 multipart。
 */
export async function uploadFile(
  file: File,
  baseUrl: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<Pick<Attachment, 'stored' | 'path' | 'size'>> {
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

/** 把界面上的消息整理成接口需要的载荷 */
function toPayload(messages: Message[], settings: Settings) {
  const out: Array<{ role: string; content: string }> = []
  if (settings.systemPrompt.trim()) {
    out.push({ role: 'system', content: settings.systemPrompt.trim() })
  }
  const kept = messages.filter((m) => !m.error && m.content.trim())
  // 上下文管理：只带最近 N 条（0 = 全部）
  const limit = settings.contextLimit > 0 ? settings.contextLimit : kept.length
  for (const m of kept.slice(-limit)) {
    out.push({ role: m.role, content: m.content })
  }
  return out
}

/**
 * 通过我们自己的服务器中转，向 DeepSeek 发起流式对话。
 * key 只在请求头里带一次，服务器转发后即丢弃，不落盘、不进日志。
 */
export async function streamChat(
  messages: Message[],
  settings: Settings,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const key = await loadApiKey()
  if (!key) {
    handlers.onError(new MissingKeyError().message)
    return
  }

  let resp: Response
  try {
    resp = await fetch(`${settings.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // 中转服务器读取该头并转发给上游，不会记录
        'x-deepseek-key': key,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: toPayload(messages, settings),
        temperature: settings.temperature,
        stream: true,
        // 明确告诉服务端要不要思考：不传的话默认是开启的，
        // 关掉显示时顺手关掉思考，省 token
        thinking: {
          type: settings.reasoningEffort === 'off' ? 'disabled' : 'enabled',
        },
        ...(settings.reasoningEffort === 'off'
          ? {}
          : { reasoning_effort: settings.reasoningEffort || 'high' }),
        stream_options: { include_usage: true },
        // 让服务端顺手起个会话标题（仅 flash 支持）
        ...(settings.model === 'deepseek-flash' ? { title: { enabled: true } } : {}),
        // 联网搜索 / 阅读链接：声明后由 DeepSeek 服务端执行，客户端不跑工具
        ...(settings.webSearch
          ? { tools: [{ type: 'deepseek_web_search' }, { type: 'deepseek_read_url' }] }
          : {}),
      }),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    handlers.onError(`网络请求失败：${(e as Error).message}`)
    return
  }

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '')
    let msg = text.slice(0, 400)
    try {
      const j = JSON.parse(text)
      msg = j?.error?.message || j?.message || msg
    } catch {
      /* 保持原文 */
    }
    handlers.onError(`请求失败（${resp.status}）：${msg || '没有返回内容'}`)
    return
  }

  const reader = resp.body.getReader()
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
    handlers.onDone()
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      handlers.onDone()
      return
    }
    handlers.onError(`读取流失败：${(e as Error).message}`)
  }
}
