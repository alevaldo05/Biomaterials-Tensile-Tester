/* The reference firmware's own code (firmware/esp32-ads1115/src: protocol, acquisition loop, ADS1115 driver), built
   for this computer with a pretend ADS1115, driven by the app's real connection, adapter, and recorder.
   This checks the two sides of the protocol against each other. It does not run on an ESP32 or touch hardware.
   Skipped when no C++ compiler is installed. */
import { execFileSync, spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DeviceSource, NdjsonAdapter } from '@tensile/acquisition';
import type { Transport } from '@tensile/acquisition';
import { parseDeviceMessage } from '@tensile/protocol';
import { createMachineControl, MOTION_OPERATIONS } from '@tensile/machine-control';
import { countsToVolts, Recorder, sessionToTestRecord, signalPathOf } from '../src/index';
import type { CalibrationRecord, DeviceProfile } from '../src/index';

const root = path.resolve(import.meta.dirname, '../../..');
const script = path.join(root, 'firmware/esp32-ads1115/test/host/build-and-test.sh');
const out = path.join(os.tmpdir(), 'tensile-firmware-host-' + process.pid);
let hasCompiler = true;
try { execFileSync('g++', ['--version'], { stdio: 'ignore' }); } catch { hasCompiler = false; }

/** The host build of the firmware as a transport: bytes to its stdin, its stdout back. Lines starting with "#" are
    test controls (see host_device.cpp) and never reach the app. */
class HostFirmware implements Transport {
  readonly label = 'firmware (host build)';
  readonly lines: string[] = [];
  writes = 0;
  private proc: ChildProcessWithoutNullStreams | null = null;
  private data: (c: Uint8Array) => void = () => undefined;
  private closed: (i: { unexpected: boolean; reason: string }) => void = () => undefined;
  private waiting: (() => void)[] = [];
  private text = '';
  onData(l: (c: Uint8Array) => void) { this.data = l; }
  onClose(l: (i: { unexpected: boolean; reason: string }) => void) { this.closed = l; }
  async open() {
    this.proc = spawn(path.join(out, 'host_device'));
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk: string) => {
      this.text += chunk;
      const parts = this.text.split('\n');
      this.text = parts.pop() ?? '';
      const keep: string[] = [];
      for (const l of parts) {
        if (l === '#done') { const w = this.waiting.shift(); w?.(); } else { keep.push(l); this.lines.push(l); }
      }
      if (keep.length) this.data(new TextEncoder().encode(keep.join('\n') + '\n'));
    });
  }
  async close() { this.proc?.stdin.end(); this.proc?.kill(); this.proc = null; this.closed({ unexpected: false, reason: 'closed' }); }
  write(bytes: Uint8Array): Promise<void> {
    this.writes++;
    return this.send(new TextDecoder().decode(bytes));
  }
  /** A test control: "#step N", "#adc off", "#full N", "#reboot". Resolves when the device has handled it. */
  control(line: string): Promise<void> { return this.send(line + '\n'); }
  private send(text: string): Promise<void> {
    return new Promise((resolve) => { this.waiting.push(resolve); this.proc!.stdin.write(text); });
  }
}

/* A made-up profile and calibration for the made-up board: conditioning gain 1 and 100 N per volt, 10 mm per volt. */
const profile: DeviceProfile = { id: 'host-test', name: 'Host test board', channels: { force: { conditioning: { id: 'none', gain: 1, offset_V: 0 } }, displacement: { conditioning: { id: 'none', gain: 1, offset_V: 0 } } } };
function calibrationsFor(source: DeviceSource): CalibrationRecord[] {
  return source.channels.map((ch) => ({
    id: 'test-' + ch.quantity, quantity: ch.quantity as 'force' | 'displacement', unit: ch.quantity === 'force' ? 'N' as const : 'mm' as const,
    slope: ch.quantity === 'force' ? 100 : 10, offset: 0, origin: 'measured' as const, createdAt: 'test',
    signalPath: signalPathOf(source.identity!, ch, source.settings!, profile.channels[ch.id]!.conditioning),
  }));
}

let fw: HostFirmware, source: DeviceSource;
async function connected() {
  fw = new HostFirmware();
  source = new DeviceSource({ transport: fw, adapter: new NdjsonAdapter(), kind: 'real', requiredQuantities: ['force', 'displacement'] });
  await source.connect();
  return new Recorder({ source, profile, calibrations: calibrationsFor(source), appVersion: 'test' });
}

