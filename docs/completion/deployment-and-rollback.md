# Deployment readiness, backup, rollback and staging – 16 Nov 2026

**Nothing here has been run against staging or production. Production deployment is on hold; every step below needs written approval.**

## Where things stand (read-only checks)

- Production D1 `cuet-db` has migrations 0001–0008 applied. Pending: **0009 – 0034 (26 files)**, all additive (new tables/columns/indexes, no drops). The local database is at 0034.
- Production Worker `cuet`, R2 bucket `cuet-storage` (stale: 55 media rows missing, see content audit), crons `[]`, no email binding, `PAYMENTS_MODE=off`, `workers_dev: true`.
- Local-only data that production does not have: 19,178+ questions work, admissions drafts, the four published Delhi programmes (local database only), notices.
- There is **no `env.staging`** in `backend/wrangler.jsonc`. Staging needs its own D1 database, R2 bucket and Worker name – created in the Cloudflare account (approval needed; nothing was created).

## Order matters

1. **Migrations first, code second.** Migration 0034 creates `rate_limits`; the new code uses it for sign-in. Deploying the code before 0034 would make sign-in fail. All 26 migrations are additive, so the currently live code keeps working after they are applied.
2. Apply in file order, in one run: `wrangler d1 migrations apply DB --remote -e production` (it applies only the pending ones, in order, and stops on the first error).
3. Content (questions, lessons, media, admissions) is a separate approved step; `backend/scripts/db-transfer.mjs`, `r2-transfer.mjs`, `r2-remote-upload.mjs` exist for it. Do not run them without approval; they must never overwrite production student data (users, sessions, practice rows).

## Backup before anything touches production

1. Record the current Worker version: `wrangler deployments list -e production` (note the id).
2. D1 export: `wrangler d1 export cuet-db --remote --output=D:/backups/cuet-db-<date>.sql` (schema + data). Store outside the repo. Also note the D1 **Time Travel** bookmark: `wrangler d1 time-travel info cuet-db` (restore point for the last 30 days).
3. R2: list the bucket (`wrangler r2 object list cuet-storage`) and keep the listing; objects are only added by the transfer scripts, never deleted.
4. Keep the local database file copy (`backend/.wrangler/state`) and the snapshot hashes (`docs/completion/preservation-evidence.md`).

## Rollback

| Problem | Action |
|---|---|
| Bad code | `wrangler rollback <previous-version-id> -e production` (code only; the migrations stay – they are additive and the old code ignores them). |
| Bad data change | `wrangler d1 time-travel restore cuet-db --bookmark=<bookmark from before the change>` (or import the SQL export into a new database and repoint). Restoring D1 also discards student activity after the bookmark – check with the owner first. |
| Email problem | Remove `EMAIL_FROM` (email switches off), redeploy. |
| Payments problem | `PAYMENTS_MODE=off` (and unset `PAYMENTS_LIVE_APPROVED`), redeploy. |
| Rate limiter locking people out | Set `RATE_LIMIT=off` in production vars and redeploy; or `DELETE FROM rate_limits`. |

## Staging instructions (needs approval to create resources)

1. Create D1 `cuet-staging`, R2 `cuet-storage-staging`; add an `env.staging` block (name `cuet-staging`, `PAYMENTS_MODE=test` with Razorpay **test** keys, `APP_ENV=staging`, `workers_dev: true`, no email until the subdomain exists).
2. `wrangler d1 migrations apply DB --remote -e staging` (all 34 from empty) – this also proves the whole chain from scratch.
3. `npm run build -w frontend`, `wrangler deploy -e staging`, set secrets (`ADMIN_API_TOKEN`, Razorpay test keys, webhook secret) with `wrangler secret put … -e staging`.
4. Run: sign-up/sign-in, a practice session, a plan purchase with Razorpay test cards, webhook delivery, refund, an HTTP load test (k6 or similar) at expected launch traffic, and the browser/mobile checks.
5. Check the CSP report-only headers in the browser console, then promote `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `frontend/public/_headers`.

## Production sequence (after approval)

1. Backup (above). 2. Apply migrations 0009–0034. 3. Deploy the Worker with frontend assets (`wrangler deploy -e production`, after `npm run check` passes and `predeploy-check.mjs` is clean). 4. Smoke test on the workers.dev URL (health, sign-up, sign-in, a practice session, plans page shows payments off). 5. Load approved content. 6. Protect `/api/admin/*` (Cloudflare Access) and rotate `ADMIN_API_TOKEN`. 7. Email go-live per `docs/completion/email-go-live.md`. 8. Payments go-live only after the CEO decisions and Razorpay approval (`docs/completion/payments-audit-and-plan.md`). 9. Domain/DNS last, separately approved.

## Git state (at the time of writing)

Pushed: everything up to `f8f347a` (user-approved). **Unpushed:** `ede4ea4` (CI fix) and the sprint changes (committed locally after this report, see the completion report). No push without explicit approval. Secret scan of tracked files: no keys, tokens or `.dev.vars` committed.
