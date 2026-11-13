/* Help: every help topic in the app, searchable, available offline. */
import { useState } from 'react';
import { HelpTopicView } from '../components/HelpButton';
import { HELP, searchHelp } from '../help-text';
import { siteUrl } from '../site-url';

export function HelpPage() {
  const [q, setQ] = useState('');
  const found = q.trim() ? searchHelp(q) : Object.entries(HELP).map(([key, topic]) => ({ key, topic }));
  return (
    <main className="page" id="main-content">
      <h1>Help</h1>
      <label className="field" style={{ maxWidth: '32rem' }}><span className="field-label">Search help</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: port, calibration, recovery" /></label>
      <p className="hint">{found.length} topic{found.length === 1 ? '' : 's'}. More background and troubleshooting on the <a href={siteUrl('help.html')} target="_blank" rel="noreferrer">website</a>.</p>
      {found.map(({ key, topic }) => (
        <details key={key} className="panel" open={!!q.trim()}>
          <summary>{topic.title}</summary>
          <div className="panel-body"><HelpTopicView topic={topic} /></div>
        </details>
      ))}
    </main>
  );
}
