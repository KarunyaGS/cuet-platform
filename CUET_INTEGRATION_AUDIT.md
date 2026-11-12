# CUET Platform: Frontend–Backend–Database Integration Audit

**Date:** 12 November 2026, evening (India time)
**Code audited:** GitHub `main` at `d8aa959`
**Type:** Integration audit only. No code, database records, migrations or deployment settings were changed. Every test flow ran on a **throwaway copy** of the local database, which was deleted afterwards. The real local database has no audit accounts and still has 0 human approvals.

## How integration was verified

The audit traced the actual data flow. A route, page or table existing was not enough.

| Check | What was done | Result |
|---|---|---|
| 1. Frontend → API mapping | Every `request(...)` call in `frontend/src/api.ts` and `frontend/src/review/api.ts`, plus every `/api/...` URL in screens, was matched against the backend route list | **43 of 43 match a real route**: 40 calls, 2 media URLs, 1 reviewer PDF URL. 0 missing |
| 2. End-to-end trace (API → database) | A script made the same API calls the screens make, on a copy of the local database (server on port 8791). After each step it read the database to confirm what was written or read | **53 of 53 checks passed** |
| 3. Browser pass | Signed in on the copy and opened 14 screens. Read each screen's network requests, answered a question, and checked signed-out behaviour | Every screen called the expected API and got 200 (401 or 403 where expected). No console errors |
| 4. Error, loading and empty states | Code check of every screen, plus signed-out and no-role checks in the browser | Present on all data screens. 3 actions have no error message (see issues) |
| 5. Local vs Cloudflare D1 | Read-only queries on both: tables, migrations, row counts and foreign-key check | Local 47 tables, 9 migrations. Remote 43 tables, 8 migrations. **0 foreign-key violations on both** |
| 6. R2 files | 6 random files downloaded from the live bucket `cuet-storage` and compared with the database checksums. Earlier today all 281 were checked the same way | **6 of 6 match** (sizes and SHA-256) |
| 7. Worker configuration | Read `wrangler.jsonc`, listed production secret names, ran a production **dry-run** build (nothing uploaded) | Bindings correct. **No production secrets set** |
| 8. Live Worker | Requested `/`, `/api/health` and `/api/learn/exams` on `cuet.ceo-3a7.workers.dev` | All return **"Hello World!"**. The CUET app is not deployed |
| 9. Automated tests | Backend suite and content-tool suite | 33 of 33 and 21 of 21 pass; both typechecks clean |

**Important:** everything marked FULLY INTEGRATED below is fully connected **on this computer** (local server, local D1, local R2). **On the live site nothing is connected yet**, because the Worker has not been deployed.

---

## 1. Frontend ↔ Backend

| Question | Finding |
|---|---|
| Does every implemented feature call the correct API? | **Yes.** All 43 API URLs used by the screens exist, with the correct method. The browser pass confirmed each screen's calls at runtime (table in section 3) |
| API URLs and environment variables | **Correct.** The frontend uses relative `/api/...` paths, so there are no hard-coded hosts and no frontend environment variables. In development, Vite forwards `/api` to `127.0.0.1:8787`. In production the same Worker serves the app files and the API from one address (`run_worker_first: ["/api/*"]`). The dry run confirmed 66 app files are bundled |
| Tokens and sessions | **Correct.** Sign-in sets cookie `cuet_session`: HttpOnly, SameSite=Lax, 7 days, and Secure outside development. The browser never sees the token. The database stores only its SHA-256 hash (verified). Sign-out revokes the session. A password change signs out other devices (verified) |
| Request and response mapping | **Correct.** Typed in `api.ts` (typecheck clean). The trace compared API values with database values: subject counts, syllabus rows, lesson blocks, revision notes, scores, progress and today counts all match exactly |
| Loading, error, empty states | **Present on every data screen.** Every screen that loads data shows Loading and an error box; lists show an empty message. Signed-out visitors are sent to sign-in (dashboard, planner, bookmarks, profile) or shown "Please sign in" (progress). A student opening the review area sees "Reviewer access needed" |
| Missing error messages | If the server call fails, nothing is shown for: "Practise 10 questions" on the lesson page, ticking a plan item on the Today page, and "Remove" on the Bookmarks page |
| UI-only screens or mock data | **None.** No mock, fake or placeholder data in the frontend or backend. Every number and list on screen comes from the database. The only fixed text is the home page introduction |
| Backend with no screen | All 38 **admin** APIs have no screen. The 4 **`/api/public/*`** APIs (question, lesson, topic content, evaluate) are not used by any screen |
| Efficiency | The Results page asks the bookmark API once per question: 15 requests for a 15-question test, 50 for a mock. The Today, Bookmarks, Planner and Profile pages each load their data twice on opening |
| Navigation | There is no "page not found" screen. `/admin` (or any unknown word) is treated as an exam name and shows "exam must be CUET_UG or CUET_PG" |

