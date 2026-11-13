# Highlights and annotations

Students can mark learning content: highlight text, draw with a pen, place rectangles, circles, arrows and lines, and add notes. Marks are personal, saved to the database, and come back in the same place.

Status: built and tested **locally**. Migration `0024_annotations.sql` has been applied to the local database only.

## Where it works today

| Place | Surface | Blocks |
|---|---|---|
| Lesson page (`/learn/:id`) | `LESSON` + lesson id | every content block, keyed by its own content |
| Practice question (`/practice/:session`) | `QUESTION` + question id | `stem`, `opt-<n>`, `explanation` |
| Results review (`/results/:session`) | `QUESTION` + question id | the same keys, so marks made while practising show here |

Not yet: the topic page, the quick-revision page, previous-year papers (those open on other websites) and flashcard review.

## How it is built

- **One layer, no wrappers.** `frontend/src/annotate.tsx` wraps content in `<Annotatable kind id>`. Marks are drawn on one transparent SVG layer over the content. Nothing is inserted into the text. The layer takes pointer input only while a drawing tool is in use, so selection, scrolling and quiz buttons work as before.
- **Blocks.** Any element with `data-annot-block="<key>"` is a block. A lesson block's key is a hash of its type and body (`blockKey`), because lesson blocks are deleted and re-inserted on every import and have no lasting id.
- **Text highlights** store the exact words, their character range in the block, and a little text before and after. On return: the same range if the words are still there; else the same words elsewhere in the block; else the same words anywhere in the content if they appear exactly once; else the highlight is kept and flagged `orphaned`. It is never attached to other text.
- **Drawings** store points as fractions of their block's box, so they follow the block when the page is narrower or wider.
- **Saving.** Changes are sent as one batched `PUT` about 0.7 s after the last change, and again when the page is left. The browser makes each id, so a repeated save cannot duplicate. The page shows "Saving…", "Saved" or "Not saved. Try again".
- **Undo and redo** are per page visit, up to 50 steps.

## Data

Table `annotations`: `user_id`, `surface_kind`, `surface_id`, `kind` (HIGHLIGHT, PEN, RECT, ELLIPSE, ARROW, LINE, NOTE), `block_key`, `data_json`, `quote`, `note`, `color`, `opacity`, `stroke_width`, `z`, `orphaned`, `origin_path`, and the context the server fills in: `exam_code`, `test_paper_id`, `unit_node_id`, `chapter_node_id`, `curriculum_node_id`, `resource_id`, `question_id`, plus timestamps.

## API (signed-in students only)

| Call | What it does |
|---|---|
| `GET /api/student/annotations?surface=LESSON&id=…` | marks on one lesson or question |
| `GET /api/student/annotations?surface=QUESTION&ids=a,b,c` | marks on several questions at once |
| `GET /api/student/annotations` | everything, with subject, unit, chapter, topic and lesson, for My bookmarks |
| `PUT /api/student/annotations` | batched save: `upserts` and `deletes` for one surface |
| `PATCH /api/student/annotations/:id` | change a note or a colour |
| `DELETE /api/student/annotations/:id` | remove one |

Every query is scoped to the signed-in student. Another student sending the same id changes nothing. The service never reads or writes questions, answer keys or scores.

## My bookmarks

The "Highlights and notes" tab (`frontend/src/pages/BookmarkNotes.tsx`) lists them by subject, chapter, topic and lesson or question, with search, subject and chapter filters, "Open at its place", note editing and delete. Revision cards stay a separate tab; removing one kind never removes the other.

## Known limits

- A drawing on a worked example is measured against the whole example. Opening or closing its solution changes the example's height, so the drawing moves with it. Highlights are not affected.
- A highlight inside a closed worked solution is not shown until the solution is opened.
- A lesson block that is edited gets a new key. Highlights are re-found by their words; drawings on that block are flagged, not moved.
- "Open at its place" for a question returns to the practice or results page it was made on, which shows that question only if it is the one on screen (practice) or in the list (results).
- The highlighter tool needs a browser with `caretPositionFromPoint` or `caretRangeFromPoint` (current Chrome, Edge, Firefox, Safari). Checked here in Chrome only.
- No pressure sensitivity for stylus; a stylus draws like a finger.

## Tests

- `backend/test/annotations.test.ts`: saving and reading, idempotent re-sends, context from the server, questions and answers untouched, isolation between students, My bookmarks listing, independence from cards and page bookmarks.
- Browser check (scratch script, 50 checks): the 12 acceptance tests on a Physics lesson and a practice question, at desktop, tablet and phone sizes, including a touch stroke.
