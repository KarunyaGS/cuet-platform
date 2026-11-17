# Question bank audit: original CUET UG questions (17 November 2026)

**Read-only audit.** No question record, pack file or production data was changed. Sources: the 115 authored pack files in `content/packs/CUET_UG` and the local database (read-only queries).

## 1. What exists
| Subject | Topic rows with a pack | Chapters | Questions | Easy/Medium/Hard | Correct answer at position 1/2/3/4 | Syllabus rows with no pack | Questions per topic (min–max) | Full 50-question papers it could fill |
|---|---|---|---|---|---|---|---|---|
| Biology | 13 | 5 | 195 | 52/78/65 | 52/52/49/42 | 0 | 15–15 | 3 |
| Chemistry | 10 | 1 | 200 | 55/87/58 | 49/50/52/49 | 0 | 20–20 | 4 |
| Computer Science / Informatics Practices | 22 | 3 | 444 | 112/191/141 | 147/103/97/97 | 0 | 18–22 | 8 |
| Geography / Geology | 9 | 2 | 135 | 36/54/45 | 35/32/34/34 | 0 | 15–15 | 2 |
| Mathematics / Applied Mathematics | 25 | 6 | 512 | 126/209/177 | 171/119/113/109 | 2 | 19–22 | 10 |
| Physics | 31 | 9 | 787 | 185/405/197 | 197/202/202/186 | 1 | 14–45 | 15 |
| General Aptitude Test | 5 | 1 | 75 | 20/30/25 | 18/19/19/19 | 0 | 15–15 | 1 |
| **Total** | 115 | | **2348** | | | | | |

- The database holds the same 2348 questions, one record per authored question, each linked to a syllabus topic. All have origin **AI-assisted** and status **draft**.
- **Review status:** 787 (all Physics) are marked VERIFIED. They were approved on 16 November 2026 as a **bulk management approval** (a batch of 786, plus 1), after automated format checks only. The batch record states it was *not* an individual review, and that the scientific correctness of answers, the accuracy of explanations and the fit to the syllabus were **not checked**. The other 1,561 questions (six subjects) are **unverified**. No question has been reviewed by a subject expert.
- **Official papers:** there are **0** structured NTA PYQ questions and 0 mock-paper question records. NTA and SelfStudys papers exist only as hosted PDFs. All 2348 structured questions are original practice questions, so the two are already kept apart in the data.

## 2. Gaps in coverage
- **Syllabus rows with no pack:** Physics 1 of 32 topic rows; Mathematics 2 of 146 leaf items. No other subject has any. Every other syllabus topic has a lesson and questions.
- **Thin banks.** Targets used: topic minimum 30, chapter minimum 60 (below that a chapter test repeats questions), subject minimum 300.
  - Chapters below 60 questions: Biology 5 of 5; Chemistry 0 of 1; Computer Science / Informatics Practices 0 of 3; Geography / Geology 0 of 2; Mathematics / Applied Mathematics 3 of 6; Physics 0 of 9; General Aptitude Test 0 of 1.
  - General Aptitude Test (75 questions) can fill only 1 full 50-question paper; Geography 2; Biology 3; Chemistry 4.
- **No full-length mocks and no chapter tests exist yet.** Topic practice exists.

## 3. Quality checks (automated)
| Check | Result |
|---|---|
| Exact duplicate questions (stem and options) | **0** |
| Near duplicates inside a subject (85% or more identical wording, numbers included) | **0**. An earlier count of 28 came from a check that ignored the numbers inside formulas, and is withdrawn. |
| Answer outside options 1–4, or two identical options | **0** |
| Missing explanation or missing per-option notes | **0** |
| Explanations under 120 characters | 3 (Maths, formula-dense but complete) |
| "All of the above / None of the above" options | 1 |
| Correct option is also the longest | 16% overall, a guessing cue (Physics 18%, Computer Science 18%) |
| Correct answer is option 1 | Computer Science 33%, Maths 33% (an even spread is 25%) |
| Reads more like another topic of the same subject | 35 flagged (306: 1, 308: 11, 313: 3, 319: 19, 501: 1). Almost all are Computer Science rows whose syllabus topics genuinely overlap (SQL I and II with the SQL row, the three networking rows). A person must confirm; they are not shown to be wrong. |

**Not checkable by software, so still open:** whether each answer is correct, whether each explanation is accurate, and whether each question truly matches its syllabus line. The writers recomputed arithmetic and ran code and SQL outputs, but nobody else has checked the content.

## 4. Proposed plan to fill the gaps (original, CUET-level, no third-party material)
Targets: every topic at least 30 questions, every chapter at least 60, and every subject at least 300, so six different 50-question papers can be built.

| Subject | Now | To write | After | Full 50-question papers |
|---|---|---|---|---|
| Biology | 195 | +195 | 390 | 7 |
| Chemistry | 200 | +100 | 300 | 6 |
| Computer Science / Informatics Practices | 444 | +216 | 660 | 13 |
| Geography / Geology | 135 | +165 | 300 | 6 |
| Mathematics / Applied Mathematics | 512 | +238 | 750 | 15 |
| Physics | 787 | +207 | 994 | 19 |
| General Aptitude Test | 75 | +225 | 300 | 6 |
| **Total** | 2348 | **+1346** | 3694 | |

How the new questions will be written:
1. Each topic gets questions on the syllabus lines that have the fewest so far, in the CUET mix (single-answer, assertion–reason, match, statement-based), about 25% easy, 40% medium and 35% hard, with the correct option spread evenly across 1–4 and never systematically the longest.
2. Every answer and number is recomputed independently; code, SQL and arithmetic are run.
3. Each new question is checked against the existing bank for duplicates (exact and 85% near matches) before it is added.
4. New questions go in as separate files per topic, imported alongside the old ones without touching any existing record, marked AI-assisted and unverified.
5. A sample of about 60 per subject is prepared for a subject expert to review. Nothing is labelled expert-approved until that happens.

## 5. Making the bank ready for PDFs and mock tests
- **Ready now:** every question has a stable key, a topic link, a type, a difficulty, four options, one answer, an explanation and per-option notes. Branded chapter-wise and topic-wise PDFs can be generated from the bank with the existing document pipeline and stored in our own storage.
- **Chapter tests:** the practice API already starts a test from any syllabus node, so a chapter test works once chapters have enough questions.
- **Full-length mocks:** built to each paper's real pattern (50 questions, 60 minutes, +5 / −1; for Computer Science and Maths the Section A plus Section B1 or B2 layout), taking questions from the chapters in proportion to the syllabus. This needs the pools in section 4.
- **Formulas in PDFs:** many stems contain formulas, so PDF generation must render them. The existing pipeline does this.
