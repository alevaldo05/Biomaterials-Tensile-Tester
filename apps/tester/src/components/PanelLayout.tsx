/* Load test's three-column layout (the same shape as the Test screen): a left panel, the graph in the middle, results
   on the right, and a strip along the bottom. At 1100 px and narrower the left panel is a drawer opened from a button
   (Esc closes it and sends nothing to any device; focus goes into it and comes back to the button). */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const sliders = <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" /></svg>;

export function PanelLayout(p: { id: string; title: string; buttonLabel: string; summary: ReactNode; printPanel?: boolean; panel: ReactNode; center: ReactNode; right: ReactNode; bottom?: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 1100px)').matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const q = window.matchMedia('(max-width: 1100px)'), on = () => setNarrow(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };   /* closes the drawer only; it sends nothing to any device */
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);
  const button = useRef<HTMLButtonElement | null>(null), heading = useRef<HTMLHeadingElement | null>(null), was = useRef(false);
  useEffect(() => {
    if (drawer) { was.current = true; heading.current?.focus(); }
    else if (was.current) { was.current = false; if (narrow) button.current?.focus(); }
  }, [drawer, narrow]);
  return (
    <div className={'panel-layout' + (drawer ? ' drawer-open' : '')}>
      <div className="test-top">
        <button type="button" className="setup-button" ref={button} aria-expanded={drawer} aria-controls={p.id} onClick={() => setDrawer(true)}>{sliders}{p.buttonLabel}</button>
        <p className="test-top-summary">{p.summary}</p>
      </div>
      <div className="test-grid">
        <aside className={'quick' + (p.printPanel ? ' print-panel' : '')} id={p.id} aria-labelledby={p.id + '-title'} inert={narrow && !drawer}>
          <div className="quick-head">
            <h2 id={p.id + '-title'} ref={heading} tabIndex={-1}>{p.title}</h2>
            {narrow ? <button type="button" className="quiet drawer-close" onClick={() => setDrawer(false)}>Close</button> : null}
          </div>
          {p.panel}
        </aside>
        {drawer ? <button type="button" className="scrim" aria-label={'Close ' + p.title.toLowerCase()} onClick={() => setDrawer(false)} /> : null}
        <div className="test-center">{p.center}</div>
        <div className="side">{p.right}</div>
      </div>
      {p.bottom}
    </div>
  );
}
