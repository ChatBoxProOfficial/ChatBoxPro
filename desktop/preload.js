// 桌面端桥接：只暴露必要的能力（打开文件夹、取路径、检查/下载/应用更新）
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chatbox', {
  openFolder: (p) => ipcRenderer.invoke('chatbox:open-folder', p),
  paths: () => ipcRenderer.invoke('chatbox:paths'),

  /** 读取远端版本信息 */
  checkUpdate: (url) => ipcRenderer.invoke('chatbox:check-update', url),
  /** 下载更新包（带 sha256 校验） */
  downloadUpdate: (url, sha256) => ipcRenderer.invoke('chatbox:download-update', url, sha256),
  /** 探测某个地址是否可达 / 是否是 DSH */
  probe: (url) => ipcRenderer.invoke('chatbox:probe', url),
  /** 应用更新（退出并覆盖安装） */
  applyUpdate: (file) => ipcRenderer.invoke('chatbox:apply-update', file),
  /** 下载进度 */
  onUpdateProgress: (cb) => {
    const handler = (_e, p) => cb(p)
    ipcRenderer.on('chatbox:update-progress', handler)
    return () => ipcRenderer.removeListener('chatbox:update-progress', handler)
  },
})
