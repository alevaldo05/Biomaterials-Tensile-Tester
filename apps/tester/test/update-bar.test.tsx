/* The update notice and its setting (Windows app only). Rendered with React's server renderer (no browser). */
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DesktopBridge } from '../src/desktop';
import { UpdateBar, UpdateNotice, askForUpdate } from '../src/components/UpdateBar';
import { UpdateSetting } from '../src/pages/Settings';

const answer = { available: true, version: '1.0.0-beta.2', pageUrl: 'https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases/tag/app-v1.0.0-beta.2-run.30' };
function bridge(on: boolean) {
  const checkForUpdate = vi.fn(async () => answer);
  const b: DesktopBridge = { kind: 'windows-app', getLabServer: async () => '', setLabServer: async () => ({}), checkForUpdate,
    openReleasePage: vi.fn(async () => true), getUpdateCheck: async () => on, setUpdateCheck: async (v) => ({ on: v }) };
  return { b, checkForUpdate };
}
const none = () => undefined;

describe('update notice', () => {
  it('says which version is available, with Download and a dismiss button', () => {
    const html = renderToStaticMarkup(<UpdateNotice answer={answer} recording={false} onDownload={none} onDismiss={none} />);
    expect(html).toContain('class="update-bar" role="status"');
    expect(html).toContain('Version 1.0.0-beta.2 is available.');
    expect(html).toContain('>Download</button>');
    expect(html).toContain('aria-label="Dismiss the update notice"');
  });
  it('is hidden while recording, and when there is no answer', () => {
    expect(renderToStaticMarkup(<UpdateNotice answer={answer} recording onDownload={none} onDismiss={none} />)).toBe('');
    expect(renderToStaticMarkup(<UpdateNotice answer={null} recording={false} onDownload={none} onDismiss={none} />)).toBe('');
  });
  it('shows nothing at first and in the browser version', () => {
    expect(renderToStaticMarkup(<UpdateBar recording={false} bridge={null} />)).toBe('');
    expect(renderToStaticMarkup(<UpdateBar recording={false} bridge={bridge(true).b} />)).toBe('');
  });
  it('asks only when the setting is on, and only in the Windows app', async () => {
    const off = bridge(false);
    expect(await askForUpdate(off.b)).toBeNull();
    expect(off.checkForUpdate).not.toHaveBeenCalled();
    const on = bridge(true);
    expect(await askForUpdate(on.b)).toEqual(answer);
    expect(on.checkForUpdate).toHaveBeenCalledTimes(1);
    expect(await askForUpdate(null)).toBeNull();
  });
  it('ignores a failed or incomplete answer', async () => {
    const { b } = bridge(true);
    expect(await askForUpdate({ ...b, checkForUpdate: async () => { throw new Error('x'); } })).toBeNull();
    expect(await askForUpdate({ ...b, checkForUpdate: async () => ({ available: true }) })).toBeNull();
    expect(await askForUpdate({ ...b, checkForUpdate: async () => ({ available: false }) })).toBeNull();
  });
});

describe('update setting', () => {
  it('is a switch, on by default, with one line saying it asks GitHub', () => {
    const html = renderToStaticMarkup(<UpdateSetting bridge={bridge(true).b} />);
    expect(html).toContain('Check for updates when the app starts');
    expect(html).toMatch(/type="checkbox" role="switch" checked=""/);
    expect(html).toContain('Asks GitHub for the latest release of the tester app.');
  });
  it('shows nothing in the browser version', () => {
    expect(renderToStaticMarkup(<UpdateSetting bridge={null} />)).toBe('');
  });
});
