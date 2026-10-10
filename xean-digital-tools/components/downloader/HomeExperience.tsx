"use client";
import { useState } from "react";
import { PLATFORMS } from "@/lib/scraper/registry";
import { tone } from "@/components/ui/tone";
import DownloaderHero from "./DownloaderHero";
import Downloader from "./Downloader";

const POPULAR = ["tiktok", "instagram", "youtube", "facebook", "twitter", "pinterest", "spotify"];

export default function HomeExperience() {
  const [hint, setHint] = useState<string | null>(null);
  const [signal, setSignal] = useState(0);
  const popular = POPULAR.map((id) => PLATFORMS.find((p) => p.id === id)!).filter(Boolean);

  return (
    <main className="page">
      <span className="blob b1" aria-hidden /><span className="blob b2" aria-hidden /><span className="blob b3" aria-hidden />
      <DownloaderHero />
      <Downloader hint={hint} focusSignal={signal} />
      <div className="section-title rel"><h2>Popular platforms</h2><span>{PLATFORMS.length} supported</span></div>
      <div className="grid rel">
        {popular.map((p, i) => (
          <button key={p.id} className={`pcard ${tone(i)}`} onClick={() => { setHint(p.label); setSignal((s) => s + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <b>{p.label}</b>
            <small>{p.methods.length} {p.methods.length === 1 ? "method" : "methods"}</small>
          </button>
        ))}
      </div>
    </main>
  );
}