---

## 2. Backend ↔ Database

| Question | Finding |
|---|---|
| Correct database? | **Yes.** All APIs use the `DB` binding (local D1 in development, `cuet-db` in production) and the `MEDIA` binding for files (local R2 in development, `cuet-storage` in production). Some admin APIs use Prisma (D1 adapter) on the same binding. There is no other data source |
| Tables and relationships | Local: 47 tables, all migrations 0001–0009 applied, **0 foreign-key violations**. Remote: 43 tables (0009 missing), 0 violations |
| CRUD with real records (verified in the trace) | Create, read, update and delete, each confirmed in the database: accounts, sessions, goals (upsert), bookmarks, plan items, practice sessions and answers, scores, topic progress, display name, password hash, session revocation, reviewer role, reviewer approval and its review record, and admin lesson create/update/delete with audit log |
| Permissions and roles | **Enforced** (verified): no session → 401 on student APIs; student → **403** on reviewer APIs; reviewer gets `content:review`; another student's result → **404**; another student's plan item → 404; admin APIs: no token or wrong token → 401, and a student cookie → 401. Approval as VERIFIED is recorded against the person (`user:<id>`) |
| Mock data or incomplete database integration | No mock data. Not connected to the database: **official exam information and university lists** (JSON and CSV files only, no tables, no API) |
| Missing remotely | Tables `bookmarks`, `learning_activity`, `daily_goals` and `study_plan_items` (migration `0009_student_tools.sql`) |

---

## 3. End-to-end flows (frontend → API → database)

"Trace" = the API-and-database script on the copy. "Browser" = the network log of the real screen.

