import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DownloaderError } from "@/lib/errors";
import { clientIp, ensureClientId, errorResponse, newRequestId, readJsonBody, withClientCookie } from "@/lib/http";
import { historyLimiter } from "@/lib/rateLimit";
import { addHistory, clearHistory, listHistory } from "@/lib/history/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function guard(req: NextRequest) {
  const wait = historyLimiter.check(clientIp(req));
  if (wait) throw new DownloaderError("RATE_LIMITED", `Too many requests. Try again in ${wait}s.`, 429);
}

export async function GET(req: NextRequest) {
  const rid = newRequestId();
  try {
    guard(req);
    const { id, isNew } = ensureClientId(req);
    return withClientCookie(json({ history: await listHistory(id) }), id, isNew);
  } catch (e) { return errorResponse(e, rid); }
}

export async function POST(req: NextRequest) {
  const rid = newRequestId();
  try {
    guard(req);
    const { id, isNew } = ensureClientId(req);
    const entry = await addHistory(id, await readJsonBody(req));
    return withClientCookie(json({ entry }, 201), id, isNew);
  } catch (e) { return errorResponse(e, rid); }
}

/** DELETE /api/history        -> clear all;  DELETE /api/history?id=... -> remove one */
export async function DELETE(req: NextRequest) {
  const rid = newRequestId();
  try {
    guard(req);
    const { id } = ensureClientId(req);
    await clearHistory(id, req.nextUrl.searchParams.get("id") ?? undefined);
    return json({ ok: true });
  } catch (e) { return errorResponse(e, rid); }
}
