/* The Need help button, bottom right on every screen. It opens a small panel with the help for what is on screen.
   It never blocks the screen: the panel can stay open while you work, and it does not cover the recording controls. */
import { useEffect, useRef, useState } from 'react';
import { siteUrl } from '../site-url';
import type { HelpTopic } from '../help-text';

export function HelpTopicView({ topic }: { topic: HelpTopic }) {
  return (
    <div className="help-topic">
      <p>{topic.what}</p>
      {topic.next.length ? (<><h4>What to do next</h4><ol>{topic.next.map((n) => <li key={n}>{n}</li>)}</ol></>) : null}
      {topic.terms?.length ? (<><h4>Terms</h4><dl>{topic.terms.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl></>) : null}
      {topic.problems?.length ? (<><h4>Common problems</h4><dl>{topic.problems.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl></>) : null}
      {topic.assistance ? <p className="help-assist"><strong>When to get help:</strong> {topic.assistance}</p> : null}
      {topic.links?.length ? <p className="row">{topic.links.map((l) => <a key={l.page} href={siteUrl(l.page)} target="_blank" rel="noreferrer">{l.label}</a>)}</p> : null}
    </div>
  );
}

export function HelpButton({ topic, onOpenHelp }: { topic: HelpTopic; onOpenHelp: () => void }) {
  const [open, setOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement | null>(null), button = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (open) heading.current?.focus(); }, [open]);
  const close = () => { setOpen(false); button.current?.focus(); };
  return (
    <>
      {open ? (
        <section className="help-panel" aria-labelledby="help-panel-title" onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
          <div className="row help-panel-head">
            <h3 id="help-panel-title" ref={heading} tabIndex={-1}>{topic.title}</h3>
            <button type="button" className="quiet" onClick={close} aria-label="Close help">Close</button>
          </div>
          <HelpTopicView topic={topic} />
          <p className="row"><button type="button" className="link" onClick={() => { setOpen(false); onOpenHelp(); }}>Search all help</button>
            <a href={siteUrl('help.html#trouble-title')} target="_blank" rel="noreferrer">Troubleshooting on the website</a></p>
        </section>) : null}
      <button ref={button} type="button" className="help-button" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>Need help?</button>
    </>
  );
}
