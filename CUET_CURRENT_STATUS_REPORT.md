# CUET Platform: Current Status Report

**Date:** 12 November 2026, evening (India time)
**Starting point:** GitHub `KarunyaGS/cuet-platform`, branch `main`, commit `d8aa959`
**Type:** Status audit only. No code, data, migrations or settings were changed while preparing it. The only new file is this report, and it is not committed.

## How this was checked

Every figure below comes from something read or run today, not from page or route names.

| What | How it was checked |
|---|---|
| GitHub | `git fetch`, `git status`, `git rev-list` against `origin/main` |
| Local database | Read-only queries: all 47 tables, row counts, migration list and content breakdown |
| Cloudflare D1 `cuet-db` | The same read-only queries against the remote database (`--remote --env production`) |
| Cloudflare R2 `cuet-storage` | The download-and-checksum check run earlier today (281 of 281 files). Not repeated now, to avoid 281 more downloads |
| Live Worker | Requests to `https://cuet.ceo-3a7.workers.dev/`, `/api/health` and `/api/learn/exams` |
| Worker secrets | `wrangler secret list --env production` (names only) |
| Code | Route lists, page list and searches for unbuilt features (password reset, email, subscriptions, universities, previous-year papers) |
| Tests | Backend 33 of 33 pass (4 files). Content tools 21 of 21 pass. Backend and frontend typechecks are clean |
| Today's student features | 8 automated tests, plus a click-through of every new screen on a throwaway copy of the local database earlier today |

"Works" below means it works on this computer (local server and local database). Nothing is live yet: the live Worker still serves "Hello World!".

---

## 1. Work completed

| Area | What is done (with evidence) |
|---|---|
| Public website | Home page, CUET-UG and CUET-PG subject lists, subject syllabus pages, topic pages and lesson pages. All open without signing in |
| CUET-UG | 37 papers registered, each with its official NTA syllabus PDF. 21 papers have a syllabus that students can see |
| CUET-PG | 157 papers registered, each with its official PDF. 71 papers have a syllabus that students can see |
| Syllabus explorer | Exam → subject → unit → topic → subtopic, with the official PDF page for each row. 4,733 syllabus rows are stored. 1,723 are machine-checked and shown; 3,010 are unchecked and hidden |
| Student accounts | Sign-up, sign-in and sign-out. Passwords are hashed (PBKDF2, 100,000 rounds); the session cookie is private (HttpOnly) and only a hash of the session token is stored |
| Student dashboard ("Today") | Daily goal meters, continue learning, unfinished tests, today's plan, weak topics, subject table and bookmark count |
| Learning centre | Lesson page with definitions, formulas (KaTeX), tables, diagrams, worked problems and exam tips. Content: Physics only, 21 lessons with 1,206 content blocks and 87 images and diagrams |
| Daily practice and unit tests | Daily practice: 10 questions, weak topics first, skipping questions answered correctly in the last 3 days. Unit tests: a timed test on one unit, from the subject page. Topic practice and timed topic tests also work |
| Bookmarks and revision | Bookmark topics, lessons and questions, with a Bookmarks page and filters. Quick revision page per topic with definitions, formulas, key points and exam tips |
| Study planner and daily goals | Week planner: add, tick, move to the next day and delete tasks, or use "Add to plan" from topics and lessons. Questions-per-day and lessons-per-day goals |
| Student profile and password change | Profile page: email, member since, tests taken, edit name, daily goals and password change. The current password must be correct, and other devices are signed out |
| Mock examinations and results | Full-paper mock with CUET timing and marking (+5/−1 UG, +4/−1 PG), answers hidden until submission, results page with answer review, and topic progress updated once per session |
| Progress | Totals, weak topics (under 60% after 3 or more attempts), all practised topics, recent sessions and, new today, a subject-wise table |
| Admin functionality | 38 admin API endpoints (paper registry, syllabus import, coverage, questions and lessons create/read/update/delete, content packs, review actions, roles). They work with an admin token. There are no admin screens |
| Reviewer workspace | Paper-wise review queue, and a workspace with the PDF page beside the extracted rows: edit, move, add, approve, reject, flag and sign off. 10 API endpoints, with sign-in and roles enforced |
| Database and APIs | Local: 47 tables, 9 migrations, 17,838 rows. 86 API endpoints: health 2, auth 4, learn 7, student 21, public 4, review 10, admin 38. All tests pass |
| Cloudflare D1 | `cuet-db` holds all migrated data (17,806 rows, 43 tables, migrations 0001–0008). Content and syllabus tables have identical counts to local |
| Cloudflare R2 | `cuet-storage` holds all 281 referenced files (194 syllabus PDFs and 87 images and diagrams), each checked by download and SHA-256 earlier today. The bucket is private |
| Cloudflare Worker | Worker `cuet` exists, and the production settings point it at `cuet-db` and `cuet-storage`. The application has **not** been deployed to it |
| GitHub repository | `main` at `d8aa959`, identical on GitHub and on this computer. 333 tracked files. No secrets, local databases or PDFs in Git |

