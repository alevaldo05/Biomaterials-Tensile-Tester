'use strict';
/* What the Windows app gives its screens, and nothing more: a fixed label saying they run inside it, and two calls to
   read and set the lab server address (checked and saved by the main process). No Node, no file access, no other
   messages. Anything added here must be reviewed. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tensileDesktop', Object.freeze({
  kind: 'windows-app',
  getLabServer: () => ipcRenderer.invoke('lab-server:get'),
  setLabServer: (url) => ipcRenderer.invoke('lab-server:set', String(url)),
}));
