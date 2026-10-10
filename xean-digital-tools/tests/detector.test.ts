import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPlatform } from "../lib/scraper/detector.ts";
import { PLATFORMS } from "../lib/scraper/registry.ts";

const cases: [string, string][] = [
  ["https://www.tiktok.com/@a/video/123", "tiktok"],
  ["https://vm.tiktok.com/ZMabc/", "tiktok"],
  ["https://www.instagram.com/reel/abc/", "instagram"],
  ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
  ["https://m.youtube.com/watch?v=x", "youtube"],
  ["https://fb.watch/abc/", "facebook"],
  ["https://x.com/u/status/1", "twitter"],
  ["https://twitter.com/u/status/1", "twitter"],
  ["https://pin.it/abc", "pinterest"],
  ["https://open.spotify.com/track/1", "spotify"],
  ["https://redd.it/abc", "reddit"],
  ["https://www.threads.net/@a/post/1", "threads"],
  ["https://www.bilibili.com/video/BV1xx", "bilibili"],
  ["https://v.douyin.com/abc/", "douyin"],
  ["https://music.apple.com/us/album/x/1", "applemusic"],
  ["https://soundcloud.com/a/b", "soundcloud"],
  ["https://artist.bandcamp.com/album/x", "bandcamp"],
  ["https://www.pixiv.net/en/artworks/1", "pixiv"],
  ["https://www.xiaohongshu.com/explore/1", "rednote"],
  ["https://www.terabox.com/s/1abc", "terabox"],
  ["https://www.mediafire.com/file/abc/x.zip", "mediafire"],
  ["https://sfile.co/abc", "sfile"],
  ["https://sfl.gl/abc", "safelinku"],
  ["https://sub2unlock.com/abc", "sub2unlock"],
  ["https://rekonise.com/abc", "rekonise"],
];
for (const [url, platform] of cases) {
  test(`detects ${platform}: ${url}`, () => {
    const d = detectPlatform(url);
    assert.equal(d.platform, platform);
    assert.equal(d.supported, true);
    assert.ok(d.normalizedUrl);
  });
}
test("scheme-less input gets https", () => {
  assert.equal(detectPlatform("tiktok.com/@a/video/1").normalizedUrl, "https://tiktok.com/@a/video/1");
});
test("lookalike hosts are not matched", () => {
  for (const u of ["https://nottiktok.com/x", "https://tiktok.com.evil.io/x", "https://evil.io/?u=https://tiktok.com/x", "https://youtube.com@evil.io/"]) {
    assert.equal(detectPlatform(u).supported, false, u);
  }
});
test("garbage / non-http is unsupported", () => {
  for (const u of ["", "   ", "javascript:alert(1)", "ftp://tiktok.com/x", "not a url", "file:///etc/passwd"]) {
    assert.equal(detectPlatform(u).supported, false, u);
  }
});
test("every spec platform id exists in registry", () => {
  const want = "youtube tiktok instagram facebook twitter pinterest spotify reddit threads bilibili douyin applemusic soundcloud bandcamp pixiv rednote terabox mediafire sfile safelinku sub2unlock rekonise".split(" ");
  assert.deepEqual(PLATFORMS.map((p) => p.id).sort(), want.sort());
});