---

## 2. Today's latest updates (commits `ba0bc65`, `7adccd1`, `d8aa959`)

| Item | Commit | Evidence | Status |
|---|---|---|---|
| Today page (dashboard) | `ba0bc65` | `pages/Dashboard.tsx`; `GET /api/student/dashboard`; test "tracks continue-learning, today's answers and subject progress"; screen checked | **Fully functional (local)** |
| Bookmarks | `ba0bc65` | `pages/Bookmarks.tsx`; bookmark buttons on topic, lesson, practice, results and revision pages; 4 endpoints; test; screen checked | **Fully functional (local).** A bookmarked question opens its topic, not the question itself |
| Study planner | `ba0bc65` | `pages/Planner.tsx`; 4 endpoints; owner-only checks tested | **Fully functional (local)** |
| Daily learning goals | `ba0bc65` | Goal meters on the Today page; editable on the profile; 2 endpoints; test | **Fully functional (local)** |
| Student profile and password change | `ba0bc65` | `pages/Profile.tsx`; 3 endpoints; tests cover a wrong current password, a short password, the same password, and signing out other sessions | **Fully functional (local).** "Forgot password" by email is **not** built |
| Daily practice | `ba0bc65` | `POST /api/student/practice/daily`; test checks that recently correct questions are skipped | **Fully functional, with one limit:** it uses the student's most recent subject. The API accepts a subject, but there is no subject chooser on screen |
| Quick revision | `ba0bc65` | `pages/Revise.tsx`; `GET /api/learn/topics/:id/revision`; test; screen showed 23 notes for a Physics topic | **Fully functional.** Content exists only where lessons exist (Physics) |
| Unit tests | `ba0bc65` | "Unit test" button on the subject page; a 15-question, 18-minute test was started and submitted in the screen check | **Fully functional (local)** |
| 8 automated tests | `ba0bc65` | `backend/test/student-tools.test.ts`, 8 tests; full suite 33 of 33 pass (run again now) | **Passing** |
| Completion audit report | `7adccd1` | `CUET_PROJECT_COMPLETION_AUDIT.md` | **Committed.** It was written before the student tools, so it still lists the dashboard, bookmarks, planner and profile as pending. This report supersedes it |
| Official CUET-UG information | `d8aa959` | `content/official-info/CUET_UG.json`: 13 sections, **117 facts (all with a source link)**, 27 notices, 8 known unknowns. `universities-CUET_UG.csv`: **244 universities** (49 Central, 41 State, 27 Deemed, 120 Private, 7 Other Government) | **Collected, files only.** Not in the database, no API, no pages |
| Official CUET-PG information | `d8aa959` | `CUET_PG.json`: 13 sections, **99 facts (all with a source link)**, 24 notices, 7 known unknowns. `universities-CUET_PG.csv`: **198 universities** | **Collected, files only.** Not in the database, no API, no pages |

**Important:** every new student tool except password change, revision notes and unit tests needs the 4 new tables from migration `0009`. Those tables exist **only in the local database**, so these features cannot work on the live site until `0009` is applied to `cuet-db`.

**Real use seen locally:** between 17:36 and 17:44 today, a student account used the local app (port 8787). It added bookmarks, "opened" records and practice sessions while this audit was running, so the local counts below are snapshots. None of these rows came from the automated tests or from this audit; the audit's own test flows ran on a throwaway copy.

---

## 3. Remaining work

### Public website
- **Exam information pages:** about, eligibility, pattern, how to apply, fees, dates, admit card, exam day, answer key, results and contact. The data is ready in files; the pages and a way to serve the data are not built.
- **Notices list** (27 UG and 24 PG notices collected): not built.
- **Participating universities page** (244 UG, 198 PG): not built.
- **Search across subjects and syllabus:** not built.
- **About and contact pages, and search-engine basics** (titles, sitemap): not built.

### Student portal
- **Forgot password / reset by email:** not built (needs an email service).
- **Email verification:** not built.
- **Subscriptions and payments:** not built (needs plans and a payment provider).
- **Daily practice subject chooser:** API ready, screen not built.
- **Opening a bookmarked question directly:** not built (opens the topic).
- **UI redesign:** set by the owner as the final priority.

