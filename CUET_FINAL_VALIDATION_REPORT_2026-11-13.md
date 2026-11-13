# CUET Final Validation Report

**Date:** 13 November 2026
**Scope:** the integration trace, repeated in full, and a read-only verification of everything on Cloudflare.
**Changes to Cloudflare:** none. Every Cloudflare step below was a read. Nothing was deployed, migrated or imported.

## 1. Result

| Area | Result |
|---|---|
| Integration trace (API to database) | **74 of 74 checks pass** |
| Backend tests | 60 of 60 |
| Pipeline tests | 28 of 28 |
| Typecheck, frontend build, Worker dry-run builds | Pass |
| Browser checks (earlier today) | 18 of 18, plus 13 of 13 for email |
| Cloudflare: live database, file storage, Worker, settings | As expected; no drift since 12 November |

The platform is fully connected on this computer. The live site is still the "Hello World!" placeholder: the app has not been deployed, by design.

## 2. Integration trace

### What changed about the trace

Yesterday's 53-check trace was run from a one-off script that was not saved, so it could not simply be run again. It has been rebuilt as `backend/scripts/integration-trace.mjs` and is now in the repository. It covers the same flows as yesterday plus the work added since (search, public information, email, the admin console, reviewer reject), which is why the count is 74 and not 53.

How it works: it copies the local database and files to a throwaway folder, starts the Worker against that copy on port 8791, makes the calls the screens make, reads the database after each step, then stops the server and deletes the copy. The working local database is never touched. Run it with:

```
node backend/scripts/integration-trace.mjs
```

### Checks by area

| Area | Checks | Passed | What was confirmed in the database |
|---|---|---|---|
| Accounts and sessions | 8 | 8 | Account and role written; password stored only as a salted hash (100,000 rounds); cookie is HttpOnly and SameSite=Lax; only the session token's hash is stored; duplicate email and wrong password refused |
| Syllabus explorer | 11 | 11 | UG 33 of 37 and PG 120 of 157 visible, equal to the database; Physics outline 41 rows; unchecked papers serve no rows; lesson blocks and diagram checksum match; search stays inside visible syllabi |
| Student tools | 7 | 7 | Goals, preferences, recently viewed, bookmarks and plan items written, changed and deleted; another student gets 404 |
| Practice and tests | 13 | 13 | Answers marked from stored keys; no key revealed during a test; topic test 15 questions; mock 50 questions, 60 minutes, +5 and −1 from the stored exam rules; score 12 equals the expected 12; progress, Today page and weekly report equal stored attempts |
| Profile and email | 8 | 8 | Name change; wrong password refused; password change replaces the hash and signs out other devices; reset email recorded with a hashed one-time link; no message body stored; sign-out revokes the session |
| Public information | 4 | 4 | 125 UG and 106 PG facts served, equal to the database; 244 UG universities; search filters |
| Reviewer | 10 | 10 | Student refused (403); role grant stored; official PDF matches its checksum; approval needs a ticked checklist and is recorded under the reviewer's own account; rejection needs a comment; the shared admin token cannot approve |
| Admin | 10 | 10 | Missing or wrong token refused; question total 787 equals the database; student refused in the console; suspend signs the account out and blocks sign-in; restore works; actions logged under the administrator's account; reset link stored as a hash |
| Integrity | 3 | 3 | 0 foreign-key violations; nothing approved without a signed-in reviewer's record; every machine-checked syllabus version has its evidence record |

### What the first run found

The first run passed 72 of 74.

- **Sign-out did not work for API clients.** The browser signs out correctly, because it sends the session cookie. A client that sends the token as a `Bearer` header was not signed out. Fixed in `backend/src/routes/student.ts`; the check now passes.
- **One check was wrong, not the product.** It expected a "not found" answer for a paper whose syllabus is unchecked. The designed behaviour is an empty syllabus with a "being checked" screen. The check now confirms that no rows are served and that such a row cannot be opened directly.

## 3. Cloudflare verification (read-only)

### Worker `cuet`

| Check | Finding |
|---|---|
| `https://cuet.ceo-3a7.workers.dev/`, `/api/health`, `/api/learn/exams` | All answer 200 "Hello World!" |
| Deployments | One, created 12 November 2026 09:18 UTC, the placeholder. No deployment since |
| Secrets | None set. `ADMIN_API_TOKEN` must be set before the admin API can work live |
| Production dry-run build | Passes. Bindings: `DB` to `cuet-db`, `MEDIA` to `cuet-storage`, `ASSETS` to the app files |
| Email in production | Off. The production configuration has no `send_email` binding and no cron, as intended. Wrangler prints a notice about this; it is expected |

### Database `cuet-db`

| Measure | Live | Local | Note |
|---|---|---|---|
| Migrations applied | 0001–0008 | 0001–0013 | 0009–0013 pending live |
| Tables | 43 | 57 | |
| Papers / source PDFs | 194 / 194 | 194 / 194 | Same |
| Syllabus versions | 196 | 347 | Local holds the Option B corrections |
| Papers visible to students | 92 | 153 | |
| Syllabus rows | 4,733 | 9,367 including archived versions | |
| Lessons / questions / media | 21 / 552 / 87 | 31 / 787 / 122 | Physics packs 22–31 are local only |
| Page texts | 1,107 | 1,107 | Same |
| Accounts | 2 | 4 | |
| Reviewer decisions by a person | 0 | 0 | Nothing is approved on either side |
| Foreign-key violations | 0 | 0 | |
| Size | 13.4 MB | | Region APAC |

No change since the approved migration on 12 November: the newest syllabus row change is 12 November 10:19 UTC and the newest account is 12 November 10:41 UTC. Every live figure equals the figure recorded after that migration. The 157 write queries shown for the last 24 hours are that migration; today's queries wrote 0 rows.

### File storage `cuet-storage`

| Check | Finding |
|---|---|
| Objects | 281, 53.2 MB, region APAC. Equal to 194 PDFs plus 87 media files in the database |
| Checksums | 8 files downloaded (4 diagrams, 4 PDFs): **8 of 8** match the size and SHA-256 stored in the database |
| Public access | r2.dev address disabled; no custom domain. The bucket is private |

## 4. Remaining blockers

| # | Blocker | Needs |
|---|---|---|
| 1 | **No reviewer decisions exist.** Physics and syllabus approval cannot be recorded until the reviewer's decisions are entered through a reviewer account, or their record is supplied | Owner: where the review was recorded |
| 2 | **The app is not deployed.** Live is five migrations and one deploy behind local | Owner's approval of the go-live steps in `CUET_TECHNICAL_VERIFICATION_2026-11-13.md` (now including migration 0013) |
| 3 | **No production admin secret** | Set at deploy time |
| 4 | **No custom domain.** Email cannot be switched on without a sending domain | Owner: the domain |
| 5 | **41 papers still hidden** and 38 review items open, including Kashmiri, Urdu and Lepcha | Human reviewers and readers of those scripts |
| 6 | **Previous-year papers have no official question source.** NTA publishes answer keys only and requires permission to reproduce | Owner: whether to write to NTA |

Not blockers, but open: the admin API is protected by one shared token (Cloudflare Access in front of it is recommended before real students); three buttons show no message if a save fails (noted in the 12 November audit).

## 5. Files changed in this step

- `backend/scripts/integration-trace.mjs` (new): the repeatable trace.
- `backend/src/routes/student.ts`: sign-out also revokes a token sent as a `Bearer` header.
- This report.
