# Question formats and practice filters

Phase 2 of the question-bank work (18 Nov 2026). What each layer does for each question format, and how practice sets are filtered.

## Formats

| Format | Database | Backend | Student screen | Real content |
|---|---|---|---|---|
| Single answer (`MCQ_SINGLE`, assertion-reason, statements, match, figure) | yes | yes | yes | 3,000+ |
| Multi-select (`MCQ_MULTI`) | yes | scored as an exact set (`scoring.ts`) | checkboxes, "More than one answer" label, Check answer button | none yet |
| Numerical (`NUMERICAL`) | `answer_keys.numeric_answer`, `numeric_tolerance` | marked within the tolerance; blank is unattempted | answer box (`NumericAnswer` in `Practice.tsx`), parses `12`, `-3.5`, `2e-3`, `2,5`; refuses text; result and review show your answer and the correct one | none yet |
| Passage-based (`PASSAGE_BASED`) | `passages`, `questions.passage_id` | passage returned with every question of it | passage box above the stem, also in results | 12 questions on 3 passages (General Aptitude) |

Passages are stored once by their text: `POST /api/admin/passages` (admin token) returns the existing passage when the text is the same. Questions refer to it with `passageId`.

Content of this kind is imported with `backend/scripts/import-passage-sets.mts <file> [--dry-run]` from `content/special/passage-sets/`. It adds drafts only (UNVERIFIED, DRAFT), is repeatable, and never overwrites a question a reviewer has touched. The multi-select and numerical formats have no authored questions yet; they are tested with fixtures.

## Filters

`POST /api/student/practice` accepts, besides `mode`, `paperId` or `nodeId`, `count`:

- `nodeIds`: several chapters or topics of one subject (each includes everything under it). Chapters of two subjects are refused.
- `difficulty`: any of `EASY`, `MEDIUM`, `HARD`.
- `types`: any of the eight question types.

A full mock test is never filtered (the request is refused if it carries filters). When nothing matches, the API answers 404 `NO_QUESTIONS` with "No questions match these filters".

`GET /api/learn/question-counts?paperId=…|nodeIds=a,b&difficulty=…&types=…` returns `total`, `matching` (after the filters), `byDifficulty` and `byType`, so the screen can show how many questions match before a student starts.

Screens: the filter panel (`CustomPractice.tsx`) is on the subject page (chapters, difficulty, type, number of questions) and on the topic practice page (that topic fixed).

## Tests

`backend/test/question-formats.test.ts` (7 tests), `frontend/src/numeric.test.ts` (3 tests), and the browser run described in the Phase 2 report.
