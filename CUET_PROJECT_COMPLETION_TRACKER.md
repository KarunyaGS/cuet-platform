# CUET Platform: Project Completion Tracker

**Last updated:** 12 November 2026, after Batch P2 (student portal)
**Repository:** `KarunyaGS/cuet-platform`, branch `main`
**Live site:** not deployed. The Worker `cuet` still serves "Hello World!". Going live needs the owner's approval.

**Status words:**
- COMPLETED: works end to end on the local server, with tests.
- PARTIALLY COMPLETED: works, but part of it is missing.
- PENDING: not started.
- BLOCKED: cannot continue without something outside the code.
- NEEDS APPROVAL: built, but the next step needs the owner's go-ahead.

"Local" means the developer machine (local Worker, local D1 and local R2). Nothing below is live yet.

---

## Batches

| Batch | What | Commit | Date |
|---|---|---|---|
| 1 | Student tools: Today page, bookmarks, planner, goals, profile, password change, daily practice, revision, unit tests | `ba0bc65` | 12 Nov 2026 |
| Audit | Status report and integration audit | `b12e9c0` | 12 Nov 2026 |
| UX | Sign-in-first entry flow and full UI/UX redesign | `eba6918` | 12 Nov 2026 |
| P1 | Public website: official CUET-UG and CUET-PG information pages, notices, FAQs, participating universities | `d608ea5` | 12 Nov 2026 |
| P2 | Student portal: preferences, account recovery, weekly report, reminders, recently viewed, saved revision notes | this batch | 12 Nov 2026 |

---

## Feature tracker

