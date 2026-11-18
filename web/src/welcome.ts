/**
 * 主界面欢迎语：每次启动 / 新建对话随机取一条。
 */
export const WELCOME_LINES = [
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
]

/** 随机取一条欢迎语 */
export function pickWelcome(): string {
  return WELCOME_LINES[Math.floor(Math.random() * WELCOME_LINES.length)]
}
