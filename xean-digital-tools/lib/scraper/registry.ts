import type { PlatformId } from "../../types/index.ts";

/**
 * Registry generated from the modules that actually exist in scrapr-main
 * (index.js + lib/<platform>/index.js). Method order = fallback order:
 * lightweight HTTP scrapers first, browser-based scrapers (puppeteer /
 * playwright) last. At runtime `getMethods()` additionally filters against
 * what the loaded scrapr build really exports, so this can never advertise
 * a method that is missing.
 */
export interface MethodDef {
  /** function name on scrapr[namespace] */
  name: string;
  /** extra arguments passed after the url */
  args?: unknown[];
  /** needs puppeteer-core / playwright + a local Chrome */
  requires?: "browser";
}

export interface PlatformDef {
  id: PlatformId;
  label: string;
  /** property on the scrapr export that holds the methods */
  namespace: string;
  kind: "media" | "resolver";
  methods: MethodDef[];
  /** hostnames (exact or suffix match) that belong to this platform */
  domains: string[];
}

export const PLATFORMS: PlatformDef[] = [
  {
    id: "tiktok", label: "TikTok", namespace: "tiktok", kind: "media",
    domains: ["tiktok.com"],
    methods: [
      { name: "snaptik" }, { name: "tiktokio" }, { name: "ssstik" },
      { name: "tikdownloader" }, { name: "savetik", requires: "browser" },
    ],
  },
  {
    id: "instagram", label: "Instagram", namespace: "instagram", kind: "media",
    domains: ["instagram.com", "instagr.am"],
    methods: [
      { name: "direct" }, { name: "indown" }, { name: "snapsave" },
      { name: "snapinsta", requires: "browser" },
    ],
  },
  {
    id: "youtube", label: "YouTube", namespace: "youtube", kind: "media",
    domains: ["youtube.com", "youtu.be", "youtube-nocookie.com"],
    methods: [{ name: "ytmp3gg" }, { name: "ytmp3", args: ["mp4"] }, { name: "playlist" }],
  },
  {
    id: "facebook", label: "Facebook", namespace: "facebook", kind: "media",
    domains: ["facebook.com", "fb.watch", "fb.com"],
    methods: [{ name: "snapsave" }, { name: "fdown", requires: "browser" }],
  },
  {
    id: "twitter", label: "Twitter / X", namespace: "twitter", kind: "media",
    domains: ["twitter.com", "x.com", "t.co"],
    methods: [{ name: "direct" }, { name: "tvd" }, { name: "savetwt" }, { name: "tweeload" }],
  },
  {
    id: "pinterest", label: "Pinterest", namespace: "pinterest", kind: "media",
    domains: ["pinterest.com", "pin.it"],
    methods: [{ name: "direct" }, { name: "pindown" }],
  },
  {
    id: "spotify", label: "Spotify", namespace: "spotify", kind: "media",
    domains: ["spotify.com", "spotify.link"],
    methods: [
      { name: "spotisaver" }, { name: "spotidown" }, { name: "spotmate" }, { name: "soundloaders" },
    ],
  },
  {
    id: "reddit", label: "Reddit", namespace: "reddit", kind: "media",
    domains: ["reddit.com", "redd.it"],
    methods: [{ name: "rapidsave" }],
  },
  {
    id: "threads", label: "Threads", namespace: "threads", kind: "media",
    domains: ["threads.net", "threads.com"],
    methods: [{ name: "threadster" }],
  },
  {
    id: "bilibili", label: "Bilibili", namespace: "bilibili", kind: "media",
    domains: ["bilibili.com", "bilibili.tv", "b23.tv"],
    methods: [{ name: "direct" }],
  },
  {
    id: "douyin", label: "Douyin", namespace: "douyin", kind: "media",
    domains: ["douyin.com", "iesdouyin.com"],
    methods: [{ name: "direct" }],
  },
  {
    id: "applemusic", label: "Apple Music", namespace: "applemusic", kind: "media",
    domains: ["music.apple.com"],
    methods: [{ name: "aplmate" }],
  },
  {
    id: "soundcloud", label: "SoundCloud", namespace: "soundcloud", kind: "media",
    domains: ["soundcloud.com", "snd.sc"],
    methods: [{ name: "klickaud" }],
  },
  {
    id: "bandcamp", label: "Bandcamp", namespace: "bandcamp", kind: "media",
    domains: ["bandcamp.com"],
    methods: [{ name: "bandcampdownloader", args: [{ quality: "320" }] }],
  },
  {
    id: "pixiv", label: "Pixiv", namespace: "pixiv", kind: "media",
    domains: ["pixiv.net"],
    methods: [{ name: "ajax" }],
  },
  {
    id: "rednote", label: "RedNote", namespace: "rednote", kind: "media",
    domains: ["xiaohongshu.com", "xhslink.com", "rednote.com"],
    methods: [{ name: "direct" }],
  },
  {
    id: "terabox", label: "TeraBox", namespace: "terabox", kind: "media",
    domains: [
      "terabox.com", "teraboxapp.com", "terabox.app", "1024terabox.com",
      "4funbox.com", "mirrobox.com", "nephobox.com", "terasharelink.com",
    ],
    methods: [{ name: "sechno" }],
  },
  // --- resolvers (scrapr.resolver.*) ---
  {
    id: "mediafire", label: "MediaFire", namespace: "resolver", kind: "resolver",
    domains: ["mediafire.com"], methods: [{ name: "mediafire" }],
  },
  {
    id: "sfile", label: "Sfile", namespace: "resolver", kind: "resolver",
    domains: ["sfile.co", "sfile.mobi"], methods: [{ name: "sfile" }],
  },
  {
    id: "safelinku", label: "Safelinku", namespace: "resolver", kind: "resolver",
    domains: ["safelinku.com", "sfl.gl"], methods: [{ name: "safelinku" }],
  },
  {
    id: "sub2unlock", label: "Sub2Unlock", namespace: "resolver", kind: "resolver",
    domains: ["sub2unlock.com", "sub4unlock.com", "sub2unlock.io"], methods: [{ name: "sub2unlock" }],
  },
  {
    id: "rekonise", label: "Rekonise", namespace: "resolver", kind: "resolver",
    domains: ["rekonise.com"], methods: [{ name: "rekonise" }],
  },
];

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

export function getPlatform(id: string): PlatformDef | undefined {
  return BY_ID.get(id as PlatformId);
}

/** Order the methods for a given URL (e.g. youtube playlists go to `playlist`). */
export function orderMethodsForUrl(def: PlatformDef, url: string): MethodDef[] {
  if (def.id === "youtube") {
    let isPlaylist = false;
    try {
      const u = new URL(url);
      isPlaylist = u.pathname === "/playlist" && u.searchParams.has("list");
    } catch { /* ignore */ }
    return def.methods.filter((m) => (m.name === "playlist") === isPlaylist);
  }
  return def.methods;
}
