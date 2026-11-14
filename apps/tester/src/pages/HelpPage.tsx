/* Help: every help topic in the app, searchable, available offline. Topics on the left, the chosen topic in the middle,
   pointers on the right. */
import { useState } from 'react';
import { HelpTopicView } from '../components/HelpButton';
import { HELP, searchHelp } from '../help-text';
import { siteUrl } from '../site-url';
import { versionLine } from '../version';

export function HelpPage({ openDevice }: { openDevice?: () => void }) {
  const [q, setQ] = useState(''), [sel, setSel] = useState('');
  const found = q.trim() ? searchHelp(q) : Object.entries(HELP).map(([key, topic]) => ({ key, topic }));
  const shown = found.find((f) => f.key === sel) ?? found[0];
  return (
    <main className="page" id="main-content">
      <div className="page-head"><h1>Help</h1></div>
      <div className="help-grid">
        <div className="help-side">
          <label className="field"><span className="field-label">Search help</span>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: port, calibration, recovery" /></label>
          <nav className="card-plain help-topics" aria-labelledby="hp-topics">
            <h2 id="hp-topics">Topics <span className="hint">({found.length})</span></h2>
            {found.length ? (
              <ul className="plain-list">
                {found.map((f) => (
                  <li key={f.key}><button type="button" className={'topic-link' + (shown?.key === f.key ? ' topic-on' : '')} aria-current={shown?.key === f.key ? 'true' : undefined} onClick={() => setSel(f.key)}>{f.topic.title}</button></li>
                ))}
              </ul>) : <p className="hint">No topic matches. Try another word.</p>}
          </nav>
        </div>
        <article className="card-plain help-article" aria-labelledby="hp-topic-title">
          {shown ? (<>
            <h2 id="hp-topic-title">{shown.topic.title}</h2>
            <HelpTopicView topic={shown.topic} />
          </>) : <h2 id="hp-topic-title">No topic</h2>}
        </article>
        <aside className="help-more" aria-label="More help">
          <section className="side-card" aria-labelledby="hp-web">
            <h2 id="hp-web">On the website</h2>
            <ul className="plain-list">
              <li><a href={siteUrl('learn.html')} target="_blank" rel="noreferrer">Background and glossary</a></li>
              <li><a href={siteUrl('help.html#trouble-title')} target="_blank" rel="noreferrer">Troubleshooting</a></li>
              <li><a href={siteUrl('help.html')} target="_blank" rel="noreferrer">All website help</a></li>
            </ul>
          </section>
          <section className="side-card" aria-labelledby="hp-ask">
            <h2 id="hp-ask">Asking for help</h2>
            <p className="hint">Copy the diagnostic summary and send it with your question.</p>
            {openDevice ? <p><button type="button" className="link" onClick={openDevice}>Open the diagnostic summary</button></p> : null}
          </section>
        </aside>
      </div>
      <p className="hint version-line">{versionLine()}</p>
    </main>
  );
}
