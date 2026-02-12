# Code Style & Conventions

## TypeScript
- Strict mode enabled
- ES2022 target, ESNext modules, Bundler resolution
- Path alias: `~/` → `./app/`
- `.server.ts` suffix for server-only modules

## File Naming
- Routes: flat file routing (`app.settings.tsx`, `webhooks.app.uninstalled.tsx`)
- Server modules: `*.server.ts`
- Components: PascalCase in `app/components/`

## Patterns
- Shopify auth via `authenticate.admin(request)` in loaders/actions
- Supabase accessed via `supabaseAdmin` singleton from `db.server.ts`
- Exports from `shopify.server.ts`: authenticate, login, unauthenticated, etc.

## Important
- NEVER use `@shopify/shopify-app-remix` — use `@shopify/shopify-app-react-router` instead
- Imports from: `/server`, `/react`, `/adapters/node`
