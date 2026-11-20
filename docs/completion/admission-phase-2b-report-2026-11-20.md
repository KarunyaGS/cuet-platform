# Phase 2B: structured admission requirements, review and student use (20 Nov 2026)

**Local only.** Migration 0042 is applied to the local database only. Nothing is committed, pushed, deployed or applied to preview or production. **No requirement is approved and no list is published**: those are a reviewer's decisions, and every record below is a draft.

## What exists now

| Area | Where |
|---|---|
| Tables (migration `0042_admission_requirements_review.sql`) | `admission_requirements`, `admission_review_events`, `admission_groups`, `admission_group_members`, `admission_targets`, and `admission_programmes.campus` (nullable) |
| Reading, review, approval, revision, lists, eligibility, targets, validation | `backend/src/services/admission-review.ts` |
| Pure eligibility evaluation | `backend/src/services/admission-eligibility.ts` |
| Subject map and reader (Phase 2A) | `admission-subjects.ts`, `admission-requirements.ts` |
| Console routes | `backend/src/routes/console.ts`: `/api/console/admissions/requirements[...]`, `/groups[...]`, `/validation` |
| Student routes | `backend/src/routes/student.ts`: `/api/student/admissions/eligibility`, `/targets` |
| Admin review screen | `frontend/src/admin/AdmissionsReview.tsx` (mounted in `admin/Admissions.tsx`) |
| Student screens | `frontend/src/pages/AdmissionEligibility.tsx`, used in `pages/Admissions.tsx` (cards, programme page, My target programmes) |
| One-off local loader | `backend/scripts/phase2b-local-load.mts` |

## The safety rule, and where it is enforced

A student result is produced only if **all** of these hold (`eligibilityFor`, with a test for each): the programme is published; the programme's source is approved; the requirement is APPROVED; its printed fact is published, from an approved source, and unchanged since it was read (hash); **no** subject or eligibility text of that programme carries an open review flag; no blocking or review question remains open on the reading; every list the rule names (List A, List B) is published. Otherwise the student sees why no result is shown (`NO_APPROVED_REQUIREMENT`, `PRINTED_FACT_FLAGGED`, `PRINTED_TEXT_CHANGED`, `LISTS_NOT_PUBLISHED`, `STUDENT_PAPERS_NOT_SET`, and so on). The evaluator says "does not meet" only when every combination is fully known and none is satisfied; otherwise "cannot tell". A result is labelled with the admission year and "previous cycle", and is never a prediction or an admission outcome.

## Task by task

| Task | State |
|---|---|
| Persist structured requirements as drafts | Done locally: 109 current readings (97 draft, 12 waiting for a university) + 3 superseded versions; 0 approved |
| Admin review screen: printed text beside the parsed reading | Done and checked in a browser |
| Approval, rejection, revision tracking | Done: approve / reject / ask the university / reopen / revise (new version, old kept); every step in `admission_review_events` with source address, page and admission year |
| Delhi List A and List B from official documentation | Entered as **drafts** from the Bulletin of Information (UG) 2026-27, PDF p.20 / printed p.xvi: List A 14 languages, List B 22 domain subjects. 35 of 36 entries matched to NTA papers; **Sanskrit needs a person's confirmation**. **Not published.** |
| BHU ambiguous rules | **Not resolved: no BHU document answers it.** Evidence recorded; question drafted, not sent; 11 readings waiting for BHU. No BHU result can reach a student. |
| Three partly parsed programmes | Reviewer drafts prepared, none approved: JNU Ayurveda (structured, 0 open questions); Delhi Sanskrit (mapped as a proposal, 1 open item: List A not yet published); Delhi B.Voc. Health Care Management (the bulletin prints "either List B"; proposed reading "List B" from the sibling programme, waiting for Delhi) |
| Source URLs, academic years, verification history for every criterion | Kept on the programme and fact (existing), and snapshotted on every review event |
| University, programme, campus validation | `GET /api/console/admissions/validation`: local result 0 errors, 2 warnings (the two draft lists), 147 notes (campus not recorded 109, degree not recorded 38) |
| Student target workflow | Done: follow or unfollow published programmes (limit 30), list with eligibility, cycle label, stale flag, "no longer published" |
| Missing, outdated, unverified information | Each target and result says what is missing, old (over 180 days) or from a previous cycle; a withdrawn programme stays listed, marked |
| Tests: mandatory subjects, alternative combinations, any-N-of-list | 8 pure evaluator tests + 12 workflow tests |
| Drafts and flagged criteria never influence results | Tested at the API level and checked in the browser against the real local data (all 4 published programmes show "not available") |

## Needs a person

1. Open the Delhi bulletin p.20 and publish (or correct) List A and List B in Admin, Admissions. Confirm Sanskrit.
2. Review and approve the 97 draft readings (the 24 JNU English + General Aptitude Test readings and the Delhi readings are the quickest). Approval needs a note and clears only what can be cleared.
3. Send the two questions in `phase-2b-requests-for-universities-2026-11-20.md` (BHU, Delhi) if wanted.
4. Production is at migration 0008; this work needs migrations 0009 to 0042 before it can be live there.
