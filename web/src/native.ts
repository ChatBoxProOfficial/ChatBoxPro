/**
 * 原生网络层：安卓 App 里用插件直连 DeepSeek，绕开 WebView 的跨域限制，
 * 同时保持流式（SSE 逐行回推）。
 *
 * 非原生环境（浏览器 / Electron）返回 null，调用方继续用 fetch。
 */
import { registerPlugin } from '@capacitor/core'

interface ChunkEvent {
  requestId: string
  line: string
}
interface DoneEvent {
  requestId: string
}
interface ErrorEvent {
  requestId: string
  message: string
}
interface JsonResult {
  status: number
  body: string
}

interface ChatboxHttpPlugin {
  stream(options: {
    url: string
    apiKey: string
    body: string
    requestId: string
  }): Promise<{ status: number; body?: string }>
  cancel(options: { requestId: string }): Promise<void>
  json(options: {
    url: string
    method?: string
    apiKey: string
    body?: string
  }): Promise<JsonResult>
  upload(options: {
    url: string
    apiKey: string
    filename: string
    purpose: string
    data: string
  }): Promise<JsonResult>
  openExternal(options: { url: string }): Promise<void>
  appendLog(options: { line: string }): Promise<void>
  addListener(
    event: 'chunk' | 'done' | 'error',
    cb: (data: ChunkEvent & DoneEvent & ErrorEvent) => void,
  ): Promise<{ remove: () => void }>
}

const Native = registerPlugin<ChatboxHttpPlugin>('ChatboxHttp')

/** 是否在原生 App（安卓）里运行 */
export function isNativeApp(): boolean {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}

interface StreamOptions {
  url: string
  apiKey: string
  body: string
  signal?: AbortSignal
}

/**
 * 用原生插件发起流式请求，并把 SSE 行包装成 ReadableStream，
 * 这样上层的解析代码可以完全复用。
 */
export function nativeStream({ url, apiKey, body, signal }: StreamOptions): ReadableStream<Uint8Array> {
  const requestId = `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const encoder = new TextEncoder()
  let cleanup: Array<() => void> = []

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (line: string) => {
        controller.enqueue(encoder.encode(`${line}\n\n`))
      }

      const onChunk = (e: ChunkEvent) => {
        if (e.requestId === requestId) push(e.line)
      }
      const onDone = (e: DoneEvent) => {
        if (e.requestId !== requestId) return
        try {
          controller.close()
        } catch {
          /* 已关闭 */
        }
        cleanup.forEach((fn) => fn())
      }
      const onError = (e: ErrorEvent) => {
        if (e.requestId !== requestId) return
        push(`data: ${JSON.stringify({ error: { message: e.message } })}`)
        try {
          controller.close()
        } catch {
          /* 已关闭 */
        }
        cleanup.forEach((fn) => fn())
      }

      const c1 = await Native.addListener('chunk', onChunk)
      const c2 = await Native.addListener('done', onDone)
      const c3 = await Native.addListener('error', onError)
      cleanup = [() => void c1.remove(), () => void c2.remove(), () => void c3.remove()]

      if (signal) {
        signal.addEventListener('abort', () => {
          void Native.cancel({ requestId })
          try {
            controller.close()
          } catch {
            /* 已关闭 */
          }
        })
      }

      Native.stream({ url, apiKey, body, requestId }).then((res) => {
        if (res?.status && res.status >= 400) {
          push(
            `data: ${JSON.stringify({
              error: { message: `请求失败（${res.status}）：${(res.body || '').slice(0, 300)}` },
            })}`,
          )
          try {
            controller.close()
          } catch {
            /* 已关闭 */
          }
        }
      })
    },
    cancel() {
      void Native.cancel({ requestId })
      cleanup.forEach((fn) => fn())
    },
  })
}

/** 原生 JSON 请求（余额、文件列表、非流式摘要等） */
export async function nativeJson(
  url: string,
  apiKey: string,
  method = 'GET',
  body?: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await Native.json({ url, method, apiKey, body })
  return { ok: res.status >= 200 && res.status < 300, status: res.status, text: res.body }
}

/** 原生 multipart 上传（文件解析） */
export async function nativeUpload(
  url: string,
  apiKey: string,
  filename: string,
  purpose: string,
  base64: string,
): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await Native.upload({ url, apiKey, filename, purpose, data: base64 })
  return { ok: res.status >= 200 && res.status < 300, status: res.status, text: res.body }
}

/** 用系统浏览器打开链接（安卓端） */
export async function nativeOpenExternal(url: string): Promise<void> {
  await Native.openExternal({ url })
}

/** 写一行日志到 App 私有目录（crash.log），用于排查闪退 */
export async function nativeLog(line: string): Promise<void> {
  try {
    if (!isNativeApp()) return
    await Native.appendLog({ line })
  } catch {
    /* 日志失败不影响使用 */
  }
}


