/* A pretend acquisition board for tests, posing as the real device behind the app's USB connection,
   and a setup file whose calibration is marked "measured" so the app treats it like a real setup.
   Test fixtures only: nothing under apps/tester/src imports the simulator. */
import { SIMULATED_SIGNAL, SimulatedDevice, simulatedRelaxation, simulatedUniaxial } from '@tensile/acquisition';
import { signalPathOf, simulatedProfile } from '@tensile/recording';
import type { CalibrationRecord } from '@tensile/recording';
import { MemoryJournal } from '../src/storage/journal';
import { TestController } from '../src/controller';
import type { SetupFile } from '../src/controller';
import { EXAMPLE_DIMENSIONS } from '../src/setup';

export function rig(o: { journal?: MemoryJournal | null } = {}) {
  const dev = new SimulatedDevice({ manualMotion: true, auto: false });
  const c = new TestController({ openReal: () => dev, journal: o.journal ?? null, commitEvery_ms: 0 });
  return { dev, c };
}

export function ready(c: TestController) {
  c.setup = { ...c.setup, material: 'Test', ...EXAMPLE_DIMENSIONS, speed: '30' };
}

/** A setup file for the connected stand-in device: its profile and calibration, marked as made on real equipment. */
export function measuredSetup(c: TestController): SetupFile {
  const src = c.source!, profile = { ...simulatedProfile(), id: 'test-rig', name: 'Test rig' };
  const calibrations: CalibrationRecord[] = src.channels.filter((ch) => ch.quantity !== 'voltage').map((ch) => ({
    id: 'cal-' + ch.quantity, quantity: ch.quantity as 'force' | 'displacement', unit: ch.quantity === 'force' ? 'N' : 'mm',
    slope: 1 / (ch.quantity === 'force' ? SIMULATED_SIGNAL.volts_per_N : SIMULATED_SIGNAL.volts_per_mm), offset: 0,
    signalPath: signalPathOf(src.identity!, ch, src.settings!, profile.channels[ch.id]!.conditioning), origin: 'measured', createdAt: '2026-01-01',
  }));
  return { profile, calibrations };
}

/** Moves the stand-in's pretend crosshead. On a real tester the operator starts it from the tester's own controller. */
export function move(dev: SimulatedDevice, c: TestController) {
  const area = Number(c.setup.width) * Number(c.setup.thickness);
  dev.beginMotion(c.test === 'relaxation'
    ? simulatedRelaxation({ speed_mm_min: 30, hold_mm: Number(c.setup.holdMm), area_mm2: area })
    : simulatedUniaxial({ speed_mm_min: 30, gauge_mm: Number(c.setup.L0), area_mm2: area }));
}
