import { memo, useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

/**
 * Markdown 渲染只在消息「定稿」后执行一次（流式期间显示纯文本），
 * 避免每个 token 都重排整段 HTML —— 这是手机上最主要的一处卡顿源。
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(text, { async: false }) as string
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } })
  }, [text])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
})
