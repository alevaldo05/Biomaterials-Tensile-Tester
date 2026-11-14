'use strict';
/* What the Windows app gives its screens, and nothing more: a fixed label saying they run inside it, two calls to read
   and set the lab server address, the seven recording-journal calls (files in the app's data folder), and four update
   calls (ask once whether a newer release exists, open this repository's release page in the computer's browser, and
   read and set the "Check for updates" setting), and the people calls (sign-in and who may run the machine; see
   people.cjs: the screens get names and kinds only, never a password hash). The main process checks every argument.
   No Node, no file access, no other messages. Anything added here must be reviewed. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tensileDesktop', Object.freeze({
  kind: 'windows-app',
  getLabServer: () => ipcRenderer.invoke('lab-server:get'),
  setLabServer: (url) => ipcRenderer.invoke('lab-server:set', String(url)),
  checkForUpdate: () => ipcRenderer.invoke('update:check'),
  openReleasePage: (url) => ipcRenderer.invoke('update:open', String(url)),
  getUpdateCheck: () => ipcRenderer.invoke('update:get-setting'),
  setUpdateCheck: (on) => ipcRenderer.invoke('update:set-setting', on === true),
  journal: Object.freeze({
    begin: (meta, header) => ipcRenderer.invoke('journal:begin', meta, header),
    append: (id, batch) => ipcRenderer.invoke('journal:append', id, batch),
    finish: (id, status, endReason) => ipcRenderer.invoke('journal:finish', id, status, endReason),
    list: () => ipcRenderer.invoke('journal:list'),
    lines: (id) => ipcRenderer.invoke('journal:lines', id),
    remove: (id) => ipcRenderer.invoke('journal:remove', id),
    estimate: () => ipcRenderer.invoke('journal:estimate'),
  }),
  people: Object.freeze({
    status: () => ipcRenderer.invoke('people:status'),
    setup: (input) => ipcRenderer.invoke('people:setup', input),
    signIn: (username, password) => ipcRenderer.invoke('people:sign-in', String(username), String(password)),
    signOut: () => ipcRenderer.invoke('people:sign-out'),
    current: () => ipcRenderer.invoke('people:current'),
    touch: (busy) => ipcRenderer.invoke('people:touch', busy === true),
    changePassword: (oldPassword, newPassword) => ipcRenderer.invoke('people:change-password', String(oldPassword), String(newPassword)),
    list: () => ipcRenderer.invoke('people:list'),
    responsibleChoices: () => ipcRenderer.invoke('people:responsible-choices'),
    confirmResponsible: (id, password) => ipcRenderer.invoke('people:confirm-responsible', String(id), password == null ? '' : String(password)),
    add: (input) => ipcRenderer.invoke('people:add', input),
    update: (id, changes) => ipcRenderer.invoke('people:update', String(id), changes),
    recover: (code, newPassword) => ipcRenderer.invoke('people:recover', String(code), String(newPassword)),
    usageLog: () => ipcRenderer.invoke('people:usage-log'),
  }),
}));
