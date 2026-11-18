import { readFileSync, writeFileSync } from 'node:fs'

const p = 'web/src/components/ChatScreen.tsx'
let s = readFileSync(p, 'utf8')

const start = s.indexOf('const run = useCallback(')
const end = s.indexOf('const send = useCallback(')
if (start < 0 || end < 0) throw new Error('找不到 run 块')

const block = `const run = useCallback(
    async (base: Message[]) => {
      if (busy) return

      let working = [...base]
      setMessages(working)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), working.length))
      setAtBottom(true)
      setBusy(true)

      const once = async (msgs: Message[]) => {
        accRef.current = ''
        reasonRef.current = ''
        startAtRef.current = Date.now()
        firstContentAtRef.current = 0
        firstTokenAtRef.current = 0
        usageRef.current = undefined
        setStreamText('')
        setReasonText('')

        const ctrl = new AbortController()
        abortRef.current = ctrl
        let failed = ''
        let citations: Array<{ url: string; title?: string }> = []
        let usedTools = false
        let toolCalls: Array<{ id: string; name: string; arguments: string }> = []

        await streamChat(
          msgs,
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
            onToolCalls: (calls) => {
              toolCalls = calls
              usedTools = true
            },
            onUsage: (u) => {
              usageRef.current = u
            },
            onTitle: (t) => {
              const cur = sessionRef.current
              const firstUser = cur.messages.find((m) => m.role === 'user')
              const derived = firstUser
                ? firstUser.content.split('\\n\\n[附件]')[0].trim().slice(0, 24)
                : ''
              if (!cur.title || cur.title === '新对话' || cur.title === derived) {
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

        return {
          acc: accRef.current,
          reasons: reasonRef.current,
          failed,
          citations,
          usedTools,
          toolCalls,
          startedAt: startAtRef.current,
          firstTokenAt: firstTokenAtRef.current,
          usage: usageRef.current,
        }
      }

      const finish = (
        msgs: Message[],
        res: Awaited<ReturnType<typeof once>>,
      ) => {
        const reasoningMs = res.reasons
          ? (res.firstContentAtAt || Date.now()) - (res.startedAt || Date.now())
          : 0
        const assistant: Message = res.failed
          ? {
              id: newId(),
              role: 'assistant',
              content: res.failed,
              createdAt: Date.now(),
              error: true,
            }
          : {
              id: newId(),
              role: 'assistant',
              content: res.acc,
              createdAt: Date.now(),
              model: session.model,
              reasoning: res.reasons || undefined,
              reasoningMs: res.reasons ? reasoningMs : undefined,
              citations: res.citations.length ? res.citations : undefined,
              usedTools: res.usedTools || undefined,
              usage: res.usage,
              meta: {
                startedAt: res.startedAt || undefined,
                firstTokenAt: res.firstTokenAt || undefined,
                endedAt: Date.now(),
              },
            }
        const withReply = [...msgs, assistant]
        setMessages(withReply)
        setVisibleCount((c) => Math.min(Math.max(c + 1, 1), withReply.length))
        setAtBottom(true)
        persist(withReply)
      }

      try {
        for (let round = 0; round < 4; round++) {
          const res = await once(working)

          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
          }
          setStreamText('')
          setReasonText('')
          setSearching(false)
          abortRef.current = null

          const calls = res.toolCalls
          if (res.failed || !calls.length) {
            finish(working, res)
            return
          }

          // 模型要调工具：先落一条 assistant(tool_calls)，再逐条执行并回填
          const assistantMsg: Message = {
            id: newId(),
            role: 'assistant',
            content: res.acc,
            createdAt: Date.now(),
            toolCalls: calls,
          }
          const toolMsgs: Message[] = []
          for (const call of calls) {
            const output = await executeTool(call.name, call.arguments, settings.baseUrl)
            toolMsgs.push({
              id: newId(),
              role: 'tool',
              content: output,
              createdAt: Date.now(),
              toolCallId: call.id,
              toolName: call.name,
            })
          }
          working = [...working, assistantMsg, ...toolMsgs]
          setMessages(working)
          persist(working)
        }
      } finally {
        setBusy(false)
        setSearching(false)
        setStreamText('')
        setReasonText('')
      }
    },
    [busy, settings, session.model, persist, scheduleFlush, onPersist],
  )

  `

s = s.slice(0, start) + block + s.slice(end)
writeFileSync(p, s, 'utf8')
console.log('run 已改为支持工具循环:', s.includes('executeTool'), s.includes('round < 4'))
