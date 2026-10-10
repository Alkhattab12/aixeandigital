export type PlatformId =
  | "youtube" | "tiktok" | "instagram" | "facebook" | "twitter" | "pinterest"
  | "spotify" | "reddit" | "threads" | "bilibili" | "douyin" | "applemusic"
  | "soundcloud" | "bandcamp" | "pixiv" | "rednote" | "terabox"
  | "mediafire" | "sfile" | "safelinku" | "sub2unlock" | "rekonise";

export type MediaKind =
  | "video" | "audio" | "image" | "mixed" | "playlist" | "album" | "file" | "link";

export type DownloadKind = "video" | "audio" | "image" | "file" | "link";

export interface NormalizedDownload {
  id: string;
  type: DownloadKind;
  quality: string | null;
  format: string | null;
  size: string | null;
  url: string;
}

export interface NormalizedItem {
  id: string | null;
  title: string | null;
  author: string | null;
  thumbnail: string | null;
  duration: string | null;
  /** Original page URL of the item (re-resolvable), if the scraper gave one. */
  url: string | null;
  downloads: NormalizedDownload[];
}

export interface NormalizedMedia {
  title: string | null;
  thumbnail: string | null;
  type: MediaKind;
  duration: string | null;
  author: { name: string | null; username: string | null } | null;
  filename: string | null;
  size: string | null;
  itemCount: number | null;
  items: NormalizedItem[];
  downloads: NormalizedDownload[];
}

export interface DownloadSuccess {
  success: true;
  platform: PlatformId;
  method: string;
  data: NormalizedMedia;
}

export interface DownloadFailure {
  success: false;
  error: { code: ErrorCode; message: string };
  platform?: PlatformId | null;
  requestId: string;
}

export type ErrorCode =
  | "INVALID_URL" | "UNSUPPORTED_PLATFORM" | "RATE_LIMITED" | "BUSY"
  | "EXTRACTION_FAILED" | "BAD_REQUEST" | "INTERNAL";

export interface PlatformInfo {
  id: PlatformId;
  label: string;
  kind: "media" | "resolver";
  methods: { name: string; available: boolean; requires: "browser" | null }[];
}

export interface HistoryEntry {
  id: string;
  platform: PlatformId;
  title: string | null;
  thumbnail: string | null;
  type: DownloadKind;
  format: string | null;
  quality: string | null;
  createdAt: string;
}