describe.skipIf(!hasCompiler)('reference firmware code against the app', () => {
  beforeAll(() => { execFileSync('bash', [script, out], { stdio: 'pipe', env: { ...process.env, HOST_ONLY: '1' } }); }, 120_000);
  afterEach(async () => { await source?.disconnect(); });

  it('identifies itself, and every line it sends is accepted by the app', async () => {
    const recorder = await connected();
    expect(source.identity).toMatchObject({ deviceType: 'esp32-host-test', bootId: 'b0000001', protocol: 'tensile-ndjson/1' });
    expect(source.channels.map((c) => [c.id, c.quantity, c.mode, c.input])).toEqual([['force', 'force', 'single-ended', 'AIN0'], ['displacement', 'displacement', 'single-ended', 'AIN1']]);
    expect(source.settings).toMatchObject({ ref: 'b0000001-s1', adc: 'ads1115', bits: 16, i2cAddress: 72, fullScale_mV: 4096, dataRate_sps: 128 });
    expect(recorder.state()).toBe('ready');
    await source.startStream();
    await fw.control('#step 400');
    await source.stopStream();
    expect(fw.lines.length).toBeGreaterThan(400);
    for (const l of fw.lines) expect(parseDeviceMessage(l)).toMatchObject({ ok: true });
    expect(source.rejectedLines).toBe(0);
  });

  it('records raw counts that convert back to the input voltage, with the time of each conversion', async () => {
    const recorder = await connected();
    await source.startStream();
    const session = recorder.start();
    await fw.control('#step 2560');
    recorder.stop();
    const f = session.columns.force!, d = session.columns.displacement!;
    expect(f.raw.length).toBe(1280);
    expect(d.raw.length).toBe(1280);
    expect(session.missingSamples).toBe(0);
    const settings = source.settings!;
    for (let i = 0; i < f.raw.length; i += 97) {
      expect(countsToVolts(f.raw[i]!, settings)).toBeCloseTo(0.2 + 0.1 * f.deviceTime_s[i]!, 3);   /* the fake board's force input */
      expect(f.value[i]).toBeCloseTo(100 * (0.2 + 0.1 * f.deviceTime_s[i]!), 1);
    }
    for (let i = 1; i < f.deviceTime_s.length; i++) expect(f.deviceTime_s[i]!).toBeGreaterThan(f.deviceTime_s[i - 1]!);
    expect(f.deviceTime_s[0]).not.toBe(d.deviceTime_s[0]);   /* converted one after another, never at the same instant */
    const rate = (f.raw.length - 1) / (f.deviceTime_s.at(-1)! - f.deviceTime_s[0]!);
    expect(rate).toBeGreaterThan(55);
    expect(rate).toBeLessThanOrEqual(64);   /* two channels share 128 conversions per second, less the time spent asking */
    const built = sessionToTestRecord(session, { test: 'uniaxial', specimen: { L0_mm: 25, width_mm: 5, thickness_mm: 1.2 } });
    expect(built.ok).toBe(true);
  });

  it('changes settings with a new reference, refuses values the ADS1115 cannot do, and asks for a calibration review when the range changes', async () => {
    const recorder = await connected();
    const s2 = await source.changeSettings({ dataRate_sps: 250 });
    expect(s2).toMatchObject({ ref: 'b0000001-s2', dataRate_sps: 250 });
    await expect(source.changeSettings({ dataRate_sps: 100 })).rejects.toMatchObject({ code: 'request-refused' });
    await expect(source.changeSettings({ channelOrder: ['force', 'force'] })).rejects.toMatchObject({ code: 'request-refused' });
    expect(source.settings!.ref).toBe('b0000001-s2');
    expect(recorder.readiness().ready).toBe(true);
    await source.changeSettings({ fullScale_mV: 2048 });
    expect(recorder.readiness().ready).toBe(false);
    expect(recorder.readiness().channels.force.reasons.join(' ')).toContain('ADC input range changed');
  });

  it('reports samples it could not send, so the app records the gap', async () => {
    const recorder = await connected();
    await source.startStream();
    const session = recorder.start();
    await fw.control('#step 100');
    await fw.control('#full 7');
    await fw.control('#step 100');
    recorder.stop();
    expect(session.missingSamples).toBe(7);
    expect(session.gaps).toHaveLength(1);
  });

  it('ends the recording when the ADC stops answering, and when the board restarts', async () => {
    let recorder = await connected();
    await source.startStream();
    let session = recorder.start();
    await fw.control('#step 50');
    await fw.control('#adc off');
    await fw.control('#step 1');
    expect(source.state).toBe('fault');
    expect(session.interrupted).toBe(true);
    expect(source.diagnostics.at(-1)!.message).toContain('did not complete a conversion');
    await source.disconnect();

    recorder = await connected();
    await source.startStream();
    session = recorder.start();
    await fw.control('#step 50');
    await fw.control('#reboot');
    expect(source.state).toBe('fault');
    expect(session.events.some((e) => e.kind === 'device-reset')).toBe(true);
  });

  it('answers anything that is not an acquisition request with an error, and machine control sends it nothing', async () => {
    await connected();
    const before = fw.writes;
    for (const op of MOTION_OPERATIONS) expect((await createMachineControl({ motion: true }).request(op)).ok).toBe(false);
    expect(fw.writes).toBe(before);
    const n = fw.lines.length;
    for (const line of ['START', 'STOP', 'TARE', '{"v":1,"type":"move_to","id":"m1","position":5}', '{"v":1,"type":"start_stream","id":"m2","speed":5}', '{"v":2,"type":"identify","id":"m3"}']) await fw.control(line);
    const answers = fw.lines.slice(n).map((l) => JSON.parse(l) as { type: string; code: string });
    expect(answers.map((a) => a.type)).toEqual(['error', 'error', 'error', 'error', 'error', 'error']);
    expect(answers.map((a) => a.code)).toEqual(['bad_request', 'bad_request', 'bad_request', 'unknown_request', 'bad_request', 'unsupported_version']);
    expect(source.state).toBe('connected');   /* the stream was never started by any of them */
  });

  it("passes the firmware's own unit tests", () => {
    const text = execFileSync('bash', [script, out + '-unit'], { encoding: 'utf8' });
    expect(text).toMatch(/0 failed/);
    expect(fs.existsSync(path.join(out + '-unit', 'test_native'))).toBe(true);
  }, 120_000);
});
