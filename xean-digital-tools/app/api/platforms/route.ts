import { ok } from "@/lib/http";
import { PLATFORMS } from "@/lib/scraper/registry";
import { browserScrapersAvailable, methodExists } from "@/lib/scraper/executor";
import type { PlatformInfo } from "@/types";

export const runtime = "nodejs";

export async function GET() {
  const browser = await browserScrapersAvailable();
  const platforms: PlatformInfo[] = [];
  for (const p of PLATFORMS) {
    const methods = [];
    for (const m of p.methods) {
      const exists = await methodExists(p, m);
      methods.push({ name: m.name, available: exists && (m.requires !== "browser" || browser), requires: m.requires ?? null });
    }
    platforms.push({ id: p.id, label: p.label, kind: p.kind, methods });
  }
  return ok({ platforms }, { "Cache-Control": "public, max-age=60" });
}
