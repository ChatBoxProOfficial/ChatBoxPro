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
  '关于模型': { en: 'About models', ja: 'モデルについて' },
  '模型信息与官方教程': { en: 'Model info and official guides', ja: 'モデル情報と公式ガイド' },
  '模型的能力、价格与最新变化都以官方文档为准。下面这些入口会跳转到浏览器打开。': {
    en: 'Capabilities, pricing and changes follow the official docs. These links open in your browser.',
    ja: '能力・料金・最新情報は公式ドキュメントが基準です。以下のリンクはブラウザで開きます。',
  },
  '前往 DeepSeek 开放平台': { en: 'Open DeepSeek platform', ja: 'DeepSeek プラットフォームへ' },
  'DeepSeek 开放平台': { en: 'DeepSeek platform', ja: 'DeepSeek プラットフォーム' },
  '充值、用量、API Key 管理': { en: 'Top up, usage and API keys', ja: 'チャージ・使用量・APIキー管理' },
  '模型与价格': { en: 'Models and pricing', ja: 'モデルと料金' },
  '各模型能力、上下文长度、计费标准': { en: 'Capabilities, context length, billing', ja: '能力・コンテキスト長・課金' },
  '快速开始': { en: 'Quick start', ja: 'クイックスタート' },
  '第一次调用 API 的最短路径': { en: 'Shortest path to your first API call', ja: '最初の API 呼び出しまで' },
  '思考模式指南': { en: 'Reasoning mode guide', ja: '思考モードのガイド' },
  '如何控制模型的思考强度': { en: 'How to control reasoning effort', ja: '思考の強さの制御方法' },
  '工具调用与联网': { en: 'Tools and web access', ja: 'ツールとウェブ連携' },
  '搜索、读链接、函数调用的用法': { en: 'Search, link reading, function calling', ja: '検索・リンク読み込み・関数呼び出し' },
  更新日志: { en: 'Changelog', ja: '更新履歴' },
  '官方最近发布了什么新能力': { en: 'What the official platform shipped recently', ja: '公式の最新リリース情報' },
  文档: { en: 'Documents', ja: 'ドキュメント' },
  用户协议: { en: 'User agreement', ja: 'ユーザー契約' },
  '你与作者之间的约定：许可、义务与责任划分': {
    en: 'License, obligations and liability between you and the author',
    ja: 'あなたと作者の間の約束：許諾・義務・責任',
  },
  服务条款: { en: 'Terms of service', ja: 'サービス条項' },
  '软件以什么方式提供、可用性与终止': {
    en: 'How the software is provided, availability and termination',
    ja: '提供方法・可用性・終了について',
  },
  第三方开源许可: { en: 'Third-party licenses', ja: 'サードパーティライセンス' },
  '本软件使用的开源组件及其许可证': {
    en: 'Open-source components and their licenses',
    ja: '使用しているオープンソースとライセンス',
  },
  '说明数据怎么处理、软件是什么、使用时的约定。': {
    en: 'How data is handled, what this app is, and the rules of use.',
    ja: 'データの扱い・このアプリの内容・利用上の約束。',
  },
  '用户信息收集文档': { en: 'User data collection', ja: 'ユーザー情報の収集' },
  '本机会收集哪些信息、存在哪里、传给谁': {
    en: 'What is collected, where it is stored, who receives it',
    ja: '何を集め、どこに保存し、誰に送るか',
  },
  '隐私收集文档': { en: 'Privacy notice', ja: 'プライバシーについて' },
  '数据处理方式、留存期限与你的控制权': {
    en: 'Processing, retention and your control',
    ja: '処理方法・保存期間・あなたの権限',
  },
  '关于此软件': { en: 'About this software', ja: 'このソフトウェアについて' },
  '它是什么、由什么构成、能力边界在哪': {
    en: 'What it is, what it is built with, where its limits are',
    ja: '何か・何で作られているか・限界はどこか',
  },
  '使用须知': { en: 'Terms of use', ja: '利用にあたって' },
  '使用前请确认这些约定与风险': {
    en: 'Please review these terms and risks before use',
    ja: '利用前に約束とリスクをご確認ください',
  },
  '更新于 2026-11-18 · 文档以中文为准': {
    en: 'Updated 2026-11-18 · Chinese version is authoritative',
    ja: '2026-11-18 更新 · 中国語版が正本です',
  },
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

  // ---------- 聊天界面 ----------
  '正在搜索…': { en: 'Searching…', ja: '検索中…' },
  '↓ 回到最新': { en: '↓ Back to latest', ja: '↓ 最新へ' },
  '更早对话的摘要': { en: 'Summary of earlier conversation', ja: '以前の会話の要約' },
  参考来源: { en: 'Sources', ja: '参考元' },
  '（子智能体没有输出）': { en: '(sub-agent returned nothing)', ja: '（サブエージェントの出力なし）' },
  '（子智能体达到步数上限 6）': {
    en: '(sub-agent reached the 6-step limit)',
    ja: '（サブエージェントが6ステップ上限に達しました）',
  },
  新对话: { en: 'New chat', ja: '新しい会話' },
  图片读取失败: { en: 'Failed to read image', ja: '画像を読み込めません' },
  '子智能体未开启（模型面板 → 子智能体团队协作）': {
    en: 'Sub-agents are off (model panel → sub-agent collaboration)',
    ja: 'サブエージェントは無効です（モデルパネル → サブエージェント連携）',
  },
  缺少子任务描述: { en: 'Missing subtask description', ja: 'サブタスクの説明がありません' },
  '执行命令权限未开启（设置 → 保存路径 → 允许执行命令）': {
    en: 'Command execution is off (Settings → File & Paths → Allow commands)',
    ja: 'コマンド実行は無効です（設定 → ファイルとパス → コマンド実行を許可）',
  },
  缺少命令: { en: 'Missing command', ja: 'コマンドがありません' },
  用户拒绝了这次命令执行: { en: 'You declined this command', ja: 'このコマンドは拒否されました' },
  '写文件权限未开启（设置 → 保存路径 → 允许写文件）': {
    en: 'File writes are off (Settings → File & Paths → Allow file writes)',
    ja: 'ファイル書き込みは無効です（設定 → ファイルとパス → ファイル書き込みを許可）',
  },
  缺少文件路径: { en: 'Missing file path', ja: 'ファイルパスがありません' },
  '用户拒绝了这次写入，文件未改动': {
    en: 'You declined this write; the file is unchanged',
    ja: 'この書き込みは拒否されました。ファイルは変更されていません。',
  },
  '（内容已附在下方）': { en: ' (content included below)', ja: '（内容は下に添付）' },
  展开: { en: 'Expand', ja: '展開' },
  收起: { en: 'Collapse', ja: '折りたたむ' },
  当前模型: { en: 'Current model', ja: '現在のモデル' },
  子智能体团队协作: { en: 'Sub-agent collaboration', ja: 'サブエージェント連携' },
  允许主模型派生只读子智能体处理子任务: {
    en: 'Let the main model spawn read-only sub-agents for subtasks',
    ja: 'メインモデルが読み取り専用サブエージェントにサブタスクを任せられます',
  },
  联网搜索: { en: 'Web search', ja: 'ウェブ検索' },
  '需要最新信息时自动搜索并标注来源（仅 deepseek-flash）': {
    en: 'Search automatically and cite sources when fresh info is needed (deepseek-flash only)',
    ja: '最新情報が必要なとき自動検索し出典を表示（deepseek-flash のみ）',
  },
  内容安全: { en: 'Content safety', ja: 'コンテンツ安全' },
  '开启官方风控，命中风险内容时拒答': {
    en: 'Enable official risk control; risky content is refused',
    ja: '公式のリスク制御を有効化。危険な内容は拒否されます。',
  },
  本地工具: { en: 'Local tools', ja: 'ローカルツール' },
  '允许模型调用时间、计算、搜索、抓网页（本机执行）': {
    en: 'Let the model use time, math, search and page fetching (run locally)',
    ja: 'モデルが時刻・計算・検索・ページ取得を利用できます（端末上で実行）',
  },
  '上传中…': { en: 'Uploading…', ja: 'アップロード中…' },
  失败: { en: 'Failed', ja: '失敗' },
  '搜索中…': { en: 'Searching…', ja: '検索中…' },
  '（标题匹配）': { en: '(title match)', ja: '（タイトル一致）' },
  删除对话: { en: 'Delete conversation', ja: '会話を削除' },

  // 统计
  会话统计: { en: 'Conversation stats', ja: '会話の統計' },
  对话轮数: { en: 'Turns', ja: 'ターン数' },
  执行步数: { en: 'Steps', ja: 'ステップ数' },
  累计用时: { en: 'Total time', ja: '合計時間' },
  平均每步: { en: 'Average per step', ja: '1ステップ平均' },
  首字延迟: { en: 'First token', ja: '初回トークン' },
  缓存命中率: { en: 'Cache hit rate', ja: 'キャッシュ命中率' },
  上下文占用: { en: 'Context usage', ja: 'コンテキスト使用率' },
  估算费用: { en: 'Estimated cost', ja: '推定コスト' },
  'Token 用量': { en: 'Token usage', ja: 'トークン使用量' },
  '输入（未命中缓存）': { en: 'Input (cache miss)', ja: '入力（キャッシュ未命中）' },
  输出: { en: 'Output', ja: '出力' },
  其中思考: { en: 'of which reasoning', ja: 'うち思考' },
  合计: { en: 'Total', ja: '合計' },
  '这个会话还没有拿到用量数据（旧消息不计）。': {
    en: 'No usage data for this conversation yet (old messages excluded).',
    ja: 'この会話の使用量データはまだありません（古いメッセージは対象外）。',
  },
  '按最近一次请求的输入 token 计算；模型上下文上限 1M。': {
    en: 'Based on the latest request input tokens; model context limit is 1M.',
    ja: '直近リクエストの入力トークンで計算。モデルの上限は 1M。',
  },
  高峰: { en: 'Peak', ja: 'ピーク' },
  闲时: { en: 'Off-peak', ja: 'オフピーク' },

  // 子智能体面板
  '还没有派出子智能体。': { en: 'No sub-agents spawned yet.', ja: 'サブエージェントはまだ起動していません。' },
  主模型交给它的任务: { en: 'Task given by the main model', ja: 'メインモデルからのタスク' },
  它的思考: { en: 'Its reasoning', ja: 'その思考' },
  它调用的工具: { en: 'Tools it called', ja: '呼び出したツール' },
  它的输出: { en: 'Its output', ja: 'その出力' },
  已完成: { en: 'Done', ja: '完了' },
  出错: { en: 'Error', ja: 'エラー' },
  行: { en: 'lines', ja: '行' },

  // 审批
  允许写入: { en: 'Allow write', ja: '書き込みを許可' },
  新建文件: { en: 'New file', ja: '新規ファイル' },
  修改文件: { en: 'Modify file', ja: 'ファイルを変更' },
  执行命令: { en: 'Run command', ja: 'コマンド実行' },
  '这条命令会在你的电脑上真实执行。请确认它不会删除文件、修改系统设置或访问敏感数据。': {
    en: 'This command runs on your computer. Make sure it does not delete files, change system settings or access sensitive data.',
    ja: 'このコマンドは実際に端末上で実行されます。ファイル削除・システム設定変更・機密データへのアクセスがないか確認してください。',
  },
  运行: { en: 'Run', ja: '実行' },
  '（未设置）': { en: '(not set)', ja: '（未設定）' },
  关闭窗口: { en: 'Close', ja: '閉じる' },

  // 滑块徽标 / 思考
  浮想: { en: 'Light', ja: 'ひらめき' },
  沉思: { en: 'Deep', ja: '熟考' },
  '最大 token 消耗': { en: 'Max token use', ja: '最大トークン消費' },
  正在思考: { en: 'Thinking…', ja: '思考中…' },
  思考过程: { en: 'Reasoning', ja: '思考プロセス' },
  思考中: { en: 'Thinking…', ja: '思考中…' },
  已深度思考: { en: 'Reasoned deeply', ja: '深く思考しました' },

  '有什么可以帮你的？': { en: 'How can I help you?', ja: '何をお手伝いしましょうか？' },
  '输入一句话开始': { en: 'Type a message to begin', ja: 'メッセージを入力して開始' },
  '开启后请求思维链（reasoning_content）。关闭时同时禁用模型思考模式，降低 token 消耗。': {
    en: 'Requests reasoning_content when enabled. Disabling also turns off model thinking to reduce tokens.',
    ja: '有効にすると reasoning_content を要求します。無効にすると思考モードも停止し、トークンを節約します。',
  },
  '折叠条目显示「已深度思考（用时 X 秒）」；思考时自动展开，正文生成后收起，可随时展开查看。': {
    en: 'Shows a collapsed “Reasoned deeply (Xs)” row; expands while thinking, collapses once the answer starts.',
    ja: '「深く思考しました（X秒）」の折りたたみ行を表示。思考中は自動展開し、本文が出ると折りたたみます。',
  },
  '紧凑的「思考过程」折叠块，默认收起，附耗时标记。': {
    en: 'Compact “Reasoning” block, collapsed by default, with elapsed time.',
    ja: 'コンパクトな「思考プロセス」ブロック。既定では折りたたみ、所要時間を表示。',
  },
  '运行 DSH 服务的主机地址，例如 http://192.168.1.48:3081': {
    en: 'Host running DSH, e.g. http://192.168.1.48:3081',
    ja: 'DSH を動かしているホスト。例：http://192.168.1.48:3081',
  },
  '· 复用 DSH 的会话与文件能力': { en: '· Reuse DSH sessions and file access', ja: '· DSH の会話とファイル機能を再利用' },
  '· 移动端上传的文件可直接进入 DSH 工作区': {
    en: '· Files uploaded on mobile go straight into the DSH workspace',
    ja: '· モバイルでアップロードしたファイルを DSH ワークスペースへ',
  },
  '· 在移动端查看 DSH 执行代码的实时过程': {
    en: '· Watch DSH run code in real time on mobile',
    ja: '· モバイルで DSH のコード実行をリアルタイム表示',
  },
  '深度对接（会话同步、文件写入工作区）仍在开发中。': {
    en: 'Deeper integration (session sync, writing files into the workspace) is still in development.',
    ja: '深い連携（会話同期・ワークスペースへのファイル書き込み）は開発中です。',
  },
  '附件与导出文件均存放于以下目录。': {
    en: 'Attachments and exports are stored in the folder below.',
    ja: '添付ファイルとエクスポートは次のフォルダーに保存されます。',
  },
  '（浏览器环境不可用）': { en: ' (unavailable in browser)', ja: '（ブラウザでは利用不可）' },
  '。留空则禁用文件读取能力。': { en: '. Leave empty to disable file reading.', ja: '。空欄ならファイル読み取りは無効です。' },
  '允许模型在工作目录内执行命令。每次执行均需确认完整命令。': {
    en: 'Allow commands inside the workspace. Every command needs your confirmation.',
    ja: '作業ディレクトリ内でのコマンド実行を許可します。各実行は確認が必要です。',
  },
  '高危命令（format、del /f、shutdown 等）一律拒绝。': {
    en: 'High-risk commands (format, del /f, shutdown, etc.) are always blocked.',
    ja: '危険なコマンド（format、del /f、shutdown など）は常に拒否します。',
  },
}

