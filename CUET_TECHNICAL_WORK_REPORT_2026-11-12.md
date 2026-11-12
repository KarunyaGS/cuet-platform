# CUET Platform: Technical Work Report, 12 November 2026

**Repository:** `KarunyaGS/cuet-platform`, branch `main`, 19 commits today (`49c41f3` → `2a85c94`), 1,343 tracked files
**Stack:** Cloudflare Workers (Hono), D1 (SQLite) through Prisma 7 and raw SQL, R2, React 19 + Vite 8 + Tailwind 4 + React Router 8
**Live state:** nothing deployed. The Worker `cuet` still serves "Hello World!". The live database `cuet-db` has migrations 0001–0008 only.

"Local" below means the developer machine (local Worker, local D1, local R2).

---

## 1. Timeline of commits

| Time | Commit | Work |
|---|---|---|
| 12:10 | `49c41f3` | Repository created |
| 14:14 | `ce2dac2` | Syllabus pipeline, D1 schema, Worker API and student app (99 files) |
| 15:09 | `cd54da2` | Syllabus reviewer, content-pack pipeline, production Worker configuration |
| 15:27 | `8dff13c` | Owner decision on unreviewed content; OCR re-extraction; integrity checks |
| 15:52 | `3f5c8b5` | All collected syllabus data stored in local D1; data report |
| 16:53 | `7dafc92` | Remote migration tooling, R2 upload with checksums, mid-day report |
| 16:56 | `311d435` | Physics content packs (31) and Chemistry diagrams |
| 17:38 | `ba0bc65` | Student tools (Batch 1) |
| 17:38 | `7adccd1` | Project completion audit |
| 17:38 | `d8aa959` | Official NTA information files |
| 18:24 | `b12e9c0` | Status report and integration audit |
| 18:24 | `eba6918` | Sign-in-first entry flow and UI/UX redesign |
| 18:36 | `d608ea5` | Public information pages (Batch P1) |
| 18:45 | `3cf7534` | Student portal (Batch P2) |
| 18:46 | `3057e9e` | Syllabus review and extraction results added to Git (986 files) |
| 18:53 | `d2c9f20` | CUET-PG syllabus structure audit |
| 20:17 | `b1bfd44` | Syllabus count fix |
| 20:30 | `da4a4bc` | Admin console and reviewer review: backend |
| 20:36 | `2a85c94` | Admin console and reviewer screens: frontend |

---

## 2. Work completed, by area

### 2.1 Syllabus ingestion pipeline (`content-ingestion/`)
- **Registry:** 194 official papers registered (37 CUET-UG, 157 CUET-PG), each with its NTA syllabus PDF.
- **Extraction:** text-layer extraction with OCR fallback (tesseract.js), structure detection (parts, sections, units, topics, subtopics, notes), tables and figures.
- **Verification:** an automated triple-source check marks rows `MACHINE_VERIFIED`. `VERIFIED` is reserved for a signed-in person and is enforced in code.
- **Corrections found and fixed:**
  - footer text captured as rows (extractor fixed);
  - a correction that damaged 801 rows was fully restored from the stored before-values, and matching was changed to tree path.
- **Page-image review:** every page of all 194 PDFs compared with the stored rows. Result: 149 corrected, 3 transcribed, 42 confirmed. The results are in `storage/local/syllabus-review/` (now in Git). They are **not imported**.

### 2.2 Database (`database/`)
- **Schema:** Prisma schema with 53 tables after today's work.
- **Migrations 0001–0008** (applied locally and on `cuet-db`): core exam, syllabus, content, question, review, account, practice and source-page tables, plus retrieval indexes.
- **Migrations added later today** (local only, each creates new tables and changes nothing existing):

| Migration | Tables |
|---|---|
| `0009_student_tools` | bookmarks, learning_activity, daily_goals, study_plan_items |
| `0010_official_info` | official_info_items, official_notices, participating_universities |
| `0011_student_portal` | student_preferences, password_reset_tokens, reminder_dismissals |
| `0012_review_assignments` | review_assignments |

- **Data in local D1:** 4,733 syllabus rows, 194 source PDFs, 1,107 page texts, 21 lessons, 1,206 content blocks, 87 media, 552 questions with keys and explanations.
- **Official data imported locally:** 231 official facts, 51 notices, 442 universities.

### 2.3 Cloudflare migration and infrastructure
- **`cuet-db`:** local data migrated in 5,000-row chunks, insert-only, with a delta check by primary key. Verified identical (17,798 rows at the time, 0 foreign-key violations).
- **NUL bytes:** three page texts contained NUL bytes that silently stopped the load. Fixed by encoding as `char(0)` and verified by hex comparison.
- **`cuet-storage` (R2):** 281 files uploaded and verified by download and SHA-256. The bucket is private.
- **Safety gates:** deploy, remote data and remote file scripts refuse to run without explicit approval variables.
- **Worker configuration:** production environment `cuet` bound to `cuet-db`, `cuet-storage` and the built app. A production dry-run build passes.

### 2.4 Backend API (`backend/`)
125 endpoints in 7 groups (plus health checks):

