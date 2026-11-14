/* Recent tests as a table: saved, specimen, test, samples, where it is kept, and Open. */
import type { RecentRow } from '../pages/Home';

export function RecentTable({ rows }: { rows: RecentRow[] }) {
  return rows.length ? (
    <div className="tablebox"><table className="list-table">
      <thead><tr><th scope="col">Saved</th><th scope="col">Specimen</th><th scope="col">Test</th><th scope="col">Samples</th><th scope="col">Stored</th><th scope="col"><span className="sr">Open</span></th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key}><td>{r.saved}</td><th scope="row">{r.specimen}</th><td>{r.test}</td><td className="num">{r.samples}</td><td>{r.stored}</td><td><button type="button" className="link" aria-label={'Open ' + r.specimen + ', ' + r.saved} onClick={r.open}>Open</button></td></tr>)}</tbody>
    </table></div>) : <p className="hint">No recorded tests on this computer yet.</p>;
}
