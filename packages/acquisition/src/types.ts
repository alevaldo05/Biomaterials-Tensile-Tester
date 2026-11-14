/* The standard records and interfaces the rest of the app works with. Nothing here names a board, an ADC register,
   a pin, or a wire format: a device adapter turns whatever a device sends into these. */

/** Where the data comes from. Chosen by the person in the app, never taken from what a device says about itself. */
export type SourceKind = 'real' | 'simulated' | 'replayed';

export interface DeviceIdentity {
  deviceId: string;
  deviceType: string;
  softwareVersion: string;
  /** The wire format and version the adapter spoke, for example "tensile-ndjson/1". */
  protocol: string;
  /** Changes whenever the device restarts. */
  bootId: string;
}

export type Quantity = 'force' | 'displacement' | 'voltage';
export interface Channel {
  id: string;
  quantity: Quantity;
  mode: 'single-ended' | 'differential';
  input: string;
  encoding: string;
  label?: string;
}

/** The settings a device confirmed. A ref is never reused for different values. */
export interface AcquisitionSettings {
  ref: string;
  adc: string;
  bits: number;
  /** ± full-scale range of the ADC in millivolts. */
  fullScale_mV: number;
  /** Conversion rate of the ADC. Multiplexed channels share it. */
  dataRate_sps: number;
  /** The order the channels are converted in, one after another. */
  channelOrder: string[];
  i2cAddress?: number;
  filter?: string;
}

/** One conversion of one channel, as every part of the app above the adapter sees it. */
export interface StandardSample {
  sourceKind: SourceKind;
  deviceId: string;
  bootId: string;
  seq: number;
  channelId: string;
  /** Device time of the conversion, in seconds. */
  deviceTime_s: number;
  /** Computer time when the sample arrived (milliseconds), kept apart from the device time. */
  receivedAt_ms: number;
  /** The ADC result, unscaled. */
  raw: number;
  settingsRef: string;
  quality: string[];
}

export type SettingsChange = { fullScale_mV?: number; dataRate_sps?: number; channelOrder?: string[] };
/** Everything the app can ask an acquisition device to do. There is no motion request. */
export type AcquisitionRequest =
  | { type: 'identify' } | { type: 'get_channels' } | { type: 'get_settings' }
  | { type: 'set_settings'; settings: SettingsChange } | { type: 'start_stream' } | { type: 'stop_stream' };

export type AdapterEvent =
  | { kind: 'identity'; identity: DeviceIdentity; raw?: string }
  | { kind: 'channels'; channels: Channel[]; raw?: string }
  | { kind: 'settings'; settings: AcquisitionSettings; raw?: string }
  | { kind: 'sample'; sample: Omit<StandardSample, 'sourceKind' | 'deviceId' | 'receivedAt_ms'>; raw?: string }
  | { kind: 'status'; streaming: boolean; achieved_sps?: number; dropped?: number; raw?: string }
  | { kind: 'fault'; code: string; message: string; raw?: string }
  | { kind: 'ack'; raw?: string }
  | { kind: 'refused'; code: string; message: string; raw?: string }
  | { kind: 'rejected'; problem: 'not-json' | 'not-an-object' | 'unsupported-version' | 'invalid' | 'oversize'; detail: string };

/** Translates one device's messages into standard records, and acquisition requests into that device's bytes.
    To support a device with a different format, write another one of these; nothing above it changes. */
export interface DeviceAdapter {
  readonly protocol: string;
  receive(chunk: Uint8Array): AdapterEvent[];
  /** Forget any half-received message (the connection closed). */
  reset(): void;
  /** The bytes for a request, or null when this device needs nothing sent for it. */
  encode(request: AcquisitionRequest): Uint8Array | null;
}

export type DiagnosticCode =
  | 'unsupported-browser' | 'no-port-selected' | 'permission-denied' | 'port-in-use' | 'port-unavailable'
  | 'no-identification' | 'incompatible-protocol' | 'no-adc-response' | 'missing-channels'
  | 'device-reset' | 'disconnected' | 'invalid-data' | 'samples-lost' | 'request-refused' | 'device-fault';

export class TransportError extends Error {
  constructor(readonly code: DiagnosticCode, message: string) { super(message); this.name = 'TransportError'; }
}

/** Moves bytes. Knows nothing about what they mean. */
export interface Transport {
  /** A short name for the connection, for example "USB serial". */
  readonly label: string;
  open(): Promise<void>;
  close(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  onData(listener: (chunk: Uint8Array) => void): void;
  /** Called once when the connection ends; unexpected is true when nobody asked for it. */
  onClose(listener: (info: { unexpected: boolean; reason: string }) => void): void;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'identifying' | 'connected' | 'streaming' | 'stale' | 'fault';

export interface Diagnostic { code: DiagnosticCode; message: string; at_ms: number }
export interface Gap { channelIndependent: true; afterSeq: number; beforeSeq: number; missing: number; at_ms: number }

export interface SourceEvents {
  state: (state: ConnectionState, previous: ConnectionState) => void;
  sample: (sample: StandardSample) => void;
  gap: (gap: Gap) => void;
  diagnostic: (d: Diagnostic) => void;
  settings: (settings: AcquisitionSettings) => void;
  /** Every valid line received, for a replay log, with what the adapter read it as (so nobody has to match its text). */
  line: (line: string, receivedAt_ms: number, kind: AdapterEvent['kind']) => void;
}

/** The one interface the screens and the recorder use. They cannot tell an ESP32 from a Pico, a Raspberry Pi
    service, the simulator, or a replayed file, except through `kind`, which labels the data. */
export interface AcquisitionSource {
  readonly kind: SourceKind;
  readonly state: ConnectionState;
  readonly identity: DeviceIdentity | null;
  readonly channels: readonly Channel[];
  /** The settings in use now. */
  readonly settings: AcquisitionSettings | null;
  /** Every settings record seen in this connection, by ref. */
  settingsFor(ref: string): AcquisitionSettings | undefined;
  readonly diagnostics: readonly Diagnostic[];
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  startStream(): Promise<void>;
  stopStream(): Promise<void>;
  changeSettings(change: SettingsChange): Promise<AcquisitionSettings>;
  on<E extends keyof SourceEvents>(event: E, listener: SourceEvents[E]): () => void;
}