| Module | Feature | Frontend | Backend | Database | Content | Status |
|---|---|---|---|---|---|---|
| Public website | About CUET hub (`/cuet`) | Done | `GET /api/public/info/:exam` | `official_info_items`, `official_notices` | NTA sources, 2026 cycle | COMPLETED (local) |
| Public website | CUET-UG information (`/cuet/ug`) | Done | Same | Same | 117 facts, 27 notices | COMPLETED (local) |
| Public website | CUET-PG information (`/cuet/pg`) | Done | Same | Same | 99 facts, 24 notices | COMPLETED (local) |
| Public website | Eligibility | Done | Same | Same | UG 11, PG 6 facts | COMPLETED (local) |
| Public website | Exam pattern and subjects | Done | Same | Same | UG 20, PG 16 facts | COMPLETED (local) |
| Public website | Important dates and notifications | Done | Same | Same | Dates, notices, "not yet published" list | COMPLETED (local); no 2027 dates exist yet |
| Public website | Application, registration and fees | Done | Same | Same | UG 23, PG 20 facts | COMPLETED (local) |
| Public website | Admit card | Done | Same | Same | UG 8, PG 6 facts | COMPLETED (local) |
| Public website | Answer keys and results | Done | Same | Same | UG 15, PG 16 facts | COMPLETED (local) |
| Public website | Exam-day guidelines | Done | Same | Same | UG 11, PG 12 facts | COMPLETED (local) |
| Public website | FAQs | Done (12 questions per exam) | Same | Same | Answers are NTA statements with sources; questions are headings only | COMPLETED (local) |
| Public website | Contact and student help | Done | Same | Same | UG 6, PG 5 facts | COMPLETED (local) |
| Public website | Participating universities list | Done (search, type filter) | `GET /api/public/universities` | `participating_universities` | 244 UG, 198 PG; NTA gives no state | COMPLETED (local) |
| Public website | Official data import | Admin API only | `PUT /api/admin/official-info/:exam`, `scripts/import-official-info.mjs` | Migration `0010` | — | NEEDS APPROVAL for live |
| Authentication | Sign-in-first entry, sign up, sign in, sign out, expired sessions | Done | `/api/auth/*` | users, credentials, sessions | — | COMPLETED (local) |
| Authentication | Forgot password / account recovery | `/forgot-password`, `/reset-password` | Admin `POST /api/admin/users/reset-link`, `POST /api/auth/reset-password` | `password_reset_tokens` (hash only, 1 hour, single use) | — | PARTIALLY COMPLETED: one-time links work (admin gives the link); sending them by email is BLOCKED until an email service is chosen |
| Authentication | Email verification | — | — | — | — | BLOCKED: needs an email service |
| Student portal | Today page (dashboard) | Done | `/api/student/dashboard` | Migration 0009 tables | — | COMPLETED (local); live needs 0009 |
| Student portal | Continue learning, recently opened | Done (Today and home) | `/api/student/activity` | `learning_activity` | — | COMPLETED (local) |
| Student portal | Daily goals | Done | `/api/student/goals` | `daily_goals` | — | COMPLETED (local) |
| Student portal | Bookmarks (topics, lessons, questions) | Done | `/api/student/bookmarks*` | `bookmarks` | — | COMPLETED (local) |
| Student portal | Study planner | Done | `/api/student/plan*` | `study_plan_items` | — | COMPLETED (local) |
| Student portal | Profile and password change | Done | `/api/student/profile`, `/password` | users, credentials | — | COMPLETED (local) |
| Student portal | Academic preferences (exam, year, up to 10 subjects) | Profile, home "My subjects", Today subject chooser | `/api/student/preferences` | `student_preferences` | — | COMPLETED (local) |
| Student portal | Weekly performance report | `/report` (day chart, vs last week, subjects, weak topics, plan) | `/api/student/report/weekly` | Existing activity tables | — | COMPLETED (local) |
| Student portal | Notifications and reminders | Header bell with dismiss | `/api/student/reminders`, `/reminders/dismiss` | `reminder_dismissals` | Unfinished tests, plan, goal, weak topic, new NTA notices, setup | COMPLETED (local, in-app); email or SMS reminders BLOCKED (needs a provider) |
| Student portal | Saved revision materials | Save button on revision pages; "Revision notes" tab | Bookmark kind `REVISION` | `bookmarks` | — | COMPLETED (local) |
| Student portal | Recently viewed lessons and topics | "Recently viewed" tab on Saved and recent | `/api/student/recent` | `learning_activity` | — | COMPLETED (local) |
| Learning | Syllabus explorer | Done | `/api/learn/*` | Syllabus tables | 92 of 194 papers visible. PG structure audit (12 Nov): counts on the subject list are wrong for all PG papers (Note lines counted as topics, sections not counted); 17 visible PG papers store their syllabus inside the Note box; see `CUET_PG_SYLLABUS_STRUCTURE_AUDIT.md` | PARTIALLY COMPLETED; fixes need approval |
| Learning | Lessons and diagrams | Done | `/api/learn/resources`, `/media` | Lessons, blocks, R2 | Physics 21 lessons in the database | PARTIALLY COMPLETED |
| Learning | Quick revision | Done | `/api/learn/topics/:id/revision` | Existing | Where lessons exist | COMPLETED (local) |
| Exams | Practice, topic tests, unit tests, daily practice | Done | `/api/student/practice*` | Practice tables | Physics only (552 questions) | COMPLETED (local), content-limited |
| Exams | Full mock tests with CUET marking | Done (focus mode, CBT palette) | Same | Same | Physics only | COMPLETED (local), content-limited |
| Exams | Results and analysis | Done (marks breakdown, filters) | `/api/student/practice/:id` | Same | — | COMPLETED (local) |
| Exams | Previous-year papers | — | Database accepts them (must cite source) | Existing | None collected | BLOCKED: needs a source and permission decision |
| Progress | Topic, subject and session progress | Done | `/api/student/progress` | `topic_progress` | — | COMPLETED (local) |
| Reviewer | Syllabus review queue and workspace | Done | `/api/review/*` (10) | Review tables, R2 PDFs | 0 human decisions so far | COMPLETED (local); no live reviewer account |
| Reviewer | Lesson and question review screens | — | `POST /api/admin/review` exists | Existing | — | PENDING |
| Reviewer | Reviewer dashboard and assignments | — | — | Assignments table needed | — | PENDING |
| Admin | Admin dashboard, content, question, lesson and syllabus management | — | 38 admin APIs (shared token) | Existing | — | PENDING (backend ready) |
| Admin | Student management | — | Only "grant role" | Existing user tables | — | PENDING |
| Admin | Role and permission management | — | Grant role only | roles, permissions | — | PENDING |
| Admin | Personal admin sign-in by role | — | Reviewer role checks exist | Existing | — | PENDING |
| Admin | Subscription management | — | — | — | — | BLOCKED: needs plans and a payment provider |
| Admin | Reports and activity overview | — | `audit_logs`, overview API | Existing | — | PENDING |
| University | University explorer | List only (NTA participating list) | Public list API | `participating_universities` | Names and types | PARTIALLY COMPLETED |
| University | Courses, eligibility, CUET subject requirements | — | — | New tables needed | Needs verified university sources | PENDING |
| University | Admission, counselling, merit lists, cut-offs, application links | — | — | — | Needs verified university sources | PENDING |
| UI/UX | Design system, app shell, all student, reviewer and public screens | Done | — | — | — | COMPLETED |
| Infrastructure | Deploy Worker and app | Build ready (dry run OK) | — | — | — | NEEDS APPROVAL |
| Infrastructure | Apply migrations 0009, 0010 and 0011 to `cuet-db` | — | — | Prepared (new tables only) | — | NEEDS APPROVAL |
| Infrastructure | Import official information to `cuet-db` | — | Script ready | — | — | NEEDS APPROVAL |
| Infrastructure | Production secret `ADMIN_API_TOKEN` | — | — | — | — | NEEDS APPROVAL (owner sets it) |

