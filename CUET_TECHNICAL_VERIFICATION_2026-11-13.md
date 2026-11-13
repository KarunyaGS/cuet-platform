# CUET Technical Verification

**Date:** 13 November 2026
**Scope:** the five open checks from the 12 November end-of-day report. Local only. Nothing was deployed and the live database was only read.

## Results

| # | Check | Result |
|---|---|---|
| 1 | Which 3 lessons and 3 questions the Physics import updated | Identified (below) |
| 2 | 121 diagrams in packs against 122 media files | Explained: 121 diagrams plus 1 official image |
| 3 | Screens with no browser evidence | 18 of 18 browser checks pass |
| 4 | Wrangler authorisation error 7403 | No longer occurs; live read works |
| 5 | Full test run | Pass, after one formatting fix |

### 1. Records updated by the 12 November Physics import

Taken from the review records written by the import (`admin:content-cli`, "Edited to version 2").

Lessons:

- The electromagnetic spectrum and the uses of its bands
- Electromagnetic waves: production, characteristics and transverse nature
- Atoms: alpha-particle scattering, Rutherford's nuclear model and the Bohr model of hydrogen

Questions (opening words):

- "Radiation of frequency 1.5×10^18 Hz is emitted when fast electr…"
- "In a microwave oven, food containing water gets heated mainly because…"
- "The electric field of a plane electromagnetic wave in vacuum is…"

### 2. Media count

The local database holds 121 AI-assisted SVG diagrams and 1 official PNG: the image on page 2 of the Lepcha (LAQP21) syllabus PDF, stored for a Lepcha reader to transcribe. Both earlier figures were right.

### 3. Browser checks

Run in headless Chrome against a throwaway copy of the local database with three test accounts. The copy was deleted afterwards and the local database was confirmed unchanged (4 users, 0 rejected questions, 0 human review records).

| Area | Checks | Result |
|---|---|---|
| Reset-password page | Mismatched passwords block the button; success message; a used link is refused; old password fails; new password signs in | 5 of 5 |
| Recently viewed | The list shows the topic just opened | 1 of 1 |
| Reviewer at phone width (390 px) | Home, syllabus queue, content review, paper workspace: no sideways scroll | 4 of 4 |
| Reviewer "Reject" | Button disabled without a comment; server records DRAFT/UNVERIFIED to DRAFT/REJECTED | 2 of 2 |
| Admin at phone width (390 px) | Overview, students, content, completion, staff, activity: no sideways scroll | 6 of 6 |

No page errors were raised. One gap: the first Physics topic opened had no lesson link, so the "recently viewed" check covered a topic, not a lesson.

### 4. Wrangler

`wrangler whoami` shows a valid login with D1 and Workers scopes. The read-only live listing reports migrations 0009–0012 still to be applied, which matches yesterday's finding.

### 5. Tests and builds

| Check | Result |
|---|---|
| Backend tests | 52 of 52 |
| Pipeline tests | 28 of 28 |
| Typecheck (database, API, web, pipeline) | Clean |
| Frontend production build | Passes |
| Worker dry-run build | Passes |
| Schema validation | Valid. `prisma format --check` failed on spacing left by commit `da4a4bc`; formatted, spacing only |

Not repeated today: the 53-check integration trace.

## Review records: what the databases hold

| | Local | Live `cuet-db` |
|---|---|---|
| Review records written by a signed-in person | 0 | 0 |
| Lessons approved (`VERIFIED`) | 0 of 31 | 0 of 21 |
| Questions approved | 0 of 787 | 0 of 552 |
| Syllabus versions approved | 0 of 194 current | 0 |
| Reviewer assignments | 0 | table not present |

No reviewer decision is recorded in either database, so nothing has been marked approved. The reviewer screens exist only locally; the live Worker still answers "Hello World!".

## Go-live order (each step needs the owner's approval)

1. Back up `cuet-db` (export) and record table counts.
2. Apply migrations 0009–0012 to `cuet-db`. They only create new tables.
3. Set the production secret `ADMIN_API_TOKEN`.
4. Deploy the Worker with `CUET_DEPLOY_APPROVED=yes`.
5. Import official information (231 facts, 51 notices, 442 universities).
6. Load Physics packs 22–31 and the 35 new diagrams.
7. Import the syllabus corrections and run `review-machine-check` against live.
8. Smoke test: health, sign-up, sign-in, subject list (expect 153 visible), one lesson, one practice session, public information pages, admin sign-in.
9. Recommended before real students: put Cloudflare Access in front of `/api/admin`.

Rollback for step 4 is `wrangler rollback`. Steps 2 and 5–7 add rows and tables only; the export from step 1 is the fallback.
