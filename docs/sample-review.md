# Subject-expert sample review

**Status 18 November 2026:** built and tested locally (migration 0038). Nothing is deployed.

A sample review is a subject expert checking a **representative sample** of questions, one by one. It is recorded as exactly that.
It is **not** verification: it never changes a question's verification status, and it is never described as individual
verification of the questions that were not in the sample. Its job is to tell management how far a bulk approval can be trusted.

## How the sample is drawn

- **Which questions:** those a bulk approval could cover (not yet verified, or verified only by a bulk approval), not demonstration
  records, and passing the same automated format checks. One paper (`testPaperId`) or all.
- **Spread over the syllabus:** the questions are grouped by the unit they belong to. Each unit gives a number of questions in
  proportion to its size, rounded by largest remainder, and at least one from every unit when the sample is big enough. Never more
  than a unit holds.
- **Repeatable:** inside a unit, questions are ranked by `sha256(seed | question id)` and the first ones are taken. The seed is
  recorded, so the same seed over the same questions draws the same sample, and nobody picks questions by hand.
- **Size:** 10 to 200, default 60. One sample can be in progress per scope at a time.

## What the expert records

For each question the expert sees the question, the answer key, the explanation and where it sits in the syllabus, and answers
three questions: is the answer key correct; is the explanation accurate and clear; does the question belong under its topic. A
"no" needs a note saying what is wrong. A question with no "no" is **correct**; otherwise it **needs changes**.

To complete the review every question must be checked, the expert's name and credentials are entered, and the person recording
confirms the findings are the expert's own. The signed-in person who recorded each finding and who completed the review is kept
(`reviewed_by`, `completed_by`), and the start and completion are in the audit log.

## What the numbers say

| Number | Meaning |
|---|---|
| Checked, with a problem, wrong answer key | Plain counts from the sample |
| "Likely at most" | The highest true share of questions with a problem that is still consistent with what was found, at 95% confidence (one-sided exact binomial bound). Found none in 60: no more than about 4.9%. Found 3 in 60: no more than about 12% |

The bound is only valid if the sample is a fair draw, which is why the draw is stratified, seeded and recorded. It also says
nothing about *which* of the other questions are wrong: a problem found in the sample means other questions may have the same
fault. The statement stored with the result says all of this in plain words and ends "The other N questions were not checked
individually."

## Next to the bulk approval

The bulk-approval screen shows the latest completed sample for the same scope (who, when, how many, what was found, the bound).
If none was done it says so. If the number of questions has changed since the sample was drawn it says that the sample no longer
describes all of them. The approval itself is unchanged and does not require a sample; the batch keeps a note of which sample stood
beside it (`checks_json.sampleReview`).

## What to do with a problem found

The sample result lists each problem question with the expert's note. Correct, flag or reject one under **Lessons and questions**
with the usual decision buttons. Fixing the questions found does not make the sample a clean result; a sample with problems is a
reason to look further, and a new sample can be drawn afterwards.

## Parts

| Part | File |
|---|---|
| Tables | migration `0038_sample_reviews.sql` (`sample_reviews`, `sample_review_items`) |
| Draw, findings, numbers | `backend/src/services/sample-review.ts` |
| Routes | `/api/review/sample-reviews` (list, create, detail, `/:id/items/:questionId`, `/:id/complete`, `/:id/cancel`); reviewer permission `content:review`; the admin token and students are refused |
| Bulk approval link | `backend/src/services/bulk-approval.ts` (`sampleReview` in the preview) |
| Screens | `frontend/src/review/SampleReview.tsx` (`/review/sample`, `/review/sample/:id`), panel in `BulkApproval.tsx` |
| Tests | `backend/test/sample-review.test.ts` (6 tests) |
