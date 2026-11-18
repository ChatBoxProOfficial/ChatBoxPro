const DB_NAME = 'chatbox-pro'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' })
        s.createIndex('updatedAt', 'updatedAt')
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = run(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export interface SessionSummary {
  id: string
  title: string
  storage: string
  updatedAt: number
  count: number
  /** 是否置顶 */
  pinned?: boolean
}

export const db = {
  async listSessions(): Promise<SessionSummary[]> {
    const db0 = await openDb()
    return new Promise((resolve, reject) => {
      const out: SessionSummary[] = []
      const t = db0.transaction('sessions', 'readonly')
      const req = t.objectStore('sessions').openCursor()
      req.onsuccess = () => {
        const cur = req.result
        if (cur) {
          const v = cur.value
          out.push({
            id: v.id,
            title: v.title,
            storage: v.storage,
            updatedAt: v.updatedAt,
            count: Array.isArray(v.messages) ? v.messages.length : 0,
            pinned: Boolean(v.pinned),
          })
          cur.continue()
        } else {
          // 置顶的在最前，其余按更新时间倒序
          out.sort((a, b) =>
            Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
            b.updatedAt - a.updatedAt,
          )
          resolve(out)
        }
      }
      req.onerror = () => reject(req.error)
    })
  },

  getSession: (id: string) => tx<any>('sessions', 'readonly', (s) => s.get(id)),
  putSession: (v: unknown) => tx<any>('sessions', 'readwrite', (s) => s.put(v as any)),
  deleteSession: (id: string) => tx<any>('sessions', 'readwrite', (s) => s.delete(id)),

  getKV: (k: string) => tx<any>('kv', 'readonly', (s) => s.get(k)),
  setKV: (k: string, v: unknown) => tx<any>('kv', 'readwrite', (s) => s.put(v, k)),
  delKV: (k: string) => tx<any>('kv', 'readwrite', (s) => s.delete(k)),
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await db.getKV(key)
    return v === undefined || v === null ? fallback : (v as T)
  } catch {
    return fallback
  }
}
