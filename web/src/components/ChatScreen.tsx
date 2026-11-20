import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { streamChat, uploadDocument, uploadFile } from '../api'
import { imageToDataUrl } from '../image'
import { executeTool, readWorkspaceFile, SUBAGENT_TOOLS } from '../tools'
import { pickWelcome } from '../welcome'
import { isNativeApp } from '../native'
import { ANDROID_BUILD } from '../version'
import { WELCOME, useLang, useT } from '../i18n'
import WriteApproval from './WriteApproval'
import CommandApproval from './CommandApproval'
import SubAgentPanel, { type SubRun } from './SubAgentPanel'
import { Markdown } from './Markdown'
import Composer from './Composer'
import StreamBubble from './StreamBubble'
import Reasoning from './Reasoning'
import StatsModal from './StatsModal'
import type { Attachment, Message, Session, Settings } from '../types'
import { newId } from '../types'

interface Props {
  /** 自动压缩：返回压缩后的会话 */
  onAutoCompress?: (id: string, keep?: number) => Promise<{ session: Session }>

  session: Session
  settings: Settings
  onPersist: (s: Session) => void
  onOpenSidebar: () => void
  onExport: (s: Session) => void
  onSettingsChange: (p: Partial<Settings>) => void
}

const INITIAL_WINDOW = 30
const SUB_MAX_STEPS = 6

/** 子智能体：独立上下文的只读小循环 */
async function runSubagent(
  task: string,
  buf: { reasoning: string; content: string; steps: SubRun['steps'] },
  settings: Settings,
): Promise<string> {
  let msgs: Message[] = [
    { id: `sub-${Date.now()}`, role: 'user', content: task, createdAt: Date.now() },
  ]

  for (let step = 0; step < SUB_MAX_STEPS; step++) {
    let calls: Array<{ id: string; name: string; arguments: string }> = []
    let failed = ''

    await streamChat(
      msgs,
      { ...settings, toolsEnabled: true, teamMode: false, webSearch: false },
      {
        onDelta: (chunk, kind) => {
          if (kind === 'content') buf.content += chunk
          else buf.reasoning += chunk
        },
        onDone: () => {},
        onError: (m) => {
          failed = m
        },
        onToolCalls: (c) => {
          calls = c
        },
      },
    )

    if (failed) throw new Error(failed)
    if (!calls.length) return buf.content.trim() || '（子智能体没有输出）'

    const assistantMsg: Message = {
      id: `sub-a-${step}`,
      role: 'assistant',
      content: buf.content,
      createdAt: Date.now(),
      toolCalls: calls,
    }
    const toolMsgs: Message[] = []

    for (const c of calls) {
      const out = SUBAGENT_TOOLS.has(c.name)
        ? await executeTool(c.name, c.arguments, settings.baseUrl, settings.workspaceDir)
        : `子智能体不允许使用工具：${c.name}`
      buf.steps.push({ name: c.name, args: c.arguments.slice(0, 120), result: out.slice(0, 200) })
      toolMsgs.push({
        id: `sub-t-${step}-${c.id}`,
        role: 'tool',
        content: out,
        createdAt: Date.now(),
        toolCallId: c.id,
        toolName: c.name,
      })
    }

    buf.content = ''
    msgs = [...msgs, assistantMsg, ...toolMsgs]
  }

  return buf.content.trim() || '（子智能体达到步数上限 6）'
}

