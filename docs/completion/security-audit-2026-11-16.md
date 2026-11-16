# Security and technical audit – 16 Nov 2026

Method: a read-only code audit (25 findings, full text in the audit working file `security-audit.md`, kept outside the repo) followed by local fixes with tests.
Nothing was tested against production. Items that need the live Cloudflare account are listed as **not verified**.

## Fixed locally in this sprint (tests in `backend/test/security-hardening.test.ts`, `load.test.ts`)

| ID | Finding | Fix |
|---|---|---|
| F-01 High | `POST /api/public/questions/:id/evaluate` needed no sign-in and returned the right answer and explanation of every published question. The app never called it. | Route removed (404). Staff keep `preview-evaluate`. |
| F-02 High | No rate limiting or login throttling anywhere. | New D1 rate limiter (`lib/rate-limit.ts`, migration **0034**): sign-in 10/10 min per email and 40/10 min per address; sign-up 8/h per address; forgot-password 4/h per email and 10/h per address; reset, verify, unsubscribe, order creation (12/h per student), verification mail, `/health/db`. Answers 429 with `Retry-After`. Switched off only by `RATE_LIMIT=off`, which only the local dev config sets. |
| F-04 Medium | No security headers. | API: nosniff, frame deny, referrer, CORP, HSTS (production), `no-store` on signed-in areas. Pages: `frontend/public/_headers` (CSP in **report-only** mode so nothing can break; tighten after a staging check). |
| F-05 Medium (part) | Activity feed (shows student emails) open to any content editor. | Now needs `users:manage`. The other console reads still use the generic staff gate: **needs a CEO decision** on who may see what. |
| F-06 Medium | Webhook wrote a row for every bad-signature request under an attacker-chosen key. | Unsigned requests get a random key and only the first 200 per hour are logged. |
| F-09 Low | Reset / confirmation link could be used twice by two parallel requests. | The link is claimed first with `UPDATE … WHERE used_at IS NULL`; only one request wins (tested). |
| F-10 Low | Cross-site POST relied on SameSite alone. | Changing requests carrying a foreign `Origin` get 403 `CROSS_SITE_BLOCKED`. |
| F-11 Low | Sessions, used links never deleted. | Daily housekeeping (after 30 days) – runs from the daily cron. **Production has no crons yet.** |
| F-12 Low | `/api/health` revealed the environment; `/health/db` unthrottled. | Only `{ok:true}`; `/health/db` rate-limited. |
| F-13 Low | Broken JSON on 9 staff routes became a 500. | All use `readJson` (validation error, not a crash). |
| F-14 Low (part) | Staff file route served files without sandbox headers. | `nosniff` and a sandbox CSP added. SVG sanitising not done. |
| F-16 Low | A practice request for more than 99 questions could create a session that cannot load (D1 allows 100 bound values). | Count limited to 90. |
| new (found by the load test) | Two sign-ups with the same email at the same moment: one got an unhandled 500. | Answers 409 (tested with 10 parallel sign-ups: exactly one account). |

## Passed (code read, not run against production)

Password hashing and sessions, uniform login / forgot-password answers, student data isolation (no IDOR found), payment signature, amount and replay checks, SQL binding, SSRF, upload handling, XSS (KaTeX `trust:false`), no secrets in the tree or git history (`.dev.vars` is git-ignored; scan of tracked files found only `.dev.vars.example`).

## Unresolved – need a decision or the live account

| ID | Risk | What is needed |
|---|---|---|
| F-03 High | One shared `ADMIN_API_TOKEN` guards all of `/api/admin/*` on the public workers.dev URL; with it someone can grant SUPER_ADMIN or create a reset link for any account. | Put Cloudflare Access (or an IP rule) in front of `/api/admin/*`, or switch the route off in production after the content is loaded. Rotate the token. Needs Cloudflare dashboard access. |
| F-07 Medium | Sign-up says "account already exists" (email enumeration) and an unverified address can be claimed. | Product decision: neutral answer plus email confirmation before use. |
| F-08 Low | PBKDF2 at 100,000 iterations (OWASP asks for 600,000; Workers may cap at 100,000 – not verified). | Check the limit on the live plan; add rehash-on-login if allowed. |
| F-15 Low | Notice fetcher accepts any `*.gov.in` / `*.nic.in` host and follows redirects. | Narrow the allowlist after the first live fetch. |
| F-17/F-18 | Order spam is now limited; **a partial refund still ends the whole pass**. | CEO refund rule (see payments plan). |
| F-20 Low | No sign-in history in the audit log. | Add LOGIN_FAILED / LOGIN_OK events (small change, deferred). |
| F-21 Low | katex 0.18.1 prototype-pollution advisory (low). | Upgrade to 0.19.1 and re-test lessons. |
| F-23 Info | Production `CONTENT_PREVIEW=true` shows unreviewed content to students. | Owner decision of 12 Nov stands; revisit before launch. |
| F-24/F-25 | Mock payments allowed if the dev config were ever deployed; observability / alerts unknown. | Deploy only with `-e production`; check dashboard logs and alerts. |

Also not verified: which secrets are set in production, Cloudflare WAF / rate-limit rules, dashboard alerting.

## Performance and load

`backend/test/load.test.ts` (in the Workers test runtime, local D1): 250 concurrent public reads, 40 concurrent sign-ups and sign-ins, 10 parallel same-address sign-ups – **no server errors**. Timings printed there (public reads p95 ≈ 4.6 s, sign-up/sign-in p95 ≈ 6 s with everything queued at once) are local, single-process and **not a measure of production speed**. A real load test needs a staging Worker. `wrangler dev` crashed the workers runtime on this machine when started on a copy of the local state, so no HTTP-level load test was possible locally.

## Error handling and monitoring readiness

Errors map to typed JSON (validation 400, conflict 409, rate limit 429, unexpected 500 with only a generic message; details go to `console.error`). Production config has observability at the top level only – confirm it is inherited by `env.production`, then set alerts on 5xx and on webhook failures (needs the dashboard).
