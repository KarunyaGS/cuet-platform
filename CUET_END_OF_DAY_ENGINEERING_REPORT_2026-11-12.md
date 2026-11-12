# CUET Platform: End-of-Day Engineering Report

**Date:** 12 November 2026
**Repository:** `KarunyaGS/cuet-platform`, branch `main`
**Latest commit:** `f105754` (21:18 IST), identical on the computer and on GitHub
**Evidence re-checked while writing (21:30–21:45 IST):** Git history, local database counts, a read-only query of the live database, the live Worker's response, and a fresh run of both test suites.

Words used in this report:

- **Local** means the developer computer: local Worker, local D1 database, local R2 file store.
- **Live** means Cloudflare: Worker `cuet`, database `cuet-db`, bucket `cuet-storage`.
- **Machine-checked** (`MACHINE_VERIFIED`) means automated checks passed. **Approved** (`VERIFIED`) means a signed-in person approved it. These are different, and no record in either database is approved by a person today.

---

## 1. Executive summary

- The repository was created at 12:10 and holds 22 commits, all pushed. The working tree is clean.
- **Built today:** the syllabus pipeline for 194 official papers, a 53-table database with 12 migrations, a Worker API of about 125 endpoints, the student application, public exam-information pages, an admin console and a reviewer area.
- **Tests, re-run at 21:35:** 50 of 50 backend tests and 28 of 28 pipeline tests pass.
- **Local database now:** 194 papers, 4,733 syllabus rows, 31 Physics lessons, 787 questions and 122 media files. All lessons and questions are unpublished drafts that no person has reviewed.
- **Live is unchanged since the afternoon migration:** the Worker answers "Hello World!", and `cuet-db` holds migrations 0001–0008, 21 lessons and 552 questions. Nothing was deployed today.
- **Syllabus corrections:** a trial on a throwaway copy replaced 151 papers and removed every "stored inside the Note box" error, but it reduced visible papers from 92 to 40, because corrected versions arrive as "not reviewed".
- **Decision recorded:** proceed with Option B on the local database only, subject to validation, with no automatic human approval and no production changes. **Option B has not been executed yet.**
- **Correction to an earlier statement:** the claim that importing the corrections "unhides 102 papers" was wrong. No hidden paper becomes visible through the import alone.

---

## 2. Chronological timeline

Times are Git commit times (IST). Git records when work was committed, not when it started, so no start times are given.

| Time | Commit | Work | Size |
|---|---|---|---|
| 12:10 | `49c41f3` | Repository created | 1 file |
| 14:14 | `ce2dac2` | Syllabus pipeline, D1 schema, Worker API, student app | 99 files, +17,215 |
| 15:09 | `cd54da2` | Syllabus reviewer, content-pack pipeline, production Worker configuration | 46 files, +3,812 |
| 15:27 | `8dff13c` | Owner decision on unreviewed content; OCR re-extraction; integrity checks | 31 files, +6,374 |
| 15:52 | `3f5c8b5` | All collected syllabus data stored in local D1; data report | 16 files, +812 |
| 16:53 | `7dafc92` | Remote migration tooling, R2 upload with checksums, mid-day report | 6 files, +621 |
| 16:56 | `311d435` | Physics content packs (31) and Chemistry diagrams | 176 files, +18,978 |
| 17:38 | `ba0bc65` | Student tools: dashboard, bookmarks, planner, goals, profile, daily practice, revision | 23 files, +1,643 |
| 17:38 | `7adccd1` | Project completion audit | 1 file, +204 |
| 17:38 | `d8aa959` | Official CUET-UG and CUET-PG 2026 information from NTA sources | 4 files, +904 |
| 18:24 | `b12e9c0` | Status report and frontend–backend–database integration audit | 2 files, +562 |
| 18:24 | `eba6918` | Sign-in-first entry flow and UI/UX redesign | 27 files, +2,203 / −1,031 |
| 18:36 | `d608ea5` | Public information pages (Batch P1) | 16 files, +1,153 |
| 18:45 | `3cf7534` | Student portal: preferences, recovery, weekly report, reminders, recently viewed (Batch P2) | 23 files, +1,220 |
| 18:46 | `3057e9e` | Syllabus review and extraction results added to Git | 986 files, +345,234 |
| 18:53 | `d2c9f20` | CUET-PG syllabus structure audit (investigation only) | 2 files, +409 |
| 20:17 | `b1bfd44` | Syllabus explorer: correct unit, section and topic counts | 6 files, +112 |
| 20:30 | `da4a4bc` | Admin console and reviewer review: backend | 7 files, +608 |
| 20:36 | `2a85c94` | Admin console and reviewer screens: frontend | 7 files, +1,578 |
| 20:37 | `00bcb43` | Technical work report | 1 file, +146 |
| 20:58 | `df49be8` | Fixes from the browser verification | 7 files, +18 / −10 |
| 21:18 | `f105754` | Syllabus search, page-not-found screen, structure checks, corrections trial report | 19 files, +1,444 |