| Flow | Frontend page | API endpoints | Database tables | Evidence | Connected? |
|---|---|---|---|---|---|
| Student signup and login | `/signup`, `/signin` (Auth.tsx) | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | users, user_credentials, roles, user_roles, user_sessions | Trace: rows written, password hashed, session hash only. Browser: me 200, logout 200 | **Yes** |
| Student dashboard (Today) | `/dashboard` | `GET /api/student/dashboard` | learning_activity, practice_sessions, practice_answers, daily_goals, study_plan_items, topic_progress, bookmarks, curriculum_nodes, learning_resources, test_papers | Trace: today's answers 8 = DB 8; goal 25; continue-learning 2; bookmarks 2. Browser: 200 | **Yes** |
| Continue learning | Topic and lesson pages record; Today page shows | `POST /api/student/activity`, dashboard | learning_activity | Trace: 2 rows written and shown. Browser: activity POST 200 on topic and lesson pages | **Yes** |
| Daily learning goals | `/profile` (edit), `/dashboard` (meters) | `GET` and `PUT /api/student/goals` | daily_goals | Trace: upsert 25/2 stored; dashboard shows 25 | **Yes** |
| Bookmarks | Buttons on topic, lesson, practice, results and revision pages; `/bookmarks` | `GET /api/student/bookmarks`, `GET .../state`, `POST /api/student/bookmarks`, `POST .../remove` | bookmarks (+ curriculum_nodes, learning_resources, questions, test_papers for titles) | Trace: add 3 → 3 rows; remove → 2. Browser: state and list 200 | **Yes** |
| Study planner | `/planner`, "Add to plan", Today page | `GET`, `POST /api/student/plan`, `PATCH` and `DELETE /api/student/plan/:id` | study_plan_items | Trace: create → done → delete each seen in DB; another student → 404 | **Yes** |
| Daily practice | Today page button → `/practice/:id` | `POST /api/student/practice/daily`, `POST .../answers` | practice_sessions, practice_answers, questions, question_topics, answer_keys, topic_progress, learning_activity | Trace: untimed session of 10 for the last subject; answer marked CORRECT from answer_keys and stored | **Yes** (no subject chooser on screen) |
| Revision notes | `/revise/:nodeId` | `GET /api/learn/topics/:id/revision` | curriculum_nodes, learning_resources, content_blocks | Trace: 46 notes = 46 DB blocks for the unit. Browser: 200 | **Yes** |
| Unit tests | Subject page "Unit test" → `/practice/:id` → `/results/:id` | `POST /api/student/practice` (TOPIC_TEST), answers, submit | practice_sessions, practice_answers, answer_keys, topic_progress | Trace: 15 Q / 18 min; answers hidden; score stored on submit | **Yes** |
| Full mock examinations | Subject page "Mock test" | `POST /api/student/practice` (MOCK_TEST), answers, submit | + exam_cycles (rules), test_papers | Trace: 50 Q / 60 min / +5 −1 from rules; no key in running mock; score 12 = expected 12 | **Yes** (only Physics has questions) |
| Results and performance | `/results/:id`, `/progress` | `GET /api/student/practice/:id`, `GET /api/student/progress` | practice_sessions, practice_answers, answer_keys, explanations, topic_progress | Trace: every question has its review after submit; another student → 404; totals = DB | **Yes** |
| Subject-wise progress | `/progress`, `/dashboard` | `GET /api/student/progress` (subjects) | topic_progress, curriculum_nodes, syllabus_versions, test_papers | Trace: 7 attempted / 3 correct = sum of topic_progress | **Yes** |
| Profile and password change | `/profile` | `GET` and `PUT /api/student/profile`, `POST /api/student/password` | users, user_credentials, user_sessions, bookmarks, practice_sessions | Trace: name updated; wrong password 400; hash changed; other device signed out; new password works | **Yes** (forgot-password not built) |
| Syllabus explorer | `/`, `/CUET_UG`, `/CUET_PG`, subject and topic pages | `GET /api/learn/exams`, `.../subjects`, `/subjects/:id`, `/topics/:id` | exams, exam_cycles, test_papers, subjects, syllabus_versions, curriculum_nodes, source_documents | Trace: UG 37/21 and PG 157/71 = DB; Physics 41 rows = DB; PDF page from source_documents; unchecked syllabus hidden | **Yes** (92 of 194 papers visible by design) |
| Lessons and diagrams | `/learn/:id` | `GET /api/learn/resources/:id`, `GET /api/learn/media/:id` | learning_resources, content_blocks, media_assets + R2 | Trace: 59 blocks = DB; diagram bytes from R2 match the stored SHA-256 | **Yes** |
| Reviewer workspace | `/review`, `/review/paper/:id` | `/api/review/me`, `queue`, `papers/:id`, `sources/:id/file`, `decide`, `history`, `nodes/:id/edit`, `move`, `versions/:id/rows`, `sign-off` | curriculum_nodes, syllabus_versions, review_records, source_page_checks, source_documents + R2, users, roles | Trace: student 403; role grant stored; queue 37; rows 41 = DB; PDF from R2 matches SHA-256; approval → VERIFIED + review record by the person | **Yes** (syllabus only) |
| Admin functionality | **No screens** | 38 `/api/admin/*` endpoints (shared admin token) | All content tables, audit_logs, user_roles | Trace: 401 without token; overview reads DB; question total 552 = DB; lesson create/update/delete in DB | **API and DB only** |
| Lesson and question review | No screen | `POST /api/admin/review`, `GET /api/admin/review/history` | review_records, questions, learning_resources | API exists; no screen calls it | **API and DB only** |
| Public exam information | No screen | No API | **No tables**: data in `content/official-info/*.json` | Not connected | **No** |
| Participating universities | No screen | No API | **No tables**: data in `universities-*.csv` | Not connected | **No** |
| Public content API | No screen | 4 `/api/public/*` endpoints | questions, learning_resources, content_blocks | Not used by any screen | **API only** |
| Forgot password, email verification, subscriptions | Not built | Not built | Not built | — | **No** |

---

## 4. Environment and infrastructure

