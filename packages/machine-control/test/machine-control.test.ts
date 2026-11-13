import { describe, expect, it } from 'vitest';
import { createMachineControl, MOTION_OPERATIONS, UnsupportedMachineControl } from '../src/index';

describe('machine control', () => {
  it('reports every motion request as unsupported', async () => {
    const mc = createMachineControl();
    expect(mc.available).toBe(false);
    for (const op of MOTION_OPERATIONS) {
      expect(mc.supports(op)).toBe(false);
      expect(await mc.request(op, { speed_mm_min: 10 })).toMatchObject({ ok: false, code: 'unsupported', operation: op });
    }
  });
  it('stays unsupported even when a device advertises motion', () => {
    const mc = createMachineControl({ motion: true, operations: ['start', 'stop'] });
    expect(mc).toBeInstanceOf(UnsupportedMachineControl);
    expect(mc.available).toBe(false);
  });
});
