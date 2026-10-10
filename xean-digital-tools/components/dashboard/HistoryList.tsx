"use client";
import { getPlatform } from "@/lib/scraper/registry";
import { useHistory } from "./useHistory";

function dayLabel(iso: string) {
  const d = new Date(iso); const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function HistoryList() {
  const { history, error, remove } = useHistory();
  if (!history) return <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 82 }} />)}</div>;
  if (!history.length) return <div className="empty">{error ? "History is unavailable right now." : "Nothing here yet. Downloads you start will show up here."}</div>;

  const groups = new Map<string, typeof history>();
  history.forEach((h) => { const k = dayLabel(h.createdAt); groups.set(k, [...(groups.get(k) ?? []), h]); });

  return (
    <>
      <div className="toolbar"><button className="btn ghost small" onClick={() => confirm("Clear all history?") && remove()}>Clear all</button></div>
      {[...groups].map(([day, rows]) => (
        <section key={day}>
          <div className="hday">{day}</div>
          {rows.map((h) => (
            <div className="hrow" key={h.id}>
              {h.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={h.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : <div className="ph" />}
              <div className="meta">
                <small>{getPlatform(h.platform)?.label ?? h.platform}</small>
                <b>{h.title ?? "Untitled"}</b>
                <small>{[h.format?.toUpperCase() ?? h.type.toUpperCase(), h.quality].filter(Boolean).join(" · ")}</small>
              </div>
              <button className="icon-btn" onClick={() => remove(h.id)} aria-label="Remove from history">✕</button>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