### Learning content
- **Physics:** 10 validated lesson packs (235 questions, 35 diagrams) are in GitHub but **not loaded** into either database. One topic (single-slit diffraction) has no lesson yet.
- **All other UG subjects and all PG subjects:** no lessons or questions. Content generation is paused by the owner.
- **Mocks for other subjects:** the engine is ready; there are no questions for them.
- **Previous-year papers:** the database accepts them, and each must cite its source paper and question number. None are collected or loaded.
- **Human review:** **0** lessons, questions or syllabus versions have been approved by a person. Students currently see machine-checked and AI-assisted material without labels, by the owner's choice.
- **Video library:** postponed by the owner.

### Admin portal
- **Admin dashboard screen:** not built (the `/api/admin/overview` and coverage APIs exist).
- **Student management** (list, search, suspend, view progress): not built. Only "give a role to an email" exists.
- **Content management screens** for lessons, questions and media: not built (the full APIs exist).
- **Lesson and question review screens:** not built (the review API exists; only syllabus review has a screen).
- **Admin sign-in by user role:** admin APIs use one shared admin token, not a personal admin login.
- **Subscription management:** not built.

### Reviewer portal
- **Syllabus review:** built and working locally, but no reviewer account exists on the live database, and no person has recorded a decision yet.
- **Page-image review files for all 194 papers:** done, **not imported**. This would make the hidden 16 UG and 86 PG papers visible. **38 open items in 22 papers** need a decision first.
- **Review screens for lessons and questions:** not built.

### University and admission
- **University and course explorer:** not built. University lists exist as files only, with no states, courses or cut-offs.
- **Admission and counselling guidance:** not built. NTA does not run counselling; each university does.

### Backend and database
- **Migration `0009`** (bookmarks, learning_activity, daily_goals, study_plan_items): applied locally, **pending on `cuet-db`**.
- **Tables still needed:**
  - official information and notices;
  - universities and programmes;
  - password-reset tokens;
  - subscriptions.
- **Import of the page-image syllabus corrections and the 10 Physics packs:** commands ready, not run.

### Infrastructure
- **Live Worker:** still serves "Hello World!". The application is not deployed.
- **Production secret `ADMIN_API_TOKEN`:** not set (the secret list is empty).
- **Reviewer and admin accounts on the live database:** none.
- **Custom domain:** not decided.
- **Monitoring and alerts:** not set up.

---

## 4. Database status

| Check | Local (this computer) | Remote `cuet-db` |
|---|---|---|
| Tables | 47 | 43 |
| Migrations applied | 0001–0009 | 0001–0008 |
| Pending migrations | none | **`0009_student_tools.sql`** |
| Total rows (at the first read, about 17:40) | 17,838 | 17,806 |
| Exams / cycles / papers | 2 / 2 / 194 | 2 / 2 / 194 |
| Syllabus versions / rows | 196 / 4,733 | same |
| Source PDFs / page texts / page checks | 194 / 1,107 / 546 | same |
| Lessons / content blocks / media | 21 / 1,206 / 87 | same |
| Questions (with options, keys, explanations) | 552 | same |
| Review records / audit logs / import runs | 1,632 / 900 / 199 | same |
| Human approval decisions | **0** | **0** |
| Users (roles) | 4 (4 student, 1 reviewer) | 2 (2 student) |
| Practice sessions / answers / topic progress (at about 17:45) | 5 / 14 / 2 | 0 / 0 / 0 |
| bookmarks / learning_activity / daily_goals / study_plan_items (at about 17:45) | 4 / 4 / 0 / 0 | **tables do not exist** |

**Notes:**
- The 2 extra local accounts are test accounts that were deliberately left out of the migration.
- The practice data and bookmarks are from local use since the migration.
- The live database has no practice data because the live site has never run the application.

**The four new tables exist only locally:** `bookmarks`, `learning_activity`, `daily_goals` and `study_plan_items`.

**Features that need those tables:**

| Feature | Tables used |
|---|---|
| Today page | all four |
| Bookmarks | bookmarks |
| Study planner | study_plan_items |
| Daily goals | daily_goals |
| Continue learning | learning_activity |
| Daily practice | learning_activity, to find the student's last subject |
| Profile page | bookmarks, for the bookmark count |

On the live database today, these would fail with an error.

**Do not need them:** password change, quick revision, unit tests, mocks, results, progress and the syllabus explorer.

**Official UG/PG information:** stored **only in files** (`content/official-info/`). No code reads them, and there are no database tables for them.

---

## 5. GitHub status

