import { loadApiKey } from './secureStore'
import type { Message, Settings } from './types'

export interface StreamHandlers {
  onDelta: (text: string, kind: 'content' | 'reasoning') => void
  onDone: () => void
  onError: (message: string) => void
}

export class MissingKeyError extends Error {
  constructor() {
    super('还没有填写 API Key')
  }
}

/** 把界面上的消息整理成接口需要的载荷 */
function toPayload(messages: Message[], settings: Settings) {
  const out: Array<{ role: string; content: string }> = []
  if (settings.systemPrompt.trim()) {
    out.push({ role: 'system', content: settings.systemPrompt.trim() })
  }
  for (const m of messages) {
    if (m.error) continue
    if (!m.content.trim()) continue
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
            const delta = json?.choices?.[0]?.delta
            if (!delta) continue
            if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
              handlers.onDelta(delta.reasoning_content, 'reasoning')
            }
            if (typeof delta.content === 'string' && delta.content) {
              handlers.onDelta(delta.content, 'content')
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
