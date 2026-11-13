/* From an ADC result to a physical value, in three separate steps. Each step is done in exactly one place, so no
   factor can be applied twice:

   1. ADC conversion       counts -> volts at the ADC input        from the settings the device confirmed
   2. input conditioning   volts at the ADC -> volts at the machine's output   from the device profile (the reviewed circuit)
   3. physical calibration volts at the machine's output -> N or mm           from a calibration record

   The device sends counts only. A voltage is never assumed to mean a force: without a compatible calibration
   record the value stays in volts and is labeled uncalibrated. */
import type { AcquisitionSettings, Channel, DeviceIdentity, Quantity, SourceKind } from '@tensile/acquisition';

/** Step 1. Volts at the ADC input for a signed result. */
export function countsToVolts(raw: number, settings: Pick<AcquisitionSettings, 'bits' | 'fullScale_mV'>): number {
  return (raw * (settings.fullScale_mV / 1000)) / 2 ** (settings.bits - 1);
}

/** The conditioning circuit between the machine's output and one ADC input, as built and reviewed. */
export interface Conditioning {
  /** A name for the circuit revision, so a changed circuit is noticed. */
  id: string;
  /** Volts at the ADC input per volt at the machine's output (for a divider, less than 1). */
  gain: number;
  offset_V: number;
}
/** Documented connection and measurement settings for one setup. A profile cannot enable motion or skip a check. */
export interface DeviceProfile {
  id: string;
  name: string;
  channels: Record<string, { conditioning: Conditioning }>;
}

/** Step 2. Volts at the machine's output. */
export function adcToSignalVolts(volts: number, c: Conditioning): number {
  return (volts - c.offset_V) / c.gain;
}

/** Everything between the machine and the number: if any part changes, an old calibration must be reviewed. */
export interface SignalPath {
  deviceType: string;
  adc: string;
  bits: number;
  fullScale_mV: number;
  mode: string;
  input: string;
  conditioningId: string;
  conditioningGain: number;
  conditioningOffset_V: number;
}
export function signalPathOf(identity: DeviceIdentity, channel: Channel, settings: AcquisitionSettings, conditioning: Conditioning): SignalPath {
  return { deviceType: identity.deviceType, adc: settings.adc, bits: settings.bits, fullScale_mV: settings.fullScale_mV, mode: channel.mode, input: channel.input,
    conditioningId: conditioning.id, conditioningGain: conditioning.gain, conditioningOffset_V: conditioning.offset_V };
}

export interface CalibrationRecord {
  id: string;
  quantity: Exclude<Quantity, 'voltage'>;
  unit: 'N' | 'mm';
  /** Physical units per volt at the machine's output, and the value at 0 V. */
  slope: number;
  offset: number;
  /** The signal path the calibration was made with. */
  signalPath: SignalPath;
  /** A calibration made up for the simulator can only be used with the simulator. */
  origin: 'measured' | 'simulated';
  createdAt: string;
  note?: string;
}

const PATH_LABELS: Record<keyof SignalPath, string> = {
  deviceType: 'device type', adc: 'ADC', bits: 'ADC resolution', fullScale_mV: 'ADC input range', mode: 'measurement mode', input: 'ADC input',
  conditioningId: 'conditioning circuit', conditioningGain: 'conditioning gain', conditioningOffset_V: 'conditioning offset',
};

export interface Compatibility { compatible: boolean; reasons: string[] }
/** A calibration is reused only when the whole signal path is the same. The same channel name is not enough. */
export function calibrationCompatibility(cal: CalibrationRecord, path: SignalPath, sourceKind: SourceKind): Compatibility {
  const reasons: string[] = [];
  if (cal.origin === 'simulated' && sourceKind === 'real') reasons.push('The calibration was made up for the simulator and cannot be used with a real device.');
  if (cal.origin === 'measured' && sourceKind === 'simulated') reasons.push('The calibration belongs to a real setup and is not used with the simulator.');
  for (const k of Object.keys(PATH_LABELS) as (keyof SignalPath)[]) {
    if (cal.signalPath[k] !== path[k]) reasons.push('The ' + PATH_LABELS[k] + ' changed (' + cal.signalPath[k] + ' when calibrated, ' + path[k] + ' now).');
  }
  return { compatible: reasons.length === 0, reasons };
}

/** Step 3. */
export function signalVoltsToPhysical(volts: number, cal: Pick<CalibrationRecord, 'slope' | 'offset'>): number {
  return cal.slope * volts + cal.offset;
}

export interface Converted {
  volts_adc: number;
  /** Null when the profile has no conditioning for the channel. */
  volts_signal: number | null;
  /** Null when there is no compatible calibration: the value is then unavailable, not zero. */
  value: number | null;
  unit: 'N' | 'mm' | null;
}
export function convert(raw: number, settings: AcquisitionSettings, conditioning: Conditioning | undefined, cal: CalibrationRecord | undefined): Converted {
  const volts_adc = countsToVolts(raw, settings);
  const volts_signal = conditioning ? adcToSignalVolts(volts_adc, conditioning) : null;
  const value = cal && volts_signal !== null ? signalVoltsToPhysical(volts_signal, cal) : null;
  return { volts_adc, volts_signal, value, unit: value === null ? null : (cal as CalibrationRecord).unit };
}
