"use client";
import { useEffect, useState } from "react";
import type { PlatformInfo } from "@/types";
import { tone } from "@/components/ui/tone";
import type { XeanUtility } from "@/config/xean-utilities";

const KEY = "xean:favorites";

export default function ToolsBrowser({ platforms, utilities }: { platforms: PlatformInfo[]; utilities: XeanUtility[] }) {
  const [tab, setTab] = useState<"all" | "favorites">("all");
  const [favs, setFavs] = useState<string[]>([]);

  useEffect(() => { try { setFavs(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* ignore */ } }, []);
  const toggle = (id: string) => setFavs((f) => {
    const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  const shown = tab === "favorites" ? platforms.filter((p) => favs.includes(p.id)) : platforms;

  return (
    <>
      <div className="toolbar" role="group" aria-label="Filter">
        <button className="tab" aria-pressed={tab === "all"} onClick={() => setTab("all")}>All tools</button>
        <button className="tab" aria-pressed={tab === "favorites"} onClick={() => setTab("favorites")}>Favorites ({favs.length})</button>
      </div>

      <div className="section-title"><h2>Downloader platforms</h2><span>{shown.length} powered by scrapr</span></div>
      {shown.length === 0 ? <div className="empty">No favorites yet. Tap ♡ on a tool to pin it here.</div> : (
        <div className="grid">
          {shown.map((p, i) => {
            const live = p.methods.filter((m) => m.available).length;
            return (
              <article key={p.id} className={`tool ${tone(i)}`}>
                <button className="fav" onClick={() => toggle(p.id)} aria-pressed={favs.includes(p.id)} aria-label={`Favorite ${p.label}`}>{favs.includes(p.id) ? "♥" : "♡"}</button>
                <h3>{p.label}</h3>
                <p>{p.kind === "resolver" ? "Link resolver" : "Media downloader"} · {live}/{p.methods.length} methods ready</p>
                <div className="row">
                  {p.methods.map((m) => (
                    <span key={m.name} className={`tag ${m.available ? "" : "off"}`} title={m.available ? "ready" : m.requires === "browser" ? "needs a headless browser" : "unavailable"}>{m.name}</span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="section-title"><h2>Other Xean utilities</h2><span>{utilities.length}</span></div>
      {utilities.length === 0 ? (
        <div className="empty">No other utilities are installed yet. Only the downloader tools above are live.</div>
      ) : (
        <div className="grid">
          {utilities.map((u, i) => (
            <a key={u.id} href={u.href} className={`tool ${tone(i + 3)}`} style={{ textDecoration: "none" }}>
              <h3>{u.name}</h3><p>{u.description}</p>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
