import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafeUrl } from "../lib/security/url.ts";
import { RateLimiter, Semaphore, Dedupe, withTimeout } from "../lib/security/limits.ts";

const bad = [
  "http://localhost/x", "http://127.0.0.1/x", "http://0.0.0.0/", "http://10.1.2.3/", "http://172.16.0.1/",
  "http://172.31.255.255/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data",
  "http://2130706433/", "http://0x7f.1/", "http://017700000001/", "http://[::1]/", "http://[::ffff:127.0.0.1]/",
  "http://[fd00::1]/", "http://[fe80::1]/", "http://foo.internal/", "http://printer.local/", "http://metadata.google.internal/",
  "http://intranet/", "ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "http://user:pw@example.com/",
  "https://example.com:8443/", "http://exa mple.com/", "", "   ", "https://", "http://100.64.0.1/",
];
for (const u of bad) test(`rejects ${JSON.stringify(u)}`, () => assert.throws(() => assertSafeUrl(u), /./));
test("rejects non-string and overlong", () => {
  assert.throws(() => assertSafeUrl(undefined));
  assert.throws(() => assertSafeUrl({}));
  assert.throws(() => assertSafeUrl("https://example.com/" + "a".repeat(3000)));
});
test("accepts normal public urls", () => {
  assert.equal(assertSafeUrl("https://www.tiktok.com/@a/video/1").hostname, "www.tiktok.com");
  assert.equal(assertSafeUrl("http://example.com:80/x").hostname, "example.com");
});

test("rate limiter blocks after limit and recovers", () => {
  const r = new RateLimiter(3, 1000);
  assert.equal(r.check("a", 0), 0); assert.equal(r.check("a", 10), 0); assert.equal(r.check("a", 20), 0);
  assert.ok(r.check("a", 30) > 0);
  assert.equal(r.check("b", 30), 0);
  assert.equal(r.check("a", 1100), 0);
});
test("semaphore limits concurrency and bounds the queue", async () => {
  const s = new Semaphore(2, 1);
  let running = 0, peak = 0;
  const task = () => s.run(async () => { running++; peak = Math.max(peak, running); await new Promise((r) => setTimeout(r, 30)); running--; });
  const results = await Promise.allSettled([task(), task(), task(), task()]);
  assert.equal(peak, 2);
  assert.equal(results.filter((x) => x.status === "rejected").length, 1);
});
test("dedupe shares in-flight work", async () => {
  const d = new Dedupe<number>(0);
  let calls = 0;
  const fn = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return 1; };
  await Promise.all([d.run("k", fn), d.run("k", fn), d.run("k", fn)]);
  assert.equal(calls, 1);
});
test("withTimeout rejects slow work", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 20, "x"), /timeout/);
});
