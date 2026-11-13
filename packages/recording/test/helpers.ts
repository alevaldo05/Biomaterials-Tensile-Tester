import { DeviceSource, NdjsonAdapter, SimulatedDevice } from '@tensile/acquisition';
import type { AcquisitionSource, SimulatorOptions } from '@tensile/acquisition';
import { analyzeUniaxial } from '@tensile/core';
import type { Specimen } from '@tensile/core';
import { Recorder, sessionToTestRecord, simulatedCalibrations, simulatedProfile } from '../src/index';

export const SPECIMEN: Specimen = { L0_mm: 25, width_mm: 5, thickness_mm: 1.2 };

export function clock() { let t = 1_000_000; return () => (t += 1); }

export function simulated(o: SimulatorOptions = {}) {
  const device = new SimulatedDevice({ auto: false, ...o });
  const source = new DeviceSource({ transport: device, adapter: new NdjsonAdapter(), kind: 'simulated', now: clock(), requiredQuantities: ['force', 'displacement'] });
  return { device, source };
}

/** The experiment code: it is given a source and a way to make it produce data, and nothing else.
    It is the same for every device type, transport, and adapter. */
export async function runUniaxial(source: AcquisitionSource, produce: () => void, replayOfSimulator = false) {
  await source.connect();
  const recorder = new Recorder({ source, profile: simulatedProfile(), calibrations: simulatedCalibrations(source, undefined, replayOfSimulator), appVersion: 'test' });
  await source.startStream();
  const session = recorder.start();
  produce();
  recorder.stop();
  await source.stopStream();
  const built = sessionToTestRecord(session, { test: 'uniaxial', specimen: SPECIMEN });
  if (!built.ok) throw new Error(built.reason);
  return { recorder, session, record: built.record, analysis: analyzeUniaxial(built.record)! };
}