Work that produced no commit of its own:

| When | Work | Evidence |
|---|---|---|
| About 16:02 | Live database migration (0001–0008 and data) and R2 upload | `docs/migration-report.md`, backup `pre-migration-20261112-160227` |
| About 20:40–20:58 | Browser verification of admin, reviewer and portal screens on a throwaway database copy | Session record; fixes in `df49be8` |
| 21:01 | Backup before local imports | `D:\cuet-backups\pre-local-imports-20261112-210145` |
| About 21:04 | Physics packs loaded into the local database | Local database counts |
| Before 21:18 | Syllabus corrections trial on a throwaway copy (copy deleted afterwards) | `CUET_SYLLABUS_CORRECTIONS_TRIAL_REPORT.md` |

---

## 3. Research and data acquisition

### 3.1 Official paper discovery

- **Requirement:** a complete list of CUET papers taken only from NTA, with no invented entries.
- **How:** the `discover` step reads NTA's CUET-UG syllabus page and the six CUET-PG syllabus family pages, lists each paper with its PDF link, then checks the codes against the Information Bulletin of the same cycle.
- **Output:** `content-ingestion/registry/cuet-2026-official-papers.json` and a paper-list check file.
- **Result:** 194 papers (37 CUET-UG, 157 CUET-PG), matching NTA's lists.

### 3.2 PDF collection

- **How:** download with retries and back-off, a delay between requests, a PDF signature check, and a SHA-256 checksum per file. Files are cached under `storage/cache/pdf`.
- **Result:** 194 PDFs, 546 pages. Each is a `source_documents` record with checksum and page count.

### 3.3 Official exam information

- **Requirement:** dates, eligibility, pattern, fees, notices and universities for the public pages, each tied to an NTA source, with nothing invented.
- **Output:** `content/official-info/` with 117 UG facts, 99 PG facts, 51 notices (27 UG, 24 PG) and 442 participating universities (244 UG, 198 PG).
- **Items NTA has not announced:** 8 for UG and 7 for PG are stored as "not announced yet" entries instead of being guessed.
- **Reconciled tonight:** the local database holds 231 information rows (125 UG, 106 PG). That is the 216 facts plus the 15 "not announced yet" entries.

---

## 4. Technical architecture

| Layer | Technology | Location |
|---|---|---|
| Ingestion pipeline | Node, TypeScript, pdf.js, Poppler `pdftotext`, tesseract.js | `content-ingestion/` |
| Database | Cloudflare D1 (SQLite), Prisma 7 schema, raw SQL for hot paths | `database/`, `backend/` |
| API | Cloudflare Worker with Hono, zod 4 validation | `backend/src/` |
| File storage | Cloudflare R2, private bucket, binding `MEDIA` | PDFs, page images, diagrams |
| Student app | React 19, Vite 8, Tailwind 4, React Router 8, KaTeX | `frontend/src/` |

One Worker serves both the API (`/api/*`) and the built app (`frontend/dist`).

### 4.1 API groups

| Group | Purpose | Authentication | Route handlers |
|---|---|---|---|
| `/api/auth` | register, sign in, sign out, session, reset password | public, then session cookie | in `student.ts` |
| `/api/learn` | exams, subjects, outline, search, topics, lessons, media, revision | none on the API; the app pages that use it require sign-in | in `student.ts` |
| `/api/student` | practice, tests, progress, dashboard, goals, bookmarks, plan, profile, preferences, weekly report, reminders, recent | student session | `student.ts`: 40 in total |
| `/api/public` | official exam information, universities | none | 6 |
| `/api/review` | syllabus review, reviewer dashboard, lesson and question review | session + reviewer permission | 15 |
| `/api/console` | admin console | session + admin permission | 23 |
| `/api/admin` | import and tooling | shared token header `x-admin-token` | 40 |

Counted from source tonight: 124 route handlers in the five route files, plus health checks. The 20:37 report said 125. The two counts agree to within one.

### 4.2 Security design

- **Passwords:** PBKDF2, 100,000 rounds.
- **Sessions:** cookie `cuet_session`, HttpOnly and SameSite=Lax (plus Secure in production). Only a SHA-256 hash of the token is stored.
- **Scoring:** deterministic, from stored answer keys and the exam's marking rules. No AI model is called for student answers, scoring or evaluation.
- **Audit:** admin and reviewer writes are recorded in `audit_logs` or `review_records` under the person's account.
- **Approval is human-only:** code refuses to set `VERIFIED` without a signed-in reviewer.

### 4.3 Visibility rules

One shared SQL rule decides what students see:

- **Syllabus:** a version is visible when its status is `MACHINE_VERIFIED` or `VERIFIED` and it is not archived.
- **Content:** lessons and questions are hidden when a reviewer marks them `NEEDS_CHANGES` or `REJECTED`.
- **Owner decision (recorded today):** machine-checked syllabus and AI-assisted content may be shown to students without status labels. Internally each record keeps its true status.

---

