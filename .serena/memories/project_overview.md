# Pure Wishlist - Project Overview

## Purpose
Shopify embedded app that provides wishlist functionality for stores. Multi-tenant: 1 Vercel deploy + 1 Supabase project serves N stores.

## Tech Stack
- **Framework**: React Router v7 (file-based routing via `@react-router/fs-routes`)
- **Shopify SDK**: `@shopify/shopify-app-react-router@1.x` (NOT remix version)
- **UI**: `@shopify/polaris@13.x` + `@shopify/app-bridge-react`
- **Backend DB**: Supabase (PostgreSQL) via `@supabase/supabase-js`
- **Session storage**: Custom `SupabaseSessionStorage` (implements Shopify session interface)
- **Emails**: Resend SDK
- **Deploy**: Vercel (with cron support)
- **Language**: TypeScript (strict mode)
- **Build**: Vite 6

## Key Files
- `app/shopify.server.ts` — Shopify app config, auth, session storage
- `app/db.server.ts` — Supabase client + shop helpers
- `app/routes/` — all route files (flat routing)
- `extensions/wishlist-theme/` — Theme extension (Liquid blocks)
- `api/cron/check-prices.ts` — Daily price check cron
- `supabase/migrations/` — DB schema migrations

## Shopify Config
- API version: 2025-01
- Scopes: read_products, read_customers, write_products
- App proxy: /apps/wishlist → /api/proxy
- Embedded: true
