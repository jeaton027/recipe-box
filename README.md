# Recipe Box

A personal recipe organizer PWA — gather recipes from the web, Instagram, and manual entry into one searchable collection.

## Tech Stack

- **Next.js 14+** (App Router, TypeScript)
- **Supabase** (Postgres, Auth, Storage)
- **Tailwind CSS**
- **Vercel** (deployment)

## Getting Started

### 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor
3. Create a storage bucket named `recipe-images` (Storage → New Bucket → Public: on)

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project URL and anon key from the Supabase dashboard (Settings → API).

### 3. Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/                  # Next.js App Router pages
├── components/
│   ├── layout/           # Navbar, MobileNav
│   ├── recipes/          # RecipeCard, RecipeGrid, RecipeForm
│   └── ui/               # ImageUpload, shared primitives
├── lib/
│   ├── supabase/         # Browser + server clients, middleware
│   └── types/            # TypeScript types for all DB tables
supabase/
└── migrations/           # SQL schema, RLS policies, seed data
docs/                     # Project spec and architecture diagrams
```
