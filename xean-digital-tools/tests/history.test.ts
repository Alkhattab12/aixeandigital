import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.XEAN_DATA_DIR = mkdtempSync(path.join(tmpdir(), "xean-"));
const { addHistory, listHistory, clearHistory, sanitizeEntry } = await import("../lib/history/store.ts");

test("history stores metadata only, never direct urls", async () => {
  const e = await addHistory("c1", { platform: "tiktok", title: "T", thumbnail: "https://t/x.jpg", type: "video", format: "mp4", quality: "720p", url: "https://secret/expiring.mp4", downloads: [1] });
  assert.ok(!("url" in e) && !("downloads" in e));
  assert.equal((await listHistory("c1")).length, 1);
  assert.equal((await listHistory("c2")).length, 0);
});
test("rejects unknown platform, drops bad thumbnail scheme", async () => {
  assert.throws(() => sanitizeEntry({ platform: "evil" }));
  assert.equal(sanitizeEntry({ platform: "tiktok", thumbnail: "javascript:alert(1)" }).thumbnail, null);
});
test("concurrent writes are not lost; delete one / clear", async () => {
  await Promise.all(Array.from({ length: 10 }, (_, i) => addHistory("c3", { platform: "youtube", title: `t${i}`, type: "audio" })));
  const list = await listHistory("c3");
  assert.equal(list.length, 10);
  await clearHistory("c3", list[0].id);
  assert.equal((await listHistory("c3")).length, 9);
  await clearHistory("c3");
  assert.equal((await listHistory("c3")).length, 0);
});
