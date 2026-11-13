/* Machine control: moving the crosshead. This is deliberately separate from acquisition, and today it does nothing.

   The tester's control interface (connector, electrical levels, command set) is not verified. Until it is, and until
   a machine-specific adapter has been written, tested, and reviewed in the laboratory, the only implementation is
   UnsupportedMachineControl: every request comes back as "unsupported" and nothing is transmitted anywhere.
   It holds no transport, so it has nothing to transmit with.

   Rules for whoever adds real control later:
   - a device saying it can move the machine is not permission to enable it;
   - limits and fault behaviour must be validated first;
   - requests are never queued or replayed after a reconnect;
   - no on-screen button may be called an emergency stop unless that whole function has been engineered and validated. */

export type MotionOperation = 'start' | 'stop' | 'pause' | 'jog' | 'set-speed' | 'move-to' | 'return-to-start' | 'tare';
export const MOTION_OPERATIONS: readonly MotionOperation[] = ['start', 'stop', 'pause', 'jog', 'set-speed', 'move-to', 'return-to-start', 'tare'];

export type MachineControlResult =
  | { ok: true }
  | { ok: false; code: 'unsupported'; operation: MotionOperation; message: string };

export interface MachineControl {
  /** True only for a verified, reviewed adapter. */
  readonly available: boolean;
  supports(operation: MotionOperation): boolean;
  request(operation: MotionOperation, params?: Readonly<Record<string, number>>): Promise<MachineControlResult>;
}

export const UNSUPPORTED_MESSAGE = 'This app does not control the tester. Use the tester\'s own controller to move the crosshead.';

export class UnsupportedMachineControl implements MachineControl {
  readonly available = false;
  supports(): boolean { return false; }
  async request(operation: MotionOperation): Promise<MachineControlResult> {
    return { ok: false, code: 'unsupported', operation, message: UNSUPPORTED_MESSAGE };
  }
}

/** The machine control for this build. What a device advertises is ignored on purpose. */
export function createMachineControl(_advertisedCapabilities?: unknown): MachineControl {
  return new UnsupportedMachineControl();
}
