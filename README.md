# A Bookshelf
A personal library dashboard that tracks reading status, progress, and links across multiple sources. The frontend is a React + Vite SPA hosted on GitHub Pages and backed by Supabase Auth, tables, and two Edge Functions.

Deployment link: https://detgrey.github.io/a-bookshelf/

## Highlights
- Smart add: paste a URL (Webtoons, Bato) and the `fetch-metadata` Edge Function scrapes title, description, cover, genres, original language, language, latest chapter, and upload date.
- **Image proxy**: Book cover images are automatically downloaded, converted to WebP format, and stored in Cloudflare R2 via a Workers proxy. Ensures images remain available even if the original source goes down. Fast global delivery via Cloudflare's CDN. Gracefully falls back to original URLs if upload fails.
- Reading states and shelves: built-in shelves (reading, plan to read, waiting, completed, dropped, on hold) plus custom shelves.
- Progress tracking: personal notes, last read, latest scraped chapter, and last uploaded timestamp per book.
- Multi-source links: keep multiple URLs per book (official, scanlation, etc.) and switch quickly.
- Waiting shelf updates: throttled batch checks via `fetch-latest` (3-at-a-time with progress), unchanged rows are skipped and errors are shown in a collapsible log.
- Dashboard stats: genre breakdown pie (top genres + Other), average score (ignores 0), score-10 count, and latest updates.
- Data portability: one-click JSON backup + upload/restore (profiles, books, shelves, links, mappings).
- Filtering and sorting: status, genre, or last update.
- Performance: global `BooksProvider` context caches books/shelves for 5 minutes and uses Supabase realtime subscriptions to auto-refresh on changes (no redundant fetches across page navigation).
- Lazy loading: book cover images only load when about to enter viewport (IntersectionObserver), with CSS gradient fallback for broken links.

## Repo layout
- frontend/ — React app (Vite) with routes, components, sample data, and tests. Includes context providers for global state management: `AuthProvider` handles auth, `BooksProvider` manages books/shelves with 5-minute caching and realtime Supabase subscriptions to auto-refresh on changes.
- cloudflare-worker/ — Cloudflare Worker for downloading and hosting book cover images in R2 storage.
- tables.sql — Supabase schema and RLS policies for profiles, books, shelves, shelf_books, and book_links.
- src/supabase/functions/ — Edge Functions `fetch-metadata` and `fetch-latest` (Deno + cheerio) plus minimal Supabase CLI config.
- **GUIDE.md** — Complete deployment guide for GitHub Pages + Cloudflare setup.

## Prerequisites
- Cloudflare account (free tier works) for image hosting
- GitHub Pages (or any static host) if you want the provided deploy path

> 📖 **For complete setup instructions**, see [GUIDE.md](./GUIDE.md)
- Supabase project and the Supabase CLI (for running/deploying functions and applying the schema)
- GitHub Pages (or any static host) if you want the provided deploy path, `VITE_SUPABASE_ANON_KEY`, and `VITE_IMAGE_PROXY_URL` (your Cloudflare Worker URL).
2) Install deps: `cd frontend && npm install`.
3) Dev server: `npm run dev -- --host` (so phones/tablets can reach it).
4) Lint: `npm run lint`. Tests: `npm test`. Build: `npm run build` (adds `dist/404.html` for GitHub Pages).

## Quick start (Cloudflare Worker)
1) Install Wrangler: `npm install -g wrangler`
2) Login: `wrangler login`
3) Create R2 buckets: `wrangler r2 bucket create bookshelf-covers && wrangler r2 bucket create bookshelf-covers-preview`
4) Update `cloudflare-worker/wrangler.toml` with your GitHub Pages URL in `ALLOWED_ORIGINS`
5) Deploy: `cd cloudflare-worker && npm install && npm run deploy`
6) Copy the worker URL to your frontend `.env.local` as `VITE_IMAGE_PROXY_URL`

See [GUIDE.md](./GUIDE.md) for detailed step-by-step instructionsANON_KEY`.
2) Install deps: `cd frontend && npm install`.
3) Dev server: `npm run dev -- --host` (so phones/tablets can reach it).
4) Lint: `npm run lint`. Tests: `npm test`. Build: `npm run build` (adds `dist/404.html` for GitHub Pages).

## Supabase setup
1) Create the Edge Functions (from repo root):
	 - `npx supabase functions deploy fetch-metadata --no-verify-jwt`
	 - `npx supabase functions deploy fetch-latest --no-verify-jwt`
2) Frontend uses `supabase.functions.invoke` with anon key, so enable the functions for anon access in the Supabase dashboard or keep JWT disabled as above.

## Edge Functions (payloads)
- fetch-metadata
	- Request: `{ "url": "https://example.com/some-book" }`
	- Response: `{ metadata: { title, description, image, genres[], original_language, latest_chapter, last_uploaded_at } }`
	- Supports Webtoons, Bato (ing/si), and a generic Bato v3 parser; returns 200 with error payload on failures to avoid client-side swallowing.
- fetch-latest
	- Request: `{ "url": "https://example.com/some-book" }`
	- Response: `{ latest_chapter, last_uploaded_at }`
	- Mirrors the same site support and date parsing (Webtoons date +1 day hack for stable time zones).

## Data model
- profiles: user profile row per auth user (auto-created trigger).
- books: core book metadata, progress fields, scraper fields, user ownership, and status enum.
- shelves: custom shelf names per user.
- shelf_books: join table mapping shelves to books.
- book_links: multiple URLs per book entry.
Row Level Security is enabled on every table; policies limit access to the owning user.

## Testing and quality
- Unit/component tests: `npm test` (Vitest + Testing Library) inside frontend/.
- Linting: `npm run lint` (eslint 9).
- CI: add a GitHub Actions workflow to run lint + test on PRs (not included yet).

## Future improvement

### PWA (Progressive Web App) Support:

> Status: Optional / Planned when icon is created

Since this is a personal tool, you likely want to use it on your phone while reading in bed.

Action: Add a manifest.json and service worker (Vite has a plugin vite-plugin-pwa). This lets you "Install" the website as an app on iOS/Android, removing the browser address bar.

### Extra
