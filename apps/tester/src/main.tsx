import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { TestController } from './controller';
import type { Edition } from './controller';
import './app.css';

declare const __EDITION__: Edition;

async function start() {
  /* The learning edition never loads the hardware module, so its bundle cannot open a port. */
  let openReal: (() => import('@tensile/acquisition').Transport) | undefined;
  let serialAvailable = false;
  if (__EDITION__ === 'lab') {
    const real = await import('./real');
    openReal = real.openUsbSerial;
    serialAvailable = real.usbSerialAvailable();
  }
  const controller = new TestController({ edition: __EDITION__, ...(openReal ? { openReal } : {}) });
  createRoot(document.getElementById('root') as HTMLElement).render(<StrictMode><App controller={controller} serialAvailable={serialAvailable} /></StrictMode>);
}
void start();
