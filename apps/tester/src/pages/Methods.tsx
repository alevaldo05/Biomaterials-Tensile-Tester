/* Test methods: saved setups. Start a test from one, save the current setup as a new one, change one (which makes a
   new revision), or archive one. A method never holds a specimen's identity or results.
   Methods on this computer belong to this computer. Lab methods are shared through the lab server when signed in;
   only admins change them there (the server checks). */
import { useEffect, useState } from 'react';
import type { TestController } from '../controller';
import type { MethodStore, TestMethod } from '../storage/methods';
import { methodFromSetup } from '../storage/methods';

function MethodList(p: {
  id: string; title: string; store: MethodStore; controller: TestController; start: () => void; canChange: boolean;
  empty: string; note: string; share?: { label: string; to: MethodStore; done: () => void };
  reloadKey: number; onChange: (m: TestMethod) => void; changed: () => void;
}) {
  const c = p.controller;
  const [items, setItems] = useState<TestMethod[] | null>(null);
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const reload = () => void p.store.list().then((l) => { setItems(l); setError(''); }, (e: unknown) => { setItems([]); setError(e instanceof Error ? e.message : String(e)); });
  useEffect(reload, [p.store, p.reloadKey]);
  const act = async (f: () => Promise<unknown>, done: string) => {
    try { await f(); setStatus(done); setError(''); reload(); p.changed(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <section className="page-block" aria-labelledby={p.id}>
      <h2 id={p.id}>{p.title}</h2>
      {items === null ? <p className="hint">Loading…</p> : items.length ? (
        <div className="tablebox"><table className="list-table">
          <thead><tr><th scope="col">Method</th><th scope="col">Test</th><th scope="col">Revision</th><th scope="col">Material</th><th scope="col">Speed to set</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
          <tbody>{items.map((m) => (
            <tr key={m.id}>
              <td>{m.name}{m.instructions ? <span className="hint" style={{ display: 'block', whiteSpace: 'normal' }}>{m.instructions}</span> : null}</td>
              <td>{m.test === 'relaxation' ? 'Stress relaxation' : 'Uniaxial tension'}</td><td>{m.revision}</td>
              <td>{m.fields.material || '—'}</td><td>{m.fields.speed ? m.fields.speed + ' mm/min' : '—'}</td>
              <td className="row">
                <button type="button" className="primary" disabled={c.phase !== 'setup'} onClick={() => { c.useMethod(m); p.start(); }}>Start a test</button>
                {p.canChange ? <>
                  <button type="button" disabled={c.phase !== 'setup'} onClick={() => p.onChange(m)}>Change…</button>
                  <button type="button" className="quiet" onClick={() => void act(() => p.store.archive(m.id), 'Method archived.')}>Archive</button>
                </> : null}
                {p.share ? <button type="button" className="quiet" onClick={() => void act(async () => { if ((await p.share!.to.list()).some((x) => x.name.trim().toLowerCase() === m.name.trim().toLowerCase())) throw new Error('The lab server already has a method named "' + m.name + '". To update it, use Change… on the lab server list.'); await p.share!.to.save({ name: m.name, test: m.test, fields: m.fields, instructions: m.instructions }); p.share!.done(); }, 'Shared on the lab server.')}>{p.share.label}</button> : null}
              </td>
            </tr>))}
          </tbody></table></div>) : <p className="hint">{p.empty}</p>}
      {status ? <p className="hint" role="status">{status}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <p className="hint">{p.note}</p>
    </section>
  );
}

export function Methods(p: { store: MethodStore; lab: MethodStore | null; labAdmin: boolean; controller: TestController; start: () => void }) {
  const c = p.controller;
  const [version, setVersion] = useState(0);
  const [name, setName] = useState(''), [instructions, setInstructions] = useState(''), [error, setError] = useState(''), [status, setStatus] = useState('');
  const [where, setWhere] = useState<'local' | 'lab'>('local');
  const [revising, setRevising] = useState<{ m: TestMethod; where: 'local' | 'lab' } | null>(null);
  const canLab = !!p.lab && p.labAdmin;
  const target = (revising?.where ?? where) === 'lab' && p.lab ? p.lab : p.store;
  const bump = () => setVersion((v) => v + 1);
  const change = (w: 'local' | 'lab') => (m: TestMethod) => { setRevising({ m, where: w }); setName(m.name); setInstructions(m.instructions); setStatus(''); document.getElementById('save-title')?.scrollIntoView({ block: 'nearest' }); };
  const cancel = () => { setRevising(null); setName(''); setInstructions(''); };
  const saveNow = async () => {
    try {
      await target.save(methodFromSetup(name, c.test, c.setup, instructions), revising?.m);
      setStatus(revising ? 'New revision saved.' : 'Method saved.'); setError(''); cancel(); bump();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <main className="page" id="main-content">
      <div className="page-head"><h1>Test methods</h1></div>
      <MethodList id="local-title" title="On this computer" store={p.store} controller={c} start={p.start} canChange reloadKey={version} onChange={change('local')} changed={bump}
        empty="No methods yet. Fill in a test's setup on the Test screen, then save it below as a method."
        note="Kept on this computer only. Earlier revisions stay with the tests that used them."
        {...(canLab ? { share: { label: 'Share on the lab server', to: p.lab as MethodStore, done: bump } } : {})} />
      {p.lab ? (
        <MethodList id="lab-title" title="On the lab server" store={p.lab} controller={c} start={p.start} canChange={p.labAdmin} reloadKey={version} onChange={change('lab')} changed={bump}
          empty="No shared methods yet."
          note={p.labAdmin ? 'Shared with everyone who signs in. A change is saved as a new revision; earlier revisions are kept.' : 'Shared by the lab. Only an admin can change them.'} />
      ) : <p className="hint">Sign in to the lab server to use the lab's shared methods.</p>}
      <section className="card-plain" aria-labelledby="save-title">
        <h2 id="save-title">{revising ? 'New revision of "' + revising.m.name + '"' + (revising.where === 'lab' ? ' on the lab server' : '') : 'Save the current setup as a method'}</h2>
        <p className="hint">Takes the test type, material, dimensions, speed, hold, and offset yield now entered on the Test screen ({c.test === 'relaxation' ? 'stress relaxation' : 'uniaxial tension'}, {c.setup.material || 'no material yet'}). The specimen ID and notes are not kept.</p>
        <label className="field"><span className="field-label">Name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span className="field-label">Preparation and operator instructions</span><textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></label>
        {canLab && !revising ? (
          <fieldset className="choices"><legend>Save to</legend>
            <label className="check"><input type="radio" name="method-where" checked={where === 'local'} onChange={() => setWhere('local')} /> This computer</label>
            <label className="check"><input type="radio" name="method-where" checked={where === 'lab'} onChange={() => setWhere('lab')} /> The lab server (shared with everyone who signs in)</label>
          </fieldset>) : null}
        <p className="row"><button type="button" className="primary" disabled={!name.trim() || c.phase !== 'setup'} onClick={() => void saveNow()}>{revising ? 'Save new revision' : 'Save method'}</button>
          {revising ? <button type="button" onClick={cancel}>Cancel</button> : null}</p>
        {status ? <p className="hint" role="status">{status}</p> : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