/** 带变量的句子：按模式翻译 */
const PATTERNS: Array<{
  re: RegExp
  en: (m: RegExpMatchArray) => string
  ja: (m: RegExpMatchArray) => string
}> = [
  {
    re: /^已深度思考（用时 (.+) 秒）$/,
    en: (m) => `Reasoned deeply (${m[1]}s)`,
    ja: (m) => `深く思考しました（${m[1]}秒）`,
  },
  {
    re: /^(\d+) 条 · (.+)$/,
    en: (m) => `${m[1]} messages · ${m[2]}`,
    ja: (m) => `${m[1]} 件 · ${m[2]}`,
  },
  {
    re: /^(\d+) 条$/,
    en: (m) => `${m[1]} messages`,
    ja: (m) => `${m[1]} 件`,
  },
  {
    re: /^条 · (.+)$/,
    en: (m) => `messages · ${m[1]}`,
    ja: (m) => `件 · ${m[1]}`,
  },
  {
    re: /^条$/,
    en: () => 'messages',
    ja: () => '件',
  },
  {
    re: /^缓存 (.+)$/,
    en: (m) => `cache ${m[1]}`,
    ja: (m) => `キャッシュ ${m[1]}`,
  },
  {
    re: /^(\d+) 步$/,
    en: (m) => `${m[1]} steps`,
    ja: (m) => `${m[1]} ステップ`,
  },
  {
    re: /^完成：(\d+) 条 → (\d+) 条$/,
    en: (m) => `Done: ${m[1]} → ${m[2]} messages`,
    ja: (m) => `完了：${m[1]} 件 → ${m[2]} 件`,
  },
  {
    re: /^失败：(.+)$/,
    en: (m) => `Failed: ${m[1]}`,
    ja: (m) => `失敗：${m[1]}`,
  },
  {
    re: /^安全冷却：请等待 (\d+) 秒$/,
    en: (m) => `Cooling down: wait ${m[1]}s`,
    ja: (m) => `クールダウン：${m[1]}秒お待ちください`,
  },
  {
    re: /^(.+) 秒冷却期内按钮保持禁用，用于防止误操作。$/,
    en: (m) => `The button stays disabled for ${m[1]} seconds to prevent accidental clicks.`,
    ja: (m) => `誤操作防止のため${m[1]}秒間ボタンは無効です。`,
  },
  {
    re: /^删除「(.+)」？已引用它的历史对话将读不到内容。$/,
    en: (m) => `Delete “${m[1]}”? Conversations referencing it will lose the content.`,
    ja: (m) => `「${m[1]}」を削除しますか？参照している会話は内容を読めなくなります。`,
  },
  {
    re: /^「(.+)」将被永久删除，无法恢复。$/,
    en: (m) => `“${m[1]}” will be permanently deleted.`,
    ja: (m) => `「${m[1]}」は完全に削除されます。`,
  },
  {
    re: /^允许模型在工作目录内执行命令。每次执行均需确认完整命令。\s*高危命令（format、del \/f、shutdown 等）一律拒绝。$/,
    en: () =>
      'Allow commands inside the workspace. Every command needs your confirmation. High-risk commands (format, del /f, shutdown, etc.) are always blocked.',
    ja: () =>
      '作業ディレクトリ内でのコマンド実行を許可します。各実行は確認が必要です。危険なコマンド（format、del /f、shutdown など）は常に拒否します。',
  },
  {
    re: /^版本 (.+) · 本机模式 · 会话数据不离开设备$/,
    en: (m) => `Version ${m[1]} · Local mode · data stays on this device`,
    ja: (m) => `バージョン ${m[1]} · ローカルモード · データは端末内に保持`,
  },
  {
    re: /^(.+)（(\d+) 条）$/,
    en: (m) => `${m[1]} (${m[2]} messages)`,
    ja: (m) => `${m[1]}（${m[2]} 件）`,
  },
]