## 5. Database and infrastructure

### 5.1 Migrations

| Migration | Purpose | Local | Live `cuet-db` |
|---|---|---|---|
| `0001_init` | Core exam, syllabus, content, question tables | Applied | Applied |
| `0002_reference_data` | Reference data | Applied | Applied |
| `0003_ingestion_pipeline_tables_figures` | Tables and figures from PDFs | Applied | Applied |
| `0004_verification_students_practice` | Verification, accounts, practice | Applied | Applied |
| `0005_syllabus_review` | Syllabus review records | Applied | Applied |
| `0006_content_pack_keys` | Stable keys that make content imports repeatable | Applied | Applied |
| `0007_topic_retrieval_indexes` | Indexes for topic lookups | Applied | Applied |
| `0008_source_page_texts` | Text of every PDF page, per reading method | Applied | Applied |
| `0009_student_tools` | `bookmarks`, `learning_activity`, `daily_goals`, `study_plan_items` | Applied | **Not applied** |
| `0010_official_info` | `official_info_items`, `official_notices`, `participating_universities` | Applied | **Not applied** |
| `0011_student_portal` | `student_preferences`, `password_reset_tokens`, `reminder_dismissals` | Applied | **Not applied** |
| `0012_review_assignments` | `review_assignments` | Applied | **Not applied** |

Migrations 0009–0012 only create new tables. They change no existing table or row.

### 5.2 Database state, verified tonight

| Measure | Local | Live `cuet-db` |
|---|---|---|
| Migrations applied | 0001–0012 | 0001–0008 |
| Tables | 53 | Not counted tonight; the four tables probed from 0009–0012 are absent |
| Papers / source PDFs | 194 / 194 | Not re-counted tonight |
| Syllabus versions | 196 (194 current, 2 archived) | 196 |
| Syllabus rows | 4,733 | 4,733 |
| Current versions machine-checked / not reviewed | 92 / 102 | Not re-counted tonight |
| Lessons | 31 | 21 |
| Questions | 787 | 552 |
| Media files | 122 | Not re-counted tonight |
| Official facts / notices / universities | 231 / 51 / 442 | Tables do not exist |
| Foreign-key violations | 0 | 0 at migration time (afternoon) |

The live figures come from one read-only query at about 21:40. The response confirmed zero rows written.

### 5.3 Live migration (afternoon)

- **How:** local data was copied to `cuet-db` in 5,000-row chunks, insert-only, with a difference check by primary key.
- **Problem found:** three page texts contained NUL bytes that silently stopped the load. They were encoded as `char(0)` and verified by hex comparison.
- **Result at the time:** 17,798 rows identical, 0 foreign-key violations, 117 of 117 schema objects matching.
- **R2:** 281 files uploaded to `cuet-storage` and verified by download and SHA-256. The bucket is private.

### 5.4 Safety mechanisms

| Mechanism | Effect |
|---|---|
| `CUET_DEPLOY_APPROVED=yes` | Deploy script refuses to run without it |
| `CUET_REMOTE_DATA_APPROVED=yes` | Remote data scripts refuse to run without it |
| `CUET_REMOTE_FILES_APPROVED=yes` | Remote file scripts refuse to run without it |
| `scripts/predeploy-check.mjs` | Refuses a deploy with a placeholder database id, an unbuilt app, or no approval |
| Version archival | A syllabus import creates a new version and archives the old one. Nothing is deleted |
| Idempotent imports | Content imports match on stable keys, so a repeat run updates instead of duplicating |

### 5.5 Backups

| Backup | Taken before |
|---|---|
| `D:\cuet-backups\20261112-145801` | First remote-migration rehearsal |
| `D:\cuet-backups\20261112-154600` | Importing the missing collected data |
| `D:\cuet-backups\pre-migration-20261112-160227` | The live migration |
| `D:\cuet-backups\pre-local-imports-20261112-210145` | Tonight's local imports |

Tonight's backup holds a full SQL export (12,017,638 bytes, SHA-256 recorded in `MANIFEST.txt`) and a raw copy of the local D1 file and local R2 objects. Backups stay outside Git because they contain password hashes of local accounts.

### 5.6 Where each operation ran

| Operation | Local database | Throwaway copy | Live |
|---|---|---|---|
| Migrations 0001–0008 | Yes | | Yes (afternoon, approved) |
| Migrations 0009–0012 | Yes | | **Awaiting approval** |
| Official information import | Yes | | **Awaiting approval** |
| Physics packs 1–21 | Yes | | Yes (part of the afternoon migration) |
| Physics packs 22–31 | Yes (tonight) | | **Awaiting approval** |
| Syllabus corrections import | **No** | Yes (trial, copy deleted) | **Awaiting approval** |
| Option B machine-check marking | **No, not yet executed** | No | Not proposed |
| Integration trace (53 checks) | | Yes | |
| Browser verification with test accounts | | Yes | |

---

## 6. Frontend and backend development

