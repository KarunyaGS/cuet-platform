# CUET Completion Report – 16 Nov 2026

Everything below was done on the local copy. No production change, no push, no deployment, no real email, no live payment, no DNS or domain action. Master list: `MASTER-CHECKLIST.md`.

## 1. Completed work
- **Admissions:** JNU full eligibility text stored (draft); BHU flags narrowed; six sources and JNU PG reviewed; gaps listed. Published records unchanged (Delhi 4 programmes + 8 facts).
- **Email:** audit tests (spam complaint, failed event, unknown event, one-click unsubscribe, duplicate key); full go-live pack (subdomain, DNS, binding, config, rollback).
- **Payments:** security test suite (29 billing tests); fixes: a payment arriving for a FAILED order is now recovered by reconciliation, wrong-amount payments show in the billing console; GST/credit-note requirements and the plan for the seven CEO decisions.
- **Security:** 13 fixes – public answer-leak endpoint removed, rate limiting (migration 0034), cross-site request check, security headers (+ report-only CSP), one-time links can't be used twice, bad JSON on staff routes is a 400, webhook junk can't fill the table, daily clean-up, activity feed restricted, 90-question cap, duplicate sign-up race (found by the load test) now a clean 409.
- **Audits:** content/data (integrity ok, 0 orphans), security (25 findings), integration trace (144/144).
- **Docs:** deployment, backup, rollback, staging and production sequence.

## 2. Partially completed
BHU flags (3 of 4 questions need BHU); JNU PG (drafted, not imported, 24 of 61 rows not image-checked); load testing (in-process burst only); email and payments (everything local done, go-live blocked externally); content gaps listed but not worked (on hold).

## 3. Remaining technical tasks
Image-check the 24 JNU PG rows; DU procedure/dates and the 150 B.A. combinations; run the browser/mobile regression pass (harness missing); HTTP load test on staging; tighten CSP from report-only; rehash passwords if Workers allows more iterations; add LOGIN events to the audit log; upgrade katex; invoice and refund tables (migrations 0035+ per payments plan, after decisions); fix content gaps (stuck extraction jobs, 8 empty flashcards, stale R2, dead PYQ links).

## 4. Test results (actual)
| Suite | Result |
|---|---|
| Backend (Workers runtime) | 262 passed / 262 (31 files) |
| Frontend | 7 / 7 |
| Ingestion | 40 / 40 |
| Typechecks, Prisma schema validate/generate, production build, `wrangler deploy --dry-run` | all pass |
| Integration trace (throwaway DB copy) | 144 / 144 |
| Load (in-runtime) | no server errors: 250 concurrent reads, 15+15 sign-ups/sign-ins, 6 parallel same-address sign-ups → exactly 1 account |
| Browser / mobile | **not run this sprint** (see checklist) |
| HTTP load test | **not run** (needs staging) |

## 5. Database and content preservation evidence
`preservation-evidence.md` and `evidence/*.json`: only `audit_logs` (+2), `d1_migrations` (+1) and the new empty `rate_limits` changed in row count; integrity_check ok; foreign_key_check 0; publication states unchanged; the only content edit is the approved JNU/BHU flag work, all still DRAFT.

## 6. Security findings and unresolved risks
Full list: `security-audit-2026-11-16.md`. **Unresolved High:** F-03 – one shared admin token guards `/api/admin/*` on the public URL. Medium: sign-up email enumeration (F-07), other console reads open to any staff role (F-05). Partial refund ends the whole pass (F-18). Not verified without the live account: production secrets, WAF/Access, alerting, PBKDF2 cost limit.

## 7. CEO decisions required
1. Who may see what in the console (F-05) and whether sign-up should hide whether an email exists (F-07).
2. The seven payment decisions in `payments-audit-and-plan.md` (including refund rules for partial and stacked passes) and GST invoice details with finance.
3. Approve or reject each of the six proposed admissions sources and the JNU PG source.
4. Email subdomain choice (A recommended) and sender name.
5. Whether `CONTENT_PREVIEW=true` stays on in production.
6. Approval to push ede4ea4 and the sprint commit, and later to deploy staging then production.

## 8. Credentials / external access required
Cloudflare: create staging D1/R2/Worker, onboard Email Sending domain, Access in front of `/api/admin/*`, rotate `ADMIN_API_TOKEN`, check dashboard observability. Razorpay **test** keys and webhook secret (live keys only after approval). DNS access for the email subdomain. BHU confirmation (admission.help@bhu.ac.in). Finance input for GST invoice numbering.

## 9. Git status
Pushed (approved): up to `f8f347a`. Local, **not pushed:** `ede4ea4` and one sprint commit holding everything in this report (made after writing it). Secret scan: nothing committed. `.dev.vars` is git-ignored.

## 10. Staging and production sequence
See `deployment-and-rollback.md`. In short: backup → apply migrations 0009–0034 (26, additive) **before** the code (0034 is required by sign-in) → deploy → smoke test → content load → Cloudflare Access → email → payments → domain. Staging first, with its own D1 and R2.

## 11. Backup and rollback plan
D1 export plus Time Travel bookmark, R2 listing, recorded Worker version; code rollback with `wrangler rollback`; data rollback by Time Travel; email and payments switch off by removing one setting; rate limiter off by `RATE_LIMIT=off`. Details in `deployment-and-rollback.md`.
