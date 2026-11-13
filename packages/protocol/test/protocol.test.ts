import { describe, expect, it } from 'vitest';
import { encodeRequest, LineFramer, MAX_LINE_LENGTH, parseDeviceMessage } from '../src/index';
import type { AppRequest } from '../src/index';

const sample = { v: 1, type: 'sample', boot_id: 'b1', seq: 7, t: 123456, ch: 'force', raw: -1200, ref: 's1' };
const lines = (f: LineFramer, ...chunks: string[]) => chunks.flatMap((c) => f.push(c));

describe('line framer', () => {
  it('rebuilds a message that arrives in pieces', () => {
    const f = new LineFramer(), text = JSON.stringify(sample) + '\n';
    for (let cut = 1; cut < text.length; cut++) {
      const got = lines(new LineFramer(), text.slice(0, cut), text.slice(cut));
      expect(got).toEqual([{ line: JSON.stringify(sample) }]);
    }
    const oneByOne = text.split('').flatMap((c) => f.push(c));
    expect(oneByOne).toEqual([{ line: JSON.stringify(sample) }]);
  });
  it('splits several messages that arrive in one read, and keeps the unfinished tail', () => {
    const f = new LineFramer();
    expect(f.push('{"a":1}\n{"b":2}\r\n\r\n{"c"')).toEqual([{ line: '{"a":1}' }, { line: '{"b":2}' }]);
    expect(f.pending).toBe(4);
    expect(f.push(':3}\n')).toEqual([{ line: '{"c":3}' }]);
  });
  it('drops an oversized line, reports it, and recovers on the next line', () => {
    const f = new LineFramer(), big = 'x'.repeat(MAX_LINE_LENGTH + 500);
    expect(f.push(big.slice(0, 1000))).toEqual([]);
    expect(f.push(big.slice(1000))).toEqual([]);
    expect(f.pending).toBe(big.length);
    expect(f.push('yy\n{"ok":1}\n')).toEqual([{ oversize: true, length: big.length + 2 }, { line: '{"ok":1}' }]);
    expect(lines(new LineFramer(), big + '\n{"ok":1}\n')).toEqual([{ oversize: true, length: big.length }, { line: '{"ok":1}' }]);
  });
  it('forgets half a message when reset', () => {
    const f = new LineFramer();
    f.push('{"half":');
    f.reset();
    expect(f.push('{"whole":1}\n')).toEqual([{ line: '{"whole":1}' }]);
  });
});

describe('checking received messages', () => {
  it('accepts a valid sample', () => {
    const r = parseDeviceMessage(JSON.stringify(sample));
    expect(r.ok && r.message.type).toBe('sample');
  });
  it('rejects text that is not JSON, and JSON that is not an object', () => {
    expect(parseDeviceMessage('1250,12.84,0.625')).toMatchObject({ ok: false, problem: 'not-json' });
    expect(parseDeviceMessage('[1,2]')).toMatchObject({ ok: false, problem: 'not-an-object' });
    expect(parseDeviceMessage('null')).toMatchObject({ ok: false, problem: 'not-an-object' });
  });
  it('rejects another protocol version before looking at anything else', () => {
    expect(parseDeviceMessage(JSON.stringify({ ...sample, v: 2 }))).toMatchObject({ ok: false, problem: 'unsupported-version', version: 2 });
    expect(parseDeviceMessage(JSON.stringify({ type: 'sample' }))).toMatchObject({ ok: false, problem: 'unsupported-version' });
  });
  it.each([
    ['a raw value that is not an integer', { ...sample, raw: 1.5 }],
    ['a raw value that is text', { ...sample, raw: '12' }],
    ['a missing sequence number', { ...sample, seq: undefined }],
    ['a negative time', { ...sample, t: -1 }],
    ['an unknown quality flag', { ...sample, q: ['fine'] }],
    ['an unknown message type', { v: 1, type: 'move_crosshead', speed: 5 }],
  ])('rejects %s', (_name, msg) => {
    expect(parseDeviceMessage(JSON.stringify(msg))).toMatchObject({ ok: false, problem: 'invalid' });
  });
  it('does not accept NaN or Infinity (they are not JSON)', () => {
    expect(parseDeviceMessage('{"v":1,"type":"sample","boot_id":"b","seq":1,"t":NaN,"ch":"f","raw":1,"ref":"s"}')).toMatchObject({ ok: false, problem: 'not-json' });
  });
});

describe('requests', () => {
  it('encodes an acquisition request as one line', () => {
    expect(encodeRequest({ v: 1, type: 'identify', id: 'r1' })).toBe('{"v":1,"type":"identify","id":"r1"}\n');
  });
  it('refuses anything that is not an acquisition request, including motion and tare words and extra fields', () => {
    for (const type of ['START', 'STOP', 'TARE', 'start_motion', 'set_speed', 'move_to', 'jog']) {
      expect(() => encodeRequest({ v: 1, type, id: 'r' } as unknown as AppRequest)).toThrow('nothing was sent');
    }
    expect(() => encodeRequest({ v: 1, type: 'start_stream', id: 'r', speed: 5 } as unknown as AppRequest)).toThrow('nothing was sent');
  });
});
