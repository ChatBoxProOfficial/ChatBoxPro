/* ChatBox Pro 的 Service Worker：只为「像 App 一样打开」服务
 * - 静态资源：缓存优先（首屏快，离线也能开壳）
 * - /api/*：完全绕过（聊天请求必须走网络，绝不缓存）
 * - 页面导航：网络优先，断网时回退到缓存的 index.html
 */
const CACHE = 'chatbox-pro-v2'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // 只处理同源
  if (url.origin !== self.location.origin) return

  // 接口一律走网络，不缓存
  if (url.pathname.startsWith('/api/')) return

  // 页面导航：网络优先，失败回退缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then((r) => r || Response.error())),
    )
    return
  }

  // 静态资源：缓存优先，后台更新
  if (req.method === 'GET') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req)
          .then((resp) => {
            if (resp && resp.ok) {
              const copy = resp.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return resp
          })
          .catch(() => cached)
        return cached || fetched
      }),
    )
  }
})
