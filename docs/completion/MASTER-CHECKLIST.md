# CUET master checklist – updated 16 Nov 2026 (end of completion sprint)

Legend: DONE = finished and verified here · PARTIAL = part done, rest named · BLOCKED = needs a decision, credential or approval · NOT DONE = not done, reason given.

## P1 Government notices and admissions
| # | Item | Status | Detail |
|---|---|---|---|
| 1.1 | JNU full eligibility text (DRAFT) | DONE | 16 facts; `admissions-completion-2026-11-16.md` |
| 1.2 | BHU flags | PARTIAL | tie-break year resolved; any/all papers, draft bulletin, B.Voc remain (need BHU) |
| 1.3 | Six proposed sources reviewed | DONE (review) | none approved/imported; NTA PG and Jamia NOT VERIFIED |
| 1.4 | JNU PG reviewed | PARTIAL | 61 CUET-PG programmes drafted, not imported; 24 rows not image-checked |
| 1.5 | Remaining DU/BHU/JNU gaps listed | DONE | in admissions report |
| 1.6 | No unverified import/publication | DONE | published: Delhi 4 programmes + 8 facts only |
| 1.7 | Admissions completion report | DONE | |

## P2 Email and notifications
| # | Item | Status | Detail |
|---|---|---|---|
| 2.1 | Workflows/templates audited; retry, duplicate prevention, bounce, unsubscribe tested | DONE (local) | 5 new tests + existing email suites pass |
| 2.2 | Subdomain, DNS, binding, config prepared | DONE | `email-go-live.md` |
| 2.3 | Real sending / DNS / domain | BLOCKED | domain decision, DNS access, Cloudflare Email Sending onboarding |

## P3 Payments
| # | Item | Status | Detail |
|---|---|---|---|
| 3.1 | Audit + security tests | DONE | `billing-security.test.ts`; findings P1–P10 |
| 3.2 | Local fixes (failed-order recovery, wrong-amount visibility) | DONE | |
| 3.3 | GST invoice / credit-note requirements; plan for 7 CEO decisions | DONE (plan) | `payments-audit-and-plan.md`; items marked "?" need finance |
| 3.4 | Razorpay test run, refunds, partial refund rule, invoices | BLOCKED | Razorpay test keys, CEO decisions, finance |

## P4 Content and data audit
| # | Item | Status | Detail |
|---|---|---|---|
| 4.1 | All content areas counted, references checked, duplicates found | DONE | `content-data-audit-2026-11-16.md` |
| 4.2 | Preservation evidence | DONE | `preservation-evidence.md` |
| 4.3 | Content gaps (only Physics has questions; stuck jobs; stale R2; 8 empty flashcards; 26 hidden duplicate notices; 27 dead PYQ links) | NOT DONE | content work on hold by owner; listed, nothing deleted |

## P5 Security and technical
| # | Item | Status | Detail |
|---|---|---|---|
| 5.1 | Audit (25 findings) | DONE | `security-audit-2026-11-16.md` + full findings |
| 5.2 | Safe local fixes | DONE | 13 fixes, all tested |
| 5.3 | Admin token (F-03), email enumeration (F-07), console permissions (F-05 rest), live-account checks | BLOCKED | decisions / Cloudflare dashboard |
| 5.4 | Load test | PARTIAL | in-runtime burst test passes; HTTP load test needs staging |

## P6 Testing (actual results)
| Suite | Result |
|---|---|
| Backend vitest | 262 / 262 pass (31 files) |
| Frontend vitest | 7 / 7 |
| Ingestion vitest | 40 / 40 |
| Typechecks, Prisma validate, production build, deploy dry-run | pass |
| Integration trace on throwaway DB | 144 / 144 |
| Browser and mobile tests | NOT DONE this sprint – the Playwright harness was not found on disk and `wrangler dev` crashes the workers runtime on this machine; only one admin screen changed (Billing alert), covered by build/typecheck only |

## P7 Git and deployment readiness
| # | Item | Status | Detail |
|---|---|---|---|
| 7.1 | Pushed up to f8f347a (approved) | DONE | |
| 7.2 | Unpushed: ede4ea4 + sprint commit | OPEN | push needs approval |
| 7.3 | Secret scan | DONE | none committed |
| 7.4 | Migration order, backup, rollback, staging, production sequence | DONE (documents) | `deployment-and-rollback.md`; nothing run remotely |
| 7.5 | Staging / production deployment | BLOCKED | approval; staging resources must be created |
