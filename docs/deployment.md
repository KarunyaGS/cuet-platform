# Deploying the CUET Worker

One Cloudflare Worker serves the whole CUET platform: the Hono API (`/api/*`) and the built React app (static
assets). Configuration: `backend/wrangler.jsonc`.

| | Local development | Production |
|---|---|---|
| Config | top level of `wrangler.jsonc` | `env.production` |
| Worker name | `cuet-platform-dev` (never deployed) | **`cuet`** (the CUET Worker; Wrangler 4 rejects upper-case names, so `CUET` cannot be used verbatim) |
| D1 binding `DB` | local copy in `.wrangler/state` | database `cuet` (**not created yet**) |
| R2 binding `MEDIA` | local copy in `.wrangler/state` | bucket `cuet-media` (**not created yet**) |
| `CONTENT_PREVIEW` | `true` | `true` (owner's decision 2026-11-12: machine-verified syllabus and AI-assisted content visible before expert review, without status labels) |
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

Owner's decision (2026-11-12): machine-verified syllabus rows and AI-assisted lessons, diagrams and questions are
shown to students before expert review, without status labels. Internally every record keeps its true status
(`origin = AI_ASSISTED`, `verification = UNVERIFIED` / `MACHINE_VERIFIED`), reviewers still see and work through
all of it, nothing becomes `VERIFIED` without a signed-in reviewer, and anything a reviewer flags
(`NEEDS_CHANGES`) or rejects is hidden from students immediately. Syllabus rows that failed the automatic checks
(review drafts) stay hidden until a reviewer verifies them.

## Pending production steps added after the first migration (each needs explicit approval)

These were built and tested locally after `cuet-db` was migrated (migrations 0001–0008):

1. **Apply migrations `0009_student_tools`, `0010_official_info` and `0011_student_portal`** to `cuet-db`. All only
   create new tables (bookmarks, learning activity, daily goals, study plan; official information, notices,
   participating universities; student preferences, password reset links, dismissed reminders). Nothing existing is changed:
   `CUET_REMOTE_DATA_APPROVED=yes npx wrangler d1 migrations apply DB --env production --remote` (from `backend/`).
   Without 0009, the Today page, bookmarks, planner, goals, continue learning, daily practice and the profile page fail.
2. **Import the official exam information** (public `/cuet` pages) after the Worker is deployed:
   `CUET_API_BASE=https://<worker address> CUET_ADMIN_TOKEN=<token> CUET_REMOTE_DATA_APPROVED=yes node scripts/import-official-info.mjs`.
   It replaces each exam's information for the cycle in one batch and writes an audit log entry.
3. **Smoke test the new pages**: `/cuet`, `/cuet/ug`, `/cuet/pg/universities` (no sign-in needed) and
   `/api/public/info/CUET_UG`.
4. **Account recovery without email**: an admin creates a one-time link with
   `POST /api/admin/users/reset-link {"email": ...}` (admin token) and gives the student the returned
   `/reset-password#<token>` path on the site's address. It expires after an hour and works once.
