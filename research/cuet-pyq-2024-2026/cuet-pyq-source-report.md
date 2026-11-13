# CUET UG previous-year papers, 2024 to 2026: source report

**Date:** 13 November 2026. Local research only. Nothing was imported into CUET Prep, uploaded to storage, published or deployed. CUET PG is not included.

## Short answer

AglaSem lists **104 CUET UG question papers** for 2024, 2025 and 2026 (one per subject per year) and **7 answer-key files**. Every one is recorded here with its page and file address. This is **not a complete set of papers**: NTA held 728 subject sessions in these three years, and AglaSem carries one paper per subject with no exam date or shift. No paper could be tied to a session, so no paper can be matched to its answers yet.

## Totals

| | 2024 | 2025 | 2026 | All |
|---|---|---|---|---|
| Question papers found | 29 | 38 | 37 | **104** |
| Languages | 7 | 13 | 14 | 34 |
| Domain subjects | 21 | 24 | 22 | 67 |
| General Test | 1 | 1 | 1 | 3 |
| Answer-key files listed | 3 | 2 | 2 | **7** |
| Distinct NTA keys among them (by content) | 2 | 1 | 1 | 4 |
| Sessions in NTA's final key | 74 (computer-based only) | 322 | 332 | 728 |
| Session papers not found | 45 | 285 | 295 | **625** |
| Subjects with no paper at all | 34 | 0 | 0 | 34 |

The counts match what AglaSem's own pages print ("29 subject papers", "38 papers", "37 papers").

Subject-wise rows are in `cuet-pyq-inventory.csv`; the per-subject gaps are in `cuet-pyq-missing-papers.csv`.

## Sources

| Source | Result |
|---|---|
| AglaSem, `admission.aglasem.com/cuet-question-papers/` and its 2024, 2025, 2026 pages | Read. Robots rules allow these pages and the document pages on `docs.aglasem.com/view/`. All 111 document pages were read, one request a second |
| PDF host | `cdn.aglasem.com` for all 111 files |
| CollegeDunia, `collegedunia.com/exams/cuet/question-paper` | **Not read.** The site answered 403 to an automated client, even for its robots file. Nothing was worked around. It needs a person to open it in a browser |
| Other sites | Not searched in the time available |

Because CollegeDunia could not be read, no paper was compared across two websites. "Same paper on several websites" is therefore unknown, not zero.

## What was inspected

13 files were opened: 6 question papers (Physics and English for each year) and all 7 answer keys. They were downloaded for inspection only and deleted afterwards. The other 98 question papers were **not** opened; their rows rest on AglaSem's page titles alone and say so.

| Year | What the sampled question papers are |
|---|---|
| 2024 | An AglaSem cover page, then an NTA pen-and-paper test booklet ("Test Booklet Code A", 50 questions, 40 to answer). No date or shift is printed. The Physics booklet is bilingual, English and **Assamese**; the listing does not say so |
| 2025 | An AglaSem cover page (it prints "YEAR 2024" under a 2025 heading), then pages that are images. The file's own title is "Online Question Paper PDF Preview". Date, shift and medium could not be read |
| 2026 | A file produced by AglaSem, with "aglasem.com" printed across the pages. Pages are images. Date, shift and medium could not be read |

So the files are **not NTA's originals**: each carries a third-party cover page or watermark.

## Answer keys

| Record | Pages | Finding |
|---|---|---|
| 2025 "Answer Key" | 324 | **Byte-for-byte NTA's final answer key**, the same file CUET Prep already links on NTA's own site |
| 2025 "Answer Key (Final) All Subjects" | 325 | AglaSem cover page plus, by page count, the same key |
| 2024 "Answer Key" | 219 | NTA heading; the pen-and-paper (OMR) final key |
| 2024 "Answer Key (Final) OMR" | 220 | AglaSem cover page plus, by page count, the same OMR key |
| 2024 "Answer Key (Final) CBT" | 152 | AglaSem cover page plus, by page count, NTA's 151-page computer-based key |
| 2026 "Answer Key" and "Answer Key (Final) All Subjects" | 335 each | AglaSem cover page plus, by page count, NTA's 334-page final key. Two different files |

**Duplicates:** none by file hash (all 13 hashes differ; all 111 addresses differ). By content, three of the seven key files appear to repeat another one with a cover page added. That is a page-count inference, not a proof.

NTA's keys are organised by exam date, shift and subject, with question ids. A paper with no date and shift cannot be matched to its part of the key. Every paper row therefore says "year-level only".

## Uncertain authenticity

- **All 104 question papers are classified "unverified".** AglaSem's pages say "Published by NTA" on every document, including its own repackaged files. NTA's notices for 2025 and 2026 say each candidate sees only their own paper after login, and CUET Prep's earlier search found no openly published CUET UG paper for those years. The 2025 files look like a candidate's paper preview; that is an inference from the file title.
- **Philosophy 2025** is listed by AglaSem but is not among the 37 subjects in NTA's 2025 final key. Treat it as doubtful until someone opens it.
- **Exam date, shift and medium** are "not stated by source" on every paper row. They were not guessed.
- **2024:** NTA's key held by CUET Prep covers computer-based papers only, while the two sampled AglaSem files are pen-and-paper booklets. The "missing" figures for 2024 compare against that partial list and are a rough guide only.

## Permission

- **All 104 question papers need permission before hosting or reproduction.** The questions are NTA's; the files are AglaSem's repackaged copies. Hosting them would need NTA's permission for the content, and they should not be re-used with another site's cover page or watermark in any case.
- **Answer keys:** link NTA's own copies instead. CUET Prep already holds NTA's addresses for the 2024 (computer-based), 2025 and 2026 final keys.
- AglaSem's terms of use were not found at the addresses tried, so nothing here assumes a licence to reuse its files.

## Files

| File | What it holds |
|---|---|
| `cuet-pyq-inventory.csv` | 111 rows: 104 papers and 7 answer-key files, with source page, document page, file address, host, classification, verification status and notes |
| `cuet-pyq-inventory.json` | The same rows with the totals and source status |
| `cuet-pyq-missing-papers.csv` | 102 rows: for each subject and year, sessions in NTA's key against papers found |
| `cuet-pyq-source-report.md` | This report |

## What a complete inventory would still need

1. A person to open CollegeDunia and compare its list.
2. Opening the other 98 papers to read what each actually is, and its medium.
3. A way to tie each paper to an exam date and shift. Without it, answer keys cannot be matched.
4. A decision on permission before any of these files is shown inside CUET Prep.
