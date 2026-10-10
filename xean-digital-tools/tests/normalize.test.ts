import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeScraprResponse } from "../lib/scraper/normalize.ts";

test("tiktok-like: string author, derives format from url, no invented fields", () => {
  const n = normalizeScraprResponse({ status: true, result: {
    title: "T", thumbnail: "https://x/y.jpg", type: "video", author: "creator",
    downloads: [{ type: "video", quality: "720p", url: "https://cdn/x.mp4?sig=1" }, { type: "audio", url: "https://cdn/a.mp3" }],
  } })!;
  assert.equal(n.type, "video");
  assert.deepEqual(n.author, { name: "creator", username: null });
  assert.equal(n.duration, null);
  assert.equal(n.downloads[0].format, "mp4");
  assert.equal(n.downloads[1].quality, null);
  assert.equal(n.downloads[1].type, "audio");
  assert.equal(n.size, null);
});
test("label becomes quality; format null when unknowable", () => {
  const n = normalizeScraprResponse({ status: true, result: { title: "x", downloads: [{ label: "MP4 HD", type: "video", url: "https://cdn/dl?id=1" }] } })!;
  assert.equal(n.downloads[0].quality, "MP4 HD");
  assert.equal(n.downloads[0].format, null);
});
test("object author, numeric duration formatted", () => {
  const n = normalizeScraprResponse({ status: true, result: { title: "x", duration: 125, author: { name: "A", username: "@a" }, downloads: [{ url: "https://c/a.mp3", type: "audio" }] } })!;
  assert.equal(n.duration, "02:05");
  assert.deepEqual(n.author, { name: "A", username: "@a" });
});
test("rejects empty, invalid urls, wrong protocols", () => {
  assert.equal(normalizeScraprResponse(null), null);
  assert.equal(normalizeScraprResponse({ status: true }), null);
  assert.equal(normalizeScraprResponse({ status: true, result: { downloads: [] } }), null);
  assert.equal(normalizeScraprResponse({ status: true, result: { downloads: [{ url: "javascript:alert(1)" }, { url: "" }, {}] } }), null);
  assert.equal(normalizeScraprResponse({ status: true, result: { downloads: "nope" } }), null);
});
test("dedupes urls, handles protocol-relative", () => {
  const n = normalizeScraprResponse({ status: true, result: { downloads: [{ url: "//c/a.mp4" }, { url: "https://c/a.mp4" }] } })!;
  assert.equal(n.downloads.length, 1);
  assert.equal(n.downloads[0].url, "https://c/a.mp4");
});
test("resolver file keeps filename and size", () => {
  const n = normalizeScraprResponse({ status: true, result: { title: "f.zip", filename: "f.zip", size: "12 MB", url: "https://d/f.zip", downloads: [{ type: "file", quality: "Direct Download", url: "https://d/f.zip" }] } })!;
  assert.equal(n.type, "file");
  assert.equal(n.filename, "f.zip");
  assert.equal(n.downloads[0].size, "12 MB");
});
test("playlist: items kept, ignores functions", () => {
  const n = normalizeScraprResponse({ status: true, result: { title: "P", type: "playlist", itemCount: 2, getAudioBuffer() {}, items: [{ id: "1", title: "a", author: "x", url: "https://www.youtube.com/watch?v=1" }, { id: "2", title: "b" }] } })!;
  assert.equal(n.type, "playlist");
  assert.equal(n.items.length, 2);
  assert.equal(n.itemCount, 2);
  assert.equal(n.downloads.length, 0);
});
test("album with per-track downloads does not duplicate top-level list", () => {
  const dl = { type: "audio", quality: "320", url: "https://b/t1.mp3" };
  const n = normalizeScraprResponse({ status: true, result: { title: "A", type: "album", trackCount: 1, tracks: [{ title: "t1", downloads: [dl] }], downloads: [dl] } })!;
  assert.equal(n.downloads.length, 0);
  assert.equal(n.items[0].downloads.length, 1);
});
test("aplmate-style: type text decides kind", () => {
  const n = normalizeScraprResponse({ status: true, result: { title: "s", downloads: [{ type: "Download MP3", url: "https://aplmate.com/dl?token=1" }] } })!;
  assert.equal(n.downloads[0].type, "audio");
});
