/* Test methods: saved setups. Start a test from one, save the current setup as a new one, change one (which makes a
   new revision), or archive one. A method never holds a specimen's identity or results. */
import { useEffect, useState } from 'react';
import type { TestController } from '../controller';
import type { MethodStore, TestMethod } from '../storage/methods';
import { methodFromSetup } from '../storage/methods';

export function Methods({ store, controller: c, start }: { store: MethodStore; controller: TestController; start: () => void }) {
  const [items, setItems] = useState<TestMethod[] | null>(null);
  const [name, setName] = useState(''), [instructions, setInstructions] = useState(''), [error, setError] = useState(''), [revising, setRevising] = useState<TestMethod | null>(null);
  const reload = () => void store.list().then(setItems, (e: unknown) => setError(String(e)));
  useEffect(reload, [store]);
  const saveNow = async () => {
    try {
      await store.save(methodFromSetup(name, c.test, c.setup, instructions), revising ?? undefined);
      setName(''); setInstructions(''); setRevising(null); setError(''); reload();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <main className="page" id="main-content">
      <h1>Test methods</h1>
      {items === null ? <p className="hint">Loading…</p> : items.length ? (
        <div className="tablebox"><table className="list-table">
          <thead><tr><th scope="col">Method</th><th scope="col">Test</th><th scope="col">Revision</th><th scope="col">Material</th><th scope="col">Speed to set</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
          <tbody>{items.map((m) => (
            <tr key={m.id}>
              <td>{m.name}{m.instructions ? <span className="hint" style={{ display: 'block' }}>{m.instructions}</span> : null}</td>
              <td>{m.test === 'relaxation' ? 'Stress relaxation' : 'Uniaxial tension'}</td><td>{m.revision}</td>
              <td>{m.fields.material || '—'}</td><td>{m.fields.speed ? m.fields.speed + ' mm/min' : '—'}</td>
              <td className="row">
                <button type="button" className="primary" disabled={c.phase !== 'setup'} onClick={() => { c.useMethod(m); start(); }}>Start a test</button>
                <button type="button" disabled={c.phase !== 'setup'} onClick={() => { setRevising(m); setName(m.name); setInstructions(m.instructions); }}>Change…</button>
                <button type="button" className="quiet" onClick={() => void store.archive(m.id).then(reload)}>Archive</button>
              </td>
            </tr>))}
          </tbody></table></div>) : <p className="hint">No methods yet. Fill in a test's setup on the Test screen, then save it here as a method.</p>}
      <section className="card-plain" aria-labelledby="save-title">
        <h2 id="save-title">{revising ? 'New revision of "' + revising.name + '"' : 'Save the current setup as a method'}</h2>
        <p className="hint">Takes the test type, material, dimensions, speed, hold, and offset yield now entered on the Test screen ({c.test === 'relaxation' ? 'stress relaxation' : 'uniaxial tension'}, {c.setup.material || 'no material yet'}). The specimen ID and notes are not kept.</p>
        <label className="field"><span className="field-label">Name</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="field"><span className="field-label">Preparation and operator instructions</span><textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></label>
        <p className="row"><button type="button" className="primary" disabled={!name.trim()} onClick={() => void saveNow()}>{revising ? 'Save new revision' : 'Save method'}</button>
          {revising ? <button type="button" onClick={() => { setRevising(null); setName(''); setInstructions(''); }}>Cancel</button> : null}</p>
        {error ? <p className="error" role="alert">{error}</p> : null}
        <p className="hint">Methods are kept on this computer. Earlier revisions stay with the tests that used them.</p>
      </section>
    </main>
  );
}
