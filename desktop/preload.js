// 只给客户端自己的设置页 / 断线页（本地文件）用，游戏页面里什么都不暴露
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'file:') {
  contextBridge.exposeInMainWorld('f1d', {
    info: () => ipcRenderer.invoke('f1d:info'),
    connect: (addr) => ipcRenderer.invoke('f1d:connect', addr),
    retry: () => ipcRenderer.invoke('f1d:retry'),
    back: () => ipcRenderer.invoke('f1d:back')
  });
}
