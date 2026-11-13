/* The only file that reaches for hardware: USB serial through the browser (or, later, the Windows app's bridge). */
import { WebSerialTransport } from '@tensile/acquisition';
import type { SerialLike, Transport } from '@tensile/acquisition';

/** Must match TT_SERIAL_BAUD in the firmware's board_config.h. A board with native USB ignores it. */
export const SERIAL_BAUD = 921600;
export function openUsbSerial(): Transport {
  return new WebSerialTransport({ serial: (navigator as unknown as { serial?: SerialLike }).serial, baudRate: SERIAL_BAUD });
}
export const usbSerialAvailable = (): boolean => typeof navigator !== 'undefined' && 'serial' in navigator;
