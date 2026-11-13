/* The app's link to the lab back end (/api/v1 on the same address the app is served from). Optional: when it is not
   reachable, tests still record and download; only signing in, history, saving to the lab, and admin wait for it.
   Nothing is sent until the person signs in, except a health check. */
import type { CalibrationRecord, DeviceProfile, SignalPath } from '@tensile/recording';
import type { TestMethod } from './storage/methods';
import type { SessionFile, SetupFile } from './controller';
import { parseSetupFile } from './controller';

export type Role = 'admin' | 'user';
export interface LabUser { id: string; username: string; displayName: string; role: Role; mustChangePassword: boolean }
export interface UserRow extends LabUser { disabled: boolean; createdAt: string }
export interface ProfileRow { id: string; name: string; channels: DeviceProfile['channels']; notes: string; updatedAt: string }
export interface CalibrationRow {
  id: string; profileId: string; quantity: 'force' | 'displacement'; unit: 'N' | 'mm'; slope: number; offset: number; signalPath: SignalPath;
  origin: 'measured'; status: 'draft' | 'approved' | 'retired'; note: string; createdAt: string; approvedAt: string | null; approvedBy: string | null; createdBy: string | null;
}
export interface SessionRow {
  id: string; owner: string; testType: 'uniaxial' | 'relaxation'; recordedFrom: 'real' | 'simulated'; data: string;
  material: string; specimenId: string; deviceId: string; deviceType: string; deviceSoftware: string; appVersion: string;
  calibrationIds: string[]; sampleCount: number; startedAt: string | null; savedAt: string; summary: Record<string, number | null>; notes: string;
}
export interface AuditRow { id: string; at: string; action: string; detail: Record<string, unknown>; username: string | null }

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); this.name = 'ApiError'; }
}

export class LabApi {
  constructor(private readonly base = '/api/v1') {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        method, credentials: 'same-origin',
        headers: { 'x-tensile-client': 'app', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError(0, 'unreachable', 'The lab database is not reachable from this computer. Tests can still be recorded and downloaded.');
    }
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* not JSON: for example a page from a web server with no API behind it */ }
    if (!res.ok || data === null) {
      const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
      if (!e) throw new ApiError(res.status, 'unreachable', 'The lab database is not reachable from this computer. Tests can still be recorded and downloaded.');
      throw new ApiError(res.status, e.code ?? 'error', e.message ?? 'The request failed.');
    }
    return data as T;
  }

  health = () => this.call<{ ok: boolean; database: 'up' | 'down' }>('GET', '/health');
  me = () => this.call<{ user: LabUser }>('GET', '/auth/me').then((r) => r.user);
  login = (username: string, password: string) => this.call<{ user: LabUser }>('POST', '/auth/login', { username, password }).then((r) => r.user);
  logout = () => this.call<{ ok: true }>('POST', '/auth/logout', {});
  changePassword = (current: string, next: string) => this.call<{ ok: true }>('POST', '/auth/password', { current, next });

  sessions = (owner?: string) => this.call<{ sessions: SessionRow[] }>('GET', '/test-sessions' + (owner ? '?owner=' + encodeURIComponent(owner) : '')).then((r) => r.sessions);
  sessionFileText = async (id: string): Promise<string> => {
    const res = await fetch(this.base + '/test-sessions/' + encodeURIComponent(id) + '/file', { credentials: 'same-origin' });
    if (!res.ok) throw new ApiError(res.status, 'error', 'The file could not be fetched.');
    return res.text();
  };
  saveSession = (file: SessionFile, summary: Record<string, number | null>, notes: string) =>
    this.call<{ id: string; sampleCount: number }>('POST', '/test-sessions', { file, summary, notes });

  methods = () => this.call<{ methods: TestMethod[] }>('GET', '/methods').then((r) => r.methods);
  saveMethod = (m: Omit<TestMethod, 'id' | 'revision' | 'createdAt' | 'archived'>, replaces?: TestMethod) =>
    this.call<{ method: TestMethod }>('POST', '/methods', { name: m.name, test: m.test, fields: m.fields, instructions: m.instructions,
      ...(replaces ? { replaces: { key: replaces.id, revision: replaces.revision } } : {}) }).then((r) => r.method);
  archiveMethod = (key: string) => this.call<{ ok: true }>('POST', '/methods/' + encodeURIComponent(key) + '/archive', {}).then(() => undefined);

  profiles = () => this.call<{ profiles: ProfileRow[] }>('GET', '/device-profiles').then((r) => r.profiles);
  createProfile = (p: { id: string; name: string; channels: DeviceProfile['channels']; notes: string }) => this.call<{ profile: ProfileRow }>('POST', '/device-profiles', p);
  /** The profile and its approved calibrations, checked the same way as a setup file chosen from disk. */
  setupFile = async (profileId: string): Promise<SetupFile> => parseSetupFile(JSON.stringify(await this.call<unknown>('GET', '/setup-files/' + encodeURIComponent(profileId))));
  calibrations = (profileId?: string) => this.call<{ calibrations: CalibrationRow[] }>('GET', '/calibrations' + (profileId ? '?profile=' + encodeURIComponent(profileId) : '')).then((r) => r.calibrations);
  createCalibration = (c: Omit<CalibrationRecord, 'origin' | 'createdAt'> & { profileId: string; note: string }) =>
    this.call<{ calibration: CalibrationRow }>('POST', '/calibrations', { id: c.id, profileId: c.profileId, quantity: c.quantity, unit: c.unit, slope: c.slope, offset: c.offset, signalPath: c.signalPath, note: c.note });
  approveCalibration = (id: string) => this.call<{ calibration: CalibrationRow }>('POST', '/calibrations/' + encodeURIComponent(id) + '/approve', {});
  retireCalibration = (id: string) => this.call<{ calibration: CalibrationRow }>('POST', '/calibrations/' + encodeURIComponent(id) + '/retire', {});

  users = () => this.call<{ users: UserRow[] }>('GET', '/users').then((r) => r.users);
  createUser = (u: { username: string; displayName: string; role: Role; password: string }) => this.call<{ user: UserRow }>('POST', '/users', u);
  updateUser = (id: string, patch: { displayName?: string; role?: Role; disabled?: boolean; password?: string }) => this.call<{ user: UserRow }>('PATCH', '/users/' + encodeURIComponent(id), patch);
  audit = () => this.call<{ entries: AuditRow[] }>('GET', '/audit').then((r) => r.entries);
}

/** What the screens need to know about the person and the back end. */
export interface Account {
  api: LabApi;
  /** null while checking. */
  reachable: boolean | null;
  user: LabUser | null;
  /** An admin looking at the user screens. Changes what this screen shows, never what the server allows. */
  viewAsUser: boolean;
  /** The role the screens act on. */
  effectiveRole: Role | null;
}
