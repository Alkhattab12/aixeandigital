"use client";
import type { DownloadKind, DownloadSuccess, NormalizedDownload } from "@/types";
import { getPlatform } from "@/lib/scraper/registry";
import { ICON_FOR_KIND } from "@/components/ui/tone";
import FormatOption from "./FormatOption";

const GROUPS: { kind: DownloadKind; title: string }[] = [
  { kind: "video", title: "Video" }, { kind: "audio", title: "Audio" }, { kind: "image", title: "Image" },
  { kind: "file", title: "File" }, { kind: "link", title: "Resolved link" },
];

interface Props {
  result: DownloadSuccess;
  onResolveItem: (url: string) => void;
  onBack?: () => void;
}

function recordHistory(result: DownloadSuccess, d: NormalizedDownload) {
  // metadata only — never the (temporary) direct URL
  fetch("/api/history", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform: result.platform, title: result.data.title, thumbnail: result.data.thumbnail, type: d.type, format: d.format, quality: d.quality }),
  }).catch(() => {});
}

export default function MediaResult({ result, onResolveItem, onBack }: Props) {
  const { data } = result;
  const platform = getPlatform(result.platform)?.label ?? result.platform;
  const meta = [platform, data.author?.username ?? data.author?.name, data.duration].filter(Boolean) as string[];
  const isCollection = data.items.length > 0;
  const itemsWithDownloads = data.items.filter((i) => i.downloads.length > 0);
  const record = (d: NormalizedDownload) => recordHistory(result, d);

  return (
    <section className="card result" aria-live="polite">
      {onBack ? <div><button className="btn ghost small" onClick={onBack}>← Back</button></div> : null}
      <div className="media-head">
        {data.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="thumb" src={data.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <div className="thumb empty" aria-hidden>{ICON_FOR_KIND[data.type] ?? "📦"}</div>
        )}
        <div className="media-meta">
          <h2>{data.filename ?? data.title ?? "Untitled"}</h2>
          <div className="meta-line">{meta.map((m, i) => <span key={i}>{i ? "· " : ""}{m}</span>)}</div>
          {isCollection ? <div className="meta-line" style={{ marginTop: 6 }}>{data.type === "album" ? "Album" : "Playlist"} · {data.itemCount ?? data.items.length} items</div> : null}
          {data.size && !isCollection ? <div className="meta-line" style={{ marginTop: 6 }}>Size · {data.size}</div> : null}
        </div>
      </div>

      {GROUPS.map(({ kind, title }) => {
        const list = data.downloads.filter((d) => d.type === kind);
        if (!list.length) return null;
        return (
          <div className="group" key={kind}>
            <h3>{title}</h3>
            <div className="formats">{list.map((d) => <FormatOption key={d.id} d={d} onDownload={record} />)}</div>
          </div>
        );
      })}

      {isCollection ? (
        <div className="group">
          <h3>{data.type === "album" ? "Tracks" : "Playlist"} · {data.items.length} items</h3>
          {itemsWithDownloads.length > 1 ? (
            <p className="hint" style={{ margin: "0 0 10px" }}>Your browser may ask permission to download several files at once.</p>
          ) : null}
          <div className="items">
            {data.items.map((it, idx) => {
              const best = it.downloads[0];
              return (
                <div className="item" key={it.id ?? idx}>
                  {it.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : <div className="ph" />}
                  <div className="t">
                    <span>{it.title ?? `Item ${idx + 1}`}</span>
                    <small>{[it.author, it.duration].filter(Boolean).join(" · ")}</small>
                  </div>
                  {best ? (
                    <a className="btn small" href={best.url} target="_blank" rel="noopener noreferrer" download onClick={() => record(best)}>
                      {(best.format ?? best.type).toUpperCase()}
                    </a>
                  ) : it.url ? (
                    <button className="btn ghost small" onClick={() => onResolveItem(it.url!)}>Get</button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {itemsWithDownloads.length > 1 ? (
            <div style={{ marginTop: 14 }}>
              <button
                className="btn"
                onClick={() => itemsWithDownloads.forEach((it, i) => setTimeout(() => {
                  const a = document.createElement("a");
                  a.href = it.downloads[0].url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.download = "";
                  document.body.appendChild(a); a.click(); a.remove(); record(it.downloads[0]);
                }, i * 600))}
              >
                Download all ({itemsWithDownloads.length})
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
