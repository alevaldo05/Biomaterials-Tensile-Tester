'use strict';
/* What the Windows app gives its screens, and nothing more: a fixed label saying they run inside it, two calls to read
   and set the lab server address, and the seven recording-journal calls (files in the app's data folder). The main
   process checks every argument. No Node, no file access, no other messages. Anything added here must be reviewed. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tensileDesktop', Object.freeze({
  kind: 'windows-app',
  getLabServer: () => ipcRenderer.invoke('lab-server:get'),
  setLabServer: (url) => ipcRenderer.invoke('lab-server:set', String(url)),
  journal: Object.freeze({
    begin: (meta, header) => ipcRenderer.invoke('journal:begin', meta, header),
    append: (id, batch) => ipcRenderer.invoke('journal:append', id, batch),
    finish: (id, status, endReason) => ipcRenderer.invoke('journal:finish', id, status, endReason),
    list: () => ipcRenderer.invoke('journal:list'),
    lines: (id) => ipcRenderer.invoke('journal:lines', id),
    remove: (id) => ipcRenderer.invoke('journal:remove', id),
    estimate: () => ipcRenderer.invoke('journal:estimate'),
  }),
}));
