/* Adapter for the project's own protocol (version 1, one JSON message per line). The ESP32 reference firmware,
   a Pico, a Raspberry Pi service, and the simulator all speak it, so they share this adapter. */
import { encodeRequest, LineFramer, parseDeviceMessage, PROTOCOL_VERSION } from '@tensile/protocol';
import type { AppRequest, DeviceMessage } from '@tensile/protocol';
import type { AcquisitionRequest, AdapterEvent, DeviceAdapter } from '../types';

export class NdjsonAdapter implements DeviceAdapter {
  readonly protocol = 'tensile-ndjson/' + PROTOCOL_VERSION;
  private framer = new LineFramer();
  private decoder = new TextDecoder('utf-8');
  private encoder = new TextEncoder();
  private timeScale = 1e-6;
  private nextId = 1;

  receive(chunk: Uint8Array): AdapterEvent[] {
    const out: AdapterEvent[] = [];
    for (const f of this.framer.push(this.decoder.decode(chunk, { stream: true }))) {
      if ('oversize' in f) { out.push({ kind: 'rejected', problem: 'oversize', detail: 'A line of ' + f.length + ' characters was dropped (too long).' }); continue; }
      const r = parseDeviceMessage(f.line);
      if (!r.ok) { out.push({ kind: 'rejected', problem: r.problem, detail: r.detail }); continue; }
      out.push(this.translate(r.message, f.line));
    }
    return out;
  }

  private translate(m: DeviceMessage, raw: string): AdapterEvent {
    switch (m.type) {
      case 'hello':
        this.timeScale = m.time_unit === 'ms' ? 1e-3 : 1e-6;
        return { kind: 'identity', raw, identity: { deviceId: m.device_id, deviceType: m.device_type, softwareVersion: m.sw_version, protocol: this.protocol, bootId: m.boot_id } };
      case 'channels':
        return { kind: 'channels', raw, channels: m.channels.map((c) => ({ id: c.id, quantity: c.quantity, mode: c.mode, input: c.input, encoding: c.encoding, ...(c.label ? { label: c.label } : {}) })) };
      case 'settings': {
        const s = m.confirmed;
        return { kind: 'settings', raw, settings: { ref: s.settings_ref, adc: s.adc, bits: s.bits, fullScale_mV: s.full_scale_mv, dataRate_sps: s.data_rate_sps, channelOrder: s.channel_order,
          ...(s.i2c_address !== undefined ? { i2cAddress: s.i2c_address } : {}), ...(s.filter ? { filter: s.filter } : {}) } };
      }
      case 'sample':
        return { kind: 'sample', raw, sample: { bootId: m.boot_id, seq: m.seq, channelId: m.ch, deviceTime_s: m.t * this.timeScale, raw: m.raw, settingsRef: m.ref, quality: m.q ?? [] } };
      case 'status':
        return { kind: 'status', raw, streaming: m.state === 'streaming', ...(m.achieved_sps !== undefined ? { achieved_sps: m.achieved_sps } : {}), ...(m.dropped !== undefined ? { dropped: m.dropped } : {}) };
      case 'fault': return { kind: 'fault', raw, code: m.code, message: m.message };
      case 'ack': return { kind: 'ack', raw };
      case 'error': return { kind: 'refused', raw, code: m.code, message: m.message };
    }
  }

  reset(): void { this.framer.reset(); this.decoder = new TextDecoder('utf-8'); }

  encode(request: AcquisitionRequest): Uint8Array {
    const id = 'r' + this.nextId++;
    const wire: AppRequest = request.type === 'set_settings'
      ? { v: PROTOCOL_VERSION, type: 'set_settings', id, settings: {
          ...(request.settings.fullScale_mV !== undefined ? { full_scale_mv: request.settings.fullScale_mV } : {}),
          ...(request.settings.dataRate_sps !== undefined ? { data_rate_sps: request.settings.dataRate_sps } : {}),
          ...(request.settings.channelOrder !== undefined ? { channel_order: request.settings.channelOrder } : {}) } }
      : { v: PROTOCOL_VERSION, type: request.type, id };
    return this.encoder.encode(encodeRequest(wire));
  }
}
