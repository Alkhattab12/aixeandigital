import type {
  DownloadKind, MediaKind, NormalizedDownload, NormalizedItem, NormalizedMedia,
} from "../../types/index.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
const KNOWN_EXT = new Set([
  "mp4", "m4v", "webm", "mov", "mkv", "m3u8", "mp3", "m4a", "aac", "ogg", "opus", "wav", "flac",
  "jpg", "jpeg", "png", "webp", "gif", "avif", "zip", "rar", "7z", "pdf", "apk",
]);

const str = (v: unknown): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
};

export function cleanUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const full = s.startsWith("//") ? "https:" + s : s;
  try {
    const u = new URL(full);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch { return null; }
}

function extOf(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    const e = m?.[1].toLowerCase();
    return e && KNOWN_EXT.has(e) ? e : null;
  } catch { return null; }
}

export function formatDuration(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) {
    const total = Math.round(v);
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  return str(v);
}

function kindFromHint(hint: string | null): DownloadKind | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  if (/audio|mp3|m4a|aac|music/.test(h)) return "audio";
  if (/image|photo|cover|jpg|jpeg|png|webp|picture/.test(h)) return "image";
  if (/video|mp4|webm|\bhd\b|watermark/.test(h)) return "video";
  if (/\bfile\b/.test(h)) return "file";
  if (/\blink\b/.test(h)) return "link";
  return null;
}

function kindFromExt(ext: string | null): DownloadKind | null {
  if (!ext) return null;
  if (["mp4", "m4v", "webm", "mov", "mkv", "m3u8"].includes(ext)) return "video";
  if (["mp3", "m4a", "aac", "ogg", "opus", "wav", "flac"].includes(ext)) return "audio";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(ext)) return "image";
  return "file";
}

function normalizeDownloads(list: unknown, fallbackKind: DownloadKind | null, size: string | null, prefix = "dl"): NormalizedDownload[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: NormalizedDownload[] = [];
  for (const d of list as any[]) {
    if (!d || typeof d !== "object") continue;
    const url = cleanUrl(d.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const ext = extOf(url);
    const format = str(d.format)?.toLowerCase() ?? ext;
    const type: DownloadKind =
      kindFromHint(str(d.type)) ?? kindFromHint(format) ?? kindFromExt(ext) ?? fallbackKind ?? "file";
    const quality = str(d.quality) ?? str(d.label);
    out.push({
      id: `${prefix}-${out.length + 1}`,
      type,
      quality,
      format,
      size: str(d.size) ?? null,
      url,
    });
  }
  // a lone file/link result may carry its size at the top level
  if (out.length === 1 && !out[0].size && size) out[0].size = size;
  return out;
}

function normalizeAuthor(a: unknown, fallbackName?: unknown) {
  if (typeof a === "string") { const name = str(a); return name ? { name, username: null } : null; }
  if (a && typeof a === "object") {
    const o = a as any;
    const name = str(o.name) ?? str(o.nickname) ?? str(o.author_name);
    const username = str(o.username) ?? str(o.unique_id);
    if (name || username) return { name, username };
  }
  const name = str(fallbackName);
  return name ? { name, username: null } : null;
}

function mediaKind(rawType: unknown, downloads: NormalizedDownload[], items: NormalizedItem[]): MediaKind {
  const t = str(rawType)?.toLowerCase();
  switch (t) {
    case "video": case "audio": case "mixed": case "playlist": case "album": case "file": case "link":
      return t;
    case "image": case "photo": return "image";
    case "track": return "audio";
  }
  if (items.length > 1 && !downloads.length) return "playlist";
  const kinds = new Set(downloads.map((d) => d.type));
  if (kinds.size === 1) return [...kinds][0];
  if (kinds.size > 1) return "mixed";
  return "file";
}

function normalizeItem(i: any, idx: number): NormalizedItem | null {
  if (!i || typeof i !== "object") return null;
  const item: NormalizedItem = {
    id: str(i.id),
    title: str(i.title) ?? str(i.name),
    author: str(i.author?.name ?? i.author) ?? str(i.artist),
    thumbnail: cleanUrl(i.thumbnail),
    duration: formatDuration(i.duration),
    url: cleanUrl(i.url),
    downloads: normalizeDownloads(i.downloads, null, null, `item${idx + 1}`),
  };
  return item.title || item.url || item.downloads.length ? item : null;
}

/**
 * Convert a raw scrapr `{status, result}` into the single shape the UI uses.
 * Fields a scraper did not provide stay `null` — nothing is invented.
 * Returns null when the response contains nothing downloadable.
 */
export function normalizeScraprResponse(raw: unknown): NormalizedMedia | null {
  if (!raw || typeof raw !== "object") return null;
  const r = (raw as any).result;
  if (!r || typeof r !== "object") return null;

  const size = str(r.size);
  const rawItems: unknown[] = Array.isArray(r.items) ? r.items : Array.isArray(r.tracks) ? r.tracks : [];
  const items = rawItems.map((x, i) => normalizeItem(x, i)).filter((x): x is NormalizedItem => !!x);

  let downloads = normalizeDownloads(r.downloads, null, size);
  if (downloads.length && items.length) {
    const inItems = new Set(items.flatMap((i) => i.downloads.map((d) => d.url)));
    if (downloads.every((d) => inItems.has(d.url))) downloads = [];
  }
  if (!downloads.length && !items.length) return null;

  const count = [r.itemCount, r.trackCount, r.totalFiles].map((n) => (typeof n === "number" ? n : null)).find((n) => n !== null) ?? (items.length || null);

  return {
    title: str(r.title),
    thumbnail: cleanUrl(r.thumbnail),
    type: mediaKind(r.type, downloads, items),
    duration: formatDuration(r.duration),
    author: normalizeAuthor(r.author, r.artist),
    filename: str(r.filename),
    size,
    itemCount: count,
    items,
    downloads,
  };
}
