# Staging requirements – prepared 16 Nov 2026

Nothing below was created. Each item needing an account or credential is marked **EXTERNAL**.

## Resources to create (Cloudflare account) – EXTERNAL
| Resource | Name suggestion | Note |
|---|---|---|
| Worker | `cuet-staging` | `workers_dev: true`; add an `env.staging` block to `backend/wrangler.jsonc` (none exists today). |
| D1 database | `cuet-staging` | Starts empty; apply migrations 0001–0034 in order (this also proves the chain from scratch). |
| R2 bucket | `cuet-storage-staging` | Media and official-source files. |
| Queue (email events) | `cuet-email-events-staging` | Only when email is tested. |
| Access policy | in front of `/api/admin/*` | Same protection as production. |

## Variables and secrets for the staging block
`APP_ENV=staging`, `PAYMENTS_MODE=test`, `OFFICIAL_IN_APP_VIEWING=off`, `PYQ_IN_APP_VIEWING=off`, `NOTICE_FETCH=off`, `CONTENT_PREVIEW=true` while paid plans stay off (a paid plan cannot be switched on while it is true; to test the buying flow in staging set it to `false` there and load only reviewed content). `RATE_LIMIT` is left unset (limiter on).
Secrets (`wrangler secret put … -e staging`): `ADMIN_API_TOKEN` (new value), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` – **EXTERNAL: Razorpay test-mode keys; none exist and none were created.** Live keys and `PAYMENTS_LIVE_APPROVED` must never be set in staging.

## Test plan to run in staging
1. Migrations from empty; `npm run check` locally first.
2. Smoke: health, sign-up (same answer for a repeated address), sign-in, rate-limit 429 after repeated failures, practice session, submit, limits (free plan: 10/4/1; cards 25; bookmarks 50).
3. Payments with Razorpay **test** cards: order → payment → webhook → pass; failed payment; duplicate payment and its refund (pass unchanged); partial refund (pass shortened, order stays paid); full refund (revoked; stacked pass moves up); reconciliation of a missed webhook; pass expiry mid-test.
4. Access control: a content editor gets 403 on the email log and reviewer assignments.
5. HTTP load test (k6 or similar) at expected launch traffic – the in-process burst test is not a substitute.
6. Browser and mobile pass (the Playwright harness must be rebuilt) and the CSP report-only check before enforcing it.
7. Email: only after the sending domain is onboarded; use test mailboxes, never students.

## Preconditions that need the CEO or external access
Cloudflare account access for the resources above; Razorpay test keys; a decision on the staging hostname (workers.dev is enough); no DNS is needed for staging.
