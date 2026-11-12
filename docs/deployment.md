# Deploying the CUET Worker

One Cloudflare Worker serves the whole CUET platform: the Hono API (`/api/*`) and the built React app (static
assets). Configuration: `backend/wrangler.jsonc`.

| | Local development | Production |
|---|---|---|
| Config | top level of `wrangler.jsonc` | `env.production` |
| Worker name | `cuet-platform-dev` (never deployed) | **`cuet`** (the CUET Worker; Wrangler 4 rejects upper-case names, so `CUET` cannot be used verbatim) |
| D1 binding `DB` | local copy in `.wrangler/state` | database `cuet` (**not created yet**) |
| R2 binding `MEDIA` | local copy in `.wrangler/state` | bucket `cuet-media` (**not created yet**) |
| `CONTENT_PREVIEW` | `true` (drafts visible, labelled) | `false` (students see only approved, published content) |
| Cookies | not `Secure` (http://localhost) | `Secure; HttpOnly; SameSite=Lax` |
| Admin token | `backend/.dev.vars` (git-ignored) | Wrangler secret `ADMIN_API_TOKEN` |

Account status checked read-only on 2026-11-12: no Worker named `cuet`/`CUET`, no D1 database and no R2 bucket
for CUET exist on the company account, so creating them will not duplicate anything. Other projects' Workers,
databases and buckets are not referenced by this configuration.

## Verify locally (no Cloudflare access needed)

```sh
npm run build -w @cuet/web                                   # frontend/dist
npm run build:production -w @cuet/api                        # compiles the production Worker (dry run, nothing uploaded)
npm run migrate:production-config:local -w @cuet/api         # separate empty local DB for the production config
npm run dev:production-config -w @cuet/api                   # http://127.0.0.1:8788 with production settings
```

## Before the first production deploy (each step needs explicit approval)

1. **Approve the release** and the creation of two resources on the company account.
2. **Create the database** (once): `npx wrangler d1 create cuet` (in `backend/`). Put the printed `database_id`
   into `env.production.d1_databases[0].database_id`. Commit that change (the id is not a secret).
3. **Create the media bucket** (once): `npx wrangler r2 bucket create cuet-media`.
   The current Wrangler login lists R2 buckets but its scopes do not show an explicit R2 write scope; if creation
   is refused, re-run `npx wrangler login` with R2 access or create the bucket in the dashboard.
4. **Apply migrations**: `npm run migrate:production -w @cuet/api` (applies `database/migrations/*.sql` in order;
   Wrangler records what is applied). Take a D1 Time Travel bookmark first on later releases.
5. **Secrets**: `npx wrangler secret put ADMIN_API_TOKEN --env production` (long random value, kept in a password
   manager; used only by the ingestion CLI). Recommended: put `/api/admin/*` behind Cloudflare Access as well.
6. **Load data**, through the deployed API (same idempotent pipeline as locally):
   `npm run ingest -- import --api https://<worker-url>` (official papers, source PDFs to R2, syllabus versions,
   page checks), then `npm run ingest -- content-import --api https://<worker-url>` for lesson/question packs.
   Reviewer accounts: sign up in the app, then grant the role with `POST /api/admin/users/roles`.
7. **Domain**: decide the public address (workers.dev address `cuet.<subdomain>.workers.dev`, or a custom
   domain/route added to `env.production`).
8. **Deploy**: `npm run build -w @cuet/web`, then
   `CUET_DEPLOY_APPROVED=yes npm run deploy:production -w @cuet/api`.
   `scripts/predeploy-check.mjs` refuses to deploy while the database id is a placeholder, preview is on,
   the app is not built, or approval is not given.
9. **Smoke test**: `/api/health` (env `production`), `/api/health/db`, `/api/learn/exams`, sign up/sign in
   (cookie must be `Secure`), a practice session on a published topic, and `/api/review/*` returning 401 when
   signed out.

## What students will see in production

Only syllabus versions and content that a person has verified **and** published. Machine-verified syllabus and
AI-assisted drafts stay invisible in production until reviewed (they are visible, labelled, only in local preview).
