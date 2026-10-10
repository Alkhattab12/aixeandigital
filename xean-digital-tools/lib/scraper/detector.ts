import type { PlatformId } from "../../types/index.ts";
import { PLATFORMS } from "./registry.ts";

export interface Detection {
  platform: PlatformId | null;
  normalizedUrl: string | null;
  supported: boolean;
}

const MAX_URL_LENGTH = 2048;

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith("." + domain);
}

/**
 * Pure, dependency-free platform detection (safe to use in the browser too).
 * Only hostnames that belong to a platform in the registry are "supported",
 * which doubles as an allow-list for the server.
 */
export function detectPlatform(input: string): Detection {
  const none: Detection = { platform: null, normalizedUrl: null, supported: false };
  if (typeof input !== "string") return none;
  let raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return none;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = "https://" + raw;

  let u: URL;
  try { u = new URL(raw); } catch { return none; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return none;

  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  u.hostname = host;
  u.hash = "";
  const normalizedUrl = u.toString();

  for (const p of PLATFORMS) {
    if (p.domains.some((d) => hostMatches(host, d))) {
      return { platform: p.id, normalizedUrl, supported: true };
    }
  }
  return { platform: null, normalizedUrl, supported: false };
}
