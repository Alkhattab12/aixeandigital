import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { scraperHealth } from "@/lib/scraper/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Internal only: disabled (404) unless XEAN_ADMIN_TOKEN is set and supplied via `x-admin-token`. */
export async function GET(req: NextRequest) {
  const expected = process.env.XEAN_ADMIN_TOKEN;
  const given = req.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(given), b = Buffer.from(expected ?? "");
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json(await scraperHealth(), { headers: { "Cache-Control": "no-store" } });
}
