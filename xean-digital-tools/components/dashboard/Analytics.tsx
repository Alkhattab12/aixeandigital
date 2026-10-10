"use client";
import { getPlatform } from "@/lib/scraper/registry";
import { useHistory } from "./useHistory";

export default function Analytics() {
  const { history } = useHistory();
  if (!history) return <div className="skel" style={{ height: 160 }} />;
  const by = new Map<string, number>();
  history.forEach((h) => by.set(h.platform, (by.get(h.platform) ?? 0) + 1));
  const rows = [...by].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = rows[0]?.[1] ?? 1;
  const kinds = new Map<string, number>();
  history.forEach((h) => kinds.set(h.type, (kinds.get(h.type) ?? 0) + 1));
  const top = [...kinds].sort((a, b) => b[1] - a[1])[0];
  return (
    <>
      <div className="stat-grid">
        <div className="stat tone0"><b>{history.length}</b><span>Downloads</span></div>
        <div className="stat tone1"><b>{by.size}</b><span>Platforms used</span></div>
        <div className="stat tone2"><b>{top ? top[0] : "—"}</b><span>Most common type</span></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>By platform</h3>
        {rows.length ? <div className="bars">{rows.map(([id, n]) => (
          <div key={id}><span>{getPlatform(id)?.label ?? id}</span><i style={{ width: `${(n / max) * 100}%` }} /><span>{n}</span></div>
        ))}</div> : <p className="hint">No data yet.</p>}
      </div>
    </>
  );
}
