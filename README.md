# Pure Wishlist

Embeddable Shopify wishlist app. Multi-tenant (1 deploy serves N stores).

## Features

- Heart button on product pages (Theme App Extension)
- Dedicated wishlist page for customers
- Admin backoffice: dashboard, wishlists, product rankings, customer activity
- Email notifications: price drop + back in stock (via Resend)
- Daily price check cron (Vercel Cron)

## Tech Stack

- React Router v7 + Shopify App Remix
- Shopify Polaris (admin UI)
- Supabase PostgreSQL (database + session storage)
- Resend (transactional emails)
- Vercel (deploy + cron)

## Quick Start

```bash
npm install
cp .env.example .env  # fill in values
shopify app dev
```

See [SETUP.md](./SETUP.md) for full setup guide.

## Project Structure

```
app/
  routes/         # React Router routes (admin pages + API)
  lib/            # Server-side business logic
  components/     # Reusable Polaris components
extensions/
  wishlist-theme/ # Theme App Extension (Liquid + JS + CSS)
supabase/
  migrations/     # SQL migration files
api/
  cron/           # Vercel Cron endpoints
```
