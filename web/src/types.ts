export type Role = 'system' | 'user' | 'assistant'

export interface Message {
  id: string
  role: Role
  content: string
  createdAt: number
  model?: string
  /** 该条消息是否是一次失败的请求 */
  error?: boolean
}

/**
 * 会话的两种归属：
 * - local  : 只存在这台设备上（IndexedDB），不联网同步
 * - server : 存在服务器上，多设备可同步（后续阶段实现）
 */
export type StorageKind = 'local' | 'server'

export interface Session {
  id: string
  title: string
  storage: StorageKind
  model: string
  createdAt: number
  updatedAt: number
  messages: Message[]
}

export interface Settings {
  baseUrl: string
  model: string
  temperature: number
  systemPrompt: string
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '/api',
  model: 'deepseek-chat',
  temperature: 0.7,
  systemPrompt: '',
}

export const MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek V3（快）' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1（推理）' },
]

export function newId(): string {
  const c = globalThis.crypto
  if (c && 'randomUUID' in c) return c.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
