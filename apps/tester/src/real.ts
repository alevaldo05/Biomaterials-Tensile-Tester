/* The only file that reaches for hardware. It is loaded only by the lab edition; the learning edition's
   bundle does not contain it, the USB serial transport, or the machine-control package. */
import { WebSerialTransport } from '@tensile/acquisition';
import type { SerialLike, Transport } from '@tensile/acquisition';
import { createMachineControl } from '@tensile/machine-control';

/** Must match TT_SERIAL_BAUD in the firmware's board_config.h. A board with native USB ignores it. */
export const SERIAL_BAUD = 921600;
export function openUsbSerial(): Transport {
  return new WebSerialTransport({ serial: (navigator as unknown as { serial?: SerialLike }).serial, baudRate: SERIAL_BAUD });
}
export const usbSerialAvailable = (): boolean => 'serial' in navigator;
/** Always "unsupported" today: the app has no way to move the tester. */
export const machineControl = createMachineControl();
