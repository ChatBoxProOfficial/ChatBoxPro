/**
 * 运行时文案翻译：把界面上的中文静态文案替换成目标语言。
 * 只处理文本节点，跳过消息正文（.md / .bubble / 输入框 / 代码块），避免改动用户内容和模型输出。
 */
import type { Lang } from './i18n'

type Entry = { en: string; ja: string }

export const TEXT: Record<string, Entry> = {
  // 导航
  账号与模型: { en: 'Account & Models', ja: 'アカウントとモデル' },
  默认模型与温度: { en: 'API key, default model, temperature', ja: 'APIキー・既定モデル・温度' },
  个性化: { en: 'Personalization', ja: 'パーソナライズ' },
  '紧凑模式、主题与系统提示词': { en: 'Compact mode, theme, system prompt', ja: 'コンパクト表示・テーマ・システムプロンプト' },
  插件: { en: 'Plugins', ja: 'プラグイン' },
  扩展能力: { en: 'Extensions', ja: '拡張機能' },
  管理模型: { en: 'Model Management', ja: 'モデル管理' },
  启用模型与自定义模型: { en: 'Enabled and custom models', ja: '有効なモデルとカスタムモデル' },
  上下文管理: { en: 'Context Management', ja: 'コンテキスト管理' },
  '上下文压缩、历史条数与数据管理': { en: 'Compression, history size, data', ja: '圧縮・履歴件数・データ管理' },
  语言设置: { en: 'Language', ja: '言語設定' },
  界面语言与字号: { en: 'Interface language and font size', ja: '表示言語と文字サイズ' },
  '让 ChatBox Pro 连接到 DeepSeek Harness': {
    en: 'Connect to DeepSeek Harness',
    ja: 'DeepSeek Harness に接続',
  },
  服务端地址与连通性检测: { en: 'Server address and connectivity', ja: 'サーバーアドレスと接続確認' },
  管理模型保存路径: { en: 'File & Paths', ja: 'ファイルとパス' },
  存放位置与工具权限: { en: 'Storage location and tool permissions', ja: '保存先とツール権限' },
  '关于 ChatBox Pro': { en: 'About ChatBox Pro', ja: 'ChatBox Pro について' },
  版本信息与支持作者: { en: 'Version and support', ja: 'バージョンとサポート' },
  设置: { en: 'Settings', ja: '設定' },

  // 账号
  'API Key、默认模型与温度': { en: 'API key, model, temperature', ja: 'APIキー・モデル・温度' },
  '请选择会话…': { en: 'Choose a conversation…', ja: '会話を選択…' },
  '至少保留一个模型': { en: 'Keep at least one model', ja: 'モデルを最低1つ選択してください' },
  '已加密保存': { en: 'Saved securely', ja: '暗号化して保存しました' },
  '路径已复制': { en: 'Path copied', ja: 'パスをコピーしました' },
  '还没有发言。': { en: 'No messages yet.', ja: 'まだ発言がありません。' },
  账号: { en: 'Account', ja: 'アカウント' },
  显示名称: { en: 'Display name', ja: '表示名' },
  '仅以加密形式存储于本机。请求经中转转发，服务端不记录、不落盘。': {
    en: 'Stored encrypted on this device only. Requests are relayed; the server keeps no logs.',
    ja: 'この端末に暗号化して保存されます。リクエストは中継され、サーバーには記録されません。',
  },
  更换: { en: 'Change', ja: '変更' },
  清除: { en: 'Clear', ja: '消去' },
  保存: { en: 'Save', ja: '保存' },
  账户余额: { en: 'Balance', ja: '残高' },
  刷新余额: { en: 'Refresh balance', ja: '残高を更新' },
  查询中: { en: 'Loading…', ja: '読み込み中…' },
  暂无数据: { en: 'No data', ja: 'データなし' },
  模型: { en: 'Model', ja: 'モデル' },
  默认模型: { en: 'Default model', ja: '既定モデル' },
  温度: { en: 'Temperature', ja: '温度' },

  // 个性化
  紧凑模式: { en: 'Compact mode', ja: 'コンパクト表示' },
  '缩小字号与行距，提升单屏信息密度。': {
    en: 'Smaller font and line height for higher density.',
    ja: '文字と行間を詰めて、1画面の情報量を増やします。',
  },
  背景图: { en: 'Background image', ja: '背景画像' },
  更换图片: { en: 'Change image', ja: '画像を変更' },
  选择图片: { en: 'Choose image', ja: '画像を選択' },
  背景强度: { en: 'Background strength', ja: '背景の強さ' },
  背景模糊: { en: 'Background blur', ja: '背景のぼかし' },
  主题: { en: 'Theme', ja: 'テーマ' },
  浅色: { en: 'Light', ja: 'ライト' },
  深色: { en: 'Dark', ja: 'ダーク' },
  跟随系统: { en: 'System', ja: 'システム' },
  附带用户元信息: { en: 'Send user context', ja: 'ユーザー情報を送信' },
  系统提示词: { en: 'System prompt', ja: 'システムプロンプト' },
  '例如：回答保持简洁，先给结论': { en: 'e.g. Be concise, lead with the conclusion', ja: '例：簡潔に、結論から答える' },

  // 插件
  '插件系统尚未开放，后续将支持主题、快捷指令与会话导入导出等扩展。': {
    en: 'Plugins are not available yet. Themes, shortcuts and import/export extensions will come later.',
    ja: 'プラグインは未提供です。テーマ・ショートカット・インポート/エクスポート拡張を予定しています。',
  },
  暂无可安装插件: { en: 'No plugins available', ja: '利用できるプラグインはありません' },

  // 模型
  启用的模型: { en: 'Enabled models', ja: '有効なモデル' },
  '勾选的模型会出现在输入栏的模型选择菜单中。': {
    en: 'Checked models appear in the composer menu.',
    ja: 'チェックしたモデルが入力欄のメニューに表示されます。',
  },
  思维链展示: { en: 'Reasoning display', ja: '思考プロセスの表示' },
  开启思维链展示: { en: 'Show reasoning', ja: '思考プロセスを表示' },
  思考强度: { en: 'Reasoning effort', ja: '思考の強さ' },
  关闭: { en: 'Off', ja: 'オフ' },
  轻量: { en: 'Light', ja: '軽量' },
  标准: { en: 'Standard', ja: '標準' },
  深度: { en: 'Deep', ja: '深い' },
  '不思考，最快': { en: 'No reasoning, fastest', ja: '思考なし・最速' },
  简单问题: { en: 'Simple questions', ja: '簡単な質問' },
  默认推荐: { en: 'Recommended', ja: 'おすすめ' },
  复杂推理: { en: 'Complex reasoning', ja: '複雑な推論' },
  '样式一：DeepSeek 网页版': { en: 'Style 1: DeepSeek web', ja: 'スタイル1：DeepSeek Web' },
  '样式二：DeepSeek Harness': { en: 'Style 2: DeepSeek Harness', ja: 'スタイル2：DeepSeek Harness' },
  添加自定义模型: { en: 'Add custom model', ja: 'カスタムモデルを追加' },
  '填写与 API 一致的模型 ID，添加后即可选用。': {
    en: 'Enter the model ID used by the API; it becomes selectable once added.',
    ja: 'API と同じモデル ID を入力すると、追加後に選択できます。',
  },
  添加: { en: 'Add', ja: '追加' },

  // 上下文
  自动压缩上下文: { en: 'Auto-compress context', ja: 'コンテキストの自動圧縮' },
  上下文占用超阈值时自动压缩: {
    en: 'Compress automatically when context exceeds threshold',
    ja: 'しきい値を超えたら自動で圧縮',
  },
  触发阈值: { en: 'Threshold', ja: 'しきい値' },
  携带的历史条数: { en: 'History size', ja: '履歴の件数' },
  '单次请求携带的最近消息条数（0 表示全部）': {
    en: 'Recent messages per request (0 = all)',
    ja: '1リクエストの直近メッセージ数（0 はすべて）',
  },
  压缩指定对话的上下文: { en: 'Compress a conversation', ja: '会話のコンテキストを圧縮' },
  选择对话: { en: 'Choose conversation', ja: '会話を選択' },
  压缩所选会话: { en: 'Compress selected', ja: '選択した会話を圧縮' },
  压缩中: { en: 'Compressing…', ja: '圧縮中…' },
  本机会话: { en: 'Local conversations', ja: 'この端末の会話' },
  导出全部历史对话: { en: 'Export all conversations', ja: 'すべての会話をエクスポート' },
  '导出单个 JSON 文件，包含全部会话及消息记录。': {
    en: 'Export one JSON file with all conversations and messages.',
    ja: '全会話とメッセージを含む JSON を1つ出力します。',
  },
  删除本机全部会话: { en: 'Delete all local conversations', ja: 'この端末の会話をすべて削除' },
  全部删除: { en: 'Delete all', ja: 'すべて削除' },
  已可删除点击确认: { en: 'Ready — click to confirm', ja: '削除可能 — クリックで確定' },

  // DSH
  服务器地址: { en: 'Server address', ja: 'サーバーアドレス' },
  测试: { en: 'Test', ja: 'テスト' },
  连接正常: { en: 'Connected', ja: '接続OK' },
  '无法连接，请检查地址与网络': { en: 'Cannot connect. Check address and network.', ja: '接続できません。アドレスとネットワークを確認してください。' },
  接入后能做什么: { en: 'What it enables', ja: '接続後にできること' },

  // 路径
  存放位置: { en: 'Storage location', ja: '保存先' },
  复制路径: { en: 'Copy path', ja: 'パスをコピー' },
  打开文件夹: { en: 'Open folder', ja: 'フォルダーを開く' },
  工作目录: { en: 'Workspace', ja: '作業ディレクトリ' },
  允许写文件: { en: 'Allow file writes', ja: 'ファイル書き込みを許可' },
  允许执行命令: { en: 'Allow command execution', ja: 'コマンド実行を許可' },
  服务端已解析文件: { en: 'Files parsed on server', ja: 'サーバーで解析済みのファイル' },
  暂无文件: { en: 'No files', ja: 'ファイルなし' },
  刷新列表: { en: 'Refresh list', ja: '一覧を更新' },
  删除: { en: 'Delete', ja: '削除' },

  // 语言/字号
  界面语言: { en: 'Interface language', ja: '表示言語' },
  '切换界面语言。目前覆盖导航、侧边栏、欢迎语与常用按钮；设置正文仍以中文为主。': {
    en: 'Switches the interface language. Covers navigation, sidebar, welcome text and common buttons.',
    ja: '表示言語を切り替えます。ナビ・サイドバー・ウェルカム文・主要ボタンに対応します。',
  },
  '整站等比缩放，对话文字、按钮、间距一起变化。': {
    en: 'Scales the whole interface: text, buttons and spacing together.',
    ja: '文字・ボタン・余白をまとめて拡大/縮小します。',
  },
  '背景只影响聊天区域的观感，界面面板始终保持磨砂质感，不会发白或糊成一片。': {
    en: 'The background only affects the chat area; panels stay frosted, with no washed-out look.',
    ja: '背景はチャット領域のみに影響します。パネルはすりガラス風のままです。',
  },
  '每轮请求附带当前日期、平台与语言信息（latest_reminder），使回答符合当前时空上下文。': {
    en: 'Each request includes current date, platform and language (latest_reminder).',
    ja: '各リクエストに日付・プラットフォーム・言語（latest_reminder）を添付します。',
  },
  '账户余额不足，请充值后重试': {
    en: 'Insufficient balance. Please top up and retry.',
    ja: '残高が不足しています。チャージ後に再試行してください。',
  },
  '赠送': { en: 'Granted', ja: '付与' },
  '充值': { en: 'Topped up', ja: 'チャージ' },
  '例如': { en: 'e.g.', ja: '例' },
  '插件系统尚未开放': { en: 'Plugins are not available yet', ja: 'プラグインは未提供です' },
  '提前压缩（最省）': { en: 'Early (cheapest)', ja: '早め（最も節約）' },
  '均衡（推荐）': { en: 'Balanced (recommended)', ja: 'バランス（推奨）' },
  '保留更多原文': { en: 'Keep more text', ja: '原文を多く保持' },
  '每轮回答结束后检测上下文占用率。超过阈值时，将早期消息压缩为摘要，仅保留最近 8 条。': {
    en: 'After each reply the context usage is checked. Above the threshold, older messages are summarised and only the latest 8 are kept.',
    ja: '各回答後にコンテキスト使用率を確認します。しきい値を超えると古いメッセージを要約し、直近8件のみ保持します。',
  },
  '40% — 提前压缩（最省）': { en: '40% — Early (cheapest)', ja: '40% — 早め（最も節約）' },
  '60% — 均衡（推荐）': { en: '60% — Balanced (recommended)', ja: '60% — バランス（推奨）' },
  '80% — 保留更多原文': { en: '80% — Keep more text', ja: '80% — 原文を多く保持' },
  '条数越少，token 消耗越低，长会话渲染更稳定。': {
    en: 'Fewer messages means fewer tokens and smoother long chats.',
    ja: '件数を減らすとトークン消費が下がり、長い会話も安定します。',
  },
  '将早期消息交由模型压缩为摘要，仅保留最近若干条，适用于长会话的上下文精简。': {
    en: 'Older messages are summarised by the model; only the most recent few are kept.',
    ja: '古いメッセージを要約し、直近の数件のみ保持します。',
  },
  '「仅本机」会话仅存储于当前设备。更换设备或清除数据后将无法恢复。': {
    en: 'Local conversations live only on this device and are lost if you switch devices or clear data.',
    ja: '「この端末のみ」の会話はこの端末にだけ保存され、機種変更やデータ削除で失われます。',
  },
  '10 秒冷却期内按钮保持禁用，用于防止误操作。': {
    en: 'The button stays disabled for 10 seconds to prevent accidental clicks.',
    ja: '誤操作防止のため10秒間ボタンは無効になります。',
  },
  '「打开文件夹」仅在桌面端可用。': {
    en: '“Open folder” is only available on desktop.',
    ja: '「フォルダーを開く」はデスクトップ版のみです。',
  },
  '模型的读取类工具（list_dir / read_file / search_in_files）可访问该目录下的文件。': {
    en: 'Read-only tools (list_dir / read_file / search_in_files) can access files here.',
    ja: '読み取り系ツール（list_dir / read_file / search_in_files）がこのフォルダーにアクセスできます。',
  },
  '读取不修改': { en: 'Read-only', ja: '読み取りのみ' },
  '留空则禁用文件读取能力。': { en: 'Leave empty to disable file reading.', ja: '空欄ならファイル読み取りは無効です。' },
  '允许模型写入工作目录内的文件。每次写入均需人工确认变更（diff）。': {
    en: 'Allow the model to write files in the workspace. Every write needs your diff confirmation.',
    ja: '作業ディレクトリ内のファイル書き込みを許可します。各書き込みは diff 確認が必要です。',
  },
  '允许模型在工作目录内执行命令。每次执行均需确认完整命令。': {
    en: 'Allow commands inside the workspace. Every command needs your confirmation.',
    ja: '作業ディレクトリ内でのコマンド実行を許可します。各実行は確認が必要です。',
  },
  '高危命令（format、del /f、shutdown 等）一律拒绝。': {
    en: 'High-risk commands (format, del /f, shutdown, etc.) are always blocked.',
    ja: '危険なコマンド（format、del /f、shutdown など）は常に拒否します。',
  },
  '经解析的 PDF / Office 文件保留在服务端账户中，可在此清理。': {
    en: 'Parsed PDF/Office files stay in your server account and can be cleaned up here.',
    ja: '解析済みの PDF / Office はサーバー側に保存され、ここで削除できます。',
  },
  '多端共用同一服务端，用户各自配置自己的 API Key。': {
    en: 'Multiple devices share one server; each user configures their own API key.',
    ja: '複数端末で1つのサーバーを共有し、各自が API キーを設定します。',
  },
  字号大小: { en: 'Font size', ja: '文字サイズ' },
  整体缩放: { en: 'Scale', ja: '拡大率' },
  小: { en: 'Small', ja: '小' },
  大: { en: 'Large', ja: '大' },
  特大: { en: 'Extra large', ja: '特大' },

  // 关于
  版本: { en: 'Version', ja: 'バージョン' },
  支持作者: { en: 'Support the author', ja: '作者を支援' },
  '自愿支持，不影响任何功能。': {
    en: 'Optional support; no features are affected.',
    ja: '任意の支援です。機能への影響はありません。',
  },
  关闭本窗口: { en: 'Close', ja: '閉じる' },

  // 侧栏 / 聊天
  建立一个新的对话: { en: 'New conversation', ja: '新しい会話' },
  搜索历史对话: { en: 'Search conversations', ja: '会話を検索' },
  '没有匹配的对话': { en: 'No matching conversations', ja: '一致する会話がありません' },
  还没有对话: { en: 'No conversations yet', ja: '会話がまだありません' },
  用户发言: { en: 'Your messages', ja: 'あなたの発言' },
  复制: { en: 'Copy', ja: 'コピー' },
  编辑: { en: 'Edit', ja: '編集' },
  继续: { en: 'Continue', ja: '続き' },
  重新生成: { en: 'Regenerate', ja: '再生成' },
  发送: { en: 'Send', ja: '送信' },
  取消: { en: 'Cancel', ja: 'キャンセル' },
  确定: { en: 'OK', ja: 'OK' },
  子智能体: { en: 'Sub-agent', ja: 'サブエージェント' },
  进行中: { en: 'Running', ja: '実行中' },
  轮数: { en: 'Turns', ja: 'ターン' },
  缓存命中: { en: 'Cache hit', ja: 'キャッシュ命中' },
  上下文: { en: 'Context', ja: 'コンテキスト' },
}

