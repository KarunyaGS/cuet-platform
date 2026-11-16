# Revision cards from attempted practice questions

A student can save a practice question for revision after answering it and seeing the result. The card joins the same revision system as saved lesson concepts: same table, same SM-2 schedule, same review history, same My bookmarks page.

## What is stored

A row in `flashcards` (migration 0027 adds `question_id`). It holds the student, the question reference, the schedule and the grouping (subject, chapter, topic). The front and back text columns are empty. Nothing about the question is copied, so there are no independent or conflicting copies: the question, its options, the correct answer and the explanation are read from the question tables each time, and a corrected question is corrected on every card.

One card per student per question: a unique index on `(user_id, question_id)`, and the existing unique `(user_id, concept_key)` also guards it (the key is `question.` plus a hash of the question id). Saving again returns the same card.

## When a card can be made

Only when the student has an answer on that question whose result has already been shown to them:

- a plain practice answer (the key and explanation come back immediately), or
- any answer in a session that has been submitted.

An answer saved in a timed test that is still running does not count (the key has not been shown), and a cleared answer is not an attempt. Without such an attempt `POST /api/student/flashcards/questions` answers 409 `NOT_ATTEMPTED` and gives nothing away. The question must also be visible to students.

## What the card shows

Front: the question and its four options, nothing else. Back: the correct answer, the explanation, the student's own last answer (read from their answer records), and the options marked. Know and Need revision are the existing ratings and schedule.

## Where it appears

- Practice screen: "Save for revision" under the result of an answered question (plain practice).
- Results screen: "Save for revision" on each answered question after submitting.
- My bookmarks, Revision cards: grouped by subject, chapter and topic in a "Practice questions" group; "Show answer" in place; filters, search, due and need-revision counts work as for lesson cards.
- Revision sitting (`/bookmarks/review`): flips like any card.
- The existing "saved question" bookmark (a shortcut under Saved pages) is unchanged.

## If the question is withdrawn

A card is hidden everywhere (list, queue, counts, dashboard) while its question is flagged, rejected or archived, and returns when the question is available again. The schedule is kept.

## API

| Route | Purpose |
| --- | --- |
| `POST /api/student/flashcards/questions` `{ questionId, day }` | Make the card (201), or return the existing one (200). 409 `NOT_ATTEMPTED`, 404 `QUESTION_NOT_FOUND` |
| `POST /api/student/flashcards/questions/state` `{ ids }` | Which of these questions the student has saved |
| `GET /api/student/flashcards`, `/queue`, `/summary` | Now include question cards (`kind: "QUESTION"`, `questionId`, `question`) |
| `POST /api/student/flashcards/:id/review`, `DELETE /api/student/flashcards/:id` | Unchanged; removing a revised card still needs `?confirm=1` |

## Known limits

- Saving is offered only after a plain practice answer or in results. A multi-answer question in plain practice is offered after "Check answer".
- A card shows the student's latest revealed attempt, not the history of attempts.
- Question cards are not counted in a topic page's "concepts saved" figure (that stays about lesson concepts).
- Highlights and notes are not available inside a card.
