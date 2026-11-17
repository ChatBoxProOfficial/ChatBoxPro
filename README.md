# ChatBox Pro

手机 / 电脑都能用的聊天客户端。**自己填自己的 DeepSeek API Key**，请求经自己的服务器中转；
会话默认只存在设备本地，需要时可以导出成文件带到 DSH 里继续聊。

当前版本：v0.1.0（仅本机会话 + 流式聊天 + 导出）

## 目录

```
chatbox-pro/
├─ web/                前端（Vite + React + TS）
│   └─ src/
│      ├─ App.tsx           页面路由：列表 / 对话 / 设置
│      ├─ api.ts            流式聊天请求（SSE 解析）
│      ├─ db.ts             IndexedDB：会话与配置
│      ├─ secureStore.ts    API Key 加密存储（不可导出 AES-GCM 密钥）
│      ├─ exportFile.ts     导出对话文件
│      └─ components/       列表页、对话页、设置页、Markdown
├─ server/index.mjs    中转 + 静态托管（零依赖，只用 Node 内置模块）
├─ scripts/verify.mjs  用本机 Edge 做无头验证（截图 + 控制台错误）
├─ docs/需求备忘.md     产品的「口径」，改需求先改它
└─ dist/               构建产物（npm run build 生成）
```

## 本机运行

```bash
npm install          # 首次
npm run serve        # 构建 + 启动，默认 http://0.0.0.0:8787
```

开发时（热更新）：

```bash
node server/index.mjs   # 先起中转服务（8787）
npm run dev             # 再起 Vite（5173，/api 代理到 8787）
```

手机测试：与电脑同一 Wi-Fi，打开 `http://<电脑内网IP>:8787/`。

### 常驻与开机自启

- 双击 `start.bat` 可手动起服务（窗口关掉即停）。
- 已注册计划任务 **ChatBox Pro**：登录 Windows 后自动在后台启动，端口 8787。
  - 查看：`Get-ScheduledTask -TaskName "ChatBox Pro"`
  - 停止：`Stop-ScheduledTask -TaskName "ChatBox Pro"`
  - 首次运行会在防火墙里放行 8787（已添加规则 `ChatBox Pro 8787`）。

## 桌面端：双击就能打开

桌面上有一个 **ChatBox Pro** 快捷方式，双击直接出现一个**原生应用窗口**
（Electron 壳，没有浏览器地址栏 / 标签页）。它会：

1. 检查 8787 上的内置服务，没起就在进程内拉起来（不闪黑框、不用先手动开服务）；
2. 打开窗口加载界面。

安装位置：`%LOCALAPPDATA%\Programs\ChatBoxPro\`（不需要管理员权限，卸载即删目录）。

重新打包并安装：

```bash
npm run pack:desktop     # 产出 release/ChatBox Pro-win32-x64/
npm run install:app      # 复制到 LOCALAPPDATA + 重建桌面快捷方式
```

**已知问题**：开发模式 `npm run desktop`（直接跑 `node_modules/electron/dist/electron.exe`）
在这台机器上会被安全软件静默拦掉，秒退且无日志；**打包后的 `ChatBoxPro.exe` 不受影响**。
详见 `docs/桌面壳排查.md`。若需要开发模式，把该 `electron.exe` 加入火绒信任区。

### 备用入口：Edge 应用模式

若 Electron 版被拦截，可用 `ChatBox Pro.vbs`（`npm run shortcut` 重建）：

1. 后台拉起 8787 服务；
2. 用 Edge 的「应用模式」开一个无地址栏窗口（不是普通浏览器标签页）。

## 首次使用

1. 打开页面 → 右上角齿轮 → **API Key**，粘贴 `sk-...` 并保存（加密存在本机）；
2. 回到列表 → **新对话（仅本机）** → 开始聊天。

## 安全约定

- API Key 只从请求头 `x-deepseek-key` 读取，**不写日志、不落盘**；
- Key 在设备上由**不可导出**的 AES-GCM 密钥加密（WebCrypto + IndexedDB）；
- 上线请给 8787 加上 HTTPS 反代，否则 Key 在链路上是明文。

## 验证

```bash
node scripts/verify.mjs     # 需要 Edge 与已运行的 8787 服务
```

会输出 `shots/*.png` 截图，并在控制台报错时以非零码退出。

## 路线图

- [x] 本地会话 + 流式聊天 + 加密存 Key
- [x] 导出对话文件
- [ ] 与 DSH 的导入格式对齐（打通「拖进 DSH 继续聊」）
- [ ] Capacitor 壳 → Android APK
- [ ] 服务器会话（多端同步）
- [ ] 投喂作者的二维码（把图片放进来即可）
