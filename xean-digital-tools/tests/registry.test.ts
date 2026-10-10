import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { PLATFORMS } from "../lib/scraper/registry.ts";

/** Registry must only reference functions scrapr-main really exports (parsed statically from lib/<ns>/index.js). */
function exportsOf(ns: string): string[] {
  const file = `scrapr/lib/${ns}/index.js`;
  assert.ok(existsSync(file), `${file} missing`);
  const src = readFileSync(file, "utf8");
  const block = src.match(/module\.exports\s*=\s*\{([\s\S]*?)\};?\s*$/)![1];
  return block.split(",").map((x) => x.split(":")[0].trim()).filter(Boolean);
}
for (const p of PLATFORMS) {
  test(`registry ${p.id} matches scrapr.${p.namespace}`, () => {
    const real = exportsOf(p.namespace);
    for (const m of p.methods) assert.ok(real.includes(m.name), `${p.namespace}.${m.name} not exported by scrapr (has: ${real})`);
  });
}
test("every scrapr namespace is covered", () => {
  const covered = new Set(PLATFORMS.map((p) => p.namespace));
  for (const ns of "bilibili douyin applemusic soundcloud tiktok youtube instagram bandcamp spotify twitter pinterest facebook threads pixiv rednote reddit terabox resolver".split(" ")) assert.ok(covered.has(ns), ns);
});