/** 反查表：把已翻译的英/日文本还原成中文原文 */
const REVERSE: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const [zh, e] of Object.entries(TEXT)) {
    if (!map[e.en]) map[e.en] = zh
    if (!map[e.ja]) map[e.ja] = zh
  }
  return map
})()

/** 把当前文本还原成中文原文（可能是中文本身、英文或日文） */
function toChinese(text: string): string | undefined {
  const t = text.trim()
  if (!t) return undefined
  if (TEXT[t]) return t
  if (REVERSE[t]) return REVERSE[t]
  return undefined
}

const ATTRS = ['placeholder', 'title', 'aria-label']
const attrOriginals = new WeakMap<Element, Record<string, string>>()

function translateAttrs(root: ParentNode) {
  const els = root.querySelectorAll('[placeholder], [title], [aria-label]')
  els.forEach((el) => {
    if (el.closest(SKIP_SELECTOR)) return
    let store = attrOriginals.get(el)
    if (!store) {
      store = {}
      for (const a of ATTRS) {
        const v = el.getAttribute(a)
        if (v) store[a] = v
      }
      attrOriginals.set(el, store)
    }
    for (const a of ATTRS) {
      const original = store[a]
      if (!original) continue
      if (currentLang === 'zh') {
        if (el.getAttribute(a) !== original) el.setAttribute(a, original)
        continue
      }
      const entry = TEXT[original.trim()]
      const target = entry ? (currentLang === 'en' ? entry.en : entry.ja) : original
      if (el.getAttribute(a) !== target) el.setAttribute(a, target)
    }
  })
}

