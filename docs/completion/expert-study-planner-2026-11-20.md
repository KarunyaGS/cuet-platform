# Expert-guided study planner (20 Nov 2026)

**Local only.** Migration 0044 is applied to the local database only. Nothing is committed, pushed or deployed. The study method behind the suggestions is a **draft awaiting academic review** (see section 4).

## 1. What was there (inspected first)

| Area | Finding |
|---|---|
| Planner screen | `frontend/src/pages/Planner.tsx`: a week grid of day columns. A task is added by hand or from an "Add to plan" button. |
| Table | `study_plan_items` (user, day, kind, ref_id, title, done). Kinds: TOPIC, LESSON, PRACTICE, MOCK, CUSTOM. |
| API | `GET/POST/PATCH/DELETE /api/student/plan` in `backend/src/services/student-tools.ts`. The dashboard's "today" list reads the same table. |
| Recommendations | None. Nothing suggested or scheduled anything. |
| Progress | `topic_progress`, `learning_activity`, `practice_sessions` and `practice_answers`; the Progress page and weak-topic rule (3 or more answers, under 60%) read them. |
| Syllabus | Units and topics per subject paper, in the official order (`curriculum_nodes`); lessons and questions attach to nodes. Some subjects (for example Chemistry) stop at units. |
| Labs | A list in the browser (`frontend/src/visual/labs.ts`), matched to a chapter by lesson-title prefix. No lab data on the server. |
| Mock tests | The full-length mock and chapter tests in the examination module. |

The new work **extends** the planner. It does not replace it: generated plans use the same items table, so the weekly grid, the dashboard and the new plan always agree.

## 2. What was built

| Part | Where |
|---|---|
| Migration (additive) | `database/migrations/0044_study_plans.sql`: 15 nullable or defaulted columns on `study_plan_items`; new tables `study_plans` (goal, **original suggestion**, evidence, status) and `study_plan_events` (created, adjusted, paused, regenerated...) |
| Method settings (one reviewable file) | `backend/src/services/plan-method.ts` |
| Plan builder (pure, deterministic) | `backend/src/services/plan-builder.ts` |
| Adjuster (missed, early, over time) | `backend/src/services/plan-adapt.ts` |
| Saving, reading, adjusting, pausing, regenerating, activity detection | `backend/src/services/study-plans.ts` |
| Routes | `backend/src/routes/student.ts`: `/api/student/planner/...` |
| Student screens | `frontend/src/pages/planner/` (`StudyGoals`, `ActivePlan`, `PlanSection`, `planUi`), `PracticeStart.tsx`, `planLinks.ts`; mounted at the top of the existing planner |

### How a plan is made
1. The student's objectives choose the topics: not yet opened (official syllabus order), already opened (for revision), weak (the Progress rule).
2. Time is shared between subjects, a little more for a subject where accuracy is lower.
3. Each day is filled in a fixed order: mock test, checkpoints, due follow-ups (practice after learning, spaced revision, review of mistakes), then the next learning, rotating by who is furthest behind.
4. A 7-day, 14-day and 30-day plan differ in revision spacing (1, 2 or 3 revisions), checkpoint days (7 / 7,14 / 7,14,21,28), mock-test days (6 / 10,13 / 16,23,29) and phases.
5. Every activity carries a reason and an evidence label: **From your results**, **Syllabus order**, **Study method**, or **Verified past-paper trend** (only with enough verified data; none exists yet).
6. No randomness, no outside service: the same inputs give the same plan (a fingerprint checks that what was previewed is what is saved).

### What the student can do
Choose goal, subjects, objectives (combinable), length and daily time; preview the plan by day; add it; tick, move (previous or next day, any date), reorder, change minutes, replace an activity with an alternative, remove and **restore**, add their own tasks and revision sessions; pause and resume (remaining days shift later); change the daily time; change the goal (regenerates only the days still to come); end the plan. Missed work is moved forward within each day's time, work done early frees its day, and what cannot fit is **kept in a "Not scheduled" list**, never deleted. Work the student moved or edited is never moved again. The original suggestion is stored and every item shows "Moved from", "Added by you" or "Done: found in your activity".

### Links to the platform
Learn → lesson or topic page. Revise → revision page. Practise → starts a practice set directly (`/practice/start`). Checkpoint and mock test → the examination instructions. Lab → the lab. Review mistakes → the latest result of that subject. Activities done on the platform (lesson opened, practice submitted, mock taken, lab finished) tick themselves off; the planner never writes to Progress.

## 3. Missing data (reported, not invented)

| Gap | What the plan does instead |
|---|---|
| No prerequisite or chapter-relationship data | Uses the official syllabus order only |
| No verified past-paper frequency yet (the mapping tables in progress hold none) | No trend shown; the screen says so. A trend appears only with 30 or more verified questions from 2 or more papers |
| No calibrated chapter difficulty | Study time is estimated from lesson length and question counts, labelled as an estimate |
| No expert-authored study method | A draft method written by the product team, marked "awaiting academic review" everywhere |
| CUET (PG) and CET not on the platform | Said plainly on the first step; not selectable |
| English and other CUET subjects not in the active catalogue | The subject list is whatever the catalogue offers (7 papers today) |
| Revision and review activities leave no activity record | They are ticked by hand |
| The student's exam date is stored but not used | Not used yet |

## 4. Decisions for you
1. **Academic review of the study method** (`plan-method.ts`: revision spacing, checkpoint and mock days, session lengths). After review, set `METHOD_REVIEW.status = 'APPROVED'` and the "under review" notes disappear.
2. Whether the planner should cap a plan at the student's stored exam date.
3. Migration 0044 for preview and production (production is still at migration 0008).

## 5. Tests
Backend: 24 plan-builder tests, 16 plan API and adjuster tests (the whole journey: options, preview, save, customise, adjust, pause, regenerate, activity detection, personalisation, replace). Full backend suite 458 of 459 (the one failure is the existing, unrelated flashcard date test). Frontend 1,108 of 1,108; type check, Prisma validate and build pass. Browser: 44 of 44 checks on the real local data (desktop journey and a phone).
