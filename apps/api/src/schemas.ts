/* What the API accepts. Everything from a browser is checked here at run time. */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,63}$/, 'Use 2 to 64 lowercase letters, digits, dots, dashes, or underscores.');
export const Username = z.string().regex(/^[a-z0-9][a-z0-9._-]{1,39}$/, 'Use 2 to 40 lowercase letters, digits, dots, dashes, or underscores.');
const shortText = (max: number) => z.string().max(max);

export const LoginBody = z.object({ username: z.string().max(80), password: z.string().max(200) });
export const PasswordBody = z.object({ current: z.string().max(200), next: z.string().max(200) });
export const NewUserBody = z.strictObject({ username: Username, displayName: shortText(80).default(''), role: z.enum(['admin', 'user']), password: z.string() });
export const UserPatch = z.strictObject({ displayName: shortText(80).optional(), role: z.enum(['admin', 'user']).optional(), disabled: z.boolean().optional(), password: z.string().optional() });

export const Conditioning = z.strictObject({ id: z.string().min(1).max(64), gain: z.number().finite().refine((g) => g !== 0, 'The gain cannot be 0.'), offset_V: z.number().finite() });
export const ProfileBody = z.strictObject({
  id, name: shortText(120).min(1),
  channels: z.record(z.string().min(1).max(64), z.strictObject({ conditioning: Conditioning })).refine((c) => Object.keys(c).length > 0 && Object.keys(c).length <= 16, 'List 1 to 16 channels.'),
  notes: shortText(2000).default(''),
});

export const SignalPath = z.strictObject({
  deviceType: z.string().min(1).max(64), adc: z.string().min(1).max(64), bits: z.number().int().min(8).max(32), fullScale_mV: z.number().positive(),
  mode: z.enum(['single-ended', 'differential']), input: z.string().min(1).max(64),
  conditioningId: z.string().min(1).max(64), conditioningGain: z.number().finite(), conditioningOffset_V: z.number().finite(),
});
export const CalibrationBody = z.strictObject({
  id, profileId: id, quantity: z.enum(['force', 'displacement']), unit: z.enum(['N', 'mm']),
  slope: z.number().finite().refine((s) => s !== 0, 'The slope cannot be 0.'), offset: z.number().finite(),
  signalPath: SignalPath, note: shortText(2000).default(''),
}).refine((c) => (c.quantity === 'force') === (c.unit === 'N'), 'Force is calibrated in N and displacement in mm.');

/* The setup fields a method carries (apps/tester/src/setup.ts, Setup without specimenId and notes). Nothing else is accepted,
   so a method can never carry a specimen's identity, notes, or anything the app does not know. Numbers stay text, as typed. */
const fieldText = z.string().max(200);
export const MethodFields = z.strictObject({
  material: fieldText, temperature: fieldText, environment: fieldText, L0: fieldText, width: fieldText, thickness: fieldText,
  speed: fieldText, holdMm: fieldText, holdS: fieldText, offsetOn: z.boolean(), offsetPct: fieldText,
}).partial();

/* A test method shared through the lab server (apps/tester/src/storage/methods.ts). Fields are the setup's text boxes and switches. */
export const MethodBody = z.strictObject({
  name: shortText(120).trim().min(1, 'Give the method a name.'),
  test: z.enum(['uniaxial', 'relaxation']),
  fields: MethodFields,
  instructions: shortText(4000).default(''),
  /** The method key this is a new revision of, and the revision it was made from (so two people changing it at once do not both win). */
  replaces: z.strictObject({ key: z.string().regex(/^lm-\d+$/), revision: z.number().int().min(1) }).optional(),
});

/* The session file the app saves (apps/tester/src/controller.ts, SessionFile). */
export const SessionFileBody = z.object({
  format: z.literal('tensile-tester-session'),
  version: z.literal(1),
  savedAt: z.string().max(40),
  appVersion: z.string().max(40),
  /* Older files may say "simulated"; the route refuses them with a clear message. */
  recordedFrom: z.enum(['real', 'simulated']),
  test: z.enum(['uniaxial', 'relaxation']),
  setup: z.record(z.string().max(40), z.union([z.string().max(2000), z.boolean()])),
  profile: z.unknown().nullable(),
  calibrations: z.array(z.object({ id: z.string().max(64), quantity: z.string().max(32).optional(), slope: z.number().optional(), offset: z.number().optional() }).passthrough()).max(16),
  lines: z.array(z.string().max(2048)).min(1).max(2_000_000),
  receivedAt_ms: z.array(z.number().finite()).max(2_000_000),
}).refine((f) => f.receivedAt_ms.length === f.lines.length, 'receivedAt_ms: there must be one arrival time for each line.');

/* What a device may send (packages/protocol/src/messages.ts). A saved line of any other type was not sent by a device. */
export const DEVICE_MESSAGE_TYPES = new Set(['hello', 'channels', 'settings', 'sample', 'status', 'fault', 'ack', 'error']);
export const UploadBody = z.strictObject({
  file: SessionFileBody,
  /** Key results as the app calculated them, for the list. The file itself is the record. */
  summary: z.record(z.string().max(40), z.number().finite().nullable()).refine((s) => Object.keys(s).length <= 24).default({}),
  notes: shortText(4000).default(''),
});

export function problem(e: z.ZodError): string {
  const i = e.issues[0];
  return i ? (i.path.length ? i.path.join('.') + ': ' : '') + i.message : 'The request is not valid.';
}
