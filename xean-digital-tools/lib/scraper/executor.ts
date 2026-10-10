import type { MethodDef, PlatformDef } from "./registry.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Executor = (platform: PlatformDef, method: MethodDef, url: string) => Promise<unknown>;

let scraprPromise: Promise<any> | null = null;

/** Loaded lazily and only on the server. Variable specifier keeps bundlers away from it. */
export function loadScrapr(): Promise<any> {
  if (!scraprPromise) {
    const name = "@coflyn/scrapr";
    scraprPromise = import(/* webpackIgnore: true */ name).then((m: any) => m.default ?? m);
  }
  return scraprPromise;
}

/** Thin adapter: call the untouched scrapr function `scrapr[namespace][method](url, ...args)`. */
export const scraprExecutor: Executor = async (platform, method, url) => {
  const scrapr = await loadScrapr();
  const fn = scrapr?.[platform.namespace]?.[method.name];
  if (typeof fn !== "function") throw new Error(`scrapr.${platform.namespace}.${method.name} is not available`);
  return fn(url, ...(method.args ?? []));
};

let browserOk: boolean | null = null;
/** Browser-backed scrapers need puppeteer-core / playwright-extra. XEAN_BROWSER_SCRAPERS=on|off|auto. */
export async function browserScrapersAvailable(): Promise<boolean> {
  const mode = (process.env.XEAN_BROWSER_SCRAPERS ?? "auto").toLowerCase();
  if (mode === "off") return false;
  if (mode === "on") return true;
  if (browserOk !== null) return browserOk;
  try {
    const name = "puppeteer-core";
    await import(/* webpackIgnore: true */ name);
    browserOk = true;
  } catch { browserOk = false; }
  return browserOk;
}

/** Which of the registry methods does the loaded scrapr build really expose? */
export async function methodExists(platform: PlatformDef, method: MethodDef): Promise<boolean> {
  try {
    const scrapr = await loadScrapr();
    return typeof scrapr?.[platform.namespace]?.[method.name] === "function";
  } catch { return false; }
}
