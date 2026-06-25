# Clothing Stock Manager

A private admin inventory dashboard for a clothing brand. Manage articles, track
stock by size, adjust quantities, view financials, and configure settings.

This project is a `pnpm` workspace deployed to **Vercel** with a static React
frontend and an Express API running as a serverless function.

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS + shadcn/ui + wouter
- **API:** Express 5 (deployed as a Vercel serverless function under `/api`)
- **Database:** MongoDB (Atlas) via the official `mongodb` driver
- **Auth:** single admin password (env var) → signed JWT session cookie
- **Object storage:** Backblaze B2 (S3-compatible) presigned uploads
- **API codegen:** Orval (OpenAPI → typed React Query hooks + Zod schemas)

## Project layout

- `artifacts/clothing-stock` — React frontend
- `artifacts/api-server` — Express API (routes, auth, storage)
- `api/[...path].ts` — Vercel serverless entry that mounts the Express app
- `lib/db` — MongoDB connection, collections, numeric-id counter, domain types
- `lib/api-spec` — OpenAPI source of truth
- `lib/api-client-react` / `lib/api-zod` — generated client hooks / Zod schemas
- `lib/replit-auth-web` — `useAuth()` hook (password login)
- `lib/object-storage-web` — `useUpload()` hook (presigned upload)

## Environment variables

Copy `.env.example` to `.env` and fill in the values. The same variables must be
configured in the Vercel project settings.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB Atlas connection string (include the db name) |
| `MONGODB_DB` | no | Override database name |
| `ADMIN_PASSWORD` | yes | Password to log in |
| `SESSION_SECRET` | yes | Long random string used to sign JWTs |
| `ADMIN_EMAIL` | no | Email shown for the admin user |
| `B2_KEY_ID` | yes | Backblaze application key id |
| `B2_APP_KEY` | yes | Backblaze application key |
| `B2_BUCKET` | yes | Backblaze bucket name (can be **private**) |
| `B2_REGION` | yes | e.g. `us-west-004` |
| `B2_ENDPOINT` | yes | e.g. `https://s3.us-west-004.backblazeb2.com` |

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Vercel auto-detects `vercel.json`. The build runs `pnpm run vercel-build`
   (builds the frontend); the API is built automatically from `api/[...path].ts`.
3. Add all required environment variables in the Vercel project settings.
4. Deploy.

### Backblaze B2 setup

- Create a bucket (it can be **private**). Uploaded images are read back through
  the API using short-lived presigned GET URLs, so the bucket never needs to be
  public.
- Create an application key scoped to that bucket; use the key id/secret for
  `B2_KEY_ID` / `B2_APP_KEY`.
- Add a CORS rule on the bucket allowing `PUT` from your Vercel domain so browser
  uploads succeed (image display goes through the API, so no `GET` CORS rule is
  required).

### MongoDB Atlas setup

- Create a cluster and a database user.
- Allow network access from anywhere (`0.0.0.0/0`) or Vercel's IP ranges.
- Use the connection string as `MONGODB_URI`.

## Local development

```bash
pnpm install

# Terminal 1 — API server (http://localhost:8080)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — frontend (http://localhost:5173, proxies /api to :8080)
pnpm --filter @workspace/clothing-stock run dev
```

Create a `.env` file (loaded by your shell or process manager) with the
variables above before starting the API server.

## Notes

- Article ids are sequential integers backed by a `counters` collection in
  MongoDB, preserving the original numeric API contract.
- Uploaded images live in a private Backblaze bucket. The article `imageUrl` is
  a stable app path (`/api/storage/objects/<key>`); requesting it redirects to a
  short-lived presigned GET URL, keeping the bucket private.