Testing status uses three levels: **API test** (automated), **browser** (clicked through), **none found** (no evidence).

| Module | Frontend | Backend | Tables | API test | Browser |
|---|---|---|---|---|---|
| Sign-in-first flow | `pages/Auth.tsx`, `RequireAuth`, `GuestOnly`, `AuthProvider` in `ui.tsx` | `/api/auth/*` (existing endpoints reused; no duplicates) | `users`, `sessions` | Yes | Yes |
| Public CUET pages | `pages/info/InfoPages.tsx`, `shared.tsx` at `/cuet`, `/cuet/ug`, `/cuet/pg` | `GET /api/public/info/:exam` | 0010 tables | Yes | Yes |
| Notices and FAQs | Part of the info pages | Same endpoint | `official_notices`, `official_info_items` | Yes | Yes |
| University listings | `/cuet/*/universities` | `GET /api/public/universities` | `participating_universities` | Yes | Yes |
| Dashboard (Today) | `pages/Dashboard.tsx` | `GET /api/student/dashboard` | 0009 tables | Yes | Yes |
| Preferences | `PreferencesForm` in `Profile.tsx` | `/api/student/preferences` | `student_preferences` | Yes | Yes |
| Weekly report | `pages/Report.tsx` | `/api/student/weekly-report` | reads practice data | Yes | Yes |
| Reminders | `reminders.tsx` bell in `Layout.tsx` | `/api/student/reminders`, dismiss | `reminder_dismissals` | Yes | Yes |
| Study planner | `pages/Planner.tsx` | `/api/student/plan` | `study_plan_items` | Yes | Yes |
| Goals | `tools.tsx`, dashboard | `/api/student/goals` | `daily_goals` | Yes | Yes |
| Bookmarks | `pages/Bookmarks.tsx` | `/api/student/bookmarks` | `bookmarks` | Yes | Yes |
| Recently viewed | "Saved and recent" page | `/api/student/recent` | `learning_activity` | Yes | None found |
| Revision notes | `pages/Revise.tsx` | `GET /api/learn/topics/:id/revision` | reads lessons | Yes | Yes |
| Password recovery | `pages/Reset.tsx` | `POST /api/auth/reset-password`, `POST /api/admin/users/reset-link` | `password_reset_tokens` | Yes | Reset link creation: yes (admin console). Reset page itself: none found |
| Syllabus search | `pages/Search.tsx`, search icon in `Layout.tsx` | `GET /api/learn/search` | reads syllabus | Yes | Yes |
| Page not found | `NotFoundPage` in `Search.tsx`, route `*` | none | none | n/a | Yes |
| Admin console | `admin/Admin.tsx`, `ContentBrowser.tsx` | `/api/console/*` | `review_assignments`, `audit_logs` | Yes | Yes |
| Reviewer area | `review/Home.tsx` | `/api/review/*` | `review_records` | Yes | Yes |

Implementation notes for the items asked about:

- **Sign-in-first:** every app route sits inside `RequireAuth`. A deep link is remembered and restored after sign-in. A 401 from any API call raises one event that signs the user out and redirects.
- **Password recovery:** an admin creates a one-time link, valid for one hour and usable once. Only the token hash is stored. **Email delivery is not built**, so the link is handed over manually.
- **Wrong current password:** now returns 400 `WRONG_PASSWORD`. It previously returned 401, which the app showed as "Sign in".
- **Daily practice:** falls back to the student's preferred subjects when no topic is chosen.
- **Weekly report:** the chart has a screen-reader table. It caused sideways scrolling on phones and was wrapped to fix that.
- **Search:** each word typed must appear in the result. The SQL uses `LIKE` with `ESCAPE '!'` so that `%` and `_` typed by a student are treated as plain characters. Only syllabi students are allowed to see are searched. The query lives in the address bar, so results can be shared. At most 40 matches are shown.
- **Page not found:** shown for unknown addresses, unknown exam names and unknown papers, with links to home, search and exam information.
- **Design system:** colour tokens, IBM Plex Sans, Serif and Devanagari, lucide icons, shared components in `ui.tsx`, a phone bottom tab bar, and a focus mode on the practice screen.

---

## 7. Syllabus processing and correction

### 7.1 Pipeline

`discover → download → extract → normalise → validate → deduplicate → import → verify`

All steps are deterministic. No language model reads, rewrites or completes syllabus text in the pipeline.

| Step | How it works |
|---|---|
| Extract, text pages | pdf.js text layer. Two-column pages are split at the right column's left edge |
| Extract, OCR pages | tesseract.js for scanned pages, text drawn as images, and legacy non-Unicode fonts. The OCR language comes from the paper. Each OCR page is saved as an image for human checking |
| Structure | Headings by wording ("Unit", "Chapter", "Section" and their Indian-language forms), numbering and bullets. The printed heading line is kept unchanged as `sourceText` |
| Hierarchy | Each row is a `curriculum_nodes` record with a kind (part, section, course, unit, chapter, topic, subtopic, item, note), a parent, and `source_page` |
| Traceability | Each row points to its PDF page. `source_page_texts` holds 1,107 page texts, one per page per reading method |
| Validate | Hard checks (parent links, depths, page ranges, lengths) block a document. Soft flags are recorded per document |
| Audit | Re-reads each PDF and reports, per page, the share of source words captured, with an independent cross-check against `pdftotext` |
| Verify | Automated checks set `MACHINE_VERIFIED`. Nothing is set to `VERIFIED` by a machine |

