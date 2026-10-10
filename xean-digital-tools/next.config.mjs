/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // scrapr is a CommonJS engine that lazily requires optional browser packages.
  // Keep it (and those packages) out of the bundle: it runs only on the server.
  serverExternalPackages: [
    "@coflyn/scrapr",
    "puppeteer-core",
    "playwright",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  poweredByHeader: false,
};
export default nextConfig;
