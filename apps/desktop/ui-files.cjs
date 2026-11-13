'use strict';
/* Which file inside the bundled screens a request asks for, and its type. No Electron here, so it can be tested
   on its own. A request can never reach a file outside the ui folder. */
const path = require('node:path');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

/** The file for a request path such as "/assets/index-abc.js", or null when it is outside the ui folder or not allowed. */
function uiFile(uiDir, requestPath) {
  let p;
  try { p = decodeURIComponent(requestPath); } catch { return null; }
  if (p.includes('\0')) return null;
  if (p === '' || p === '/') p = '/index.html';
  const root = path.resolve(uiDir), full = path.resolve(root, '.' + path.posix.normalize('/' + p));
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  const type = TYPES[path.extname(full).toLowerCase()];
  return type ? { file: full, type } : null;
}

module.exports = { uiFile, TYPES };
