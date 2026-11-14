'use strict';
/* Recordings kept as files on this computer by the Windows app (the app's data folder, "recordings"), behind the
   same journal interface the screens use in the browser (apps/tester/src/storage/journal.ts).
   Per recording: <id>.meta.json (rewritten whole, through a temporary file and a rename, so it is never half
   written) and <id>.lines.ndjson (append only; each batch is flushed to disk before the save is reported done).
   A line cut off by a crash or power loss is skipped when reading back; nothing is ever recreated.
   Everything the screens send is checked here. No Electron here, so it can be tested on its own. */
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const ID = /^s-[a-z0-9]{1,16}-[a-z0-9]{0,8}$/;
const LIMITS = { batchLines: 200000, lineLength: 4096, text: 2000, setupKeys: 40, jsonBytes: 65536, reason: 1000 };

function fail(msg) { throw new Error(msg); }
function checkId(id) { if (typeof id !== 'string' || !ID.test(id)) fail('Not a recording id.'); return id; }
function checkLines(batch) {
  if (!batch || !Array.isArray(batch.lines) || !Array.isArray(batch.receivedAt_ms)) fail('A batch needs lines and arrival times.');
  const { lines, receivedAt_ms: at } = batch;
  if (lines.length !== at.length) fail('There must be one arrival time for each line.');
  if (lines.length > LIMITS.batchLines) fail('Too many lines in one batch.');
  for (let i = 0; i < lines.length; i++) {
    if (typeof lines[i] !== 'string' || lines[i].length > LIMITS.lineLength || /[\r\n]/.test(lines[i])) fail('Line ' + (i + 1) + ' is not a single device line.');
    if (typeof at[i] !== 'number' || !Number.isFinite(at[i])) fail('Arrival time ' + (i + 1) + ' is not a number.');
  }
  return { lines, at };
}
const small = (v, what) => { if (Buffer.byteLength(JSON.stringify(v ?? null)) > LIMITS.jsonBytes) fail(what + ' is too large.'); return v; };
function checkMeta(m) {
  if (!m || typeof m !== 'object') fail('Missing recording details.');
  checkId(m.id);
  if (m.test !== 'uniaxial' && m.test !== 'relaxation') fail('Unknown test type.');
  if (!m.setup || typeof m.setup !== 'object' || Array.isArray(m.setup)) fail('Missing setup.');
  const keys = Object.keys(m.setup);
  if (keys.length > LIMITS.setupKeys) fail('Too many setup fields.');
  for (const k of keys) { const v = m.setup[k]; if (!(typeof v === 'boolean' || (typeof v === 'string' && v.length <= LIMITS.text))) fail('Setup field ' + k + ' is not text.'); }
  if (m.profile !== null && (typeof m.profile !== 'object' || Array.isArray(m.profile))) fail('The device profile is not valid.');
  if (!Array.isArray(m.calibrations) || m.calibrations.length > 16) fail('The calibrations are not valid.');
  for (const f of ['appVersion', 'deviceId', 'startedAt']) if (typeof m[f] !== 'string' || m[f].length > 200) fail('Missing ' + f + '.');
  if (m.forceZero_N !== undefined && !(typeof m.forceZero_N === 'number' && Number.isFinite(m.forceZero_N))) fail('The software baseline is not a number.');
  return {
    id: m.id, test: m.test, setup: { ...m.setup }, profile: small(m.profile, 'The device profile'), calibrations: small(m.calibrations, 'The calibrations'),
    ...(m.forceZero_N !== undefined ? { forceZero_N: m.forceZero_N } : {}),
    appVersion: m.appVersion, deviceId: m.deviceId, startedAt: m.startedAt,
  };
}