### 7.2 Reconciliation, duplicates and unreadable text

- **OCR re-check:** all 546 pages were re-read by OCR; 99.70% of OCR words were found in the stored rows (mid-day figure).
- **Integrity:** 22 of 22 integrity checks passed, with 0 foreign-key violations and 0 exact duplicate rows (mid-day figure).
- **Footers:** page footers were captured as syllabus rows. The extractor was fixed and 25 rows corrected, with before and after kept.
- **A correction that went wrong:** an automatic correction matched rows by position and changed 801 rows wrongly. All 801 were restored from the stored before-values, and matching was changed to tree path.
- **Unreadable scripts:** Kashmiri (LAQP17) and Urdu (LAQP37) are scanned Nastaliq; extra OCR models reached only 25–41% confidence, so their output is not stored as fact. Marathi and Pali page 2 were re-read by OCR and stored as new drafts, with the old versions kept.
- **NTA's own PDF problems:** 24 entries are recorded separately in `content-ingestion/registry/source-issues.json`.

### 7.3 Page-image review

Every page of all 194 PDFs was compared with the stored rows. Results are in `storage/local/syllabus-review/<exam>/<code>/` (`reviewed.json`, `validation.json`), in Git since `3057e9e`.

| Review result | Papers |
|---|---|
| Corrected | 149 |
| Transcribed from the page image | 3 |
| Confirmed as stored | 42 |

These corrections were produced with AI help from page images. They are **not** in the local or live database.

### 7.4 CUET-PG structure audit (`d2c9f20`)

- **Reported problem:** PG papers such as ACQP04 and ACQP10 showed "0 units, 8 topics".
- **Finding 1, correct data:** "0 units" is right for 96 flat PDFs and 22 sectioned PDFs. NTA prints no units there, and none were invented.
- **Finding 2, display error:** topic counts included "Note" instruction lines. Fixed in `b1bfd44` (`learning.ts` `listSubjects`), which also reports sections.
- **Finding 3, data error:** 17 visible PG papers store their syllabus inside the "Note" box, as topics under the Note or as hidden text on a Note line. Code cannot fix this; only corrected data can.
- **Finding 4:** cover-page titles stored as rows, and printed unit headings missing in 10 papers.

### 7.5 Chemistry SCQP08

- **Problem:** the corrected file stored six printed "Unit-I / II / III" headings as topics.
- **Fix:** `storage/local/syllabus-review/CUET_PG/SCQP08/reviewed.json` now stores them as units (6 rows), as printed on PDF pages 3 to 5. No unit name was invented.

### 7.6 Pipeline safeguards (new in `f105754`)

File: `content-ingestion/src/structure-checks.ts`, function `checkStructure(nodes, { pageCount, allowEmpty })`.

| Check | Level | Rule |
|---|---|---|
| Topics inside the Note box | Error | A Note holds more than 8 rows, contains units or sections, or a Note line has rows under it |
| Syllabus text on a Note line | Error | A Note or Note line carries more than 300 characters of body text |
| Cover-page title as a row | Error | A top-level, empty Note on page 1 whose title is not "Note" |
| No syllabus rows | Error | Nothing outside the Note box |
| Broken links | Error | Missing parent row, or a page number beyond the PDF's page count |
| Printed unit stored as topic | Warning | A heading printed as "Unit …" that is not stored as a unit |
| Numbering gaps or repeats | Warning | Among numbered siblings. A warning, because NTA's own numbering is sometimes irregular |
| Hierarchy order | Warning | For example a unit sitting under a subtopic |
| Paragraph as heading | Warning | A row title over 1,000 characters |

Where the checks run:

1. **Pipeline verify step** (`verify.ts`): before a machine extraction can be marked machine-checked.
2. **Review validation** (`syllabus-review.ts`, `reviewValidate`): before a reviewed correction is accepted. This sits beside the existing check that each row's text is found on its own PDF page (`unconfirmedRows` in `validation.json`).
3. **Command line:** `npm run ingest -- structure-check [--warnings] [--exam]`.
4. **Import API** (`backend/src/services/imports.ts`): the server refuses the three storage errors itself, so a faulty file cannot be imported even if the pipeline is bypassed.

Results:

- **55 machine extractions flagged as faulty** across the 194 papers.
- **Reviewed corrections pass**, except Lepcha (LAQP21), which fails correctly because it has no syllabus rows.
- **Tests:** `content-ingestion/test/structure.test.ts` and `backend/test/syllabus-shape.test.ts`.

