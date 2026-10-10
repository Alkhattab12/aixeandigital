import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveWithFallback, classifyError } from "../lib/scraper/fallback.ts";
import { processDownload } from "../lib/scraper/service.ts";
import { getPlatform } from "../lib/scraper/registry.ts";
import type { Executor } from "../lib/scraper/executor.ts";

const ok = (u = "https://c/a.mp4") => ({ status: true, result: { title: "t", type: "video", downloads: [{ type: "video", quality: "720p", url: u }] } });
const tiktok = getPlatform("tiktok")!;

test("falls through failures, timeouts, empties, throws until one works", async () => {
  const order: string[] = [];
  const execute: Executor = async (_p, m) => {
    order.push(m.name);
    switch (m.name) {
      case "snaptik": return { status: false, message: "Request failed with status code 403" };
      case "tiktokio": throw new Error("boom");
      case "ssstik": return new Promise(() => {});          // hangs -> timeout
      case "tikdownloader": return { status: true, result: { downloads: [] } };  // empty
      default: return ok();
    }
  };
  const { success, attempts } = await resolveWithFallback(tiktok, "https://tiktok.com/x", { execute, requestId: "t", methodTimeoutMs: 50 });
  assert.equal(success.method, "savetik");
  assert.deepEqual(order, ["snaptik", "tiktokio", "ssstik", "tikdownloader", "savetik"]);
  assert.deepEqual(attempts.map((a) => a.reason), ["blocked", "error", "timeout", "empty", "ok"]);
});
test("stops at first success", async () => {
  const order: string[] = [];
  const execute: Executor = async (_p, m) => { order.push(m.name); return ok(); };
  await resolveWithFallback(tiktok, "https://tiktok.com/x", { execute, requestId: "t" });
  assert.deepEqual(order, ["snaptik"]);
});
test("throws generic error when everything fails; skips unavailable methods", async () => {
  const seen: string[] = [];
  const execute: Executor = async (_p, m) => { seen.push(m.name); return { status: false, message: "nope" }; };
  await assert.rejects(
    resolveWithFallback(tiktok, "https://tiktok.com/x", { execute, requestId: "t", isAvailable: (_p, m) => m.requires !== "browser" }),
    (e: any) => e.code === "EXTRACTION_FAILED" && !/nope/.test(e.message),
  );
  assert.ok(!seen.includes("savetik"));
});
test("youtube playlist urls only use the playlist method", async () => {
  const yt = getPlatform("youtube")!;
  const seen: string[] = [];
  const execute: Executor = async (_p, m) => { seen.push(m.name); return { status: true, result: { type: "playlist", items: [{ title: "a" }] } }; };
  await resolveWithFallback(yt, "https://www.youtube.com/playlist?list=PL1", { execute, requestId: "t" });
  await resolveWithFallback(yt, "https://www.youtube.com/watch?v=abc", { execute, requestId: "t" });
  assert.deepEqual(seen, ["playlist", "ytmp3gg"]);
});
test("classifyError", () => {
  assert.equal(classifyError("timeout: x"), "timeout");
  assert.equal(classifyError("Request failed with status code 429"), "rate_limit");
  assert.equal(classifyError("Cloudflare challenge"), "blocked");
  assert.equal(classifyError("Could not extract CSRF token"), "changed");
});
test("service: rejects ssrf + unsupported, resolves supported, dedupes", async () => {
  await assert.rejects(processDownload("http://127.0.0.1/x", { requestId: "r", skipDns: true }), (e: any) => e.code === "INVALID_URL");
  await assert.rejects(processDownload("https://example.com/x", { requestId: "r", skipDns: true }), (e: any) => e.code === "UNSUPPORTED_PLATFORM");
  let calls = 0;
  const execute: Executor = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return ok(); };
  const [a, b] = await Promise.all([
    processDownload("https://www.tiktok.com/@a/video/1", { requestId: "1", execute, skipDns: true }),
    processDownload("https://www.tiktok.com/@a/video/1", { requestId: "2", execute, skipDns: true }),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.platform, "tiktok");
  assert.equal(b.data.downloads[0].quality, "720p");
});
