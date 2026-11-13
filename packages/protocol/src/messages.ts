/* Acquisition protocol, version 1. This is the project's own format for talking to its own acquisition
   devices (an ESP32, a Pico, a Raspberry Pi service, the simulator). It is NOT a Shimadzu or AGS-J protocol,
   and it has no message that moves the machine. The written description is docs/app/PROTOCOL.md.

   Every message is one line of JSON ending in "\n", with "v" (protocol version) and "type".
   TypeScript types do not check what a device actually sends, so every incoming line goes through
   parseDeviceMessage, which checks it at run time. */
import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
/** Longest line accepted, in characters. A longer line is dropped and reported. */
export const MAX_LINE_LENGTH = 2048;

const id = z.string().min(1).max(64);
const text = z.string().max(200);
const count = z.number().int().nonnegative();

/** Who the device is. Sent in answer to "identify". USB names and IDs are not proof of identity; this exchange is. */
export const HelloMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('hello'),
  device_id: id,
  /** For example "esp32", "pico", "raspberry-pi-service". Free text: the app does not branch on it. */
  device_type: id,
  /** Firmware or service version. */
  sw_version: id,
  /** Changes every time the device starts, so a reset in the middle of a recording is noticed. */
  boot_id: id,
  /** Unit of the "t" field in samples. */
  time_unit: z.enum(['us', 'ms']),
});

export const ChannelInfo = z.object({
  id,
  /** What the channel is wired to measure. "voltage" when it is not assigned. */
  quantity: z.enum(['force', 'displacement', 'voltage']),
  mode: z.enum(['single-ended', 'differential']),
  /** The ADC input, for example "AIN0" or "AIN0-AIN1". */
  input: id,
  /** How "raw" in a sample is written. */
  encoding: z.enum(['int16', 'int24', 'int32']),
  label: text.optional(),
});
export const ChannelsMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('channels'),
  channels: z.array(ChannelInfo).min(1).max(16),
});

/** The acquisition settings the device confirms it is using. A new settings_ref is issued whenever any value changes,
    and a settings_ref is never reused for different values, so a sample can always be interpreted later. */
export const AdcSettings = z.object({
  settings_ref: id,
  /** ADC model, for example "ads1115". */
  adc: id,
  bits: z.number().int().min(8).max(32),
  i2c_address: z.number().int().min(0).max(127).optional(),
  /** Programmable full-scale range in millivolts (± this value). A wider range does not allow a higher pin voltage. */
  full_scale_mv: z.number().positive(),
  /** Conversion rate of the ADC in samples per second. The channels share it; it is not a per-channel rate. */
  data_rate_sps: z.number().positive(),
  /** Channel ids in the order they are converted, one after another (the inputs are multiplexed). */
  channel_order: z.array(id).min(1).max(16),
  filter: text.optional(),
});
export const SettingsMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('settings'),
  confirmed: AdcSettings,
});

export const QualityFlag = z.enum(['overrange', 'adc_timeout', 'adc_error', 'late', 'estimated_time']);
/** One conversion of one channel. Force and displacement are separate samples with their own times. */
export const SampleMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('sample'),
  boot_id: id,
  /** Counts up by 1 for every sample sent since the stream started; a jump means samples were lost. */
  seq: count,
  /** Device time of this conversion, in the hello message's time_unit. */
  t: z.number().nonnegative(),
  ch: id,
  /** The ADC result as an integer, unscaled. */
  raw: z.number().int(),
  /** The settings_ref the conversion was made with. */
  ref: id,
  q: z.array(QualityFlag).max(8).optional(),
});

export const StatusMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('status'),
  state: z.enum(['idle', 'streaming']),
  /** Samples per second actually achieved over the last reporting period, all channels together. */
  achieved_sps: z.number().nonnegative().optional(),
  dropped: count.optional(),
});
export const FaultMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('fault'),
  code: z.enum(['adc_not_responding', 'adc_error', 'buffer_overflow', 'settings_invalid', 'internal']),
  message: text,
});
export const AckMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('ack'),
  /** The id of the request being answered. */
  id,
});
export const ErrorMessage = z.object({
  v: z.literal(PROTOCOL_VERSION),
  type: z.literal('error'),
  id: id.optional(),
  code: z.enum(['unknown_request', 'bad_request', 'unsupported_version', 'not_allowed', 'busy']),
  message: text,
});

export const DeviceMessage = z.discriminatedUnion('type', [
  HelloMessage, ChannelsMessage, SettingsMessage, SampleMessage, StatusMessage, FaultMessage, AckMessage, ErrorMessage,
]);
export type HelloMessage = z.infer<typeof HelloMessage>;
export type ChannelInfo = z.infer<typeof ChannelInfo>;
export type ChannelsMessage = z.infer<typeof ChannelsMessage>;
export type AdcSettings = z.infer<typeof AdcSettings>;
export type SettingsMessage = z.infer<typeof SettingsMessage>;
export type SampleMessage = z.infer<typeof SampleMessage>;
export type StatusMessage = z.infer<typeof StatusMessage>;
export type FaultMessage = z.infer<typeof FaultMessage>;
export type DeviceMessage = z.infer<typeof DeviceMessage>;

/* ---------- requests the app may send. There are only acquisition requests: nothing here moves the machine. ---------- */

export const SettingsRequest = z.object({
  full_scale_mv: z.number().positive().optional(),
  data_rate_sps: z.number().positive().optional(),
  channel_order: z.array(id).min(1).max(16).optional(),
});
export const AppRequest = z.discriminatedUnion('type', [
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('identify'), id }),
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('get_channels'), id }),
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('get_settings'), id }),
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('set_settings'), id, settings: SettingsRequest }),
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('start_stream'), id }),
  z.strictObject({ v: z.literal(PROTOCOL_VERSION), type: z.literal('stop_stream'), id }),
]);
export type AppRequest = z.infer<typeof AppRequest>;
export type AppRequestType = AppRequest['type'];
export const APP_REQUEST_TYPES: readonly AppRequestType[] = ['identify', 'get_channels', 'get_settings', 'set_settings', 'start_stream', 'stop_stream'];

export type ParseResult =
  | { ok: true; message: DeviceMessage }
  | { ok: false; problem: 'not-json' | 'not-an-object' | 'unsupported-version' | 'invalid'; detail: string; version?: unknown };

/** Checks one received line. Never throws. */
export function parseDeviceMessage(line: string): ParseResult {
  let data: unknown;
  try { data = JSON.parse(line); } catch { return { ok: false, problem: 'not-json', detail: 'The line is not JSON.' }; }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return { ok: false, problem: 'not-an-object', detail: 'The line is not a JSON object.' };
  const v = (data as { v?: unknown }).v;
  if (v !== PROTOCOL_VERSION) return { ok: false, problem: 'unsupported-version', detail: 'Protocol version ' + JSON.stringify(v) + ' is not supported (this app speaks version ' + PROTOCOL_VERSION + ').', version: v };
  const r = DeviceMessage.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    return { ok: false, problem: 'invalid', detail: first ? (first.path.join('.') || 'message') + ': ' + first.message : 'The message has the wrong shape.' };
  }
  return { ok: true, message: r.data };
}

/** Turns a request into the line to send. Throws if it is not one of the acquisition requests, so nothing else can be sent. */
export function encodeRequest(request: AppRequest): string {
  const r = AppRequest.safeParse(request);
  if (!r.success) throw new Error('Not an acquisition request; nothing was sent.');
  return JSON.stringify(r.data) + '\n';
}
