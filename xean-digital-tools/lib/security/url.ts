import { isIP } from "node:net";
import dns from "node:dns/promises";
import { DownloaderError } from "../errors.ts";

const BLOCKED_HOSTNAMES = new Set([
  "localhost", "ip6-localhost", "ip6-loopback", "metadata.google.internal", "0.0.0.0",
]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".intranet"];

export function isPrivateIPv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||   // CGNAT
    (a === 169 && b === 254) ||             // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224                                // multicast / reserved
  );
}

export function isPrivateIPv6(ip: string): boolean {
  const s = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (s === "::" || s === "::1") return true;
  const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const mappedHex = s.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16), lo = parseInt(mappedHex[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return (
    s.startsWith("fc") || s.startsWith("fd") ||           // unique local
    /^fe[89ab]/.test(s) ||                                // link-local
    s.startsWith("ff") ||                                 // multicast
    s.startsWith("64:ff9b:") || s.startsWith("2001:db8")
  );
}

export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip.replace(/^\[|\]$/g, ""));
  if (v === 4) return isPrivateIPv4(ip);
  if (v === 6) return isPrivateIPv6(ip);
  return true;
}

/**
 * Synchronous structural validation. Throws DownloaderError(INVALID_URL).
 * WHATWG URL already canonicalises decimal / hex / octal IPv4 forms
 * (http://2130706433, http://0x7f.1) to dotted quads, so the IP checks below
 * see the real address.
 */
export function assertSafeUrl(input: unknown, maxLength = 2048): URL {
  if (typeof input !== "string" || !input.trim()) {
    throw new DownloaderError("INVALID_URL", "Please provide a URL.");
  }
  const raw = input.trim();
  if (raw.length > maxLength) throw new DownloaderError("INVALID_URL", "That URL is too long.");
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) throw new DownloaderError("INVALID_URL", "That URL looks malformed.");

  let u: URL;
  try { u = new URL(raw); } catch { throw new DownloaderError("INVALID_URL", "That URL looks malformed."); }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new DownloaderError("INVALID_URL", "Only http(s) links are supported.");
  }
  if (u.username || u.password) {
    throw new DownloaderError("INVALID_URL", "URLs with credentials are not allowed.");
  }
  if (u.port && !["80", "443"].includes(u.port)) {
    throw new DownloaderError("INVALID_URL", "Custom ports are not allowed.");
  }

  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new DownloaderError("INVALID_URL", "That URL looks malformed.");
  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new DownloaderError("INVALID_URL", "That address is not allowed.");
  }
  if (isIP(host.replace(/^\[|\]$/g, "")) && isPrivateIp(host)) {
    throw new DownloaderError("INVALID_URL", "That address is not allowed.");
  }
  if (!host.includes(".") && !host.startsWith("[")) {
    throw new DownloaderError("INVALID_URL", "That address is not allowed.");
  }
  return u;
}

/** Defence in depth: make sure a public-looking hostname does not resolve to a private address. */
export async function assertPublicDns(hostname: string, timeoutMs = 3000): Promise<void> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) { if (isPrivateIp(host)) throw new DownloaderError("INVALID_URL", "That address is not allowed."); return; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      dns.lookup(host, { all: true }),
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("dns-timeout")), timeoutMs); }),
    ]);
    if (!records.length || records.some((r) => isPrivateIp(r.address))) {
      throw new DownloaderError("INVALID_URL", "That address is not allowed.");
    }
  } catch (e) {
    if (e instanceof DownloaderError) throw e;
    throw new DownloaderError("INVALID_URL", "We couldn't resolve that address.");
  } finally { if (timer) clearTimeout(timer); }
}