---

## Area summaries

| Area | Status | Notes |
|---|---|---|
| Public website | COMPLETED (local) | All 12 requested pages, for UG and PG separately, with sources, cycle and last-checked date. Live after approval |
| Student portal | COMPLETED (local), except email delivery | All requested features work locally; reset links and reminders by email wait for an email service |
| Learning content | PARTIALLY COMPLETED | Physics only: 21 of 32 topics in the database, 31 packs in Git |
| Question bank | PARTIALLY COMPLETED | Physics 552 in the database (787 in packs); other subjects 0 |
| Admin portal | PENDING | 38 backend APIs exist; no screens |
| Reviewer portal | PARTIALLY COMPLETED | Syllabus review done; lesson and question review pending |
| University and admission | PARTIALLY COMPLETED | NTA participating lists only (244 UG, 198 PG) |
| Infrastructure | NEEDS APPROVAL | Nothing live |

---

## Syllabus coverage: CUET-UG 2026 (37 papers)

The syllabus is "Visible" when it is machine-checked and shown to students, and "Hidden" when it is unchecked. Page-image corrections for the hidden papers are ready but not imported (needs approval, plus 38 open items).

| Code | Subject | Syllabus | Units | Rows | Lessons | Questions |
|---|---|---|---|---|---|---|
| 101 | English | Visible | 3 | 10 | 0 | 0 |
| 102 | Hindi | Visible | 3 | 10 | 0 | 0 |
| 103 | Assamese | Visible | 3 | 10 | 0 | 0 |
| 104 | Bengali | Visible | 3 | 10 | 0 | 0 |
| 105 | Gujarati | Visible | 3 | 10 | 0 | 0 |
| 106 | Kannada | Hidden | 1 | 7 | 0 | 0 |
| 107 | Malayalam | Hidden | 1 | 7 | 0 | 0 |
| 108 | Marathi | Visible | 3 | 10 | 0 | 0 |
| 109 | Odia | Visible | 3 | 10 | 0 | 0 |
| 110 | Punjabi | Hidden | 1 | 9 | 0 | 0 |
| 111 | Tamil | Visible | 3 | 10 | 0 | 0 |
| 112 | Telugu | Visible | 3 | 10 | 0 | 0 |
| 113 | Urdu | Visible | 3 | 10 | 0 | 0 |
| 301 | Accountancy / Book-Keeping | Hidden | 7 | 33 | 0 | 0 |
| 302 | Agriculture | Visible | 4 | 59 | 0 | 0 |
| 303 | Anthropology | Visible | 5 | 30 | 0 | 0 |
| 304 | Biology / Biotechnology / Biochemistry | Visible | 6 | 19 | 0 | 0 |
| 305 | Business Studies | Visible | 13 | 66 | 0 | 0 |
| 306 | Chemistry | Visible | 10 | 10 | 0 | 0 |
| 307 | Environmental Science | Hidden | 15 | 32 | 0 | 0 |
| 308 | Computer Science / Informatics Practices | Visible | 4 | 106 | 0 | 0 |
| 309 | Economics / Business Economics | Visible | 4 | 62 | 0 | 0 |
| 312 | Fine Arts / Visual Arts / Commercial Arts | Hidden | 9 | 40 | 0 | 0 |
| 313 | Geography / Geology | Hidden | 3 | 37 | 0 | 0 |
| 314 | History | Hidden | 1 | 25 | 0 | 0 |
| 315 | Home Science | Visible | 7 | 25 | 0 | 0 |
| 316 | Knowledge Tradition and Practices of India | Hidden | 7 | 9 | 0 | 0 |
| 318 | Mass Media / Mass Communication | Hidden | 6 | 58 | 0 | 0 |
| 319 | Mathematics / Applied Mathematics | Hidden | 51 | 216 | 0 | 0 |
| 320 | Performing Arts | Hidden | 2 | 82 | 0 | 0 |
| 321 | Physical Education | Hidden | 8 | 33 | 0 | 0 |
| 322 | Physics | Visible | 9 | 41 | 21 | 552 |
| 323 | Political Science | Hidden | 18 | 18 | 0 | 0 |
| 324 | Psychology | Visible | 7 | 89 | 0 | 0 |
| 325 | Sanskrit | Hidden | 10 | 31 | 0 | 0 |
| 326 | Sociology | Visible | 10 | 40 | 0 | 0 |
| 501 | General Aptitude Test | Hidden | 1 | 6 | 0 | 0 |

