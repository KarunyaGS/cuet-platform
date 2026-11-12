# Syllabus review procedure (scraping completion)

Goal: the official NTA syllabus of a paper stored **exactly** as printed, correctly structured, every row citing
its PDF page. This is checking and correcting extraction. It is **not** writing content: never add, explain,
summarise, translate or "improve" syllabus text.

Per paper the folder `storage/local/syllabus-review/<EXAM>/<code>/` holds:

| File | What |
|---|---|
| `pages/p<n>.png` | image of each PDF page (open it with the Read tool) |
| `input.json` | per page: `pdfjsText`, `popplerText` (two independent text extractions), `ocrText` (OCR, if the page was OCR'd), `visualCheck` (independent OCR word check, `missingSample` = words OCR saw that the stored rows lack); `stored.nodes` = rows currently in D1; `reasons` = why the paper failed automatic verification |
| `start.json` | the stored rows already in review format — copy it to `reviewed.json` and correct it |

## Steps

1. Read `input.json` `reasons` and look at **every page image**.
2. Classify every page in `pages`: `cover` (title only), `instructions` (exam pattern, notes about the paper),
   `syllabus`, `blank`, `other`. Instructions text that the PDF prints (e.g. "The Question Paper will have 75
   questions") stays as NOTE rows, as stored.
3. Compare the rows with the images, top to bottom, page by page, and correct:
   - **wording**: exactly as printed — same language and script, same spelling (even if the PDF has a typo),
     punctuation kept; fix only extraction errors (OCR misreads, broken letter order, words split or glued,
     page headers/footers captured into rows);
   - **structure**: Unit/Chapter/Part → Topic → Subtopic → Item exactly as the PDF nests them; headings the
     extractor guessed must match what the page shows; a heading wrongly absorbed into text becomes its own row;
     text wrongly made a heading becomes body text of the row it belongs to;
   - **labels**: `label` holds the printed number/letter (`1`, `I`, `(a)`, `Unit 3` → `3`), `title` the heading
     text, `body` the text under it that is not a heading of its own;
   - **missing text**: add rows for anything printed that is missing; **wrong rows** (not on the page): remove;
   - **sourcePage**: the page the row starts on.
4. Keep `ref` of existing rows when you keep the row (they are database ids); give new rows refs like `new1`.
   `parentRef` must point to an earlier row in the list. Remove the helper field `_flags`.
5. `decision`: `CONFIRMED_AS_STORED` only if every stored row is already exactly right (then `nodes` may be
   omitted); otherwise `CORRECTED` with the **full** corrected tree; `TRANSCRIBED` for papers with no stored rows.
6. `changes`: one short line per kind of correction. `unresolved`: anything you cannot read with certainty or a
   person must decide — **never guess**; leave uncertain text out of rows and describe it here (page, position).
7. Validate: `cd D:/cuet-platform && TEMP=D:/tmp npm run ingest -- review-validate --paper <code>` — must print OK.
   Warnings "under 90% of their words in the page's text sources" are expected only where you corrected OCR or
   letter-order errors (check those rows twice against the image); "rows hold only X% of the page's words" means
   text may be missing — look again.
