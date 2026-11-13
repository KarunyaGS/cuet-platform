# Practice Centre: audit and required changes

**Date:** 13 November 2026
**Purpose:** the owner's brief asks for one Practice Centre with three parts (official previous-year paper links, our own practice questions, realistic mock tests) and for the changes to be documented before implementation. This is that document. Nothing here touches production.

## 1. What already exists (audited today)

| Area | Already built | Evidence |
|---|---|---|
| Question bank | 787 Physics (322) questions, every one linked to a syllabus topic, with an answer key and an explanation (132 to about 300 characters, average 304) | Local database |
| Difficulty levels | Easy, Medium, Hard on every question (Physics: 185 / 405 / 197) | Local database |
| Organisation by subject, unit and topic | Yes: questions link to syllabus rows; all 9 Physics units have 62 to 129 questions | Local database |
| Untimed practice | Topic practice with instant feedback; daily practice | `Topic.tsx`, `Dashboard.tsx` |
| Timed tests | Topic test (15 questions) and mock test (50 questions, 60 minutes, +5 / −1 from the stored exam rules) | `practice.ts` |
| Test screen | Timer, question palette, previous/next and arrow keys, mark for review, submit with a confirmation, auto-submit at zero, results with answers and explanations | `Practice.tsx`, `Results.tsx` |
| Answer saving | Every answer is saved to the server the moment it is chosen | `saveAnswer` |
| Server-side auto-submit | A test past its time is submitted by the server when next opened | `getSession` |
| Performance analysis | Score, per-question review, topic and subject accuracy, weak topics, weekly report | `Results.tsx`, `Progress.tsx`, `Report.tsx` |
| Licensed paper import | Paper packs with source, answer-key validation, licence gate, reviewer gate, staff publishing | `past-papers.ts`, built this morning |
| Reviewer and admin screens | Review of questions; admin list of previous-year papers and what blocks publishing | `review/`, `admin/PastPapers.tsx` |

## 2. Gaps found

| # | Gap | Why it matters |
|---|---|---|
| G1 | No Practice Centre page. Practice, mock tests and previous-year papers are reached from three different places | The brief asks for one integrated place |
| G2 | No registry of links to official NTA documents, and no "unavailable" state per year | Part 1 of the brief |
| G3 | "Mark for review" lives only in the browser tab. Reloading the page loses it | The brief asks to preserve mark for review |
| G4 | No "Clear response" button. Once an option is chosen, a student cannot go back to unanswered, which matters with negative marking | Realistic test experience |
| G5 | Our questions are not labelled "Practice questions" on the test screen, and nothing says "Official" for official material | Labelling rule in the brief |
| G6 | A mock test is 50 questions drawn at random from the subject. There is no fixed mock paper built to a blueprint, no syllabus-coverage or difficulty-balance guarantee, and no review step for a paper as a whole | Mock paper quality requirement |
| G7 | No question has been approved by a reviewer (0 of 787) | Requirement 7: academic review before publication |

## 3. Three points that need the owner's decision

### 3.1 Five options (A–E) against the CUET pattern

The brief asks for exactly five options and also for papers that "follow the applicable examination pattern". These conflict.

- All 787 existing questions have **four** options. The content validator written on 12 November enforces "CUET questions have exactly 4 options", and assertion-reason questions use NTA's four standard choices.
- The NTA facts stored on the platform say each paper has 50 objective multiple-choice questions; they do not state the option count. NTA's answer keys list one correct option id per question. To my knowledge CUET papers use four options; this should be confirmed against the Information Bulletin before a final decision.
- If five options are used: all 787 questions need a fifth option written and re-checked, and a mock paper would no longer look like the real exam.

**Recommendation:** keep four options, to match the real paper. The option count is now a single setting, so either choice can be applied. No new questions are written until this is decided.

### 3.2 Linking to NTA documents

The brief says to check NTA's linking conditions before publishing links. Read on 13 November 2026, the CUET site's policy says: "Prior permission is required before hyperlink are directed from any website/portal to this site", and that material may be reproduced "after taking proper permission from National Testing Agency (NTA)".

So, on NTA's own stated terms, a link needs permission too. The registry is therefore built with a gate: a link is published only after a member of staff records the basis for linking (for example the reference of NTA's reply). Until then students see a clear "not available" state. The platform's existing public exam-information pages already link to NTA notices and bulletins; that is the same question and is listed here so it is decided once.

### 3.3 What "available" means today

- **Question papers:** NTA does not publish CUET question papers openly; a candidate sees only their own paper after logging in. Every year's question papers therefore show as "not available".
- **Answer keys:** published openly. Two were opened and verified today (UG 2026 final key, PG 2025 final key). They are stored as drafts awaiting the linking decision.
- Nothing is downloaded, copied or re-uploaded. The registry stores an address and a description only.

## 4. Mock paper quality: what the analysis can and cannot use

