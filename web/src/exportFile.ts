import type { Session } from './types'

/**
 * 导出格式。
 *
 * 采用「自描述 + 平铺消息」的结构：既方便人读，也方便后续写一个适配器
 * 转成 DSH 的会话格式（DSH 那边的导入入口稍后对接）。
 * 一旦确认了 DSH 官方 chat-import 插件实际接受的字段，只需在
 * `toDshPayload()` 这一处做映射，界面与存储都不用改。
 */
export const EXPORT_FORMAT = 'chatbox-pro.conversation'
export const EXPORT_VERSION = 1

export interface ExportedConversation {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  session: {
    id: string
    title: string
    model: string
    createdAt: string
    updatedAt: string
  }
  messages: Array<{
    role: string
    content: string
    createdAt: string
  }>
}

export function buildExport(session: Session): ExportedConversation {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    session: {
      id: session.id,
      title: session.title,
      model: session.model,
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
    },
    messages: session.messages
      .filter((m) => !m.error && m.content.trim())
      .map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt).toISOString(),
      })),
  }
}

export function safeFileName(title: string): string {
  const base = (title || 'conversation').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 60)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  return `${base}-${stamp}.chatbox.json`
}

/** 触发浏览器下载（手机与桌面都可用） */
export function downloadConversation(session: Session): void {
  const payload = buildExport(session)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeFileName(session.title)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
