import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DownloadKind, HistoryEntry, PlatformId } from "../../types/index.ts";
import { PLATFORMS } from "../scraper/registry.ts";
import { DownloaderError } from "../errors.ts";

/**
 * Tiny JSON-file store keyed by an anonymous client id.
 * Stores METADATA ONLY. Direct media URLs are never written (they expire);
 * history items are re-resolved from the source link when needed.
 * Replace with a real database when you add accounts / multiple instances.
 */
const MAX_PER_CLIENT = 200;
const KINDS: DownloadKind[] = ["video", "audio", "image", "file", "link"];
const file = () => path.join(process.env.XEAN_DATA_DIR ?? path.join(process.cwd(), "data"), "history.json");

type Db = Record<string, HistoryEntry[]>;
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
};

async function load(): Promise<Db> {
  try { return JSON.parse(await fs.readFile(file(), "utf8")) as Db; } catch { return {}; }
}
async function save(db: Db) {
  const f = file();
  await fs.mkdir(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, f);
}

const clip = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const httpUrl = (v: unknown): string | null => {
  const s = clip(v, 1000);
  if (!s) return null;
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null; } catch { return null; }
};

export function sanitizeEntry(input: unknown): Omit<HistoryEntry, "id" | "createdAt"> {
  const o = (input ?? {}) as Record<string, unknown>;
  const platform = PLATFORMS.find((p) => p.id === o.platform)?.id as PlatformId | undefined;
  if (!platform) throw new DownloaderError("BAD_REQUEST", "Unknown platform.");
  const type = KINDS.includes(o.type as DownloadKind) ? (o.type as DownloadKind) : "file";
  return { platform, title: clip(o.title, 200), thumbnail: httpUrl(o.thumbnail), type, format: clip(o.format, 12), quality: clip(o.quality, 40) };
}

export const listHistory = async (clientId: string): Promise<HistoryEntry[]> => (await load())[clientId] ?? [];

export const addHistory = (clientId: string, input: unknown): Promise<HistoryEntry> =>
  serial(async () => {
    const entry: HistoryEntry = { id: randomUUID(), createdAt: new Date().toISOString(), ...sanitizeEntry(input) };
    const db = await load();
    db[clientId] = [entry, ...(db[clientId] ?? [])].slice(0, MAX_PER_CLIENT);
    await save(db);
    return entry;
  });

export const clearHistory = (clientId: string, id?: string): Promise<void> =>
  serial(async () => {
    const db = await load();
    db[clientId] = id ? (db[clientId] ?? []).filter((e) => e.id !== id) : [];
    if (!db[clientId].length) delete db[clientId];
    await save(db);
  });