const SKIP_SELECTOR = '.md, .bubble, textarea, input, pre, code, .msg.tool, [data-no-i18n]'

let observer: MutationObserver | null = null
let currentLang: Lang = 'zh'
const originals = new WeakMap<Text, string>()

function translateTextNode(node: Text) {
  const raw = originals.get(node) ?? node.nodeValue ?? ''
  if (!originals.has(node)) originals.set(node, raw)
  const trimmed = raw.trim()
  if (!trimmed) return

  if (currentLang === 'zh') {
    if (node.nodeValue !== raw) node.nodeValue = raw
    return
  }

  let entry = TEXT[trimmed]

  // 兜底：形如「40% — 说明」「标签：说明」的文案，只替换后半段
  if (!entry) {
    const sep = trimmed.includes('—') ? '—' : trimmed.includes('：') ? '：' : ''
    if (sep) {
      const idx = trimmed.indexOf(sep)
      const tail = trimmed.slice(idx + 1).trim()
      const tailEntry = TEXT[tail]
      if (tailEntry) {
        const target = currentLang === 'en' ? tailEntry.en : tailEntry.ja
        const head = trimmed.slice(0, idx + 1)
        const next = raw.replace(trimmed, `${head} ${target}`)
        if (node.nodeValue !== next) node.nodeValue = next
        return
      }
    }
  }

  if (!entry) return

  const target = currentLang === 'en' ? entry.en : entry.ja
  const next = raw.replace(trimmed, target)
  if (node.nodeValue !== next) node.nodeValue = next
}

function walk(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  const nodes: Text[] = []
  let n = walker.nextNode()
  while (n) {
    nodes.push(n as Text)
    n = walker.nextNode()
  }
  for (const t of nodes) translateTextNode(t)
}

/** 应用/切换语言（幂等，可反复调用） */
export function applyDomLang(lang: Lang) {
  currentLang = lang
  walk(document.body)

  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (lang === 'zh') return

  observer = new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text)
        else if (node.nodeType === Node.ELEMENT_NODE) walk(node)
      })
      if (r.type === 'characterData' && r.target.nodeType === Node.TEXT_NODE) {
        translateTextNode(r.target as Text)
      }
    }
  })
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}
