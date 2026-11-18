/**
 * 把 ChatScreen 的 send() 拆成 run()（只负责流式生成）+ send()（追加用户消息后再 run），
 * 以便实现「重新生成」「编辑后重发」。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const p = 'web/src/components/ChatScreen.tsx'
let s = readFileSync(p, 'utf8')

const start = s.indexOf('const send = useCallback(async () => {')
const end = s.indexOf('const stop = useCallback')
if (start < 0 || end < 0) throw new Error('找不到 send 块')

const block = `const run = useCallback(
    async (base: Message[]) => {
      if (busy) return
      setMessages(base)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), base.length))
      setAtBottom(true)
      setBusy(true)
      accRef.current = ''
      reasonRef.current = ''
      startAtRef.current = Date.now()
      firstContentAtRef.current = 0
      firstTokenAtRef.current = 0
      usageRef.current = undefined
      setStreamText('')
      setReasonText('')
      persist(base)

      const ctrl = new AbortController()
      abortRef.current = ctrl
      let failed = ''
      let citations: Array<{ url: string; title?: string }> = []
      let usedTools = false

      await streamChat(
        base,
        { ...settings, model: session.model || settings.model },
        {
          onDelta: (chunk, kind) => {
            if (!firstTokenAtRef.current) firstTokenAtRef.current = Date.now()
            if (kind === 'content') {
              if (!firstContentAtRef.current) firstContentAtRef.current = Date.now()
              accRef.current += chunk
            } else {
              reasonRef.current += chunk
            }
            scheduleFlush()
          },
          onDone: () => {},
          onError: (msg) => {
            failed = msg
          },
          onToolEvent: (evt) => {
            if (evt.type === 'call_started') setSearching(true)
            if (evt.type === 'call_completed') {
              setSearching(false)
              usedTools = true
            }
          },
          onUsage: (u) => {
            usageRef.current = u
          },
          onTitle: (t) => {
            const cur = sessionRef.current
            if (cur.title === '新对话' || !cur.title) {
              const next = { ...cur, title: t }
              sessionRef.current = next
              onPersist(next)
            }
          },
          onMeta: (meta) => {
            if (meta.citations?.length) citations = meta.citations
            if (meta.usedTools) usedTools = true
          },
        },
        ctrl.signal,
      )

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      const acc = accRef.current
      const reasons = reasonRef.current
      const startedAt = startAtRef.current
      const firstContentAt = firstContentAtRef.current
      const reasoningMs = reasons
        ? (firstContentAt || Date.now()) - (startedAt || Date.now())
        : 0
      accRef.current = ''
      reasonRef.current = ''
      setStreamText('')
      setReasonText('')
      setBusy(false)
      setSearching(false)
      abortRef.current = null

      const assistant: Message = failed
        ? {
            id: newId(),
            role: 'assistant',
            content: failed,
            createdAt: Date.now(),
            error: true,
          }
        : {
            id: newId(),
            role: 'assistant',
            content: acc,
            createdAt: Date.now(),
            model: session.model,
            reasoning: reasons || undefined,
            reasoningMs: reasons ? reasoningMs : undefined,
            citations: citations.length ? citations : undefined,
            usedTools: usedTools || undefined,
            usage: usageRef.current,
            meta: {
              startedAt: startedAt || undefined,
              firstTokenAt: firstTokenAtRef.current || undefined,
              endedAt: Date.now(),
            },
          }

      const withReply = [...base, assistant]
      setMessages(withReply)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), withReply.length))
      setAtBottom(true)
      persist(withReply)
    },
    [busy, settings, session.model, persist, scheduleFlush, onPersist],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if ((!text && attachments.length === 0) || busy) return

    const ready = attachments.filter((a) => !a.uploading && !a.error)
    const fileBlocks = ready
      .filter((a) => a.text)
      .map((a) => \`\\n\\n[附件：\${a.name}]\\n<<<\\n\${a.text}\\n>>>\`)
      .join('')

    const attachmentNote =
      ready.length > 0
        ? \`\\n\\n[附件]\\n\${ready
            .map(
              (a) =>
                \`- \${a.name}\${a.stored ? \`（inbox: \${a.stored}）\` : ''}\${
                  a.text ? '（内容已附在下方）' : ''
                }\`,
            )
            .join('\\n')}\` + fileBlocks
        : ''

    const userMsg: Message = {
      id: newId(),
      role: 'user',
      content: text + attachmentNote,
      createdAt: Date.now(),
      attachments: ready.length ? ready : undefined,
    }

    setInput('')
    setAttachments([])
    await run([...messages, userMsg])
  }, [input, attachments, busy, messages, run])

  /** 重新生成最后一条回复 */
  const regenerate = useCallback(async () => {
    if (busy) return
    const base = [...messages]
    while (base.length && base[base.length - 1].role === 'assistant') base.pop()
    if (!base.length) return
    await run(base)
  }, [busy, messages, run])

  /** 编辑某条用户消息：截断它和之后的内容，把原文放回输入框 */
  const editFrom = useCallback(
    (index: number) => {
      if (busy) return
      const target = messages[index]
      if (!target || target.role !== 'user') return
      const base = messages.slice(0, index)
      setInput(target.content.split('\\n\\n[附件]')[0])
      setMessages(base)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), Math.max(base.length, 1)))
      persist(base)
    },
    [busy, messages, persist],
  )

  `

s = s.slice(0, start) + block + s.slice(end)
writeFileSync(p, s, 'utf8')
console.log('send/run 已拆分:', s.includes('const run = useCallback'), s.includes('const regenerate'))
