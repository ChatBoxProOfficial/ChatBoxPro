import { memo, useEffect, useMemo, useRef } from 'react'
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
  const ref = useRef<HTMLDivElement | null>(null)

  // 给每个代码块挂一个「复制」按钮
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.querySelectorAll('pre').forEach((pre) => {
      const node = pre as HTMLElement
      if (node.dataset.copyReady) return
      node.dataset.copyReady = '1'
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy'
      btn.textContent = '复制'
      btn.addEventListener('click', () => {
        const code = node.querySelector('code')?.textContent ?? node.textContent ?? ''
        void navigator.clipboard?.writeText(code).then(() => {
          btn.textContent = '已复制'
          setTimeout(() => (btn.textContent = '复制'), 1200)
        })
      })
      node.appendChild(btn)
    })
  }, [html])

  return <div className="md" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
})