export default function ChatScreen({
  session,
  settings,
  onPersist,
  onOpenSidebar,
  onExport,
  onSettingsChange,
  onAutoCompress,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(session.messages)
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(INITIAL_WINDOW, Math.max(session.messages.length, 1)),
  )
  const [input, setInput] = useState('')
  const [seedNonce, setSeedNonce] = useState(0)
  const typedRef = useRef('')

  /** 往输入框注入文本（点提示词、编辑重发） */
  const seedInput = useCallback((v: string) => {
    setInput(v)
    setSeedNonce((n) => n + 1)
  }, [])

  /** 清空输入框（发送后） */
  const clearInput = useCallback(() => {
    typedRef.current = ''
    clearInput()
    setSeedNonce((n) => n + 1)
  }, [])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [busy, setBusy] = useState(false)
  const [hasStream, setHasStream] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])


  const [atBottom, setAtBottom] = useState(true)
  const [searching, setSearching] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [approval, setApproval] = useState<{
    path: string
    before: string
    after: string
  } | null>(null)
  const approvalResolve = useRef<((ok: boolean) => void) | null>(null)
  const [cmdApproval, setCmdApproval] = useState<string | null>(null)
  const [subRuns, setSubRuns] = useState<SubRun[]>([])
  const lang = useLang()
  const t = useT()
  // 欢迎语跟随语言实时切换（每次切换重新随机一条）
  const welcome = useMemo(() => {
    const arr = WELCOME[lang] ?? WELCOME.zh
    return arr[Math.floor(Math.random() * arr.length)] || pickWelcome()
  }, [lang])
  const [userBarOpen, setUserBarOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const cmdResolve = useRef<((ok: boolean) => void) | null>(null)

  const accRef = useRef('')
  const reasonRef = useRef('')
  const rafRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const startAtRef = useRef(0)
  const firstContentAtRef = useRef(0)
  const firstTokenAtRef = useRef(0)
  const usageRef = useRef<Message['usage']>(undefined)
  const listRef = useRef<HTMLDivElement | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const isEmpty = messages.length === 0

  const persist = useCallback(
    (msgs: Message[], extra?: Partial<Session>) => {
      const base = sessionRef.current
      const firstUser = msgs.find((m) => m.role === 'user' && m.content.trim())
      // 标题只用正文，不要把自动追加的附件清单也算进去
      const titleSource = firstUser ? firstUser.content.split('\n\n[附件]')[0].trim() : ''
      const title =
        base.title && base.title !== '新对话'
          ? base.title
          : titleSource
            ? titleSource.slice(0, 24)
            : '新对话'
      const next: Session = {
        ...base,
        ...extra,
        title,
        messages: msgs,
        updatedAt: Date.now(),
      }
      sessionRef.current = next
      onPersist(next)
    },
    [onPersist],
  )

const deleteSelected = useCallback(() => {
    const ids = selectedIds
    if (!ids.size) return
    const kept = messages.filter((m) => !ids.has(m.id))
    persist(kept)
    setSelectedIds(new Set())
    setSelectMode(false)
    setVisibleCount(Math.min(INITIAL_WINDOW, Math.max(kept.length, 1)))
  }, [selectedIds, messages, persist])

  /** 流式增量按帧合批，避免每 token 一次 React 渲染 */
  /** 兼容旧调用：流式内容只在子组件里刷新，这里只标记“有内容” */
  const scheduleFlush = useCallback(() => {
    setHasStream(true)
  }, [])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  // 流式 Markdown 的刷新已下沉到 StreamBubble 组件内部

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // 只有用户贴着底部时才跟随新内容；用户往上翻时绝不抢屏
  const pinnedRef = useRef(true)
  useLayoutEffect(() => {
    if (pinnedRef.current) scrollToBottom(false)
  }, [messages.length, scrollToBottom])

  // 流式内容变高时不靠 state 驱动：观察 DOM 变化，贴底才跟随
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    let queued = false
    const obs = new MutationObserver(() => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        if (pinnedRef.current) el.scrollTop = el.scrollHeight
      })
    })
    obs.observe(el, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [])

  const lastScrollTopRef = useRef(0)
  const onScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight
    const wentUp = el.scrollTop < lastScrollTopRef.current - 4
    lastScrollTopRef.current = el.scrollTop
    // 往上滑就立刻停止跟随，哪怕还离底部很近
    pinnedRef.current = wentUp ? false : dist < 80
    setAtBottom(pinnedRef.current)
    if (el.scrollTop < 40 && visibleCount < messages.length) {
      const prevHeight = el.scrollHeight
      setVisibleCount((c) => Math.min(c + 30, messages.length))
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight - prevHeight + el.scrollTop
      })
    }
  }, [visibleCount, messages.length])

  const pickFiles = useCallback(
    async (files: FileList | File[]) => {
      const base = settings.baseUrl
      const TEXT_EXT =
        /\.(txt|md|markdown|json|csv|tsv|log|ya?ml|xml|html?|css|js|ts|tsx|jsx|py|java|c|cc|cpp|h|hpp|go|rs|sql|sh|bat|ps1|toml|ini|conf)$/i

      for (const file of Array.from(files)) {
        const id = newId()
        // 文本类文件直接把内容读出来，才能真正发给模型
        let text: string | undefined
        // 图片：压成 data URL，直接以多模态方式发给模型
        if (file.type.startsWith('image/')) {
          let imageUrl: string | undefined
          try {
            imageUrl = await imageToDataUrl(file)
          } catch {
            imageUrl = undefined
          }
          const imgItem: Attachment = {
            id,
            name: file.name,
            size: file.size,
            uploading: false,
            imageUrl,
            error: imageUrl ? undefined : '图片读取失败',
          }
          setAttachments((prev) => [...prev, imgItem])
          continue
        }

        const isText = TEXT_EXT.test(file.name) || file.type.startsWith('text/')
        if (isText && file.size <= 256 * 1024) {
          try {
            text = await file.text()
          } catch {
            text = undefined
          }
        }
        const item: Attachment = {
          id,
          name: file.name,
          size: file.size,
          uploading: true,
          text,
        }
        setAttachments((prev) => [...prev, item])
        try {
          const DOC_EXT = /\.(pdf|docx?|pptx?|xlsx?|epub|mobi|png|jpe?g|webp|gif|bmp|tiff?)$/i
          const bigText = !DOC_EXT.test(file.name) && file.size > 256 * 1024
          if (bigText) {
            // 超大文本/代码：用 user_data 交给服务端转文本
            const parsed = await uploadDocument(file, base, 'user_data')
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === id
                  ? { ...a, ...parsed, purpose: 'user_data', uploading: false }
                  : a,
              ),
            )
          } else if (DOC_EXT.test(file.name)) {
            // PDF / Office / 图片：交给官方解析，拿到 file_id
            const isImage = /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file.name)
            const isSheet = /\.(xlsx?|epub|mobi)$/i.test(file.name)
            const purpose = isImage || isSheet ? 'text_recognition' : 'rich_layout_recognition'
            const parsed = await uploadDocument(file, base, purpose)
            setAttachments((prev) =>
              prev.map((a) =>
                a.id === id
                  ? { ...a, ...parsed, purpose, uploading: false }
                  : a,
              ),
            )
          } else {
            const res = await uploadFile(file, base)
            setAttachments((prev) =>
              prev.map((a) => (a.id === id ? { ...a, ...res, uploading: false } : a)),
            )
          }
        } catch (e) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === id ? { ...a, uploading: false, error: (e as Error).message } : a,
            ),
          )
        }
      }
    },
    [settings.baseUrl],
  )

  // 支持直接粘贴图片/文件
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.files
      if (!items || items.length === 0) return
      e.preventDefault()
      void pickFiles(Array.from(items))
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [pickFiles])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const run = useCallback(
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
        accRef.current = ''
        reasonRef.current = ''

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
                ? firstUser.content.split('\n\n[附件]')[0].trim().slice(0, 24)
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
          ? (Date.now()) - (res.startedAt || Date.now())
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

        // 自动压缩：上下文占比超过阈值时，把较早消息压成摘要
        const u = usageRef.current as Message['usage']
        const used = (u?.prompt || 0) + (u?.cached || 0)
        const pct = (used / 1_000_000) * 100
        if (
          settings.autoCompact &&
          onAutoCompress &&
          used > 0 &&
          pct >= settings.compactThreshold
        ) {
          void onAutoCompress(sessionRef.current.id, 8).then((r) => {
            if (!r?.session) return
            setMessages(r.session.messages)
            setVisibleCount(r.session.messages.length)
            onPersist(r.session)
          })
        }
      }

      try {
        for (let round = 0; round < 4; round++) {
          const res = await once(working)

          if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current)
            rafRef.current = null
          }
          accRef.current = ''
          reasonRef.current = ''
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
            let output: string

            if (call.name === 'spawn_subagent') {
              let args: { task?: string } = {}
              try {
                args = JSON.parse(call.arguments || '{}')
              } catch {
                args = {}
              }
              const task = String(args.task ?? '').trim()

              if (!settings.teamMode) {
                output = '子智能体未开启（模型面板 → 子智能体团队协作）'
              } else if (!task) {
                output = '缺少子任务描述'
              } else {
                const subId = `sub-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
                const buf = {
                  reasoning: '',
                  content: '',
                  steps: [] as SubRun['steps'],
                  usage: undefined as Message['usage'],
                }

                setSubRuns((prev) => [
                  ...prev,
                  {
                    id: subId,
                    task,
                    status: 'running',
                    reasoning: '',
                    content: '',
                    steps: [],
                    startedAt: Date.now(),
                  },
                ])
                setSubOpen(false)

                const flush = setInterval(() => {
                  setSubRuns((prev) =>
                    prev.map((r) =>
                      r.id === subId
                        ? {
                            ...r,
                            reasoning: buf.reasoning,
                            content: buf.content,
                            steps: [...buf.steps],
                          }
                        : r,
                    ),
                  )
                }, 150)

                try {
                  output = await runSubagent(task, buf, settings)
                  setSubRuns((prev) =>
                    prev.map((r) =>
                      r.id === subId
                        ? {
                            ...r,
                            status: 'done',
                            reasoning: buf.reasoning,
                            content: buf.content,
                            steps: [...buf.steps],
                            endedAt: Date.now(),
                          }
                        : r,
                    ),
                  )
                } catch (e) {
                  output = `子智能体执行失败：${(e as Error).message}`
                  setSubRuns((prev) =>
                    prev.map((r) =>
                      r.id === subId
                        ? { ...r, status: 'error', endedAt: Date.now() }
                        : r,
                    ),
                  )
                } finally {
                  clearInterval(flush)
                }
                output = `[子智能体结果]
${output}`
              }
            } else if (call.name === 'run_command') {
              let args: { command?: string } = {}
              try {
                args = JSON.parse(call.arguments || '{}')
              } catch {
                args = {}
              }
              const cmd = String(args.command ?? '')
              if (!settings.allowExec) {
                output = '执行命令权限未开启（设置 → 保存路径 → 允许执行命令）'
              } else if (!cmd) {
                output = '缺少命令'
              } else {
                const ok = await new Promise<boolean>((resolve) => {
                  cmdResolve.current = resolve
                  setCmdApproval(cmd)
                })
                setCmdApproval(null)
                cmdResolve.current = null
                output = ok
                  ? await executeTool(
                      call.name,
                      call.arguments,
                      settings.baseUrl,
                      settings.workspaceDir,
                    )
                  : '用户拒绝了这次命令执行'
              }
            } else if (call.name === 'write_file') {
              let args: { path?: string; content?: string } = {}
              try {
                args = JSON.parse(call.arguments || '{}')
              } catch {
                args = {}
              }
              const relPath = String(args.path ?? '')
              const content = String(args.content ?? '')

              if (!settings.allowWrite) {
                output = '写文件权限未开启（设置 → 保存路径 → 允许写文件）'
              } else if (!relPath) {
                output = '缺少文件路径'
              } else {
                const before = await readWorkspaceFile(settings.workspaceDir, relPath)
                const ok = await new Promise<boolean>((resolve) => {
                  approvalResolve.current = resolve
                  setApproval({ path: relPath, before, after: content })
                })
                setApproval(null)
                approvalResolve.current = null
                output = ok
                  ? await executeTool(
                      call.name,
                      call.arguments,
                      settings.baseUrl,
                      settings.workspaceDir,
                    )
                  : '用户拒绝了这次写入，文件未改动'
              }
            } else {
              output = await executeTool(
                call.name,
                call.arguments,
                settings.baseUrl,
                settings.workspaceDir,
              )
            }
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
        accRef.current = ''
        reasonRef.current = ''
      }
    },
    [busy, settings, session.model, persist, scheduleFlush, onPersist],
  )

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? typedRef.current ?? input).trim()
    if ((!text && attachments.length === 0) || busy) return

    const ready = attachments.filter((a) => !a.uploading && !a.error)
    const fileBlocks = ready
      .filter((a) => a.text)
      .map((a) => `\n\n[附件：${a.name}]\n<<<\n${a.text}\n>>>`)
      .join('')

    const attachmentNote =
      ready.length > 0
        ? `\n\n[附件]\n${ready
            .map(
              (a) =>
                `- ${a.name}${a.stored ? `（inbox: ${a.stored}）` : ''}${
                  a.text ? '（内容已附在下方）' : ''
                }`,
            )
            .join('\n')}` + fileBlocks
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

  /** 继续生成：把最后一条回复当开头，让模型接着写 */
  const continueGeneration = useCallback(async () => {
    if (busy) return
    const msgs = [...messages]
    const last = msgs[msgs.length - 1]
    if (!last || last.role !== 'assistant') return

    setBusy(true)
    accRef.current = ''
    reasonRef.current = ''
    startAtRef.current = Date.now()
    accRef.current = ''
    reasonRef.current = ''

    let extra = ''
    await streamChat(
      msgs,
      { ...settings, model: session.model || settings.model },
      {
        onDelta: (chunk, kind) => {
          if (kind === 'content') {
            extra += chunk
            accRef.current += chunk
            scheduleFlush()
          }
        },
        onDone: () => {},
        onError: (msg) => {
          extra += `\n\n（续写失败：${msg}）`
        },
      },
      undefined,
      { prefixMode: true, prefixText: last.content },
    )

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    accRef.current = ''
    accRef.current = ''
    reasonRef.current = ''
    setBusy(false)

    if (extra) {
      const updated = msgs.map((m, i) =>
        i === msgs.length - 1 ? { ...m, content: m.content + extra } : m,
      )
      setMessages(updated)
      persist(updated)
    }
  }, [busy, messages, settings, session.model, persist, scheduleFlush])

  /** 编辑某条用户消息：截断它和之后的内容，把原文放回输入框 */
  const editFrom = useCallback(
    (index: number) => {
      if (busy) return
      const target = messages[index]
      if (!target || target.role !== 'user') return
      const base = messages.slice(0, index)
      seedInput(target.content.split('\n\n[附件]')[0])
      setMessages(base)
      setVisibleCount((c) => Math.min(Math.max(c + 1, 1), Math.max(base.length, 1)))
      persist(base)
    },
    [busy, messages, persist],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setBusy(false)
  }, [])

  const start = Math.max(0, messages.length - visibleCount)
  const shown = messages.slice(start)

  return (
    <div className="screen chat-screen">
      <header className="topbar">
        <button className="icon-btn" onClick={onOpenSidebar} aria-label="展开栏目" title="展开栏目">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <span className="native-build" aria-hidden="true">
            {isNativeApp() ? ANDROID_BUILD : ''}
          </span>
          <div className="topbar-title">
          <div className="title-row">
            <span className="title-line">{isEmpty ? 'ChatBox Pro' : session.title}</span>
            {subRuns.length > 0 && (
              <button
                className={`sub-chip${
                  subRuns.some((r) => r.status === 'running') ? ' running' : ''
                }`}
                onClick={() => setSubOpen(true)}
                title="查看子智能体"
              >
                <span className="sub-chip-dot" />
                <span className="sub-chip-text">子智能体</span>
                {subRuns.some((r) => r.status === 'running') && (
                  <span className="sub-chip-state">进行中</span>
                )}
                <span className="sub-chip-count">{subRuns.length}</span>
              </button>
            )}
          </div>
          {!isEmpty && <div className="sub-line">{session.model}</div>}
        </div>
        {!isEmpty && (
          <button
            className="icon-btn"
            onClick={() => setUserBarOpen((v) => !v)}
            aria-label={t('chat.userlist', '用户发言')}
            title={t('chat.userlist', '用户发言')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M4 6h16M4 12h10M4 18h13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        {!isEmpty && (
          <button
            className="icon-btn"
            onClick={() => setStatsOpen(true)}
            aria-label="会话统计"
            title="会话统计"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M5 20V10M12 20V4M19 20v-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
        {!isEmpty && (
          <button
            className={`icon-btn${selectMode ? ' active' : ''}`}
            onClick={() => {
              setSelectMode((v) => !v)
              setSelectedIds(new Set())
            }}
            aria-label="多选"
            title="多选消息"
          >
            ☑
          </button>
        )}
        {!isEmpty && (
          <button
            className="icon-btn"
            onClick={() => onExport(sessionRef.current)}
            aria-label="导出"
            title="导出对话"
          >
            ⤓
          </button>
        )}
      </header>

      {isEmpty ? (
        <div className="welcome">
          <h1 className="welcome-title">{welcome}</h1>
          <p className="welcome-sub">输入一句话开始</p>
        </div>
      ) : (
        <div className="msg-list" ref={listRef} onScroll={onScroll}>
          {start > 0 && (
            <button
              className="load-more"
              onClick={() => {
                const el = listRef.current
                const prev = el?.scrollHeight ?? 0
                setVisibleCount((c) => Math.min(c + 30, messages.length))
                requestAnimationFrame(() => {
                  if (el) el.scrollTop = el.scrollHeight - prev + el.scrollTop
                })
              }}
            >
              上滚加载更早的 {start} 条
            </button>
          )}
          {shown.map((m, idx) => (
            <div
              key={m.id}
              className={`sel-wrap${selectMode ? ' selecting' : ''}${
                selectedIds.has(m.id) ? ' picked' : ''
              }`}
              onClick={
                selectMode
                  ? () => toggleSelect(m.id)
                  : undefined
              }
            >
              {selectMode && (
                <span className="sel-box" aria-hidden="true">
                  {selectedIds.has(m.id) ? '✓' : ''}
                </span>
              )}
              <MessageRow
                msg={m}
                reasoningMode={settings.reasoningDisplay}
                isLastAssistant={idx === shown.length - 1 && m.role === 'assistant'}
                onRegenerate={() => void regenerate()}
                onEdit={() => editFrom(start + idx)}
                onContinue={() => void continueGeneration()}
              />
            </div>
          ))}

          {(busy || hasStream) && (
            <StreamBubble
              accRef={accRef}
              reasonRef={reasonRef}
              busy={busy}
              display={settings.reasoningDisplay}
              startAt={startAtRef.current}
              searching={searching}
            />
          )}
        </div>
      )}

      {selectMode && (
        <div className="sel-bar">
          <span className="sel-count">已选 {selectedIds.size} 条</span>
          <button
            className="ghost"
            onClick={() =>
              setSelectedIds(
                selectedIds.size === messages.length
                  ? new Set()
                  : new Set(messages.map((m) => m.id)),
              )
            }
          >
            {selectedIds.size === messages.length ? '取消全选' : '全选'}
          </button>
          <button className="ghost" onClick={() => setSelectMode(false)}>
            退出
          </button>
          <button className="primary" disabled={!selectedIds.size} onClick={deleteSelected}>
            删除所选
          </button>
        </div>
      )}

      {!isEmpty && !atBottom && (
        <button
          className="to-bottom"
          onClick={() => {
            setAtBottom(true)
            scrollToBottom(true)
          }}
        >
          ↓ 回到最新
        </button>
      )}

      {approval && (
        <WriteApproval
          path={approval.path}
          before={approval.before}
          after={approval.after}
          onAllow={() => approvalResolve.current?.(true)}
          onDeny={() => approvalResolve.current?.(false)}
        />
      )}

      {userBarOpen && (
        <aside className="userbar" aria-label={t('chat.userlist', '用户发言')}>
          <div className="userbar-head">
            <span>{t('chat.userlist', '用户发言')}</span>
            <button className="icon-btn" onClick={() => setUserBarOpen(false)} aria-label="关闭">
              ✕
            </button>
          </div>
          <div className="userbar-list">
            {messages.filter((m) => m.role === 'user').length === 0 && (
              <p className="muted small">还没有发言。</p>
            )}
            {messages
              .filter((m) => m.role === 'user')
              .map((m, i) => (
                <button
                  key={m.id}
                  className="userbar-item"
                  onClick={() => {
                    setVisibleCount(messages.length)
                    requestAnimationFrame(() => {
                      document
                        .getElementById(`m-${m.id}`)
                        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                    })
                  }}
                  title={m.content.split('\n\n[附件]')[0]}
                >
                  <span className="userbar-index">{i + 1}</span>
                  <span className="userbar-text">
                    {m.content.split('\n\n[附件]')[0].slice(0, 60)}
                  </span>
                </button>
              ))}
          </div>
        </aside>
      )}

      {subOpen && <SubAgentPanel runs={subRuns} onClose={() => setSubOpen(false)} />}

      {cmdApproval !== null && (
        <CommandApproval
          command={cmdApproval}
          cwd={settings.workspaceDir}
          onAllow={() => cmdResolve.current?.(true)}
          onDeny={() => cmdResolve.current?.(false)}
        />
      )}

      {statsOpen && (
        <StatsModal session={sessionRef.current} onClose={() => setStatsOpen(false)} />
      )}

      <Composer
        value={input}
        seedNonce={seedNonce}
        onChange={(v) => {
          typedRef.current = v
        }}
        onSend={(text) => void send(text)}
        onStop={stop}
        busy={busy}
        model={session.model || settings.model}
        models={settings.enabledModels.length ? settings.enabledModels : [settings.model]}
        onModelChange={(m) => persist(messages, { model: m })}
        effort={settings.reasoningEffort}
        onEffortChange={(e) => onSettingsChange({ reasoningEffort: e })}
        teamMode={settings.teamMode}
        onTeamModeChange={(v) =>
          onSettingsChange({ teamMode: v, ...(v ? { toolsEnabled: true } : {}) })
        }
        webSearch={settings.webSearch}
        onWebSearchChange={(v) => onSettingsChange({ webSearch: v })}
        safety={settings.safety}
        onSafetyChange={(v) => onSettingsChange({ safety: v })}
        toolsEnabled={settings.toolsEnabled}
        onToolsChange={(v) => onSettingsChange({ toolsEnabled: v })}
        attachments={attachments}
        onPickFiles={(f) => void pickFiles(f)}
        onRemoveAttachment={removeAttachment}
        placeholder={isEmpty ? `${t('send', '发送')}…` : `${t('send', '发送')}…`}
      />
    </div>
  )
}

function cacheRate(u: NonNullable<Message['usage']>): string {
  const hit = u.cached || 0
  const total = hit + (u.prompt || 0)
  if (total <= 0) return '—'
  return `${Math.round((hit / total) * 100)}%`
}

function copyText(text: string) {
  void navigator.clipboard?.writeText(text)
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60000)
  return `${m}m${Math.round((ms % 60000) / 1000)}s`
}

function fmtTokens(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`
  return `${(n / 1_000_000).toFixed(2)}M`
}

function StatsInline({ msg }: { msg: Message }) {
  const dur =
    msg.meta?.endedAt && msg.meta?.startedAt
      ? fmtDuration(msg.meta.endedAt - msg.meta.startedAt)
      : ''
  const usage = msg.usage
  return (
    <span className="msg-stats">
      {dur && <span>{dur}</span>}
      {usage && (
        <>
          {dur && <span className="meta-sep">·</span>}
          <span>{fmtTokens((usage.prompt || 0) + (usage.cached || 0))} in</span>
          <span className="meta-sep">/</span>
          <span>{fmtTokens(usage.completion || 0)} out</span>
          <span className="meta-sep">·</span>
          <span>缓存 {cacheRate(usage)}</span>
        </>
      )}
    </span>
  )
}

/** 极老的消息可能把思维链塞在正文里，这里做一次运行时拆解 */
function splitLegacyReasoning(msg: Message): { content: string; reasoning?: string } {
  if (msg.role !== 'assistant' || msg.reasoning) return { content: msg.content }
  const hit =
    /^\s*(?:>\s*)?(?:\*\*)?\s*(?:思考过程|思考)\s*(?:\*\*)?\s*\n+([\s\S]*?)\n{2,}([\s\S]*)$/.exec(
      msg.content,
    )
  if (!hit) return { content: msg.content }
  const reasoning = hit[1]
    .split('\n')
    .map((l) => l.replace(/^>\s?/, ''))
    .join('\n')
    .trim()
  return { content: hit[2], reasoning }
}

const MessageRow = memo(function MessageRow({
  msg,
  reasoningMode,
  isLastAssistant,
  onRegenerate,
  onEdit,
  onContinue,
}: {
  msg: Message
  reasoningMode: 'off' | 'web' | 'dsh'
  isLastAssistant?: boolean
  onRegenerate?: () => void
  onEdit?: () => void
  onContinue?: () => void
}) {
  const t = useT()
  if (msg.role === 'summary') {
    return (
      <div className="msg summary">
        <div className="summary-head">更早对话的摘要</div>
        <div className="summary-body">{msg.content}</div>
      </div>
    )
  }

  if (msg.role === 'tool') {
    return (
      <div className="msg tool">
        <div className="tool-line">
          <span className="tool-name">{msg.toolName || 'tool'}</span>
          <span className="tool-out">{msg.content.replace(/\s+/g, ' ').slice(0, 160)}</span>
        </div>
      </div>
    )
  }

  if (msg.role === 'user') {
    return (
      <div id={`m-${msg.id}`} className="msg user">
        {msg.attachments?.some((a) => a.imageUrl) && (
          <div className="bubble-images">
            {msg.attachments
              .filter((a) => a.imageUrl)
              .map((a) => (
                <img key={a.id} src={a.imageUrl} alt={a.name} className="bubble-img" />
              ))}
          </div>
        )}
        <div className="bubble">{msg.content.split('\n\n[附件]')[0]}</div>
        {onEdit && (
          <div className="msg-toolbar">
            <button className="msg-action" onClick={onEdit} title="编辑这条消息">
              {t('common.edit', '编辑')}
            </button>
          </div>
        )}
      </div>
    )
  }

  const legacy = splitLegacyReasoning(msg)
  const reasoningText = msg.reasoning || legacy.reasoning
  const contentText = legacy.content
  const showReasoning = reasoningText && reasoningMode !== 'off'

  return (
    <div id={`m-${msg.id}`} className={`msg assistant${msg.error ? ' error' : ''}`}>
      <div className="msg-head">
        {showReasoning ? (
          <Reasoning
            key={reasoningMode}
            reasoning={reasoningText!}
            mode={reasoningMode}
            durationMs={msg.reasoningMs}
            trailing={<StatsInline msg={msg} />}
          />
        ) : (
          <StatsInline msg={msg} />
        )}
      </div>

      <div className="msg-body">
        <Markdown text={contentText} />

        {msg.citations && msg.citations.length > 0 && (
          <div className="citations">
            <div className="citations-label">参考来源</div>
            {msg.citations.map((c, i) => (
              <a
                key={`${c.url}-${i}`}
                className="citation-item"
                href={c.url}
                target="_blank"
                rel="noreferrer"
                title={c.url}
              >
                <span className="citation-index">{i + 1}</span>
                <span className="citation-title">{c.title || c.url}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="msg-toolbar">
        <button className="msg-action" onClick={() => copyText(msg.content)}>
          {t('common.copy', '复制')}
        </button>
        {isLastAssistant && onContinue && (
          <>
            <span className="toolbar-sep" />
            <button className="msg-action" onClick={onContinue}>
              {t('common.continue', '继续')}
            </button>
          </>
        )}
        {isLastAssistant && onRegenerate && (
          <>
            <span className="toolbar-sep" />
            <button className="msg-action" onClick={onRegenerate}>
              {t('common.regenerate', '重新生成')}
            </button>
          </>
        )}
      </div>
    </div>
  )
})
