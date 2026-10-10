export type FailureReason =
  | "ok" | "timeout" | "empty" | "invalid" | "blocked" | "rate_limit" | "changed" | "error" | "skipped";

interface Stat { ok: number; fail: number; lastAt: number; lastReason: FailureReason; lastMs: number }
const stats = new Map<string, Stat>();

export function recordAttempt(platform: string, method: string, reason: FailureReason, ms: number) {
  if (reason === "skipped") return;
  const key = `${platform}.${method}`;
  const s = stats.get(key) ?? { ok: 0, fail: 0, lastAt: 0, lastReason: "ok" as FailureReason, lastMs: 0 };
  if (reason === "ok") s.ok++; else s.fail++;
  s.lastAt = Date.now(); s.lastReason = reason; s.lastMs = ms;
  stats.set(key, s);
}

export function getStats(): Record<string, Stat> {
  return Object.fromEntries(stats);
}