| Item | Local (this computer) | Cloudflare (production) | Issue |
|---|---|---|---|
| Database | Local D1: 47 tables, migrations 0001–0009, 0 FK violations | `cuet-db`: 43 tables, migrations 0001–0008, 0 FK violations. Content and syllabus tables have identical counts to local | **Migration 0009 not applied remotely** |
| Tables only local | `bookmarks`, `learning_activity`, `daily_goals`, `study_plan_items` | Missing | Breaks the Today page, bookmarks, planner, goals, continue learning, daily practice and the profile page once deployed, unless 0009 is applied first |
| Accounts | 4 users, 1 reviewer | 2 students, **no reviewer, no admin** | Reviewer workspace unusable live until an account is given the role |
| Worker settings | `cuet-platform-dev`, placeholder DB id, local bucket, `APP_ENV=development` | Worker `cuet`: `DB` → `cuet-db`, `MEDIA` → `cuet-storage`, `ASSETS` → app files, `APP_ENV=production`, `CONTENT_PREVIEW=true` (owner's choice), 7-day sessions. Dry-run build OK | — |
| Secrets | `ADMIN_API_TOKEN` in `backend/.dev.vars` (git-ignored) | **None set** (`wrangler secret list` is empty) | Admin APIs would answer "ADMIN_NOT_CONFIGURED" (503) on the live site |
| R2 files | Local bucket serves lesson diagrams and syllabus PDFs; trace confirmed bytes match the database | `cuet-storage`: all 281 referenced files verified earlier today; 6 of 6 re-checked now. Bucket private | — |
| Live Worker | — | `https://cuet.ceo-3a7.workers.dev/`, `/api/health` and `/api/learn/exams` all return **"Hello World!"** | **The CUET app is not deployed** |
| Frontend → API address | Vite forwards `/api` to port 8787; the Worker on 8787 also serves the built app | The same Worker will serve app and API from one address | No address or CORS problems expected |
| Code comment | `backend/src/types.ts` says `CONTENT_PREVIEW` is "true only in local development … clearly labelled" | Production uses "true" without labels (owner's decision) | Out-of-date comment; behaviour is correct |

---

## 5. Final integration report

### Table 1: Features

| Feature | Frontend | Backend API | Database | End-to-End Status |
|---|---|---|---|---|
| Student signup and login | Auth page | `/api/auth/*` (4) | users, credentials, roles, sessions | FULLY INTEGRATED (local); live: NOT CONNECTED |
| Student dashboard (Today) | Dashboard | `/api/student/dashboard` | 10 tables incl. the 4 new ones | FULLY INTEGRATED (local); live: NOT CONNECTED (needs 0009) |
| Continue learning | Topic, lesson, Today | `/api/student/activity`, dashboard | learning_activity | FULLY INTEGRATED (local); live: NOT CONNECTED (needs 0009) |
| Daily learning goals | Profile, Today | `/api/student/goals` | daily_goals | FULLY INTEGRATED (local); live: NOT CONNECTED (needs 0009) |
| Bookmarks | Buttons + Bookmarks page | `/api/student/bookmarks*` (4) | bookmarks | FULLY INTEGRATED (local); live: NOT CONNECTED (needs 0009) |
| Study planner | Planner, Add to plan, Today | `/api/student/plan*` (4) | study_plan_items | FULLY INTEGRATED (local); live: NOT CONNECTED (needs 0009) |
| Daily practice | Today → Practice | `/api/student/practice/daily` + answers | practice_*, answer_keys, learning_activity | FULLY INTEGRATED (local); live: NOT CONNECTED (needs 0009) |
| Revision notes | Revise | `/api/learn/topics/:id/revision` | curriculum_nodes, learning_resources, content_blocks | FULLY INTEGRATED (local) |
| Unit tests | Subject → Practice → Results | `/api/student/practice` (TOPIC_TEST) | practice_*, topic_progress | FULLY INTEGRATED (local) |
| Full mock examinations | Subject → Practice → Results | `/api/student/practice` (MOCK_TEST) | practice_*, exam_cycles, test_papers | FULLY INTEGRATED (local); content: Physics only |
| Results and performance | Results, Progress | `/api/student/practice/:id`, `/api/student/progress` | practice_*, answer_keys, explanations, topic_progress | FULLY INTEGRATED (local) |
| Subject-wise progress | Progress, Today | `/api/student/progress` | topic_progress + syllabus tables | FULLY INTEGRATED (local) |
| Student profile and password change | Profile | `/api/student/profile`, `/api/student/password` | users, credentials, sessions | FULLY INTEGRATED (local); profile page needs 0009 live |
| Forgot password (email) | — | — | — | NOT CONNECTED (not built) |
| Syllabus explorer | Home, Subjects, Subject, Topic | `/api/learn/*` | syllabus tables, source_documents | FULLY INTEGRATED (local); 102 of 194 papers hidden until corrections are imported |
| Lessons and diagrams | Lesson page | `/api/learn/resources/:id`, `/api/learn/media/:id` | learning_resources, content_blocks, media_assets, R2 | FULLY INTEGRATED (local) |
| Reviewer workspace (syllabus) | Review queue and workspace | `/api/review/*` (10) | curriculum_nodes, review_records, R2 PDFs | FULLY INTEGRATED (local); live: NOT CONNECTED (no reviewer account) |
| Lesson and question review | — | `/api/admin/review` | review_records | BACKEND ONLY |
| Admin functionality | — | `/api/admin/*` (38) | all content tables | BACKEND ONLY |
| Public content API | — | `/api/public/*` (4) | questions, lessons | BACKEND ONLY (purpose NEEDS CONFIRMATION) |
| Exam information pages | — | — | files only | NOT CONNECTED |
| Participating universities | — | — | files only | NOT CONNECTED |
| Subscriptions | — | — | — | NOT CONNECTED (not built) |
| Live site | — | — | — | NOT CONNECTED (Worker serves "Hello World!") |

### Table 2: Integration issues

| Integration Issue | Affected Feature | Root Cause | Required Action | Priority |
|---|---|---|---|---|
| Live Worker serves "Hello World!" | Everything, live | The app has never been deployed to Worker `cuet` | After the steps below, run `npm run deploy:production` (pre-deploy check, then deploy), **with your approval** | High |
| 4 tables missing on `cuet-db` | Today page, bookmarks, planner, goals, continue learning, daily practice, profile page | Migration `0009_student_tools.sql` applied locally only | Apply 0009 to `cuet-db` **before** deploying, **with your approval** | High (blocks go-live) |
| No production secret `ADMIN_API_TOKEN` | All admin APIs, and granting the reviewer role, live | The secret was never set | Owner sets it: `npx wrangler secret put ADMIN_API_TOKEN --env production` (long random value, kept in a password manager) | High |
| No reviewer or admin account live | Reviewer workspace, live | No account has a role on `cuet-db` | After deploy: register, then grant REVIEWER (and later admin) through the admin API | High |
| No admin screens | Admin, student management, content management, lesson/question review | Not built (Batch 2) | Build admin screens on the existing 38 APIs | High |
| Admin uses one shared token, not a personal login | Admin | Designed for local tools | Add role-based admin sign-in (reuse the reviewer session and role checks) before admin screens go live | High |
| Official information and universities not connected | Public exam-information pages, universities page | Data exists only as JSON/CSV files | Add tables or serve the files through an API, then build the pages | High |
| 102 of 194 syllabi hidden | Syllabus explorer, UG and PG subject lists | Page-image corrections not imported; 38 open items | Decide the 38 items, then import (`review-import`), **with your approval** | High |
| 10 Physics packs not in the database | Lessons, practice, mocks (Physics) | Packs in Git but not imported (235 questions, 35 diagrams) | Import the packs, **with your approval** | Medium |
| No error shown on 3 actions | Lesson "Practise 10 questions", Today plan tick, Bookmarks "Remove" | These handlers have no `catch` | Show an error message when the call fails | Low |
| One bookmark request per question on Results | Results page (50 requests on a mock) | Each bookmark button loads its own state | Load bookmark state once for all questions | Medium (request count and cost on Workers) |
| Data loaded twice on 4 pages | Today, Bookmarks, Planner, Profile | Loading restarts when the signed-in user arrives | Wait for sign-in status before loading | Low |
| No "page not found" screen | Any unknown address, e.g. `/admin` | A catch-all route treats the word as an exam name | Add a not-found page | Low |
| Daily practice cannot choose a subject | Daily practice | The screen does not pass a subject (the API supports it) | Add a subject chooser | Low |
| `/api/public/*` APIs unused | — | Left from an earlier design | Decide: keep for later or remove | Low (NEEDS CONFIRMATION) |
| Out-of-date code comment on `CONTENT_PREVIEW` | — | The comment predates the owner's no-label decision | Update the comment | Low |
| Forgot password not built | Student accounts | Needs an email service | Choose an email service, then build | Medium (needs decision) |

### Overall FE–BE–DB integration status

- **On this computer: the student and reviewer parts are fully integrated.** Every screen calls a real API, every API reads and writes the real database and file store, and no mock data exists. 53 of 53 end-to-end checks and 43 of 43 URL matches pass, permissions are enforced, and there are 0 foreign-key violations.
- **Admin is backend-only:** the APIs work, but there are no screens.
- **The official exam information and university lists are not connected:** they exist as files only.
- **On the live site, nothing is connected yet.** The Worker serves "Hello World!", migration 0009 is missing on `cuet-db`, no admin secret is set, and no reviewer account exists.

**Fully connected (local):**
- signup and login;
- Today page;
- continue learning;
- daily goals;
- bookmarks;
- study planner;
- daily practice;
- revision notes;
- unit tests;
- full mocks;
- results;
- progress and subject-wise progress;
- profile and password change;
- syllabus explorer;
- lessons and diagrams;
- reviewer syllabus workspace.

**Partially connected:**
- **Syllabus explorer:** 92 of 194 papers visible until corrections are imported.
- **Mocks and practice:** Physics only.
- **Reviewer:** syllabus only; no lesson or question review screen.
- **Profile:** password change only; no forgot-password.

**Missing connections:**
1. Live Worker ↔ app (not deployed).
2. `cuet-db` ↔ the 4 new tables (migration 0009).
3. Production ↔ admin secret.
4. Live reviewer and admin accounts.
5. Admin screens ↔ 38 admin APIs.
6. Lesson/question review screen ↔ review API.
7. Official exam information and universities ↔ database, API and pages.
8. Hidden syllabi ↔ reviewed corrections (not imported).
9. 10 Physics packs ↔ database.
10. Forgot password, email verification and subscriptions (not built).

### Exact steps to reach complete integration

**Go live with what is already built (needs your approval at each step):**
1. Set the production secret: `npx wrangler secret put ADMIN_API_TOKEN --env production`.
2. Apply migration 0009 to `cuet-db`: `npx wrangler d1 migrations apply DB --env production --remote`. Check that the 4 tables then exist and the foreign-key check is still 0.
3. Build the frontend (`npm run build -w frontend`) and run `npm run deploy:production -w @cuet/api`. The pre-deploy check runs first.
4. Smoke-test the live address: `/api/health`, subject lists, a topic, a lesson diagram (R2), sign-up and sign-in, the Today page, a bookmark, a plan item, daily practice, a unit test, a mock, results, progress and password change.
5. Register the reviewer's account on the live site and grant REVIEWER through the admin API.

**Connect what is not yet connected:**

6. **Syllabus:** decide the 38 open items, then import the reviewed corrections (local first, then `cuet-db` with approval), so all 194 syllabi show.
7. **Physics:** import the 10 remaining packs (local, then `cuet-db` with approval).
8. **Exam information and universities:** add database tables (or a read-only file API) for the official information and university lists, then build the pages.
9. **Admin (Batch 2):**
   - role-based admin sign-in;
   - admin dashboard;
   - student management;
   - lesson and question management;
   - review screens.
10. **Small fixes:**
    - error messages on the 3 actions;
    - one bookmark-state request per page;
    - no double loading;
    - a not-found page;
    - a daily-practice subject chooser;
    - update the `CONTENT_PREVIEW` comment.
11. **After your decisions:**
    - forgot password and email verification (email service);
    - subscriptions (plans and payment provider);
    - previous-year papers and the university explorer (sources).

---

*Audit only. Both report files are in the project root and are not committed. Nothing in the code, the databases, the migrations or Cloudflare was changed.*
