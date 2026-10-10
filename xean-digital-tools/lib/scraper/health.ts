import { PLATFORMS } from "./registry.ts";
import { browserScrapersAvailable, methodExists } from "./executor.ts";
import { getStats } from "./metrics.ts";
import { semaphore } from "./service.ts";

/**
 * Internal diagnostics. Makes NO outbound requests to third-party sites:
 * it reports (a) whether each method exists in the loaded scrapr build,
 * (b) whether its dependencies are present, and (c) real outcomes of recent
 * traffic. A platform with no traffic yet is "unknown", not "available".
 */
export async function scraperHealth() {
  const stats = getStats();
  const browser = await browserScrapersAvailable();
  const platforms = [];
  for (const p of PLATFORMS) {
    const methods = [];
    for (const m of p.methods) {
      const exists = await methodExists(p, m);
      const depsOk = m.requires === "browser" ? browser : true;
      const s = stats[`${p.id}.${m.name}`];
      const status = !exists || !depsOk ? "unavailable" : !s ? "unknown" : s.lastReason === "ok" ? "available" : "error";
      methods.push({ name: m.name, status, ok: s?.ok ?? 0, fail: s?.fail ?? 0, lastReason: s?.lastReason ?? null, lastAt: s?.lastAt ? new Date(s.lastAt).toISOString() : null });
    }
    const st = methods.map((m) => m.status);
    const status = st.includes("available") ? "available" : st.every((x) => x === "unavailable") ? "unavailable" : st.includes("error") ? "error" : "unknown";
    platforms.push({ id: p.id, label: p.label, status, methods });
  }
  return { generatedAt: new Date().toISOString(), queue: semaphore.stats, browserScrapers: browser, platforms };
}
