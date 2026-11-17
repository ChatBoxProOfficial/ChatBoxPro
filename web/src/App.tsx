import { useCallback, useEffect, useState } from 'react'
import ChatScreen from './components/ChatScreen'
import SettingsScreen from './components/SettingsScreen'
import Sidebar from './components/Sidebar'
import { ConfirmHost } from './components/Confirm'
import { db, kvGet, type SessionSummary } from './db'
import { downloadConversation } from './exportFile'
import { DEFAULT_SETTINGS, newId, type Session, type Settings } from './types'

const SETTINGS_KEY = 'settings'

function draftSession(model: string): Session {
  const now = Date.now()
  return {
    id: newId(),
    title: '新对话',
    storage: 'local',
    model,
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

export default function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [current, setCurrent] = useState<Session | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState('')

  const refresh = useCallback(async () => {
    setSessions(await db.listSessions())
  }, [])

  useEffect(() => {
    void (async () => {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('本地存储初始化超时')), 6000),
      )
      try {
        const saved = await Promise.race([
          kvGet<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS),
          timeout,
        ])
        const merged = { ...DEFAULT_SETTINGS, ...saved }
        setSettings(merged)
        await Promise.race([refresh(), timeout])
        setCurrent(draftSession(merged.model))
      } catch (e) {
        setInitError((e as Error).message || '初始化失败')
        setCurrent(draftSession(DEFAULT_SETTINGS.model))
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
    setSidebarOpen(false)
    setShowSettings(false)
  }, [])

  const newConversation = useCallback(() => {
    setCurrent(draftSession(settings.model))
    setSidebarOpen(false)
    setShowSettings(false)
  }, [settings.model])

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
      if (current?.id === id) setCurrent(draftSession(settings.model))
    },
    [refresh, current?.id, settings.model],
  )

  const saveSettings = useCallback((s: Settings) => {
    setSettings(s)
    void db.setKV(SETTINGS_KEY, s)
  }, [])
  const wipe = useCallback(async () => {
    for (const s of await db.listSessions()) await db.deleteSession(s.id)
    await refresh()
    setCurrent(draftSession(settings.model))
  }, [refresh, settings.model])

  if (!ready) return <div className="boot">加载中…</div>

  return (
    <div className={`app-shell${settings.compact ? ' compact' : ''}`}>
      {initError && (
        <div className="banner">
          本地存储不可用：{initError}
          <br />
          <span className="muted small">
            这台设备的浏览器/WebView 禁用了 IndexedDB，会话无法保存。换用系统浏览器（Chrome / Safari）通常可以解决。
          </span>
        </div>
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        currentId={current?.id ?? null}
        userName={settings.userName}
        onNewConversation={newConversation}
        onOpenSession={(id) => void openSession(id)}
        onDeleteSession={(id) => void removeSession(id)}
        onOpenSettings={() => {
          setSidebarOpen(false)
          setShowSettings(true)
        }}
      />

      {current && (
        <ChatScreen
          key={current.id}
          session={current}
          settings={settings}
          onPersist={persistSession}
          onOpenSidebar={() => setSidebarOpen(true)}
          onExport={(s) => downloadConversation(s)}
        />
      )}

      {showSettings && (
        <SettingsScreen
          settings={settings}
          onChange={saveSettings}
          onBack={() => setShowSettings(false)}
          onWipe={() => void wipe()}
        />
      )}

      <ConfirmHost />
    </div>
  )
}
