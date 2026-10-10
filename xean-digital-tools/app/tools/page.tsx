import { PLATFORMS } from "@/lib/scraper/registry";
import { browserScrapersAvailable, methodExists } from "@/lib/scraper/executor";
import { XEAN_UTILITIES } from "@/config/xean-utilities";
import ToolsBrowser from "@/components/tools/ToolsBrowser";
import type { PlatformInfo } from "@/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tools — Xean Digital Tools" };

export default async function ToolsPage() {
  const browser = await browserScrapersAvailable();
  const platforms: PlatformInfo[] = [];
  for (const p of PLATFORMS) {
    const methods = [];
    for (const m of p.methods) {
      methods.push({ name: m.name, available: (await methodExists(p, m)) && (m.requires !== "browser" || browser), requires: m.requires ?? null });
    }
    platforms.push({ id: p.id, label: p.label, kind: p.kind, methods });
  }
  const total = platforms.length + XEAN_UTILITIES.length;
  return (
    <main className="page">
      <span className="blob b1" aria-hidden />
      <header className="hero rel">
        <span className="eyebrow">All tools</span>
        <h1 style={{ fontSize: "clamp(32px,6vw,48px)" }}>{total} {total === 1 ? "tool" : "tools"}</h1>
        <p>Scrapr-backed downloaders are listed separately from other Xean utilities.</p>
      </header>
      <div className="rel"><ToolsBrowser platforms={platforms} utilities={XEAN_UTILITIES} /></div>
    </main>
  );
}