const SKIP_SELECTOR = '.md, .bubble, textarea, input, pre, code, .msg.tool, [data-no-i18n]'

let observer: MutationObserver | null = null
let currentLang: Lang = 'zh'
const originals = new WeakMap<Text, string>()

function translateTextNode(node: Text) {
  const cur = node.nodeValue ?? ''
  // 反查优先：即使节点是在英文/日文状态下新建的，也能定位回中文原文
  const zh = toChinese(cur)
  let raw = zh ?? originals.get(node) ?? cur
  if (zh) originals.set(node, zh)
  else if (!originals.has(node)) originals.set(node, cur)
  else if (/[\u4e00-\u9fa5]/.test(cur) && cur.trim() !== raw.trim()) {
    originals.set(node, cur)
    raw = cur
  }
  const trimmed = raw.trim()
  if (!trimmed) return

  if (currentLang === 'zh') {
    if (node.nodeValue !== raw) node.nodeValue = raw
    return
  }

  for (const pat of PATTERNS) {
    const m = trimmed.match(pat.re)
    if (m) {
      const target = currentLang === 'en' ? pat.en(m) : pat.ja(m)
      const next = raw.replace(trimmed, target)
      if (node.nodeValue !== next) node.nodeValue = next
      return
    }
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
  translateAttrs(root as ParentNode)
}

/** 把所有节点还原成原始中文 */
function restoreAll() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n = walker.nextNode()
  while (n) {
    nodes.push(n as Text)
    n = walker.nextNode()
  }
  for (const t of nodes) {
    const cur = t.nodeValue ?? ''
    const orig = toChinese(cur) ?? originals.get(t)
    if (orig !== undefined && cur !== orig) t.nodeValue = orig
  }
  // 属性还原
  document.querySelectorAll('[placeholder], [title], [aria-label]').forEach((el) => {
    const store = attrOriginals.get(el)
    if (!store) return
    for (const a of ATTRS) {
      const v = store[a]
      if (v && el.getAttribute(a) !== v) el.setAttribute(a, v)
    }
  })
}

/** 应用/切换语言（幂等，可反复调用） */
export function applyDomLang(lang: Lang) {
  currentLang = lang
  restoreAll()
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