### 7.7 Corrections trial: before and after

Run on a throwaway copy of the local database, which was deleted afterwards. The local and live databases were not touched.

| Measure | Before | After the trial |
|---|---|---|
| Papers students can see | 92 of 194 | 40 of 194 |
| CUET-UG visible | 21 | 11 |
| CUET-PG visible | 71 | 29 |
| Papers with syllabus stored inside the Note box | 27 | 0 |
| Of those, visible to students (the "broken" PG subjects) | 17 | 0 broken; all 17 corrected but hidden |
| Papers with cover-page titles stored as rows | 54 | 0 |
| Papers with no syllabus rows at all | 26 | 1 (Lepcha) |
| Hidden papers | 102 | 102 still hidden; 99 of them replaced by corrected versions |
| Current syllabus rows | 4,718 | 5,390 |

What the trial did:

- **151 papers** received a corrected version. The old versions were archived, not deleted.
- **42 papers** confirmed as correct were left alone, including Physics.
- **Lepcha (LAQP21) was refused:** its review holds no transcribed rows. The syllabus is printed in Lepcha script inside an image and needs a Lepcha reader.
- **52 papers visible today** would become hidden, because a corrected version arrives as "not reviewed".
- **38 unresolved review items** in 22 papers (34 items in 18 PG papers, 4 items in 4 UG papers) are carried in each version's notes. The import decides none of them.

**Row-title limit:** one corrected row in MTQP03 has a 1,002-character title, which the import limit of 1,000 rejected. The limit in `imports.ts` is now 2,000. The pipeline still warns about any title over 1,000 characters so a person can judge it.

### 7.8 Options and the decision

| Option | Papers visible | Trade-off |
|---|---|---|
| A. Import as designed | 40 | Nothing unreviewed is shown, but 52 visible papers disappear until a reviewer approves each one |
| B. Import, then mark as machine-checked the corrected papers that pass automated checks | Up to 153 | Fixes the 17 broken subjects for students now. It treats "corrected with AI help, then automatically checked" as machine-checked |
| C. Do not import | 92 | No change; the 17 broken subjects stay broken |

**Option B's automated test for each corrected paper:**

1. every row's text is found on its own PDF page (`unconfirmedRows = 0`);
2. the review result is "corrected", not "transcribed";
3. the structure checks in 7.6 report no errors.

38 corrected papers do not pass and would stay hidden. Papers that pass become `MACHINE_VERIFIED`, never `VERIFIED`.

**Decision recorded:** proceed with Option B on the local database only, subject to validation, with no automatic human approval and no production changes.

**Status: not executed.** The local database still shows 92 machine-checked and 102 not-reviewed versions, as before the trial.

### 7.9 Machine-checked versus approved

| | Machine-checked | Approved |
|---|---|---|
| Stored as | `MACHINE_VERIFIED` | `VERIFIED` |
| Set by | Automated checks | A signed-in reviewer only; enforced in code |
| What it proves | The stored words appear on the cited PDF page, and the structure passes the checks | A person compared it with the PDF and accepted it |
| What it does not prove | That the hierarchy matches the PDF's meaning in every case | n/a |
| Count today | 92 syllabus versions | 0 |

---

## 8. Physics content import (local only)

| Measure | Before | After | Change |
|---|---|---|---|
| Lessons | 21 | 31 | +10 |
| Questions | 552 | 787 | +235 |
| Diagrams and images | 87 | 122 | +35 |

**How the packs are validated** (`npm run ingest -- content-validate --exam CUET_UG --paper 322`):

- **Structure:** schema `cuet-content-pack/1`; the pack's syllabus row must exist and its title must match the syllabus snapshot.
- **Coverage:** every concept the syllabus row names must map to a lesson heading that teaches it.
- **Lesson minimums:** at least 3 headings, 1 definition, 2 solved problems and 1 revision point.
- **Questions:** each needs options, an answer key that points to a real option, and an explanation. Options are compared with maths-aware matching so that two options with the same value are caught.
- **Duplicates:** near-duplicate detection across questions (word-set similarity of 0.7 or more is flagged).
- **Result:** all 31 packs passed before the import.

**How the import works** (`content-import`, through the local import API):

- Lessons, questions and diagrams are matched on stable keys (migration 0006), so a repeat run updates rather than duplicates.
- Each lesson and question is linked to its syllabus row (`curriculum_nodes`), which gives the topic relationship.
- Diagrams are SVG files stored in local R2 with a SHA-256 checksum in `media_assets`.
- Everything is stored as AI-assisted, `DRAFT`, `UNVERIFIED`. A pack cannot mark content approved.

**Checks after the import:**

- Every question has an answer key, an explanation, a topic and at least 2 options.
- No duplicate keys; 0 foreign-key violations (re-run tonight: none).
- All 35 new diagrams were fetched back and matched their checksums.
- Status re-checked tonight: 31 of 31 lessons and 787 of 787 questions are `DRAFT` and `UNVERIFIED`.

