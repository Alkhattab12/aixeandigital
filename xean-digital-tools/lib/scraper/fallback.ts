import type { DownloadSuccess, NormalizedMedia } from "../../types/index.ts";
import { DownloaderError } from "../errors.ts";
import { logEvent } from "../logger.ts";
import { withTimeout } from "../security/limits.ts";
import { normalizeScraprResponse } from "./normalize.ts";
import { recordAttempt, type FailureReason } from "./metrics.ts";
import { orderMethodsForUrl, type MethodDef, type PlatformDef } from "./registry.ts";
import type { Executor } from "./executor.ts";

export interface Attempt { method: string; reason: FailureReason; ms: number; message?: string }

export interface FallbackOptions {
  execute: Executor;
  requestId: string;
  /** per-method timeout */
  methodTimeoutMs?: number;
  /** stop starting new methods after this much total time */
  totalTimeoutMs?: number;
  /** return false to skip a method (missing dependency, etc.) */
  isAvailable?: (platform: PlatformDef, method: MethodDef) => Promise<boolean> | boolean;
}

export function classifyError(message: string): FailureReason {
  const m = message.toLowerCase();
  if (m.startsWith("timeout") || /etimedout|timed out|socket hang up/.test(m)) return "timeout";
  if (/\b429\b|rate.?limit|too many requests/.test(m)) return "rate_limit";
  if (/\b40[13]\b|forbidden|captcha|cloudflare|turnstile|blocked|access denied/.test(m)) return "blocked";
  if (/csrf|token|parse|undefined|cannot read|unexpected|selector|structure/.test(m)) return "changed";
  return "error";
}

/**
 * Try every available extraction method for the platform in order and return the
 * first response that normalises to something downloadable. A scraper that
 * throws, times out, returns `status:false`, or returns an empty/invalid payload
 * simply moves us on to the next method.
 */
export async function resolveWithFallback(
  platform: PlatformDef,
  url: string,
  opts: FallbackOptions,
): Promise<{ success: DownloadSuccess; attempts: Attempt[] }> {
  const methodTimeout = opts.methodTimeoutMs ?? 30_000;
  const deadline = Date.now() + (opts.totalTimeoutMs ?? 75_000);
  const attempts: Attempt[] = [];

  for (const method of orderMethodsForUrl(platform, url)) {
    if (Date.now() >= deadline) break;
    const started = Date.now();
    const finish = (reason: FailureReason, message?: string): Attempt => {
      const a: Attempt = { method: method.name, reason, ms: Date.now() - started, message };
      attempts.push(a);
      recordAttempt(platform.id, method.name, reason, a.ms);
      if (reason !== "ok") {
        logEvent({ level: "warn", requestId: opts.requestId, platform: platform.id, method: method.name, error: message ?? reason, reason });
      }
      return a;
    };

    if (opts.isAvailable && !(await opts.isAvailable(platform, method))) { finish("skipped", "method unavailable"); continue; }

    try {
      const raw: any = await withTimeout(
        Promise.resolve().then(() => opts.execute(platform, method, url)),
        methodTimeout,
        `${platform.id}.${method.name}`,
      );
      if (!raw || typeof raw !== "object") { finish("invalid", "non-object response"); continue; }
      if (!raw.status) { finish(classifyError(String(raw.message ?? "")), String(raw.message ?? "status false")); continue; }
      const data: NormalizedMedia | null = normalizeScraprResponse(raw);
      if (!data) { finish("empty", "no downloadable media in response"); continue; }
      finish("ok");
      return { success: { success: true, platform: platform.id, method: method.name, data }, attempts };
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      finish(classifyError(msg), msg);
    }
  }

  throw new DownloaderError("EXTRACTION_FAILED", "All available extraction methods failed", 502);
}
