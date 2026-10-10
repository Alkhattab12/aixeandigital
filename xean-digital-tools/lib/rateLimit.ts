import { RateLimiter } from "./security/limits.ts";
const n = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

export const downloadLimiter = new RateLimiter(n(process.env.XEAN_RATE_LIMIT, 20), n(process.env.XEAN_RATE_WINDOW_MS, 60_000));
export const historyLimiter = new RateLimiter(120, 60_000);
