export type Role = 'system' | 'user' | 'assistant' | 'tool' | 'summary'

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
  /** 文本类文件的内容（截断后），随消息一起发给模型 */
  text?: string
  /** 通过 Files API 解析后的文件 id（PDF/Office/图片等） */
  fileId?: string
  /** 解析方式 */
  purpose?: string
  /** 图片：压缩后的 data URL（真正让模型看图） */
  imageUrl?: string
}

export interface Usage {
  /** 输入 token（未命中缓存部分，官方口径） */
  prompt?: number
  /** 命中上下文缓存的输入 token */
  cached?: number
  /** 输出 token */
  completion?: number
  /** 其中思考 token */
  reasoning?: number
  /** 官方返回的 total */
  total?: number
}

export interface MessageMeta {
  /** 发出请求的时间 */
  startedAt?: number
  /** 第一个 token 到达 */
  firstTokenAt?: number
  /** 结束时间 */
  endedAt?: number
}

export interface Message {
  id: string
  role: Role
  content: string
  createdAt: number
  model?: string
  /** 该条消息是否是一次失败的请求 */
  error?: boolean
  /** 思维链（reasoning_content），与正文分开存 */
  reasoning?: string
  /** 思考耗时（毫秒），用于「已深度思考（用时 X 秒）」 */
  reasoningMs?: number
  /** 联网搜索用到的参考来源 */
  citations?: Array<{ url: string; title?: string }>
  /** token 用量与耗时 */
  usage?: Usage
  meta?: MessageMeta
  /** 模型请求调用的工具 */
  toolCalls?: Array<{ id: string; name: string; arguments: string }>
  /** tool 角色消息对应的调用 id */
  toolCallId?: string
  /** 工具名（便于界面展示） */
  toolName?: string
  /** 这条回复是否用过搜索/读链接 */
  usedTools?: boolean
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
  /** 思维链展示方式：off 关闭 / web 仿网页版 / dsh 仿 DSH */
  reasoningDisplay: 'off' | 'web' | 'dsh'
  /** 思考强度：off 关闭思考 / low / high / max */
  reasoningEffort: 'off' | 'low' | 'high' | 'max'
  /** 允许启动子智能体团队协作（需连接 DSH 后生效） */
  teamMode: boolean
  /** 联网搜索（DeepSeek 服务端工具） */
  webSearch: boolean
  /** 主题：浅色 / 深色 / 跟随系统 */
  theme: 'light' | 'dark' | 'system'
  /** 模型内容安全（官方 safety_check） */
  safety: boolean
  /** 每轮附带用户元信息（日期/平台/语言） */
  reminder: boolean
  /** 允许模型调用本地工具（时间/搜索/抓网页/计算/读文件） */
  toolsEnabled: boolean
  /** 只读文件工具的根目录（留空 = 不允许读文件） */
  workspaceDir: string
  /** 上下文超过阈值时自动压缩 */
  autoCompact: boolean
  /** 自动压缩阈值（百分比） */
  compactThreshold: number
}

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: '/api',
  model: 'deepseek-flash',
  temperature: 0.7,
  systemPrompt: '',
  userName: '我',
  enabledModels: ['deepseek-flash', 'deepseek-v4-pro'],
  extraModels: [],
  contextLimit: 0,
  compact: false,
  dshUrl: '',
  reasoningDisplay: 'web',
  reasoningEffort: 'high',
  teamMode: false,
  webSearch: false,
  theme: 'system',
  safety: false,
  reminder: true,
  toolsEnabled: false,
  workspaceDir: '',
  autoCompact: false,
  compactThreshold: 60,
}

/** 当前 DeepSeek API 提供的模型（2026-11）。label 给输入栏用，full 给选择面板用 */
export const MODELS = [
  {
    id: 'deepseek-flash',
    label: 'DeepSeek-V4.1 Flash',
    short: 'V4.1 Flash',
    full: 'DeepSeek-V4.1-Flash-1017',
  },
  {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    short: 'V4 Pro',
    full: 'DeepSeek-V4-Pro-0813',
  },
]

/** 思考强度档位（与官方一致：off / low / high / max） */
export const EFFORTS = ['off', 'low', 'high', 'max'] as const

export function modelFullName(id: string): string {
  return MODELS.find((m) => m.id === id)?.full ?? id
}

/** 旧模型名 → 新模型名（历史会话/旧配置迁移用） */
const LEGACY: Record<string, string> = {
  'deepseek-chat': 'deepseek-flash',
  'deepseek-reasoner': 'deepseek-flash',
  'deepseek-v4-flash': 'deepseek-flash',
  'deepseek-v4-flash-vision-exp': 'deepseek-flash',
}

export function normalizeModelId(id: string): string {
  return LEGACY[id] || id
}

export function newId(): string {
  const c = globalThis.crypto
  if (c && 'randomUUID' in c) return c.randomUUID()
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id
}

/** 输入栏里用的短名，省地方 */
export function modelShort(id: string): string {
  const m = MODELS.find((x) => x.id === id)
  return m?.short ?? m?.label ?? id
}