| Group | Purpose | Auth |
|---|---|---|
| `/api/auth` | register, login, logout, session, reset password | public / cookie |
| `/api/learn` | exams, subjects, outline, topics, lessons, media, revision notes | public |
| `/api/student` | practice, daily practice, progress, dashboard, goals, bookmarks, plan, profile, password, preferences, weekly report, reminders, recent | student session |
| `/api/public` | official exam information, universities | public |
| `/api/review` | syllabus review, reviewer dashboard, lesson and question review | session + reviewer role |
| `/api/console` | admin console | session + admin role |
| `/api/admin` | import and tooling API | shared admin token |

Key technical points:
- **Accounts:** PBKDF2 (100,000 rounds). The session cookie is HttpOnly and SameSite=Lax; only a SHA-256 hash of the token is stored.
- **Scoring:** deterministic, from stored answer keys, with CUET marking from the exam rules. No AI call at answer time.
- **Visibility rules:** one shared SQL rule decides what students see; anything a reviewer flags or rejects is hidden at once.
- **Audit:** every admin and reviewer write is recorded in `audit_logs` or `review_records` under the person's account.

### 2.5 Student application (`frontend/`)
- **Entry flow:** visitors see the welcome and sign-in page first. Every app page requires sign-in; deep links return to the requested page; expired sessions redirect to sign-in.
- **Learning:** subject lists, syllabus explorer, topic page, lesson page (KaTeX maths, diagrams, worked problems, table of contents), quick revision.
- **Practice and exams:** topic practice with instant feedback, topic and unit tests, daily practice, full mock with timer, CBT-style question palette, keyboard shortcuts and a submit check; results with marks breakdown.
- **Student tools:** Today page, bookmarks (topics, lessons, questions, revision notes), recently viewed, study planner, daily goals, profile, password change, exam and subject preferences, weekly report, reminders bell.
- **Account recovery:** one-time reset links (admin-issued; 1 hour; single use). Email delivery is not built.
- **Public pages:** `/cuet`, `/cuet/ug`, `/cuet/pg` with 11 pages per exam, each fact linked to its NTA source, with cycle year and last-checked date.
- **Design system:** colour tokens, IBM Plex Sans and Serif (with Devanagari), lucide icons, shared components, phone bottom tab bar, focus mode for tests. No sideways scrolling at 375 px on the screens checked.

### 2.6 Admin console and reviewer area (committed tonight)
- **Admin (`/admin`):** overview figures, student list and detail, suspend and restore, reset link, lesson and question management with edit and publishing workflow, content completion by subject, roles and reviewer assignments, activity log.
- **Reviewer (`/review`):** dashboard with assignments and own decisions, syllabus queue, lesson and question review with checklist, approve / request changes / reject, and history.
- **Status:** backend tested (3 tests). Frontend typechecks and builds, but **has not been opened in a browser yet**.

### 2.7 Content
- **Physics:** 31 validated packs in Git (787 questions, 121 diagrams). 21 packs (552 questions) are loaded in the database; 10 are not.
- **Validator:** near-duplicate detection (Jaccard ≥ 0.7), maths-aware option comparison, word counts that include maths.
- **Official NTA data:** 117 UG facts, 99 PG facts, 51 notices, 244 UG and 198 PG universities, all with source links.
- Content generation for other subjects is paused by the owner.

### 2.8 Audits and reports written
| File | Content |
|---|---|
| `docs/MID_DAY_PROGRESS_UPDATE_2026-11-12.md` | Mid-day progress |
| `CUET_PROJECT_COMPLETION_AUDIT.md` | Module completion audit |
| `CUET_CURRENT_STATUS_REPORT.md` | Status from code, both databases, R2, Worker and GitHub |
| `CUET_INTEGRATION_AUDIT.md` | 43 of 43 frontend calls matched; 53 of 53 end-to-end checks on a database copy |
| `CUET_PG_SYLLABUS_STRUCTURE_AUDIT.md` | Structure of all 157 PG papers and root causes |
| `CUET_PROJECT_COMPLETION_TRACKER.md` | Feature tracker and coverage tables |

### 2.9 Fixes from the audits
- Error messages added for three actions that failed silently.
- Results page loads bookmark state once instead of once per question.
- Subject list no longer counts "Note" lines as topics, counts sections, and shows flat syllabi as one list.

---

## 3. Verification

| Check | Result |
|---|---|
| Backend tests | 48 of 48 pass (8 files) |
| Content-tool tests | 21 of 21 pass (run earlier today) |
| Typecheck, backend and frontend | Clean |
| Frontend production build | Passes |
| End-to-end trace on a database copy (earlier today) | 53 of 53 |
| Browser click-through | Done for sign-in flow, redesign screens and public pages. **Not done** for the Phase 2 portal screens, the corrected subject page, and the admin and reviewer screens |
| Secret scan before each push | Clean |

---

## 4. Known open items

- **Not live:** the app is not deployed; migrations 0009–0012 and the official-data import are local only; the production admin secret is not set.
- **Syllabus:** page-image corrections are not imported. 17 visible PG papers store their syllabus inside the "Note" box. One correction (SCQP08) must be fixed first. Lepcha (LAQP21) is untranscribed.
- **Content:** only Physics has lessons and questions. No content has been approved by a person.
- **Blocked on decisions:** email service, subscriptions, previous-year paper sources, university course data, resuming content generation.
- **Machine limit:** the computer ran out of memory once this evening (5.9 GB total), which stopped the local servers.
