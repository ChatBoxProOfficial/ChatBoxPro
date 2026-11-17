export type Role = 'system' | 'user' | 'assistant'

export interface Attachment {
  id: string
  /** 用户看到的原始文件名 */
  name: string
  size: number
  /** 服务端落地后的文件名（inbox 里的名字） */
  stored?: string
  /** 服务端绝对路径 */
  path?: string
  uploading?: boolean
  error?: string
}

export interface Message {
  id: string
  role: Role
  content: string
  createdAt: number
  model?: string
  /** 该条消息是否是一次失败的请求 */
  error?: boolean
  attachments?: Attachment[]
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
  /** 侧边栏底部显示的账号名 */
  userName: string
  /** 已启用的模型 id（内置 + 自定义） */
  enabledModels: string[]
  /** 自定义追加的模型 id */
  extraModels: string[]
  /** 每次送给模型的最近消息条数；0 表示全部 */
  contextLimit: number
  /** 紧凑模式：更小的行距与字号 */
  compact: boolean
  /** DeepSeek Harness 服务器地址（暂未完成深度对接） */
  dshUrl: string
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '/api',
  model: 'deepseek-chat',
  temperature: 0.7,
  systemPrompt: '',
  userName: '我',
  enabledModels: ['deepseek-chat', 'deepseek-reasoner'],
  extraModels: [],
  contextLimit: 0,
  compact: false,
  dshUrl: '',
}

export const MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek V3' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1' },
]

export function newId(): string {
  const c = globalThis.crypto
  if (c && 'randomUUID' in c) return c.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id
}
