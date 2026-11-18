import { createContext, useContext } from 'react'

export type Lang = 'zh' | 'en' | 'ja'

type Dict = Record<string, string>

const zh: Dict = {
  'nav.account': 'ChatBox Pro 账号与模型',
  'nav.personalize': '个性化',
  'nav.plugins': '插件',
  'nav.models': '管理模型',
  'nav.context': '上下文管理',
  'nav.dsh': '让 ChatBox Pro 连接到 DeepSeek Harness',
  'nav.paths': '管理模型保存路径',
  'nav.about': '关于 ChatBox Pro',
  'nav.general': '设置',

  'side.new': '建立一个新的对话',
  'side.settings': '设置',
  'side.search': '搜索历史对话',
  'side.empty': '没有匹配的对话',

  'chat.settings': '设置',
  'chat.subagent': '子智能体',
  'chat.userlist': '用户发言',

  'common.save': '保存',
  'common.cancel': '取消',
  'common.copy': '复制',
  'common.edit': '编辑',
  'common.regenerate': '重新生成',
  'common.continue': '继续',
  'send': '发送',
}

const en: Dict = {
  'nav.account': 'Account & Models',
  'nav.personalize': 'Personalization',
  'nav.plugins': 'Plugins',
  'nav.models': 'Model Management',
  'nav.context': 'Context Management',
  'nav.dsh': 'Connect to DeepSeek Harness',
  'nav.paths': 'File & Paths',
  'nav.about': 'About ChatBox Pro',
  'nav.general': 'Settings',

  'side.new': 'New conversation',
  'side.settings': 'Settings',
  'side.search': 'Search history',
  'side.empty': 'No matching conversations',

  'chat.settings': 'Settings',
  'chat.subagent': 'Sub-agents',
  'chat.userlist': 'Your messages',

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.copy': 'Copy',
  'common.edit': 'Edit',
  'common.regenerate': 'Regenerate',
  'common.continue': 'Continue',
  'send': 'Send',
}

const ja: Dict = {
  'nav.account': 'アカウントとモデル',
  'nav.personalize': 'パーソナライズ',
  'nav.plugins': 'プラグイン',
  'nav.models': 'モデル管理',
  'nav.context': 'コンテキスト管理',
  'nav.dsh': 'DeepSeek Harness に接続',
  'nav.paths': 'ファイルとパス',
  'nav.about': 'ChatBox Pro について',
  'nav.general': '設定',

  'side.new': '新しい会話',
  'side.settings': '設定',
  'side.search': '履歴を検索',
  'side.empty': '一致する会話がありません',

  'chat.settings': '設定',
  'chat.subagent': 'サブエージェント',
  'chat.userlist': 'あなたの発言',

  'common.save': '保存',
  'common.cancel': 'キャンセル',
  'common.copy': 'コピー',
  'common.edit': '編集',
  'common.regenerate': '再生成',
  'common.continue': '続きを生成',
  'send': '送信',
}

const DICTS: Record<Lang, Dict> = { zh, en, ja }

export const LANG_LABEL: Record<Lang, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
}

export function tr(lang: Lang, key: string, fallback?: string): string {
  return DICTS[lang]?.[key] ?? DICTS.zh[key] ?? fallback ?? key
}

/** 欢迎语（多语言） */
export const WELCOME: Record<Lang, string[]> = {
  zh: [
    '您好，ChatBox Pro 欢迎您',
    '今天想从哪件事开始？',
    '有什么可以帮你的？',
    '从一句话开始吧',
    '需要我查点什么？',
    '说吧，我在听',
    '想聊点什么？',
    '有什么要处理的？',
    '随时可以开始',
    '您先说说看',
  ],
  en: [
    'Hello, welcome to ChatBox Pro',
    'What shall we start with today?',
    'How can I help you?',
    'Start with one sentence',
    'Anything you need me to look up?',
    "I'm listening",
    'What would you like to talk about?',
    'Anything to take care of?',
    'Ready whenever you are',
    'Tell me what you have in mind',
  ],
  ja: [
    'こんにちは、ChatBox Pro へようこそ',
    '今日は何から始めますか？',
    '何をお手伝いしましょうか？',
    '一言から始めましょう',
    '何か調べましょうか？',
    'どうぞ、聞いています',
    '何を話しましょうか？',
    '処理したいことはありますか？',
    'いつでも始められます',
    'まずは話してみてください',
  ],
}

export const LangContext = createContext<Lang>('zh')

export function useLang(): Lang {
  return useContext(LangContext)
}

export function useT() {
  const lang = useLang()
  return (key: string, fallback?: string) => tr(lang, key, fallback)
}
