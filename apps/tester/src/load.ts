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

export async function openTestFile(name: string, text: string, testHint?: TestType): Promise<LoadedTest> {
  const trimmed = text.replace(/^﻿/, '').trimStart();
  if (trimmed.startsWith('{')) {
    const file = parseSessionFile(text);
    if (file.recordedFrom === 'simulated') throw new Error(REJECT_SIMULATED);
    const r = await replaySession(file);
    return { name, kind: 'session', test: file.test, record: r.record, problem: r.problem, setup: { ...EMPTY_SETUP, ...file.setup }, file, session: r.session,
      provenance: 'Session file saved by this app (' + file.appVersion + '). Rebuilt from the lines the device sent; its origin is not independently verified.', original: text };
  }
  if (/^#\s*Source\s*[,;\t]\s*(simulated|sample)/im.test(trimmed)) throw new Error(REJECT_SIMULATED);
  const test = testHint ?? detectTest(text);
  const rec = recordFromCsv(name, text, test, { defaults: () => ({ specimen: { L0_mm: 0, width_mm: 0, thickness_mm: 0 } }) });
  if (!rec.direct && !rec.dimsFromFile) {
    throw new Error('This CSV file has no specimen dimensions, so stress and strain cannot be calculated. Files saved by this app or the website’s test pages include them.');
  }
  return { name, kind: 'csv', test, record: rec, problem: '', setup: null, file: null, session: null,
    provenance: 'Imported CSV file. Its origin cannot be verified from the file; any unit conversions are those stated in its column headings.', original: text };
}
