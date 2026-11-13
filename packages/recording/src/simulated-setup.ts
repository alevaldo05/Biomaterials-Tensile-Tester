/* The profile and calibration that go with the simulator. The numbers are the simulator's own made-up signal
   scaling; they are marked "simulated" and are refused for a real device. */
import { SIMULATED_SIGNAL } from '@tensile/acquisition';
import type { AcquisitionSource, SimulatedSignal } from '@tensile/acquisition';
import { signalPathOf } from './conversion';
import type { CalibrationRecord, DeviceProfile } from './conversion';

export function simulatedProfile(signal: SimulatedSignal = SIMULATED_SIGNAL): DeviceProfile {
  const conditioning = { id: 'simulated-divider', gain: signal.conditioningGain, offset_V: 0 };
  return { id: 'simulator', name: 'Simulator (made-up signal scaling)', channels: { force: { conditioning }, displacement: { conditioning } } };
}

/** Calibration records for a connected simulator, tied to its current settings. Empty for a real device.
    For a replay, pass replayOfSimulator only when the replayed log was recorded from the simulator. */
export function simulatedCalibrations(source: AcquisitionSource, signal: SimulatedSignal = SIMULATED_SIGNAL, replayOfSimulator = false): CalibrationRecord[] {
  const id = source.identity, settings = source.settings, profile = simulatedProfile(signal);
  if (!(source.kind === 'simulated' || (source.kind === 'replayed' && replayOfSimulator)) || !id || !settings) return [];
  const out: CalibrationRecord[] = [];
  for (const ch of source.channels) {
    if (ch.quantity === 'voltage') continue;
    const c = profile.channels[ch.id];
    if (!c) continue;
    out.push({
      id: 'simulated-' + ch.quantity, quantity: ch.quantity, unit: ch.quantity === 'force' ? 'N' : 'mm',
      slope: 1 / (ch.quantity === 'force' ? signal.volts_per_N : signal.volts_per_mm), offset: 0,
      signalPath: signalPathOf(id, ch, settings, c.conditioning), origin: 'simulated', createdAt: 'simulated', note: 'Made up for the simulator. Not a calibration of any real equipment.',
    });
  }
  return out;
}
