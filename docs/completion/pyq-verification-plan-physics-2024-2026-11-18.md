# Verification plan: CUET (UG) 2024 Physics pilot (50 questions, 17 figures)

Written 18 November 2026. This is a plan only. Nothing in it has been executed: no question, figure or key was changed, verified, published or deleted.

## 1. Where things stand (database, read-only)

| Item | State |
|---|---|
| Paper | `past_papers` 1 row, DRAFT, permission `NTA_OFFICIAL_REFERENCE` (display not allowed) |
| Questions | 50, all DRAFT and UNVERIFIED, origin `PAST_PAPER`, each with an official key, source page, source locator and one topic |
| Figures | 17 media assets, all DRAFT and UNVERIFIED, each with source document and page |
| Explanations | **0**. Official papers carry none, and none has been written |
| Verified keys | 0 (`answer_keys.verified_by` empty) |
| Review records for these items | none (only import audit entries) |

## 2. New evidence that changes the Book C question

While preparing this plan I compared all language sections of the official key (the key PDF is stored locally and was read from its text layer).

- The key PDF has a separate Physics section **per language edition**. English and Hindi have four different books (A to D). **Assamese has one key shared by all four books.**
- This booklet is the English and Assamese edition (code "EAS"). Its own section is therefore **Physics (Assamese)**, not English Book C.
- The Assamese key is identical to the English Book C key I stored in **49 of 50 questions**. The only difference: **Q7 is marked "Drop"** in the Assamese key (the question was dropped in that edition), while English Book C gives 2.
- Other editions have their own drops (Bengali Q1, Gujarati Q1 and Q30, Malayalam Q30), so a drop in one language edition does not mean a drop in another.

What this means:

1. The "Book C" uncertainty is largely resolved: the booklet's governing key is the Assamese section, and it agrees with Book C everywhere except Q7.
2. **Q7 needs correction.** The pack stores Q7 as a scored question with key 2. The official key for this edition drops it. Correct handling is to mark Q7 dropped (the existing `dropped` field), not to change any key.
3. Which key governs a bilingual booklet (the Assamese section, or the English one where the paper says English prevails) is a decision for the owner or a reviewer. It is documented, not assumed.
4. Q11 has key 3 (100 V) in **both** the English Book C and the Assamese sections. My calculation (about 157 V, nearest option 2, 150 V) disagrees with both. This is a genuine disagreement between the official key and the physics, and stays flagged.
5. Q39: my derivation with the Cartesian sign convention (v = uf / (u + f), object distance negative) gives the curve in the upper left rising towards a vertical asymptote, which is graph 2, the official key. So Q39 is consistent with the key, but a person must confirm the figure and the convention.

## 3. Existing verification tools, and what is missing

Reused as they are:

| Tool | What it gives |
|---|---|
| `POST /api/review/decide` (reviewer screen) | VERIFIED, CHANGES_REQUESTED, REJECTED for `QUESTION` and `MEDIA_ASSET`, with a comment and a checklist, only by a signed-in reviewer; recorded in `review_records` |
| Content browser, review mode (`/review/content`) | Question list, detail and a three-point checklist (answer key correct, explanation accurate, matches topic) |
| Admin console, previous-year papers | Each question beside the stored and the official key, with its page |
| Source file endpoint and PDF page viewer | The stored paper and key PDFs can be shown by page |
| Past-paper publish gate | Blocks on unverified questions, unverified figures, unimported questions and display permission |
| Bulk-approval guard | A bulk approval can never stand in for these reviews |

Missing, and needed to do this review comfortably:

| Gap | Proposed fix | Effort |
|---|---|---|
| The question checklist has no "text matches the paper", "figure matches the paper" or "option order matches" points | Add a past-paper checklist (three extra points) to the content browser | small |
| No screen to review a **figure**: the decision route accepts `MEDIA_ASSET`, but nothing shows the crop beside its source page | A figure review list in the staff past-paper view: crop, source page, description, decide | about 1 hour |
| No "Uncertain" state | Not added to the database. Uncertain items stay UNVERIFIED and are tracked in the ledger below | none |
| The page images, text layer and parsed data live in `D:\tmp\pilot` (temporary) | Regenerate them on demand from the stored PDFs with the same scripts, or copy to a durable folder | small |

