// 桌面端桥接：只暴露「打开文件夹」和「取路径」两个最小能力
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chatbox', {
  openFolder: (p) => ipcRenderer.invoke('chatbox:open-folder', p),
  paths: () => ipcRenderer.invoke('chatbox:paths'),
})
