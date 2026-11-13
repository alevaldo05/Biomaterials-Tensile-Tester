/* Opening a recorded test (Load test). A session file saved by this app is rebuilt by replaying its lines through
   the same adapter and recorder as a live test; replaying sends nothing to any device. A CSV file is read with the
   shared CSV reader. Files marked as simulated are refused: this app is for recorded tests only. Nothing here can
   prove where an ordinary file came from, so imported files are labeled as not verified. */
import { DeviceSource, NdjsonAdapter, ReplayTransport } from '@tensile/acquisition';
import { recordFromCsv } from '@tensile/core';
import type { TestRecord, TestType } from '@tensile/core';
import { Recorder, sessionToTestRecord } from '@tensile/recording';
import type { Session } from '@tensile/recording';
import { APP_VERSION, parseSessionFile } from './controller';
import type { SessionFile } from './controller';
import { EMPTY_SETUP, paramsFrom } from './setup';
import type { Setup } from './setup';

export interface LoadedTest {
  name: string;
  kind: 'session' | 'csv';
  test: TestType;
  /** Null when the file holds no force and displacement in engineering units. */
  record: TestRecord | null;
  problem: string;
  setup: Setup | null;
  file: SessionFile | null;
  session: Session | null;
  /** How the data reached this screen, in plain words. */
  provenance: string;
  /** Text of the original file, so it can be downloaded unchanged. */
  original: string;
}

export const REJECT_SIMULATED = 'This file is marked as simulated data. The tester app opens recorded tests only; practice files open on the website’s Load Test page.';

/** Rebuilds a recorded test from its session file. Sends nothing to any device. */
export async function replaySession(file: SessionFile): Promise<{ session: Session; record: TestRecord | null; problem: string }> {
  const replay = new ReplayTransport({ lines: file.lines, auto: false });
  const source = new DeviceSource({ transport: replay, adapter: new NdjsonAdapter(), kind: 'replayed' });
  await source.connect();
  const recorder = new Recorder({ source, profile: file.profile, calibrations: file.calibrations, appVersion: APP_VERSION });
  await source.startStream();
  const session = recorder.start({ allowUncalibrated: true });
  replay.play(Number.MAX_SAFE_INTEGER);
  recorder.stop('Rebuilt from the session file.');
  await source.disconnect();
  recorder.dispose();
  const p = paramsFrom(file.setup, file.test), r = sessionToTestRecord(session, { test: file.test, specimen: p.specimen, params: p.params });
  return r.ok ? { session, record: r.record, problem: '' } : { session, record: null, problem: r.reason };
}

function detectTest(text: string): TestType {
  return /^﻿?#\s*Test\s*[,;\t]\s*Stress relaxation/im.test(text) || /^﻿?#\s*Test\s*[,;\t].*relax/im.test(text) ? 'relaxation' : 'uniaxial';
}

/** True when a "# Source" note line of a CSV says the data is simulated or sample data. It reads the line the way the
 *  shared CSV reader does (optional quotes, comma, semicolon, or tab), so a differently written note cannot slip past. */
export function markedNotRecorded(text: string): boolean {
  for (const raw of text.split(/\r?\n/)) {
    const t = raw.trim();
    if (!/^["']?#/.test(t)) continue;
    const body = t.replace(/^["']?#\s*/, '');
    /* "Source: simulated" is not read as a note by the shared reader, but it is still refused here */
    const colon = body.match(/^"?source"?\s*[:=]\s*(.*)$/i);
    const m = colon ? ['', 'source', colon[1] as string] : body.match(/^([^,;\t]*)[,;\t](.*)$/);
    if (!m) continue;
    if ((m[1] as string).replace(/"/g, '').trim().toLowerCase().indexOf('source') !== 0) continue;
    const val = (m[2] as string).replace(/[,;\t]+$/, '').trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
    if (/simul/i.test(val) || /^sample/i.test(val)) return true;
  }
  return false;
}

export async function openTestFile(name: string, text: string, testHint?: TestType): Promise<LoadedTest> {
  const trimmed = text.replace(/^﻿/, '').trimStart();
  if (trimmed.startsWith('{')) {
    const file = parseSessionFile(text);
    if (file.recordedFrom === 'simulated') throw new Error(REJECT_SIMULATED);
    /* a file marked real but carrying a simulated calibration is refused too: its force or displacement would not be measured */
    if (file.calibrations.some((c) => c.origin === 'simulated')) throw new Error(REJECT_SIMULATED);
    const r = await replaySession(file);
    return { name, kind: 'session', test: file.test, record: r.record, problem: r.problem, setup: { ...EMPTY_SETUP, ...file.setup }, file, session: r.session,
      provenance: 'Session file saved by this app (' + file.appVersion + '). Rebuilt from the lines the device sent; its origin is not independently verified.', original: text };
  }
  if (markedNotRecorded(trimmed)) throw new Error(REJECT_SIMULATED);
  const test = testHint ?? detectTest(text);
  const rec = recordFromCsv(name, text, test, { defaults: () => ({ specimen: { L0_mm: 0, width_mm: 0, thickness_mm: 0 } }) });
  if (rec.simulated) throw new Error(REJECT_SIMULATED);
  if (!rec.direct && !rec.dimsFromFile) {
    throw new Error('This CSV file has no specimen dimensions, so stress and strain cannot be calculated. Files saved by this app or the website’s test pages include them.');
  }
  return { name, kind: 'csv', test, record: rec, problem: '', setup: null, file: null, session: null,
    provenance: 'Imported CSV file. Its origin cannot be verified from the file; any unit conversions are those stated in its column headings.', original: text };
}
