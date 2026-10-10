import type { DownloadSuccess } from "../../types/index.ts";
import { DownloaderError } from "../errors.ts";
import { Dedupe, Semaphore } from "../security/limits.ts";
import { assertPublicDns, assertSafeUrl } from "../security/url.ts";
import { detectPlatform } from "./detector.ts";
import { browserScrapersAvailable, methodExists, scraprExecutor, type Executor } from "./executor.ts";
import { resolveWithFallback } from "./fallback.ts";
import { getPlatform } from "./registry.ts";

const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

const semaphore = new Semaphore(num(process.env.XEAN_MAX_CONCURRENCY, 4), num(process.env.XEAN_MAX_QUEUE, 20));
// Short in-memory memo only: extracted direct URLs are temporary and are never persisted.
const dedupe = new Dedupe<DownloadSuccess>(num(process.env.XEAN_CACHE_TTL_MS, 30_000));

export interface ProcessOptions { requestId: string; execute?: Executor; skipDns?: boolean }

export async function processDownload(rawUrl: unknown, opts: ProcessOptions): Promise<DownloadSuccess> {
  const parsed = assertSafeUrl(rawUrl);
  const det = detectPlatform(parsed.toString());
  if (!det.supported || !det.platform || !det.normalizedUrl) {
    throw new DownloaderError("UNSUPPORTED_PLATFORM", "This website is not supported yet.", 422);
  }
  const platform = getPlatform(det.platform)!;
  if (!opts.skipDns && process.env.XEAN_DNS_CHECK !== "off") await assertPublicDns(parsed.hostname);

  const execute = opts.execute ?? scraprExecutor;
  const browserOk = opts.execute ? true : await browserScrapersAvailable();

  return dedupe.run(`${platform.id}:${det.normalizedUrl}`, () =>
    semaphore.run(async () => {
      const { success } = await resolveWithFallback(platform, det.normalizedUrl!, {
        execute,
        requestId: opts.requestId,
        methodTimeoutMs: num(process.env.XEAN_METHOD_TIMEOUT_MS, 30_000),
        totalTimeoutMs: num(process.env.XEAN_TOTAL_TIMEOUT_MS, 75_000),
        isAvailable: async (p, m) => {
          if (m.requires === "browser" && !browserOk) return false;
          return opts.execute ? true : methodExists(p, m);
        },
      });
      return success;
    }),
  );
}

export { semaphore };
