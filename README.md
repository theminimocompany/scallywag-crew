# Scallywag Crew

Crew sign-up and race-selection website for the Scallywag racing team (Hong Kong).

- **Public**: upcoming race schedule with selected crew names, and a mobile-first
  signup form where crew pick their name and tick the races they can do.
- **Admin console** (`#/t/scallywag/admin`): roster management (approve / decline /
  delete, per-person race history), race management with RHKYC Google-Calendar CSV
  import, one-tap WhatsApp crew list, and settings (team name, per-race visibility,
  per-race sign-up open/closed, admin management).
- **Stack**: React 19 + TypeScript + Vite + Tailwind; Supabase (Postgres, row-level
  security, email auth). The Supabase anon key in `src/lib/config.ts` is a public
  key by design — all access control is enforced by Postgres RLS.
- **Hosting**: GitHub Pages via the workflow in `.github/workflows/deploy.yml`.
- **Database**: migrations in `sql/` — run them in order in the Supabase SQL Editor
  (`001` is the full schema on a fresh project). Seed data is intentionally not in
  this repo (it contains personal contact details).