## Syllabus coverage: CUET-PG 2026 (157 papers)

| Measure | Count |
|---|---|
| Papers registered, each with its official PDF | 157 |
| Syllabus visible (machine-checked) | 71 |
| Syllabus hidden (unchecked; corrections ready) | 86 |
| Syllabus rows | 3,428 |
| Lessons | 0 |
| Questions | 0 |

## Content progress

| Measure | CUET-UG | CUET-PG |
|---|---|---|
| Subjects with any lessons | 1 of 37 (Physics) | 0 of 157 |
| Lessons in the database | 21 | 0 |
| Lessons ready in Git, not imported | 10 (Physics) | 0 |
| Questions in the database | 552 | 0 |
| Questions ready in Git, not imported | 235 (Physics) | 0 |
| Lessons or questions approved by a person | 0 | 0 |

---

## Decisions and approvals needed

1. **Go live:**
   - apply migrations `0009`, `0010` and `0011` to `cuet-db`;
   - import the official information;
   - set `ADMIN_API_TOKEN`;
   - deploy the Worker.
2. **Syllabus:**
   - Fix the subject-list counts (code only).
   - Correct the SCQP08 review file.
   - Import the page-image corrections.
   - Decide the open items.
   - Decide on the Lepcha transcription.
   
   Details are in `CUET_PG_SYLLABUS_STRUCTURE_AUDIT.md`.
3. **Content:** resume content generation (owner had paused it), and in which subject order. Who reviews it?
4. **Email service** for password reset, verification and reminders.
5. **Subscriptions:** plans, prices and payment provider.
6. **Previous-year papers:** which sources may be used.
7. **University explorer:** which university sources to use for courses, eligibility and cut-offs.
