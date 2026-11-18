# Previous-year paper pilot: CUET (UG) 2024 Physics (322), 18 November 2026

One official NTA paper and its official answer key, imported as an unpublished draft to test the process. Local only. Nothing published, nothing deployed.

## What was imported

| Item | Detail |
|---|---|
| Paper | CUET (UG) 2024 Physics, OMR-based test, 16 May 2024, English and Assamese booklet (printed code A), 28 pages. Hosted file `pyq_7957fad5…`, source `nta.ac.in/Download/ExamPaper/111620247903.pdf` |
| Key | NTA "Final Answer Keys for the OMR-based test", 219 pages (`pyq_01b6abbd…`), Physics (English) section |
| Duplicates | None. No paper, question or key from it existed (`past_papers` was 0). Importing twice replaced the draft; counts stayed at 1 paper, 39 questions |
| Result | 1 paper, **50 questions** (draft, unverified, origin `PAST_PAPER`), 0 dropped, **17 figures** (9 question figures, 8 graph options). First import held back 11 figure questions; a second import after figure support was added replaced the draft with all 50. 4,012 → 4,062 questions in the local database |
| Status | DRAFT. Permission `NTA_OFFICIAL_REFERENCE` does not allow display, so it cannot be published; unverified questions and unverified figures are further publish blockers |
| Backup | `D:\tmp\backup-before-pyq-pilot-2026-11-18` |

## Extraction

| Step | Result |
|---|---|
| Text layer (pdf.js) | Found English text for all 50 questions (even pages). The Assamese pages are unreadable (font encoding), which does not matter here |
| Parsing | 50 of 50 questions split out; 49 with four options |
| Accuracy of the text layer alone | Identical to the printed question for only **13 of 39** (33 per cent) after normalising spacing. The rest lost symbols: Ω, π, μ, λ, ×, superscripts and subscripts, fractions (for example "M/π" came out as "M/"). All 11 figure questions lost the figure |
| What fixed it | The 16 English pages were rendered to images and each question was transcribed from the image (LaTeX for maths). Q50 was transcribed from the text layer only (page 24 image not viewed) |
| OCR (Tesseract) | Not run: the text layer exists, and OCR is no better on symbols. For scanned papers (most of the 207 hosted PDFs) it would be needed |

## Answer key

- **The printed booklet code does not match the key's book label.** The booklet says code A. Only **Book C** of the English key agrees with 22 of 22 questions solved independently (A 3, B 4, D 6). The pack uses Book C and says so in its notes. This is the main risk for any further import: the book must be found by checking, never assumed from the printed code.
- All 39 imported questions carry the official key (Book C); the import refuses a pack where the stored key and the official key differ.
- Independent solve of all 39: **38 agree** with the official key. **Q11** (crest voltage in the secondary = M·ω·I₀ = 0.5 × 2π × 50 × 1 ≈ 157 V) is marked 3 (100 V); the nearest option is 2 (150 V). Left as the official key; a reviewer must decide.

## Mapping to syllabus topics

39 of 39 questions are linked to one of the 31 Physics syllabus topics (`question_topics`), and the 11 deferred ones are mapped in the pack. This is my judgement, not checked by anyone else. Less certain: Q24 (two cells in parallel: current electricity or Kirchhoff's rules), Q6, Q9, Q20 and Q7. Accuracy has no ground truth until a reviewer checks it.

## Metadata kept

Exam, year, date (16 May 2024, from the key), language, marking (+5 / −1, 60 minutes), source URL, SHA-256, page, question and page of each question (`Question 12, page 4`), official key, and "official PYQ" (`origin PAST_PAPER`, official NTA source). **Shift is not recorded**: neither the booklet nor the key page gives one. The booklet says candidates answer any 40 of the 50; that rule is in the notes, not enforced.

## Figures (the 11 questions that were held back)

Cut by hand from the official PDF pages at 2.5 times scale and stored as PNG in the existing media store (R2 binding `MEDIA`, `media/<sha256>.png`, media asset records). Each figure keeps its source PDF, page and question (`source_document_id`, `source_page`, caption "Question N, page P", attribution). 9 are question figures (Q5, 19, 23, 28, 32, 33, 37, 48, 49) and 8 are the graph options of Q39 and Q42. Every figure has a written description for screen readers, is unverified, and stays hidden until its paper is published.

My independent solve of the 10 solvable figure questions agreed with the official key 10 of 10. Q39 (graph options, a sign-convention question) was not solved independently.

## For human review (kept in the pack notes as well)

1. **Q11**: official key option 3 (100 V); calculated about 157 V (nearest option 2, 150 V).
2. All 17 figures: check each crop against the paper (nothing clipped, labels present).
3. Topic mapping of all 50 questions (an AI judgement; less certain: Q24, Q6, Q9, Q20, Q7).
4. Q39: official key used without an independent check.
5. Which key book the paper belongs to (Book C chosen by the 22 of 22 test).

## Changes made to the existing module

- `topicNodeId` per question and a `deferred` list in the pack (`past-papers.ts`); topics must belong to the subject.
- Figures: `figure` on a question and on an option (a media key), `DIAGRAM_BASED` accepted, figures uploaded by the CLI through the existing media endpoints, linked to the source document and page, published and unpublished with the paper, never served while a paper is a draft, and a publish blocker while a figure is unverified. The practice, exam and result screens show figures and option images, with an enlarged view (fit to screen or actual size, Esc to close).
- Publishing is blocked while any question of the paper is not imported.
- `VISIBLE_CONTENT`: an official past-paper question is visible only once published, even in local preview. Without this, the topic link would have shown drafts in practice.
- Tests: `backend/test/past-paper-topics.test.ts` (2 tests) and a browser run of 22 checks.

## Time and cost

About an hour of work and roughly 150,000 tokens, of which about 20,000 went on reading the 16 page images. For the other 100+ papers, expect the same per paper unless a faster check of the transcription is found, or a person is used for it.

## Recommended next steps

1. A reviewer checks the 50 questions, the 17 figures and Q11 against the paper.
2. Add the key book check as an automatic step: solve a sample independently and pick the book that agrees.
3. Record the shift when a source gives one.
4. Only after review, decide on the permission needed to show the paper to students.
