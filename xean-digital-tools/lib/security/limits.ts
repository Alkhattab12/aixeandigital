import { DownloaderError } from "../errors.ts";

/** Sliding-window rate limiter (in-memory; swap for Redis when running >1 instance). */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private limit: number;
  private windowMs: number;
  constructor(limit: number, windowMs: number) { this.limit = limit; this.windowMs = windowMs; }

  /** @returns seconds to wait if limited, otherwise 0 */
  check(key: string, now = Date.now()): number {
    const cutoff = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (arr.length >= this.limit) {
      this.hits.set(key, arr);
      return Math.max(1, Math.ceil((arr[0] + this.windowMs - now) / 1000));
    }
    arr.push(now);
    this.hits.set(key, arr);
    if (this.hits.size > 10_000) this.sweep(cutoff);
    return 0;
  }
  private sweep(cutoff: number) {
    for (const [k, v] of this.hits) if (!v.length || v[v.length - 1] <= cutoff) this.hits.delete(k);
  }
}

/** Bounded concurrency with a bounded queue so a flood cannot exhaust the server. */
export class Semaphore {
  private active = 0;
  private queue: (() => void)[] = [];
  private max: number;
  private maxQueue: number;
  constructor(max: number, maxQueue: number) { this.max = max; this.maxQueue = maxQueue; }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      if (this.queue.length >= this.maxQueue) {
        throw new DownloaderError("BUSY", "The service is busy right now. Please try again shortly.", 503);
      }
      await new Promise<void>((resolve) => this.queue.push(resolve));
    } else {
      this.active++;
    }
    try { return await fn(); }
    finally {
      const next = this.queue.shift();
      if (next) next(); else this.active--;
    }
  }
  get stats() { return { active: this.active, queued: this.queue.length }; }
}

/** Collapses identical in-flight requests and keeps a very short-lived memory cache. */
export class Dedupe<T> {
  private inflight = new Map<string, Promise<T>>();
  private cache = new Map<string, { at: number; value: T }>();
  private ttlMs: number;
  constructor(ttlMs: number) { this.ttlMs = ttlMs; }

  run(key: string, fn: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return Promise.resolve(hit.value);
    const running = this.inflight.get(key);
    if (running) return running;
    const p = fn().then((value) => {
      if (this.ttlMs > 0) {
        this.cache.set(key, { at: Date.now(), value });
        if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value as string);
      }
      return value;
    }).finally(() => { this.inflight.delete(key); });
    this.inflight.set(key, p);
    return p;
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error(`timeout: ${label} exceeded ${ms}ms`)), ms); });
  return Promise.race([p, t]).finally(() => { if (timer) clearTimeout(timer); });
}
