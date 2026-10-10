import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { DownloaderError } from "./errors.ts";
import type { DownloadFailure, ErrorCode } from "../types/index.ts";

export const CLIENT_COOKIE = "xean_cid";
const NO_STORE = { "Cache-Control": "no-store" };

export function newRequestId(): string { return randomUUID().slice(0, 8); }

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("x-real-ip") || "unknown";
}

export async function readJsonBody(req: NextRequest, maxBytes = 4096): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new DownloaderError("BAD_REQUEST", "Request is too large.", 413);
  const text = await req.text();
  if (text.length > maxBytes) throw new DownloaderError("BAD_REQUEST", "Request is too large.", 413);
  try { return JSON.parse(text); } catch { throw new DownloaderError("BAD_REQUEST", "Body must be valid JSON."); }
}

const USER_MESSAGES: Partial<Record<ErrorCode, string>> = {
  EXTRACTION_FAILED: "We couldn't process this link. The platform may have changed its page structure or temporarily blocked the extraction service.",
  INTERNAL: "Something went wrong on our side. Please try again.",
};

/** Convert any thrown value into a safe JSON error — no stack traces or internals. */
export function errorResponse(e: unknown, requestId: string, platform?: DownloadFailure["platform"], extraHeaders: Record<string, string> = {}) {
  const err = e instanceof DownloaderError ? e : new DownloaderError("INTERNAL", "", 500);
  const body: DownloadFailure = {
    success: false,
    error: { code: err.code, message: USER_MESSAGES[err.code] ?? err.message },
    platform: platform ?? null,
    requestId,
  };
  return NextResponse.json(body, { status: err.status, headers: { ...NO_STORE, ...extraHeaders } });
}

export function ok(body: unknown, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { headers: { ...NO_STORE, ...headers } });
}

export function ensureClientId(req: NextRequest): { id: string; isNew: boolean } {
  const existing = req.cookies.get(CLIENT_COOKIE)?.value;
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return { id: existing, isNew: false };
  return { id: randomUUID(), isNew: true };
}

export function withClientCookie(res: NextResponse, id: string, isNew: boolean) {
  if (isNew) {
    res.cookies.set(CLIENT_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