| Input the brief asks for | Available? | Used how |
|---|---|---|
| Official syllabus and topics | Yes: 322 Physics has 9 units and 41 rows, machine-checked against the NTA PDF | Coverage: every unit is represented |
| Time and marking scheme | Yes: 50 questions, 60 minutes, +5 / −1, from the NTA bulletin | Applied exactly |
| Official answer keys | Yes, but they hold ids only | Confirms the question count per paper; nothing about topics |
| Previous-year question papers | **No** | Cannot be analysed |
| Year-wise topic distribution, frequently tested concepts | **No**: they can only come from the question papers | Not claimed. No trend is invented |

So a blueprint cannot honestly be "based on past trends". It is based on the syllabus: each unit gets questions in proportion to its share of the syllabus, with a fixed difficulty mix and a spread of question formats. This is stated on the paper. If licensed papers arrive later, the blueprint weights can be replaced by measured ones.

## 5. Required changes

### Database

| Change | Purpose |
|---|---|
| New table `official_paper_links` | One row per official document or per "not available" notice: exam, year, subject (or all subjects), session, kind (question paper or answer key), availability, address, title, date checked, linking basis, status |
| New column `practice_sessions.marked_json` | Keeps "mark for review" on the server |
| New tables `mock_papers`, `mock_paper_questions` | A fixed mock paper: its blueprint, its questions in order, its review state |
| New column `practice_sessions.source_json` | Records what an attempt was (a mock paper, a previous-year paper), so results can say so |

All additive. No existing table is rebuilt.

### Backend

| Change | Reuses |
|---|---|
| Official links: staff import with host check (NTA addresses only), publish gate (linking basis required), public list grouped by exam, year, subject, session | Admin token API, console permissions |
| Save and return marked questions; allow clearing an answer | `practice.ts` (clearing already works in the API; only the screen lacks it) |
| Mock papers: build from a blueprint out of **reviewer-approved** questions only, check coverage and balance, staff publish, student start | `createSession`, the reviewer decision flow, plan limits |
| One option-count setting used by the validators | `content.ts` validator |

No second practice engine, scoring routine or results API is added.

### Screens

| Change | Reuses |
|---|---|
| New Practice Centre page with three clearly labelled sections | Existing start actions and pages |
| Official papers list with "Official Previous-Year Paper" label, source, year, and unavailable states | `PastPapers.tsx` is extended, not duplicated |
| "Practice questions" label on our own questions; "Clear response" button; marks restored after reload | `Practice.tsx` |
| Mock papers list and start; admin screen to build, inspect and publish a mock paper | `admin/PastPapers.tsx` pattern |

### Not changed

Import, answer-key validation, licence gate and reviewer gate for licensed papers stay exactly as built. No safeguard is loosened.

## 6. Order of work

1. Test-screen gaps (G3, G4, G5) and verification of timer, navigation, autosave, submit, auto-submit and results.
2. Official links registry with its gates and unavailable states (G2).
3. Practice Centre page (G1).
4. Mock papers with blueprint, checks and review gate (G6).
5. New practice questions: **waits for the decision in 3.1.** Content writing for other subjects was on hold; the brief reopens it, and the scope (which subjects first) should be confirmed with that decision.

## 7. What will remain true after this work

- No mock paper can be published until a reviewer has approved its questions (G7). Today that number is zero, so the mechanism will be ready but the shelf will be empty.
- No official link is shown until the linking basis is recorded (3.2).
- No official question paper exists to link to (3.3).

## 8. What was implemented on 13 November 2026

| Step | Status | Where |
|---|---|---|
| 1. Test-screen gaps | Done. Marks for review are kept on the server and restored after a reload; "Clear response" added; every test shows "Practice questions" or "Official previous-year paper" beside its title | `Practice.tsx`, `practice.ts` |
| 2. Official links registry | Done. Addresses only, NTA sites only, linking basis required to publish, clear "not available" notices. Four verified rows are in `content/official-papers/links.json` (2 answer keys, 2 "not available" notices); they are not yet imported or published | `practice-centre.ts`, `npm run ingest -- official-links-import` |
| 3. Practice Centre page | Done: `/practice-centre`, with a "Practice" link in the top bar and the account menu | `PracticeCentre.tsx` |
| 4. Mock papers | Done: blueprint, readiness report, build from approved questions, reviewer approval, staff publishing, student start (timed or untimed) | `practice-centre.ts`, `admin/PracticeCentre.tsx` |
| 5. New practice questions | **Not started.** Waits for the decision on five options (section 3.1) |

Database: migration `0016_practice_centre.sql` (two new columns on practice sessions, three new tables). Additive only.

One defect was found and fixed while testing: a reviewer approving more than 100 items in one go received a server error, because the database accepts at most 100 values in one statement. Large selections are now decided in parts.

Checks: backend 85 of 85, integration trace 102 of 102, browser 30 of 30 (timer, navigation, mark for review after reload, saved answers after reload, clear response, submit with confirmation, auto-submit at zero, results, labels, phone width).

Analysis for the first subject: `docs/mock-paper-analysis-physics.md`.
