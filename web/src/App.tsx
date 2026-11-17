import { useCallback, useEffect, useMemo, useState } from 'react'
import ChatScreen from './components/ChatScreen'
import ListScreen from './components/ListScreen'
import SettingsScreen from './components/SettingsScreen'
import { db, kvGet, type SessionSummary } from './db'
import { downloadConversation } from './exportFile'
import { DEFAULT_SETTINGS, newId, type Session, type Settings } from './types'

type View = 'list' | 'chat' | 'settings'

const SETTINGS_KEY = 'settings'

export default function App() {
  const [view, setView] = useState<View>('list')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [current, setCurrent] = useState<Session | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState('')

  const refresh = useCallback(async () => {
    setSessions(await db.listSessions())
  }, [])

  useEffect(() => {
    void (async () => {
      // 本地数据库打不开时（某些 WebView 会禁用 IndexedDB），不要一直转圈
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('本地存储初始化超时')), 6000),
      )
      try {
        const saved = await Promise.race([
          kvGet<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS),
          timeout,
        ])
        setSettings({ ...DEFAULT_SETTINGS, ...saved })
        await Promise.race([refresh(), timeout])
      } catch (e) {
        setInitError((e as Error).message || '初始化失败')
      } finally {
        setReady(true)
      }
    })()
  }, [refresh])

  const openSession = useCallback(async (id: string) => {
    const s = (await db.getSession(id)) as Session | undefined
    if (!s) return
    if (!Array.isArray(s.messages)) s.messages = []
    setCurrent(s)
    setView('chat')
  }, [])

  const createSession = useCallback(
    async (storage: 'local' | 'server') => {
      if (storage === 'server') return
      const s: Session = {
        id: newId(),
        title: '新对话',
        storage,
        model: settings.model,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      }
      await db.putSession(s)
      await refresh()
      setCurrent(s)
      setView('chat')
    },
    [refresh, settings.model],
  )

  const persistSession = useCallback(
    (s: Session) => {
      setCurrent(s)
      void db.putSession(s).then(refresh)
    },
    [refresh],
  )

  const removeSession = useCallback(
    async (id: string) => {
      await db.deleteSession(id)
      await refresh()
    },
    [refresh],
  )

  const exportById = useCallback(async (id: string) => {
    const s = (await db.getSession(id)) as Session | undefined
    if (s) downloadConversation(s)
  }, [])

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s)
    void db.setKV(SETTINGS_KEY, s)
  }, [])

  const wipe = useCallback(async () => {
    for (const s of await db.listSessions()) await db.deleteSession(s.id)
    await refresh()
  }, [refresh])

  const content = useMemo(() => {
    if (!ready) return <div className="boot">加载中…</div>
    if (view === 'chat' && current) {
      return (
        <ChatScreen
          session={current}
          settings={{ ...settings, model: current.model || settings.model }}
          onPersist={persistSession}
          onBack={() => {
            setView('list')
            void refresh()
          }}
          onOpenSettings={() => setView('settings')}
          onExport={(s) => downloadConversation(s)}
        />
      )
    }
    if (view === 'settings') {
      return (
        <SettingsScreen
          settings={settings}
          onSave={saveSettings}
          onBack={() => setView(current ? 'chat' : 'list')}
          onWipe={wipe}
        />
      )
    }
    return (
      <ListScreen
        sessions={sessions}
        onOpen={openSession}
        onNew={createSession}
        onDelete={removeSession}
        onOpenSettings={() => setView('settings')}
        onExport={exportById}
        serverReady={false}
      />
    )
  }, [
    ready,
    view,
    current,
    settings,
    sessions,
    persistSession,
    saveSettings,
    wipe,
    openSession,
    createSession,
    removeSession,
    exportById,
    refresh,
  ])

  return (
    <div className="app">
      {initError && (
        <div className="banner">
          本地存储不可用：{initError}
          <br />
          <span className="muted small">
            这台设备的浏览器/WebView 禁用了 IndexedDB，会话无法保存。换用系统浏览器（Chrome / Safari）通常可以解决。
          </span>
        </div>
      )}
      {content}
    </div>
  )
}
