/* Device and calibration: the connection, the identified device, the calibration in use, and a summary to copy
   when asking for help. */
import { useState, useSyncExternalStore } from 'react';
import type { TestController } from '../controller';
import type { Account } from '../lab-api';
import { CalibrationCheck } from './CalibrationCheck';
import { CalibrationPanel, DeviceFacts } from '../components/DevicePanels';

export function Device({ controller: c, account, serialAvailable }: { controller: TestController; account: Account | null; serialAvailable: boolean }) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [copied, setCopied] = useState('');
  const busy = c.state === 'connecting' || c.state === 'identifying';
  return (
    <main className="page" id="main-content">
      <h1>Device and calibration</h1>
      <div className="two-col">
        <section className="card-plain" aria-labelledby="conn-title">
          <h2 id="conn-title">Acquisition device</h2>
          <p className="row">
            {c.connected || c.state === 'fault' ? <button type="button" disabled={c.phase === 'recording'} onClick={() => void c.disconnect()}>Disconnect</button> : null}
            {!c.connected ? <button type="button" className="primary" disabled={busy} onClick={() => void c.connect()}>Connect…</button> : null}
            <span className="hint">{c.connected ? 'Connected' : busy ? 'Connecting…' : c.state === 'fault' ? 'Stopped by a fault' : 'Not connected'}</span>
          </p>
          {!serialAvailable ? <p className="hint">This browser cannot open USB serial ports. Use Chrome on a computer, or the Windows app.</p> : null}
          {c.message && !c.connected ? <p className="error" role="alert">{c.message}</p> : null}
          <DeviceFacts c={c} />
          <p className="hint">Machine motion: unknown to this app. The tester is moved and stopped from its own controller.</p>
        </section>
        <section className="card-plain" aria-labelledby="cal-title">
          <h2 id="cal-title">Calibration</h2>
          <CalibrationPanel c={c} account={account} />
        </section>
      </div>
      <CalibrationCheck controller={c} />
      <section className="card-plain" aria-labelledby="diag-title">
        <h2 id="diag-title">Diagnostic summary</h2>
        <pre className="diag">{c.diagnosticSummary()}</pre>
        <p className="row"><button type="button" onClick={() => void navigator.clipboard?.writeText(c.diagnosticSummary()).then(() => setCopied('Copied.'), () => setCopied('Could not copy; select the text instead.'))}>Copy summary</button><span className="hint" role="status">{copied}</span></p>
        <p className="hint">Nothing is sent anywhere. Check the text before sharing it.</p>
      </section>
    </main>
  );
}