**Three lessons and three questions updated:** the import reported updating 3 existing lessons and 3 existing questions to match their pack files. **I could not identify which ones from the import log.** They can be identified by comparing the current database with the pre-import backup; that comparison has not been done.

**Why the content stays unpublished and unreviewed:** it was written with AI help, and no subject expert has checked it. Publishing and approval are human steps in the admin and reviewer screens.

**Minor discrepancy:** earlier reports say the 31 packs hold 121 diagrams; the database holds 122 media files. One media file is not a pack diagram, or one count is off by one. Not traced tonight.

**Backup before the import:** `D:\cuet-backups\pre-local-imports-20261112-210145`

---

## 9. Testing and validation

### 9.1 Automated tests (re-run 21:35)

| Suite | Result |
|---|---|
| Backend (`backend/test`, 8 files) | 50 of 50 pass |
| Pipeline (`content-ingestion/test`, 2 files) | 28 of 28 pass |

### 9.2 Build checks

| Check | Result | When |
|---|---|---|
| Typecheck, backend and frontend | Clean | Before commit `f105754`; not re-run for this report |
| Frontend production build | Passes | Before commit `f105754`; not re-run for this report |
| Production Worker dry-run build | Passes | Afternoon |

### 9.3 Browser-tested, with evidence

| Screens | When | How |
|---|---|---|
| Lesson page (maths, diagrams), practice, results, reviewer syllabus screen | About 15:27 | Local test reviewer account |
| Student tools: dashboard, bookmarks, planner, goals, profile, password change, daily practice, revision, unit test | Before 17:38 | Throwaway database copy and test account, deleted afterwards |
| Sign-in-first flow, redesigned screens, public `/cuet` pages | Before 18:45 | Recorded in the 20:37 report |
| Admin console: access refused for a student; overview; student search, reset link, suspend and restore; question and lesson view, edit, publishing steps; content completion; roles; assign a paper; activity log | About 20:40–20:58 | Signed in as admin on a throwaway copy |
| Reviewer: dashboard, approve (every check must be ticked), request changes (comment required), syllabus queue | Same | Signed in as reviewer |
| Weekly report, reminders (a dismissal survives reload), preferences, corrected subject page | Same | Signed in as student |
| Syllabus search and page-not-found | Before 21:18 | Local |

### 9.4 Built but no browser evidence found

- The reset-password page itself (`/reset-password`). Its API is tested.
- The "recently viewed" list. Its API is tested.
- Admin and reviewer screens at phone width.
- Reviewer "reject" action in the browser (approve and request-changes were clicked).

### 9.5 Known failures and limitations

- **Screenshots:** Chrome screenshots timed out at times, so some checks read the page content directly instead of looking at an image.
- **Memory:** the computer has 5.9 GB of memory and ran out once this evening, which stopped the local servers.
- **Live read access by command line:** tonight the Wrangler command for listing live migrations was refused with an authorisation error (code 7403). The live state was verified through the Cloudflare connector instead. The Wrangler login should be checked before any approved live step.
- **Integration trace:** the 53-of-53 end-to-end trace predates tonight's admin, reviewer and search work and has not been repeated.

---

## 10. Git and code changes

- **Branch:** `main`. **Commits today:** 22 (the whole history). **Tracked files:** 1,348.
- **Pushed:** yes. Local and `origin/main` are both `f105754`; 0 unpushed commits; 0 uncommitted files (checked 21:30, before this report file was added).
- **Force-push:** none. History is linear.
- **The five commits named in the request are all present.** The list was incomplete: there are 17 more, shown in Section 2.
- **Secrets:** a scan ran before each push. `.dev.vars` and `.env` files are ignored by Git.

Largest code additions:

| Commit | Main files |
|---|---|
| `ce2dac2` | Pipeline, schema, Worker API, first student app |
| `cd54da2` | `routes/review.ts`, content-pack validator and importer, `wrangler.jsonc` production environment |
| `ba0bc65` | `services/student-tools.ts`, migration 0009, dashboard, planner, bookmarks pages |
| `eba6918` | `ui.tsx`, `Layout.tsx`, `pages/Auth.tsx`, redesign of every student page |
| `d608ea5` | `services/official-info.ts`, `routes/public.ts`, migration 0010, info pages |
| `3cf7534` | `services/student-portal.ts`, migration 0011, report, reminders, reset pages |
| `da4a4bc`, `2a85c94` | `services/admin-console.ts`, `routes/console.ts`, migration 0012, `admin/Admin.tsx`, `review/Home.tsx` |
| `f105754` | `structure-checks.ts`, `searchSyllabus` in `learning.ts`, `pages/Search.tsx`, import guard and 2,000-character title limit in `imports.ts` |

---

## 11. Current project status

### A. Completed and verified locally

- Syllabus pipeline for 194 papers, with source-page traceability.
- Database schema, 12 migrations, integrity checks.
- Student app: sign-in-first flow, learning, practice, tests, results, progress, and the student tools in Section 6 marked "Yes" under Browser.
- Public exam-information pages.
- Admin console and reviewer area.
- Syllabus search and page-not-found screen.
- Structure checks in the pipeline and the import API.

