'use strict';
/* The only thing the Windows app gives its screens: a fixed label saying they run inside it.
   No Node, no file access, no messages to the main process. Anything added here must be reviewed. */
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('tensileDesktop', Object.freeze({ kind: 'windows-app' }));