| Check | Result |
|---|---|
| Latest commit | `d8aa959`, "Official CUET-UG and CUET-PG 2026 information from NTA sources" |
| GitHub vs this computer | Identical (0 ahead, 0 behind) |
| Uncommitted changes | None, apart from this new report file |
| Unpushed commits | 0 |
| Excluded from Git (by design) | `node_modules/`, `frontend/dist/` (build output), `backend/.wrangler/` (local database and file store), `backend/.dev.vars` (local secrets), `storage/` (downloaded PDFs, page images, the 194 review files, figures), `database/.local/`, `database/src/generated/` (generated code) |

---

## 6. Final report

### Table 1: Modules

| Module | Completed | Partially Completed | Pending | Status |
|---|---|---|---|---|
| Public website | Home, subject lists, syllabus, topic and lesson pages, all public | — | Exam information pages, notices, universities page, search, about and contact | PARTIALLY COMPLETED |
| CUET-UG | 37 papers and PDFs | 21 of 37 syllabi visible; Physics content only | 16 syllabi (corrections not imported); UG info pages | PARTIALLY COMPLETED |
| CUET-PG | 157 papers and PDFs | 71 of 157 syllabi visible | 86 syllabi (corrections not imported); PG info pages; any PG content | PARTIALLY COMPLETED |
| Syllabus explorer | Browsing with official page references | 92 of 194 papers visible | Import corrections, 38 open items, search | PARTIALLY COMPLETED |
| Student accounts | Sign-up, sign-in, sign-out, password change | — | Forgot password, email verification | PARTIALLY COMPLETED |
| Student dashboard (Today) | All parts working locally | Needs migration 0009 to go live | — | COMPLETED (local only) |
| Learning centre | Lesson page | Physics 21 of 32 topics in the database | 10 Physics packs to import; 1 Physics topic; all other subjects | PARTIALLY COMPLETED |
| Daily practice and unit tests | Both working | No subject chooser for daily practice | — | COMPLETED (local only) |
| Bookmarks and revision | Both working | Revision limited to topics with lessons | — | COMPLETED (local only) |
| Study planner and daily goals | Both working | — | — | COMPLETED (local only) |
| Student profile | Profile, name, goals, password change | — | Forgot password by email | COMPLETED (local only), reset pending |
| Mock examinations and results | Mock engine, results, review | Only Physics has questions | Mocks for other subjects; previous-year papers | PARTIALLY COMPLETED |
| Progress and performance | Totals, weak topics, topics, sessions, subjects | — | — | COMPLETED (local only) |
| Admin portal | 38 admin APIs (admin token) | — | All admin screens; student management; personal admin login | PARTIALLY COMPLETED (backend only) |
| Reviewer workspace | Syllabus queue and workspace | No reviewer on live; 0 decisions | Lesson and question review screens | PARTIALLY COMPLETED |
| University and admission | University lists collected (files) | — | Explorer, courses, counselling | PENDING |
| Subscriptions | — | — | Everything | PENDING (needs decisions) |
| Database and APIs | 47 tables, 86 endpoints, tests pass | — | Tables for info, universities, reset, subscriptions | PARTIALLY COMPLETED |
| Cloudflare D1 | Data migrated and checked | Migration 0009 not applied | — | PARTIALLY COMPLETED |
| Cloudflare R2 | 281 of 281 files verified, private | — | — | COMPLETED |
| Cloudflare Worker | Worker and production settings exist | — | Deploy app, set secret, accounts | PENDING (needs approval) |
| GitHub repository | In sync at `d8aa959` | — | — | COMPLETED |

### Table 2: Pending features

| Pending Feature | Existing Backend Support | Frontend Status | Database Dependency | Priority |
|---|---|---|---|---|
| Go live (deploy Worker and app) | Production settings, pre-deploy check | Built | Migration 0009 on `cuet-db`; secret `ADMIN_API_TOKEN` | High (needs approval) |
| Show all 194 syllabi | `review-import` command ready | Explorer ready | Existing tables | High |
| Load 10 remaining Physics packs | Content-pack import ready | Pages ready | Existing tables | High |
| Exam information pages (UG and PG) | None (data in JSON files) | Not built | New tables or static data files | High |
| Admin dashboard and content screens | 38 admin APIs | Not built | Existing tables | High |
| Student management | Only "give a role" | Not built | Existing user tables; needs list, search and suspend APIs | High |
| Personal admin login (role-based) | Role checks exist for reviewers | — | Existing roles tables | High |
| Lesson and question review screens | `POST /api/admin/review`, review history | Not built | Existing tables | Medium |
| Forgot password by email | None | Not built | New reset-token table; email service | Medium (needs decision) |
| Participating universities page | None | Not built | New table or static file (244 and 198 rows ready) | Medium |
| University and course explorer | None | Not built | New tables and a data source for courses | Medium (needs decision) |
| Previous-year papers | Database accepts them, with source citation | No page | Existing tables plus source PDFs | Medium (needs decision) |
| Content for other subjects | Pack pipeline ready | Pages ready | Existing tables | Owner decision (paused) |
| Daily practice subject chooser | API accepts a subject | Not built | None | Low |
| Search | None | Not built | Index | Low |
| Subscriptions and payments | None | Not built | New tables | Needs decision |
| Admission and counselling guidance | None | Not built | Content | Low |
| UI redesign | — | — | — | Final (owner) |
| Video library | — | — | — | Postponed (owner) |

