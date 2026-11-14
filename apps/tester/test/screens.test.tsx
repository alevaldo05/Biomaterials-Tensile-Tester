/* The restyled screens: Load test's key results use info buttons and no formula text, the graph's two helper sentences
   sit behind one "About the graph" button with their wording unchanged, and Need help takes its own space.
   Rendered with React's server renderer (no browser); the layout itself was checked with screenshots in Chromium. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoadTest } from '../src/pages/LoadTest';
import { resultsFor } from '../src/results';
import { openTestFile } from '../src/load';
import { measuredSetup, move, ready, rig } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '../src', f), 'utf8');
const FORMULA = [/F\s*\/\s*A/, /Δx\s*\/\s*L/, /σ\s*=/, /ε\s*=/, /dσ\s*\/\s*dε/, /F = m g/];

async function loadedTest() {
  const { dev, c } = rig();
  ready(c);
  await c.connect();
  c.useSetup(measuredSetup(c));
  await c.startRecording();
  move(dev, c);
  dev.step(2400);
  c.stopRecording();
  return openTestFile('t.session.json', JSON.stringify(c.sessionFile()));
}
const page = (loaded: Awaited<ReturnType<typeof loadedTest>> | null) =>
  renderToStaticMarkup(<LoadTest loaded={loaded} error="" theme="light" recent={[]} openFile={() => undefined} clear={() => undefined} />);

describe('Load test', () => {
  it('shows key results with an "i" button each and no formula text', async () => {
    const l = await loadedTest();
    const html = page(l);
    const rows = resultsFor(l.record).screen;
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) {
      expect(html).toContain('aria-label="About ' + r.label.toLowerCase() + '"');
      expect(html).toContain('id="about-' + r.id + '"');
    }
    const text = html.replace(/<[^>]+>/g, ' ');
    for (const f of FORMULA) expect(text, String(f)).not.toMatch(f);
    for (const f of ['pages/LoadTest.tsx', 'pages/Compare.tsx', 'components/RecordGraph.tsx']) for (const p of FORMULA) expect(src(f), f + ' ' + p).not.toMatch(p);
  });
  it('keeps the honesty wording: nothing uploaded, simulated files not opened, the data comes from a file', async () => {
    const html = page(await loadedTest());
    expect(html).toContain('Opened on this computer. Nothing is uploaded.');
    expect(html).toContain('Files marked as simulated are not opened here.');
    expect(html).toContain('Session file saved by this app');
  });
  it('has the file panel as a drawer that Esc closes without sending anything', () => {
    const layout = src('components/PanelLayout.tsx');
    expect(layout).toContain('inert={narrow && !drawer}');
    expect(layout).toMatch(/e\.key === 'Escape'\) setDrawer\(false\)/);
    expect(layout).not.toMatch(/Escape[^\n]*(stopRecording|STOP|sendStop)/);
  });
});

describe('the graph helper text', () => {
  it('sits behind one "About the graph" button with the wording unchanged', async () => {
    const html = page(await loadedTest());
    expect(html).toMatch(/<button[^>]*aria-label="About the graph"[^>]*aria-expanded="false"[^>]*aria-controls="about-graph"/);
    expect(html).toMatch(/id="about-graph"[^>]*hidden=""[^>]*>Move over the curve, or use the arrow keys, to read a point\. Scroll or drag to zoom; double-click to reset\. Guides only: they change the picture, never the results\. Region boundaries are estimates\./);
    expect(html).toContain('Show regions');
    expect(html).toContain('Tangent line at cursor');
  });
  it('is found in the code, and the idle line under the graph stays blank for the screens that use the button', () => {
    expect(src('components/RecordGraph.tsx')).toContain('Guides only: they change the picture, never the results. Region boundaries are estimates.');
    expect(src('components/RecordGraph.tsx')).toContain('idleHint={false}');
    expect(readFileSync(path.join(here, '../../../packages/ui/src/Graph.tsx'), 'utf8')).toContain("'Move over the curve, or use the arrow keys, to read a point. Scroll or drag to zoom; double-click to reset.'");
    expect(readFileSync(path.join(here, '../../../packages/ui/src/Graph.tsx'), 'utf8')).toContain('Recording. Zoom and the readout are available when recording stops.');
  });
});

describe('Need help', () => {
  it('sits in a bar that takes its own space, so it never floats over a button or a heading', () => {
    expect(src('Shell.tsx')).toContain('<div className="help-bar"><HelpButton');
    const css = src('app.css');
    expect(css).toMatch(/\.help-bar \{[^}]*display: flex/);
    expect(css).not.toMatch(/\.help-button \{[^}]*position: (fixed|sticky)/);
    expect(css).not.toMatch(/\.help-bar \{[^}]*position: (fixed|sticky)/);
  });
});

describe('screens keep their safety wording', () => {
  it('Device says the machine motion is unknown and the check changes nothing', () => {
    expect(src('pages/Device.tsx')).toContain('Machine motion is unknown to this app. Move and stop the crosshead on the tester');
    const check = src('pages/CalibrationCheck.tsx');
    expect(check).toContain('It changes no reading and no calibration, makes no claim of traceability, and saves nothing.');
    expect(check).toContain('A software baseline or a tare is not a calibration.');
  });
  it('Settings shows the lab address box only in the Windows app', () => {
    const s = src('pages/Settings.tsx');
    expect(s).toContain('Windows app only');
    expect(s).toMatch(/if \(!d\) return <p className="hint">/);
  });
});