### B. Implemented, awaiting browser verification

- Reset-password page.
- Recently viewed list.
- Admin and reviewer screens at phone width; reviewer "reject".

### C. Imported locally, unpublished and unreviewed

- 31 Physics lessons, 787 questions, 122 media files.
- Official exam information: 231 facts, 51 notices, 442 universities (public pages read these; they carry NTA source links).

### D. Awaiting explicit approval

- Production deployment of the Worker.
- Live migrations 0009–0012.
- Live import of the official information.
- Setting the production admin secret `ADMIN_API_TOKEN`.
- Any live import of syllabus corrections.
- Any live load of Physics packs 22–31.

### E. Awaiting business or product decisions

- Physics content approval: who reviews it, and when.
- Content writing for other subjects: whether to resume, the order, and reviewer allocation. Generation is paused by the owner.
- Email provider, for reset links and reminders.
- Subscription plans, prices and payment gateway.
- Permitted sources for previous-year papers.
- Sources for university courses, eligibility and cut-offs.
- The 38 open syllabus review items in 22 papers, and Lepcha.
- Custom domain.

### F. Not implemented

- Subscription and payment module.
- Admission, counselling, cut-off and university-course module.
- Previous-year papers module.
- Email delivery and email verification.
- Video library (postponed by the owner).
- Lessons and questions for any subject other than Physics.

### G. Blocked by external dependencies

- Kashmiri, Urdu and Lepcha syllabus text: need human readers of those scripts.
- Email features: need a provider account.
- Payments: need a gateway account.
- Previous-year papers and university data: need confirmed, permitted sources.

---

## 12. Production safety and deployment status

| Statement | Evidence checked tonight | Result |
|---|---|---|
| No production deployment happened | `https://cuet.ceo-3a7.workers.dev/` and `/api/health` both return "Hello World!" | Confirmed |
| No production migration was applied after 0008 | Live `d1_migrations` lists 0001–0008 only; four tables from 0009–0012 are absent | Confirmed |
| The production database was not modified tonight | Live has 21 lessons and 552 questions (local has 31 and 787); 4,733 syllabus rows and 196 versions, as after the afternoon migration | Confirmed for these tables. A full table-by-table comparison was not repeated tonight |
| Tonight's Physics import was local | Local 787 questions, live 552 | Confirmed |
| The corrections trial ran on a temporary copy | Local still has 92 machine-checked and 102 not-reviewed versions, 4,733 rows | Confirmed. The deletion of the copy is recorded in the session, not re-checked |
| Production actions remain gated | Approval variables and `predeploy-check.mjs` are in the repository | Confirmed in code |

The only live write today was the approved afternoon migration (0001–0008, data, and 281 files to R2).

---

## 13. Risks and technical observations

1. **Option B changes what "machine-checked" means.** Until now it meant "extracted by code and cross-checked". Under Option B it also covers "corrected with AI help from page images, then cross-checked". The text check proves wording, not hierarchy. A person should sample the Option B papers.
2. **Zero human approvals.** Every syllabus version, lesson and question is unapproved. Reviewer capacity is the real constraint on quality.
3. **Local and live have diverged:** four migrations, ten Physics packs and the official information. The live steps must run in order: migrations, deploy, then imports.
4. **Wrangler authorisation error (7403)** on a live read tonight. It must be resolved before any approved live step.
5. **Numbers that differ between reports** (official facts, 216 against 231, were reconciled tonight; see 3.3):
   - diagrams: 121 in packs, 122 media files;
   - cover-page titles: the PG audit counted 40 rows; the trial snapshot counted 54 papers across both exams (different scope and unit);
   - hidden papers corrected: the brief says 100; the trial report shows 99 replaced and 3 unchanged;
   - syllabus rows: 4,718 current plus 15 archived equals 4,733.
6. **Three updated lessons and questions are unidentified** (Section 8).
7. **Memory:** 5.9 GB limits running the local server, a test copy and a browser together.
8. **Security:** `/api/admin` relies on one shared token. Cloudflare Access in front of it is recommended before go-live.
9. **Reset links are manual** until an email provider is chosen.

---

## 14. Next working day's priorities

1. **Run Option B on the local database:** back up, import the 151 corrections, run the text and structure checks, mark only passing papers machine-checked, then produce a before-and-after report with the unresolved items listed separately. No live change.
2. **Identify the 3 updated lessons and 3 updated questions** from the backup comparison.
3. **Reconcile the numbers** in Section 13, item 5.
4. **Browser-check the remaining screens** in Section 11 B.
5. **Fix the Wrangler login** and repeat the live read-only checks.
6. **Prepare the go-live checklist** for approval: migrations 0009–0012, admin secret, deploy, official information import, smoke test.
7. **Decisions needed from the owner:** reviewers for Physics, email provider, and whether content writing resumes.
