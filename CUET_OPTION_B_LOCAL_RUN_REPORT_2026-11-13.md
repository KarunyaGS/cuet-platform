# Option B: Local Run Report

**Date:** 13 November 2026, 09:31–09:36 IST
**Where:** the local database only. Nothing was deployed, and the live database, Worker and bucket were not touched.
**Backup taken first:** `D:\cuet-backups\pre-option-b-20261113-093125` (SQL export, raw database and file copy, table counts).

## What was done

1. All 194 page-image reviews were validated again (193 valid; Lepcha fails because it has no rows).
2. The 151 corrected syllabi were imported. Each old version was archived, not deleted.
3. A new step, `npm run ingest -- review-machine-check`, marked a corrected paper machine-checked only when all of these held:
   - the review result is "corrected", not "transcribed";
   - every row has its text confirmed on its own PDF page (no unconfirmed rows);
   - the structure checks report no errors;
   - the stored version is exactly the reviewed tree and no person has worked on it.
4. The server takes the row decision from the check stored with each row at import, not from what the tool claims.

No record was marked approved (`VERIFIED`). Approved versions: 0.

## Before and after (local)

| Measure | Before | After |
|---|---|---|
| Papers students can see | 92 of 194 | 153 of 194 |
| CUET-UG visible | 21 of 37 | 33 of 37 |
| CUET-PG visible | 71 of 157 | 120 of 157 |
| The 17 PG subjects with a broken syllabus | 17 broken | 0 broken, all 17 visible with topics |
| Current syllabus rows | 4,718 | 5,390 |
| Machine-checked current versions | 92 | 153 (40 unchanged + 113 corrected) |
| Not-reviewed current versions | 102 | 41 |
| Approved by a person | 0 | 0 |
| Lessons / questions / media files | 31 / 787 / 122 | 31 / 787 / 122 |
| Foreign-key violations | 0 | 0 |

Checks after the run: every machine-checked version has an evidence record; no machine-checked version holds an unchecked row; no lesson points at an archived version; Physics (322) still shows 9 units and 787 questions.

## Three papers that were visible and are now hidden

ACQP15, ACQP19 and ACQP26 were visible in their old form. Their corrected versions contain rows whose text the automatic check could not confirm, so they stay hidden until a person reviews them.

## Papers still hidden (41)

39 were held back by the marking step:

| Paper | Subject | Reason |
|---|---|---|
| 312 | Fine Arts/Visual Arts/Commercial Arts | 12 row(s) not confirmed on their PDF page |
| 316 | Knowledge Tradition-Practices in India | 2 row(s) not confirmed on their PDF page |
| 321 | Physical Education (Yoga, Sports) | 1 row(s) not confirmed on their PDF page |
| 325 | Sanskrit | 1 row(s) not confirmed on their PDF page |
| SCQP09 | Computer Science and Information Technology | 1 row(s) not confirmed on their PDF page |
| LAQP03 | Sanskrit | 4 row(s) not confirmed on their PDF page |
| LAQP07 | Bengali | 4 row(s) not confirmed on their PDF page |
| LAQP08 | Bhutia | 1 row(s) not confirmed on their PDF page |
| LAQP17 | Kashmiri | transcribed from the page image: needs a person |
| LAQP21 | Lepcha | review validation failed |
| LAQP23 | Malayalam | 1 row(s) not confirmed on their PDF page |
| LAQP24 | Manipuri | 6 row(s) not confirmed on their PDF page |
| LAQP28 | Pali | 1 row(s) not confirmed on their PDF page |
| LAQP31 | Prakrit | 1 row(s) not confirmed on their PDF page |
| LAQP33 | Punjabi | 1 row(s) not confirmed on their PDF page |
| LAQP37 | Urdu | transcribed from the page image: needs a person |
| LAQP39 | Indo-Tibetan | 2 row(s) not confirmed on their PDF page |
| COQP11 | General Paper | 4 row(s) not confirmed on their PDF page |
| COQP12 | General Paper (MBA etc.) | 7 row(s) not confirmed on their PDF page |
| ACQP01 | Shiksha Shastri (B.Ed.) | 2 row(s) not confirmed on their PDF page |
| ACQP02 | Shiksha Acharya (M.Ed.) | 2 row(s) not confirmed on their PDF page |
| ACQP03 | Agama | 12 row(s) not confirmed on their PDF page |
| ACQP05 | Dharmashastra, Vastu & Paurohitya | 2 row(s) not confirmed on their PDF page |
| ACQP06 | Dharm Vijnan | 1 row(s) not confirmed on their PDF page |
| ACQP09 | Indian Knowledge System (Trilingual) | 7 row(s) not confirmed on their PDF page |
| ACQP11 | Jyotish – Falit | 5 row(s) not confirmed on their PDF page |
| ACQP12 | Jyotish – Ganit | 2 row(s) not confirmed on their PDF page |
| ACQP13 | Krishna Yajurveda | 13 row(s) not confirmed on their PDF page |
| ACQP15 | Phalit Jyotish and Siddhant Jyotish | 2 row(s) not confirmed on their PDF page |
| ACQP16 | Puranetihasa | 4 row(s) not confirmed on their PDF page |
| ACQP17 | Rigveda | 8 row(s) not confirmed on their PDF page |
| ACQP19 | Sahitya (Alankara and Kavya Varga) | 2 row(s) not confirmed on their PDF page |
| ACQP20 | Samveda | 3 row(s) not confirmed on their PDF page |
| ACQP21 | Shukla Yajurveda | 6 row(s) not confirmed on their PDF page |
| ACQP22 | Veda Etc. | 1 row(s) not confirmed on their PDF page |
| ACQP23 | Vedanta | 1 row(s) not confirmed on their PDF page |
| ACQP24 | Vedanta, Sarvadarshan, Mimansa, Nyaya Etc. | 4 row(s) not confirmed on their PDF page |
| ACQP25 | Vyakaran | 1 row(s) not confirmed on their PDF page |
| ACQP26 | Vyakarana and Shabdabodha System | 1 row(s) not confirmed on their PDF page |

Two more, SCQP29 and COQP22, were confirmed as stored and keep their earlier "not reviewed" status.

## Unresolved review items

The 38 items in 22 papers listed in `CUET_SYLLABUS_CORRECTIONS_TRIAL_REPORT.md` are unchanged. They are carried in each version's notes. Some of those papers are now visible; the items concern spelling, spacing or nesting that a person should decide.

## Code changes

- `backend/src/services/maintenance.ts`, `backend/src/routes/admin.ts`: `POST /api/admin/syllabus-versions/:id/machine-verify`.
- `content-ingestion/src/syllabus-review.ts`, `cli.ts`: the `review-machine-check` command, with `--dry-run`.
- `backend/test/machine-verify.test.ts`: 2 new tests.
- Tests: backend 52 of 52, pipeline 28 of 28. Typecheck clean for backend and pipeline.

## What this does not prove

Machine-checked means the words are on the cited PDF page and the structure passes the checks. It does not prove the nesting matches the PDF's meaning in every case. A person should sample the 113 newly marked papers.

## How to undo

Stop the local server, then copy `wrangler-state\d1` from the backup folder back to `backend\.wrangler\state\v3\d1`.
