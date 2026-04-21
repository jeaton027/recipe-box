# Architecture Map

Five CSVs, openable in Excel / Google Sheets / Numbers. Each one answers a different "where is X?" question.

| Sheet | Answers |
|---|---|
| `pages.csv` | For each route → page file, layout, and every component it renders |
| `components.csv` | For each component in `src/components/**` → purpose and which pages use it |
| `lib.csv` | Supabase clients, hooks, utils, types in `src/lib/**` |
| `api-and-middleware.csv` | API routes under `src/app/api/**` + root `middleware.ts` |
| `database.csv` | Supabase migrations (001–011) in order, with purpose |

## Conventions to know before reading

- **Route groups**: folders wrapped in parens — `(main)` and `(cook)` — do NOT appear in URLs. They just scope which `layout.tsx` applies.
  - `(main)` → has Navbar, Footer, MobileNav (everyday pages)
  - `(cook)` → bare-bones full-bleed (Cook Mode only)
- **Root layout**: `src/app/layout.tsx` — applies to *every* page; just fonts + `<html><body>` + globals.css.
- **Server vs client**: files with `"use client"` at the top run in the browser. Everything else is a React Server Component.
- **Styling**: Tailwind v4 + design tokens defined inline in `src/app/globals.css` (colors `--color-accent`, `--color-accent-light`, etc., fonts `--font-heading`, `--font-body`).
- **Data layer**: all DB calls go through `src/lib/supabase/{server,client}.ts`. Middleware refreshes the session on every request.

## How to use this map

- **"Where does the filter panel on /search live?"** → open `pages.csv`, find `/search`, the component column lists `SearchClient.tsx`.
- **"What uses `ServingsMultiplier`?"** → open `components.csv`, find the row.
- **"Where is the current DB schema?"** → read `database.csv` top-to-bottom (migrations are append-only).

## Regenerating

If you add a route or rename a component, these CSVs drift. They're hand-maintained — update the affected row(s) in the relevant CSV in the same PR.
