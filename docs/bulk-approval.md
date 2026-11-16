# Bulk approval of questions

A bulk approval is **one management decision** on many questions. It is recorded as that, and never as individual review.

## What it records

One batch (`bulk_approval_batches`, migration 0025) per approval:

- the approver (a signed-in person with `content:review`), their roles at the time, and the date and time
- the scope (all unverified questions, or one subject paper)
- the method: `BULK_MANAGEMENT_APPROVAL_AFTER_AUTOMATED_FORMAT_CHECKS_v1`
- the exact statement the approver confirmed, the automated checks that were run, and what was not checked
- a hash of the list of questions the approver was shown

One item per question (`bulk_approval_items`) with what it was before. Each question also gets a normal review record whose
checklist says `{"bulkApproval": true, "individuallyReviewed": false, "batchId": ...}`.

The answer key's own `verified_by` and `verified_at` are **not** written, because nobody checked each answer.

## What is checked automatically

Exactly four options labelled A to D, exactly one correct answer pointing at an existing option, an explanation of at least 40
characters, a topic, question text present with balanced `$`, a figure present for figure-based questions, and the question is not a
demonstration record and may be shown to students. Questions failing a check are left out and listed with the reason.

## What is not checked

Whether each answer is scientifically correct, whether each explanation is accurate, and whether each question matches its topic.
The screen says so before the approver confirms.

## Who can do it

Only a signed-in reviewer. The shared admin token, scripts and students are refused (`/api/review/bulk-approval/*`).
The approver must tick the statement and type `APPROVE <count>`. If the list changed after they looked at it
(hash mismatch), the approval is refused and they must look again.

## Undoing and correcting

- Flag, reject or withdraw single questions or a whole batch, with a reason (`POST /api/review/bulk-approval/withdraw`).
  Withdrawn questions return to unverified, or become needs-changes or rejected, and leave any approved or published state.
- Using the normal decision buttons on a question: flagging or rejecting takes it out of the bulk approval; verifying it
  one by one makes it individually reviewed (the item becomes `SUPERSEDED`).
- Individually verified questions are never changed by a withdrawal.
- A mock paper that contains a withdrawn question stops being shown to students automatically, because mock papers re-check
  verification each time.

## Reporting

`GET /api/review/bulk-approval/summary` separates: unverified, bulk-approved, individually verified, flagged, rejected.
The reviewer screen is at `/review/bulk-approval`. Lists mark bulk-approved questions with a "Bulk approved" badge.

## Publishing

Bulk approval marks questions verified. It does not change publishing status. Students already see questions under
`CONTENT_PREVIEW`, and mock papers need verified questions.