### 1. Overall completion summary
- **Status of the 22 modules in Table 1:**
  - 2 completed: GitHub and R2;
  - 6 completed but local only, waiting for go-live: Today page, daily practice and unit tests, bookmarks and revision, planner and goals, profile, progress;
  - 11 partially completed;
  - 3 pending: university and admission, subscriptions, Worker deployment.
- **The core student journey works on this computer from sign-up to results.** That covers browsing the syllabus, reading lessons, practising, tests, mocks, results, progress and today's new tools. It is tested.
- **The biggest gaps are:**
  - nothing is live;
  - only Physics has learning content, and only 21 of its 32 topics are loaded;
  - 102 of 194 syllabi are hidden until corrections are imported;
  - there are no admin screens;
  - the public information pages and the university features are not built;
  - no person has approved any content yet.

### 2. What was completed today (latest commits)
- **Student tools:**
  - Today page;
  - bookmarks;
  - study planner;
  - daily goals;
  - profile with password change;
  - daily practice;
  - quick revision;
  - unit tests;
  - subject-wise progress.
- **8 new automated tests** (33 in total, all passing).
- **The completion audit report.**
- **Official NTA information:**
  - UG: 117 facts, 27 notices and 244 universities;
  - PG: 99 facts, 24 notices and 198 universities.
- **Everything is pushed to GitHub** (`d8aa959`).

### 3. What remains
See section 3. In short:
- go live;
- import the reviewed syllabus corrections and the 10 Physics packs;
- exam information pages;
- admin screens and student management;
- password reset by email;
- the university explorer;
- previous-year papers;
- content for other subjects;
- subscriptions;
- UI redesign.

### 4. Next 10 development priorities
1. **Import the page-image syllabus corrections** after deciding the 38 open items. This makes all 194 syllabi visible. The command is ready.
2. **Load the 10 remaining Physics packs** (235 questions, 35 diagrams) and write the missing single-slit diffraction lesson.
3. **Exam information pages for UG and PG** from the collected NTA facts, with source links, notices and the participating-universities lists.
4. **Admin dashboard and personal admin login by role,** replacing the shared admin token for screens.
5. **Student management:** list, search, view progress, suspend.
6. **Content management and lesson/question review screens,** so people can approve content (today 0 approvals).
7. **Go-live preparation:**
   - set `ADMIN_API_TOKEN`;
   - apply migration 0009 to `cuet-db`;
   - create a reviewer and admin account;
   - run the pre-deploy check;
   - deploy (with approval).
8. **Forgot password by email,** once an email service is chosen.
9. **Previous-year papers,** once the source and permission are decided.
10. **University and course explorer,** once the scope and data source are decided.

After these: content for other subjects (when resumed), subscriptions, search, and the UI redesign.

### 5. Decisions and approvals needed from you
1. **Go live:** approve deploying the Worker and app, applying migration `0009` to `cuet-db`, and setting the `ADMIN_API_TOKEN` secret.
2. **Syllabus corrections:** approve importing the 194 reviewed papers, and decide the 38 open items in 22 papers.
3. **Physics packs:** approve loading the 10 remaining packs.
4. **Human review:** who will approve syllabus and content? No reviewer account exists on the live database.
5. **Email service** for password reset and verification.
6. **Subscriptions:** plans, prices and payment provider.
7. **University explorer scope:** participating lists only, or courses and cut-offs too, and from which source.
8. **Previous-year papers:** which sources may be used.
9. **Content for other subjects:** when to resume, and which subjects first.
10. **NTA's conflicting statements** (for example, PG exam cities: 2 in the bulletin, 4 in a later notice): show both with dates, or only the latest?
11. **Custom domain** for the live site.

---

*This report is saved in the project root and is not committed. It changes nothing in the code, the databases or Cloudflare.*
