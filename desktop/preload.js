// 桌面端桥接：只暴露必要的 IPC 能力
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chatbox', {
  /** 在资源管理器里打开文件夹 */
  openFolder: (p) => ipcRenderer.invoke('chatbox:open-folder', p),
  /** 应用数据目录（inbox / userData） */
  paths: () => ipcRenderer.invoke('chatbox:paths'),

  /** 读取远端版本清单 */
  checkUpdate: (url) => ipcRenderer.invoke('chatbox:check-update', url),
  /** 下载更新包（带 sha256 校验） */
  downloadUpdate: (url, sha256) => ipcRenderer.invoke('chatbox:download-update', url, sha256),
  /** 探测地址是否可达 / 是否为 DSH */
  probe: (url) => ipcRenderer.invoke('chatbox:probe', url),
  /** 应用更新（退出后覆盖安装并重启） */
  applyUpdate: (file) => ipcRenderer.invoke('chatbox:apply-update', file),
  /** 下载进度订阅，返回取消函数 */
  onUpdateProgress: (cb) => {
    const handler = (_e, p) => cb(p)
    ipcRenderer.on('chatbox:update-progress', handler)
    return () => ipcRenderer.removeListener('chatbox:update-progress', handler)
  },
})
