import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { isNativeApp, nativeLog } from './native'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

const native = isNativeApp()

// 闪退/异常先落盘，便于排查（安卓）
if (native) {
  window.addEventListener('error', (e) => {
    void nativeLog(`ERROR ${e.message} @ ${e.filename}:${e.lineno}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string } | string
    void nativeLog(`REJECT ${typeof r === 'string' ? r : r?.message ?? 'unknown'}`)
  })
  void nativeLog('app start')
}

if (native) {
  // 安卓 App 里绝不能用 Service Worker：
  // 它会把旧的前端缓存下来，导致装了新 APK 还跑旧代码。
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.unregister())
    })
  }
  if ('caches' in window) {
    void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)))
  }
} else if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // 浏览器 / PWA：注册 SW，让「添加到主屏幕」后能像 App 一样启动
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 注册失败不影响正常使用 */
    })
  })
}
