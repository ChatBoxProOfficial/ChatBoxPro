import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.chatboxpro.app',
  appName: 'ChatBox Pro',
  webDir: 'dist',
  android: {
    // 允许 WebView 加载 http(s) 资源（App 直连 DeepSeek 需要）
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // 我们自己写的直连插件：绕开 CORS，并支持流式
    ChatboxHttp: {},
  },
}

export default config
