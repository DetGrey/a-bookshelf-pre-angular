# A Bookshelf frontend

React + Vite single-page app for your personal library dashboard. It is wired for Supabase Auth, the `fetch-metadata` Edge Function, and GitHub Pages hosting.

## Quick start

1) Copy envs: `cp .env.example .env.local` and fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
2) Install: `npm install`
3) Dev server: `npm run dev -- --host` (so you can open it on devices).
4) Lint: `npm run lint`
5) Build: `npm run build` (outputs to `dist/`).

## Supabase wiring

- Auth flows already call `supabase.auth.signInWithPassword`, `signUp`, and `signOut` through the shared `AuthProvider`.
- Smart Add calls the Edge Function `fetch-metadata` via `supabase.functions.invoke`. Replace the fallback metadata in `src/pages/AddBook.jsx` once your function is deployed.
- Database tables suggested in the root README: `profiles`, `books`, `links`. When ready, swap the sample data in `src/data/sampleBooks.js` with real queries.

## Routing

Routes live in `src/main.jsx` using `react-router-dom`:
- `/` Dashboard (protected)
- `/add` Smart Add form (protected)
- `/book/:bookId` Book details (protected)
- `/login`, `/signup` Public auth screens

`ProtectedRoute` guards private pages using the Supabase session.

## Deployment (GitHub Pages)

- `vite.config.js` is set with `base: '/a-bookshelf/'` for Pages.
- Workflow: `.github/workflows/deploy.yml` builds from `frontend/` and publishes `dist` to Pages on pushes to `main`.
- For manual deploys, run `npm run build` and upload `dist/` to your `gh-pages` branch.

## File map

- `src/context/AuthProvider.jsx` – session provider + auth helpers
- `src/lib/supabaseClient.js` – client factory reading env vars
- `src/pages/*` – dashboard, Smart Add, auth, and book detail views
- `src/components/*` – navigation and protected-route gate
- `src/data/sampleBooks.js` – sample data used until Supabase queries are added

## Waiting Shelf Updates

- The Bookshelf page can batch-check all `waiting` books via the "Check Updates" button.
- It calls the `fetch-latest` Edge Function; if the function returns empty data or values identical to the book, the row is skipped and not overwritten.
- A collapsible error panel shows per-book failures without cluttering the main status line.
