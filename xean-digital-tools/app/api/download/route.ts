import { NextRequest } from "next/server";
import { DownloaderError } from "@/lib/errors";
import { clientIp, errorResponse, newRequestId, ok, readJsonBody } from "@/lib/http";
import { logEvent } from "@/lib/logger";
import { downloadLimiter } from "@/lib/rateLimit";
import { processDownload } from "@/lib/scraper/service";
import { detectPlatform } from "@/lib/scraper/detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const requestId = newRequestId();
  let platform: ReturnType<typeof detectPlatform>["platform"] = null;
  try {
    const wait = downloadLimiter.check(clientIp(req));
    if (wait) throw Object.assign(new DownloaderError("RATE_LIMITED", `Too many requests. Try again in ${wait}s.`, 429), { wait });

    const body = (await readJsonBody(req)) as { url?: unknown } | null;
    platform = detectPlatform(typeof body?.url === "string" ? body.url : "").platform;
    const result = await processDownload(body?.url, { requestId });
    return ok(result);
  } catch (e) {
    const wait = (e as { wait?: number })?.wait;
    if (!(e instanceof DownloaderError) || e.code === "INTERNAL" || e.code === "EXTRACTION_FAILED") {
      logEvent({ level: "error", requestId, platform, error: e instanceof Error ? e.message : String(e) });
    }
    return errorResponse(e, requestId, platform, wait ? { "Retry-After": String(wait) } : {});
  }
}