## 4. Status tracking

| Status | Database state | When |
|---|---|---|
| Verified | `VERIFIED` by a signed-in person, with the checklist and an individual review record | All checks pass and an explanation exists |
| Needs correction | `NEEDS_CHANGES`, with a comment saying what to change | A concrete fix is known (for example Q7: mark dropped; a wrong topic; a wrong crop) |
| Uncertain | stays `UNVERIFIED` | A decision needs an expert or a source we do not have (Q11, Q39 at first) |
| Rejected | `REJECTED`, with a reason | Not usable (not expected for any item) |

A ledger file, `docs/completion/pyq-verification-ledger-physics-2024.md`, will hold one row per question and per figure with: text check, key check (Assamese section and English Book C), figure check, topic check, explanation check, status, reviewer, date, and notes. The database holds the authoritative VERIFIED / NEEDS_CHANGES / REJECTED states. Nothing is set to VERIFIED by a script or by me.

## 5. The work, in order

| # | Step | Who | Items | Source files | Estimate |
|---|---|---|---|---|---|
| 1 | **Fix the key basis.** Record the Assamese section as the governing key, mark Q7 dropped, keep Q11 and Q39 flagged. No key is changed; Q7 becomes a dropped question as the official key states | AI prepares, owner approves the decision | Q7 plus the key note | key PDF pages for Physics (Assamese) and (English) | 20 minutes, after the owner's decision |
| 2 | **Review packets.** For every question: the page image, the stored text, both official key rows, my independent solution, the topic and the figure, on one sheet | AI | 50 | paper PDF (28 pages), key PDF (219 pages), page images, text layer | about 1.5 hours, about 100,000 tokens |
| 3 | **Question and answer verification** against the paper and the key | A subject expert, signed in | 50 | the packets, the paper PDF page, the key PDF page | about 4 minutes per question, **about 3.5 hours** |
| 4 | **Figure verification:** each crop against its page (complete, not clipped, labels, graph shapes), and each description | A subject expert, using the new figure screen | 17 | the 17 PNG crops, pages 2, 8, 10, 12, 14, 16, 18, 20, 22, 24 | about 1 minute each plus the screen: **about 20 minutes** (screen build about 1 hour) |
| 5 | **Topic and syllabus mapping** against the 31 syllabus rows | A subject expert | 50, with 10 flagged: Q5, 6, 7, 9, 19, 20, 23, 24, 33, 37 | syllabus text of the 31 topics | about 30 minutes; corrections go through the existing question update |
| 6 | **Explanations and worked solutions.** None exist. AI drafts them (unverified), including the calculation for the numerical ones; the expert checks each one | AI drafts, expert checks | 50 (about 30 numerical) | the question, the key, my solutions | drafting about 80,000 tokens; checking about 1.5 hours |
| 7 | **Resolve Q11 and Q39** | A subject expert (and the owner for the key policy) | 2 | the paper page, the key page, a note of the calculation | 20 minutes |
| 8 | **Record decisions** in the reviewer screen and the ledger; count the results | The expert | 50 + 17 | | included above |

Realistic total: about **6 hours of expert time** (steps 3 to 7) and about **3 hours of preparation** on my side, including the small tool additions in section 3.

## 6. What stays as it is

No answer key is edited. No question is deleted. Nothing is published; the paper stays a draft under a permission that does not allow display, and the new publish blockers stay in force. No production data, deployment or live preview is involved. The bulk-approval safeguard is unchanged.

## 7. Decisions needed before starting

1. Is the Assamese section the governing key for this booklet, and so Q7 is dropped? (Recommended: yes, and keep the English Book C key noted beside it.)
2. Who is the subject expert signing in to verify? Only a signed-in reviewer account can set VERIFIED.
3. May I add the two small review additions (the past-paper checklist points and the figure review list)?
