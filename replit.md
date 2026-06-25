# Clothing Stock Manager

A private admin inventory dashboard for a clothing brand. Manage articles, track stock by size, adjust quantities, view financials, and configure settings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/clothing-stock run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Replit Auth (OIDC/PKCE)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod v3
- Storage: Replit Object Storage (presigned URL flow)
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Frontend: React 19 + Vite + Tailwind CSS + shadcn/ui + wouter
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/db/src/schema/articles.ts` — DB schema (articles, sizes, adjustments, settings)
- `lib/db/src/schema/auth.ts` — auth session schema
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/replit-auth-web/` — `useAuth()` hook for frontend
- `lib/object-storage-web/` — `useUpload()` hook for frontend
- `artifacts/api-server/src/routes/` — API route handlers
- `artifacts/clothing-stock/src/pages/` — frontend pages
- `artifacts/clothing-stock/src/components/` — shared UI components

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas
- Object storage uses a presigned URL two-step flow: POST metadata → get uploadURL → PUT file directly
- Replit Auth (OIDC/PKCE): single admin user, all routes protected server-side with `req.isAuthenticated()`
- Zod v3 (`"zod"` not `"zod/v4"`) used on the server — esbuild cannot resolve the `/v4` subpath
- Prices stored as `numeric(12,2)` strings in Postgres, parsed to float in API responses
- Low-stock status computed at query time based on `lowStockThreshold` from `app_settings`

## Product

- **Dashboard** — stats overview (total articles, pieces, inventory cost, potential revenue, profit), stock by size chart, recent articles, low-stock section
- **All Stock** — article grid with search, fabric/size/status/sort filters, delete with confirmation
- **Add / Edit Article** — image upload, sizes with enable/disable toggles, live profit calculation panel
- **Article Detail** — full info, stock-by-size display, complete adjustment history table
- **Low Stock** — separated out-of-stock and low-stock sections
- **Settings** — currency (default PKR), low-stock threshold, brand name

## User preferences

- Default currency: PKR
- No emojis in the UI

## Gotchas

- Do NOT import `zod/v4` in server code — use `"zod"` (catalog is v3)
- Always run `pnpm --filter @workspace/db run push` after schema changes
- Run `pnpm --filter @workspace/api-spec run codegen` after any OpenAPI changes
- `replit-auth-web` and `object-storage-web` libs must NOT use `import.meta.env` — they are composite libs without Vite client types
- The `pnpm overrides` in root `package.json` pin React to 19.1.0 to satisfy Uppy peer deps

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
