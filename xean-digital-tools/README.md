# Xean Digital Tools

Aplikasi downloader media (Next.js + API server-side) dengan **scrapr-main** sebagai mesin ekstraksi.
Folder `scrapr/` adalah kode asli scrapr, tidak diubah. Aplikasi hanya membungkusnya lewat adapter.

## Menjalankan
Butuh Node.js >= 22.18.

```bash
npm install
cp .env.example .env.local   # opsional
npm run dev                  # http://localhost:3000
npm test                     # 105 tes: detector, SSRF, normalisasi, fallback, registry, history
npm run build && npm start
```

## Arsitektur
```
UI (app/, components/)  ->  POST /api/download  ->  lib/scraper/*  ->  scrapr/ (lib/*)
```
- `lib/scraper/registry.ts` platform, method, dan urutan fallback (dicek tes terhadap ekspor asli scrapr)
- `lib/scraper/detector.ts` deteksi platform berbasis hostname (juga berfungsi sebagai allow-list)
- `lib/scraper/executor.ts` adapter tipis: memanggil `scrapr[namespace][method](url, ...)`
- `lib/scraper/fallback.ts` orkestrator: timeout per method, lanjut ke method berikut saat gagal/kosong/invalid
- `lib/scraper/normalize.ts` bentuk response tunggal; field yang tidak diberikan scraper = `null`
- `lib/security/` validasi URL/SSRF, rate limit, concurrency, dedup
- `lib/history/store.ts` riwayat (JSON file, hanya metadata; URL download tidak pernah disimpan)

## Endpoint
| | |
|---|---|
| `POST /api/download` | `{ "url": "..." }` -> `{ success, platform, method, data }` |
| `GET /api/platforms` | platform dan method yang benar-benar tersedia |
| `GET/POST/DELETE /api/history` | riwayat per browser (cookie anonim) |
| `GET /api/health` | internal; mati (404) kecuali `XEAN_ADMIN_TOKEN` diset dan dikirim di header `x-admin-token` |

## Catatan penting
- **Scraper pihak ketiga bisa berubah/diblokir kapan saja.** Karena itu ada fallback; kegagalan tercatat di log server (`requestId`, platform, method, error).
- `savetik`, `fdown`, `snapinsta` butuh `puppeteer-core`/`playwright` + Chrome. Jika tidak ada, otomatis dilewati (`XEAN_BROWSER_SCRAPERS=auto|on|off`).
- Timeout tidak bisa membatalkan request scrapr yang sedang berjalan (scrapr tidak mendukung AbortSignal); hasilnya hanya diabaikan.
- Rate limit dan cache bersifat in-memory (satu instance). Untuk banyak instance, ganti dengan Redis.
- Halaman Tools memisahkan tool berbasis scrapr dari utilitas Xean lain (`config/xean-utilities.ts`, kosong sampai kamu isi).
- Pastikan penggunaan sesuai ToS platform dan hukum hak cipta di wilayahmu.