function createJournalFiles(dir) {
  const metaFile = (id) => path.join(dir, checkId(id) + '.meta.json');
  const linesFile = (id) => path.join(dir, checkId(id) + '.lines.ndjson');
  const queues = new Map();
  /* One write at a time per recording, in the order asked. */
  const serial = (id, f) => {
    const next = (queues.get(id) || Promise.resolve()).then(f, f);
    queues.set(id, next.catch(() => undefined));
    return next;
  };
  async function writeMeta(meta) {
    const file = metaFile(meta.id), tmp = file + '.tmp';
    const fh = await fsp.open(tmp, 'w');
    try { await fh.writeFile(JSON.stringify(meta)); await fh.sync(); } finally { await fh.close(); }
    await fsp.rename(tmp, file);
  }
  async function readMeta(id) {
    try { return JSON.parse(await fsp.readFile(metaFile(id), 'utf8')); } catch (e) { if (e && e.code === 'ENOENT') fail('No such recording.'); throw e; }
  }
  async function appendLines(id, lines, at) {
    if (!lines.length) return;
    const text = lines.map((l, i) => JSON.stringify([at[i], l])).join('\n') + '\n';
    const fh = await fsp.open(linesFile(id), 'a');
    try { await fh.writeFile(text); await fh.sync(); } finally { await fh.close(); }
  }
  const now = () => new Date().toISOString();

  return {
    dir,
    async begin(meta, header) {
      const m = checkMeta(meta), h = checkLines(header);
      return serial(m.id, async () => {
        await fsp.mkdir(dir, { recursive: true });
        if (fs.existsSync(metaFile(m.id))) fail('A recording with this id exists.');
        await fsp.writeFile(linesFile(m.id), '');
        await appendLines(m.id, h.lines, h.at);
        await writeMeta({ ...m, status: 'recording', lastCommitAt: now(), endedAt: null, endReason: '', sampleCount: 0 });
      });
    },
    async append(id, batch) {
      checkId(id);
      const b = checkLines(batch);
      return serial(id, async () => {
        const m = await readMeta(id);
        if (m.status !== 'recording') fail('This recording has ended.');
        await appendLines(id, b.lines, b.at);
        await writeMeta({ ...m, sampleCount: m.sampleCount + b.lines.length, lastCommitAt: now() });
      });
    },
    async finish(id, status, endReason) {
      checkId(id);
      if (status !== 'complete' && status !== 'interrupted') fail('Unknown status.');
      if (typeof endReason !== 'string' || endReason.length > LIMITS.reason) fail('The reason is not valid.');
      return serial(id, async () => { const m = await readMeta(id); await writeMeta({ ...m, status, endReason, endedAt: now() }); });
    },
    async list() {
      let names = [];
      try { names = await fsp.readdir(dir); } catch (e) { if (e && e.code === 'ENOENT') return []; throw e; }
      const out = [];
      for (const n of names) {
        const id = n.endsWith('.meta.json') ? n.slice(0, -'.meta.json'.length) : null;
        if (!id || !ID.test(id)) continue;
        try { out.push(JSON.parse(await fsp.readFile(path.join(dir, n), 'utf8'))); } catch { /* unreadable details: skipped */ }
      }
      return out.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    },
    async lines(id) {
      checkId(id);
      let text = '';
      try { text = await fsp.readFile(linesFile(id), 'utf8'); } catch (e) { if (e && e.code === 'ENOENT') fail('No such recording.'); throw e; }
      const lines = [], receivedAt_ms = [];
      for (const row of text.split('\n')) {
        if (!row) continue;
        let v;
        try { v = JSON.parse(row); } catch { continue; }   /* a line cut off by a crash */
        if (Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'string') { receivedAt_ms.push(v[0]); lines.push(v[1]); }
      }
      return { lines, receivedAt_ms };
    },
    async remove(id) {
      checkId(id);
      return serial(id, async () => {
        for (const f of [metaFile(id), linesFile(id), metaFile(id) + '.tmp']) await fsp.rm(f, { force: true });
      });
    },
    async estimate() {
      let usage = 0;
      try { for (const n of await fsp.readdir(dir)) usage += (await fsp.stat(path.join(dir, n))).size; } catch { /* no folder yet */ }
      try { const s = await fsp.statfs(fs.existsSync(dir) ? dir : path.dirname(dir)); return { usage, quota: usage + s.bavail * s.bsize }; } catch { return null; }
    },
  };
}

module.exports = { createJournalFiles, checkMeta, checkLines, ID };
