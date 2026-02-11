# Pure Wishlist — Setup Guide

## Prerequisites

- Node.js >= 18
- Shopify CLI (`npm install -g @shopify/cli`)
- Shopify Partners account + dev store
- Supabase project (free tier)
- Resend account (free tier)
- Vercel account

---

## 1. Shopify Partners Setup

1. Go to [partners.shopify.com](https://partners.shopify.com) > Apps > Create app
2. Choose "Create app manually"
3. Set App URL: `https://your-app.vercel.app` (update after deploy)
4. Set Allowed redirection URLs: `https://your-app.vercel.app/auth/callback`
5. Under API access, request scopes: `read_products`, `read_customers`, `write_products`
6. Copy **API key** and **API secret key**
7. Configure App Proxy:
   - Subpath prefix: `apps`
   - Subpath: `wishlist`
   - Proxy URL: `https://your-app.vercel.app/api/proxy`
8. Install on dev store

---

## 2. Supabase Setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to Settings > Database > Connection string
3. Copy:
   - **Project URL** (e.g. `https://xxx.supabase.co`)
   - **service_role key** (Settings > API)
   - **Direct connection string** (for session storage)
4. Run migrations in SQL Editor (in order):
   ```
   supabase/migrations/001_sessions.sql
   supabase/migrations/002_shops.sql
   supabase/migrations/003_wishlists.sql
   supabase/migrations/004_notifications.sql
   ```
5. Connection pooling: use **Transaction mode** for serverless (Settings > Database > Connection Pooling) (can be changed later if needed when scaling)

---

## 3. Environment Variables

Copy `.env.example` to `.env` and fill:

```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=read_products,read_customers,write_products
SHOPIFY_APP_URL=https://your-app.vercel.app

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=postgresql://postgres:password@db.ref.supabase.co:5432/postgres

RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev

CRON_SECRET=your_random_secret
```

---

## 4. Local Development

```bash
npm install
shopify app dev
```

This starts the dev server with ngrok tunnel. Install on your dev store when prompted.

---

## 5. Vercel Deploy

1. Push repo to GitHub
2. Import in Vercel > Framework preset: Vite
3. Set all environment variables from step 3
4. Deploy
5. Copy production URL
6. Update `SHOPIFY_APP_URL` in Vercel env vars
7. Update App URL in Shopify Partners dashboard

---

## 6. Resend Setup

1. Create account at [resend.dev](https://resend.dev)
2. For development: use `onboarding@resend.dev` as sender
3. For production: add + verify your domain
4. Copy API key to `RESEND_API_KEY`

---

## 7. Deploy Theme Extension

```bash
shopify app deploy
```

This pushes the theme app extension to Shopify.

---

## 8. Activate Theme Extension

1. In dev store: Online Store > Themes > Customize
2. On product page: Add block > Pure Wishlist > Wishlist Button
3. For wishlist page: Create new page template > Add section > Wishlist Page
4. Save

---

## 9. Verify

1. OAuth: install app on dev store, admin panel loads
2. Storefront: heart button appears on product page, toggles on click
3. Admin: dashboard shows stats, tables load
4. Database: check Supabase for wishlist entries with correct `shop_id`
5. Price drop: simulate via API, check email sent
6. Back in stock: update product inventory, check notification log

---

## Vercel Cron

The `vercel.json` configures a daily cron at 6AM UTC for price drop checks.
Protect it with `CRON_SECRET` env var (Vercel sends it as `Authorization: Bearer <secret>`).
