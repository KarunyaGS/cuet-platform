# Examination mode for mock tests

**Date:** 17 November 2026. Local development; not deployed.

Every mock test (a chapter's mock test, a subject mock, a full-length CUET mock) runs as an examination. Practice tests, Study Material and the Question Bank are unchanged and never go full screen.

## The student's path

1. **Instructions** (`/exam/start`): exam title, subject, duration, number of questions, maximum marks, the marking scheme, the six examination rules, the warning *"Important: Leaving the full-screen examination environment or switching tabs may result in immediate termination of your test."*, and the checkbox *"I have read and agree to the examination rules."* **Start Examination** stays disabled until the box is ticked. Nothing is created and full screen is not requested before that.
2. **Start**: the browser is asked for full screen (it only allows this from a click). If the browser refuses, the examination does not start. The attempt is then created and the student is taken to `/exam/<attempt>`.
3. **The examination screen** sits outside the normal layout: no Prepora header, no sidebar, no menus, no support widget, no bookmark or annotation tools. It has the question, the options, Previous and Next, Mark for review, Clear response, the question palette (answered, not answered, marked, answered and marked, not visited), the remaining time and Submit test.
4. **The end**: on Submit, when time runs out, or when the test is ended for a violation, full screen is left and the student returns to the normal Prepora screens, on the result page with a confirmation, the score, correct, wrong and unanswered counts and the answer review.

## What can and cannot be detected

A web page can see only these things, and only these are used:

| Event | Browser signal |
|---|---|
| Another tab or a minimised window | `visibilitychange` (page hidden) |
| The window losing focus | `blur` (checked again after a moment, so a click on the page itself is not counted) |
| Leaving full screen (including Esc) | `fullscreenchange` |

**Not detectable:** other applications placed over the browser, a second screen or device, a person or tool helping from outside, screenshots, or a student who blocks the page's events (for example with developer tools). This is a limit of every browser-based exam and the instructions screen says so. Integrity beyond this relies on the student's honesty and, for scoring, on the server.

## The policy (applied by the server)

- **First incident:** a prominent warning covers the test, with the type, the time and "warning 1 of 2". The student has 15 seconds to return to full screen (or press Continue if they never left it). The question and every answer stay exactly as they were.
- **Second incident, or not returning in time:** the test is ended. The student is told why on screen before anything else happens, the attempt is **scored from the answers already saved**, and the reason is recorded.
- Incidents reported within 4 seconds of one another are one incident (a tab switch also blurs the window).
- A page refresh is not a violation: the student sees "Examination in progress" and re-enters full screen, with the clock still running and all answers kept.
- The limits (2 incidents, 15 seconds) are in `EXAM_POLICY` in `backend/src/services/practice.ts` and are sent to the screen, so they are stated once.

## Data and integrity

- `practice_sessions` (the attempt) keeps the answers (`practice_answers`, saved on every change), the marks for review, the server clock (`started_at`, `duration_seconds`), the score and a new `end_reason`: `SUBMITTED`, `TIME_UP`, or `TERMINATED_<incident>`.
- `exam_violations` keeps every report: type, the browser's time, the server's time and what was done (`WARNED`, `TERMINATED`, `MERGED`).
- API: `GET /api/student/exam/preview` (the facts for the instructions), `POST /api/student/practice/:id/violations`, and the existing practice routes. Every route is scoped to the signed-in student: another student's attempt answers "not found".
- Scoring, the clock and the ending of an attempt are server-side. The server auto-submits an attempt whose time has passed the next time it is read, and accepts "time is up" from the screen only within 5 seconds of the real end. Submitting twice counts once.
- The browser's reports are trusted only as reports: a student who sends nothing is not penalised, and one who sends false reports can only end their own test.

## Tests

- Backend: `backend/test/exam.test.ts` (policy, merging, termination and scoring, time-up, ownership, practice excluded, chapter tests).
- Browser: a 51-check run against the real app and database (instructions, rule acceptance, full-screen entry, header and sidebar removal, tab switch, full-screen exit, warning and termination, refresh, answer autosave, submission without double counting, time expiry, return to the normal screens). Headless Chrome has no real full-screen window, so the run emulates the full-screen API with the same properties and events the browser fires; the page code is unchanged.
