# Plan milestone celebrations and context-aware sounds (20 Nov 2026)

Migration 0045 has been applied only to a throwaway copy of the local database (used for the browser checks). It is **not** applied to the main local database, preview or production.

## 1. Inspected
`pages/Progress.tsx`, `pages/Planner.tsx`, `pages/planner/*`, `services/study-plans.ts`, `student-tools.ts`, `sound.tsx`, `Layout.tsx`, `Sidebar.tsx`, `ui.tsx`, `Practice.tsx`, schema and migrations 0044. There was no achievement or milestone logic anywhere. Progress comes from `study_plan_items`, `topic_progress` and `practice_sessions`; the planner already ticks items from real activity. Sound was one global handler that played a "tap" for every click and a **hover tick** on every control.

## 2. Milestones: calculation and persistence
Nothing is hard-coded. `backend/src/services/milestones.ts` reads the student's own plan items (and, for one rule, `topic_progress`).

| Milestone | Exact rule | Message |
|---|---|---|
| Plan 25 / 50 / 75 / 100% | done ÷ scheduled activities reaches the share (deferred, unscheduled items are not counted) | the four messages you specified |
| Subject learning complete | a subject has at least 2 learn activities and all are done. "Foundation stage" wording only if the goal includes "Learn from the basics" | "You've completed the foundation stage for X..." / "...learning activities planned for X." |
| Subject halfway | subject has at least 4 topics and at least half are complete (a topic = its lesson and the practice that depends on it are both done) | "You've completed 5 out of 8 topics in X." |
| Mastery (only with evidence) | every topic of the subject complete, and at least 3 practised topics each with at least 5 answers and at least 80% correct in `topic_progress`, and none of them below 80% | "You've mastered the topics in your X plan..." |
| Week revision goal | at least 2 revision sessions in a plan week, all done | "Your revision goal for week N of your plan is complete." |

"Chapters": the plan's smallest unit is a syllabus topic, so the wording says topics, not chapters.

**Never claimed:** eligibility, qualification, admission, cut-offs or official results. A test checks every message for those words.

**Persistence** (`plan_milestones`, migration 0045, one new table): unique per student and key (`plan:{id}:pct:50`), so duplicates are impossible. Status PENDING, SHOWN, DISMISSED or SUPERSEDED, with reached, shown and dismissed times and the counts the wording was built from.
- Recorded when a task is ticked (and again whenever My Progress is opened).
- The pop-up appears on My Progress. The moment it is on screen the server marks it SHOWN, so a reload or the next visit never repeats it; Continue (or Escape) dismisses it.
- Several reached together: the most meaningful is queued (100% > mastery > 75% > 50% > subject done > 25% > revision week > subject half); the rest stay in the history as SUPERSEDED and never come back. A later new milestone appears normally.
- Routes: `GET /api/student/milestones`, `POST .../:id/shown`, `POST .../:id/dismiss` (owner only).

**Why a migration:** "shown once, across reloads and logins" needs server-side history; browser storage would repeat after a new login or device. It adds one table and touches nothing else.

## 3. Sounds
One manager, `frontend/src/sound.tsx`. Generated with Web Audio (no audio files added), sine/triangle only, quiet, one voice at a time (a new sound fades the previous one out; clicks within 45 ms are ignored).

| Sound | Plays for |
|---|---|
| nav | sidebar, tab bar and top navigation links |
| press | ordinary buttons and primary actions (`Button`, `ButtonLink`) |
| open / close | links that open a lesson, topic or calendar; expanding and collapsing a section (`summary`, `aria-expanded`); opening a planner task |
| add | adding a study activity (planner forms) |
| move | moving or rescheduling a task |
| complete | completing a task |
| success | saving a plan |
| generate | a plan being built (when the preview is ready) |
| achievement | a newly earned milestone, once |
| older cues kept | select, correct, incorrect, toggles, step, notification, progress (practice and support) |

Choosing is central: `soundForElement` decides from the element and the zone it is in, and a control can override it with `data-sound="..."` (or `none`). Components do not play sounds from hover or focus handlers.

**Hover: none.** The old hover and focus listeners and the "hover" sound are deleted. Nothing listens for pointer-over, focus, scroll, load or timers. The timed warning beep in Practice was also removed. The examination screen (`data-exam-screen`) is silent. Mute uses the existing toggle and the saved `prepora.ui-sounds` setting. If the browser has not allowed audio yet, the sound is skipped, never queued.

**One deliberate exception to "only after a click":** the achievement sound plays when the celebration appears. The student arrived there by clicking, and the sound is played once per milestone (the server marks it seen first). Saved/error messages marked for sound play only within 2.5 s of a click or key press.

## 4. Verification
- Backend: 13 new milestone tests (the rules, 25/50/75/100 one at a time, never twice, reload, simultaneous milestones, ticks, owner-only, no forbidden wording) pass. The rest of the suite passes when run without load; under load, 1-2 unrelated tests flake (billing timing, and the existing flashcard date test).
- Frontend 1,117 of 1,117, type checks and build pass; Prisma validate passes.
- Browser (46 checks desktop, plus phone), on real local data with a copy of the local database: 25%, 50%, 100% pop-ups with the right wording and counts; dismissed ones do not return after reload, revisit or new login; reload while open does not repeat; 50% to 100% jump gives one pop-up and keeps the lesser ones as history; page load, scrolling, hovering 47 elements and Tab focus created **zero** audio oscillators; sidebar and tab bar give the nav sound; each planner action gives its own sound; 12 instant clicks make one sound; keyboard Enter and Space work; mute holds across navigation and reload; the examination screen is silent. Phone: pop-up fits (390 px, no horizontal scroll), tab bar and taps work.

## 5. Limits
- Sounds were verified by recording what the sound manager plays and counting audio nodes, not by listening. Please listen once and tell me if any sound feels wrong; each is a few numbers in `CUES`.
- Revision and review activities leave no activity record, so those milestones depend on the student ticking them.
- Mastery uses topic-level results from `topic_progress`; it needs practice on at least 3 topics, so many plans will never show it.
- Another session redesigned `ActivePlan` and the weekly planner while this work was in progress; the checks were updated to that layout.
