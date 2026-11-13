# CUET (UG) question papers: clean PDF discovery and rights report

Checked on 13 November 2026. Research only: nothing in the student collection was changed, nothing was deployed, no paper was copied or hosted.

## The short answer

1. **Clean originals exist, on NTA's own website.** 83 NTA files were found and opened: 38 for 2024, 30 for 2025, 15 for 2026. They carry no watermark and no third-party mark.
2. **49 of the 83 are new finds from this round**, including the first 15 NTA originals for 2026. On approval (13 November 2026) all 49 were added as links to NTA: 5 English-only ones are shown to students, 44 are stored and hidden. See `nta-added-records.csv`.
3. **Most clean originals are not English-only.** NTA's 2025 and 2026 papers print every question in English and in Hindi. Only 20 clean originals are English-only: 18 for 2024, 1 for 2025, 1 for 2026.
4. **No previous-year paper may be re-made as a CUET Prep PDF today.** There is no permission on record from NTA or from any website. Every such paper stays a link to its source.
5. **Only our own questions are eligible for CUET Prep PDFs.** One sample is made and checked question by question: 50 of 50 match.

## 1. Sources checked

| Source | What it has | Clean? | Result |
|---|---|---|---|
| NTA (`nta.ac.in/Download/ExamPaper/`) | Its own paper files, 2024 to 2026 | Yes | 83 files opened. NTA has no index page; the addresses were found on other public pages. |
| AglaSem | Copies of papers, 2024 to 2026 | No: its cover page; its name across every page on 2026 files | 136 records; 26 are the same files as NTA's |
| SelfStudys | Its own write-ups with answers | No: re-written, not the original file | 85 pages |
| Adda247 | Memory-based papers | No: not the real paper | 27 links, could not be machine-checked |
| Oswal Publishers, PW, SciAstra, VSI Jaipur | Pages that link to NTA's files | Links only | Used to find NTA addresses |
| CollegeDunia, Shiksha, Prepp | Own-hosted files | Unknown | Block automated access; not bypassed |
| Careers360, CollegeDekho, Aakash, TopRankers | Own-hosted files or samples | Not NTA files | Careers360 needs registration; not bypassed |

No notice from NTA announcing these uploads was found.

## 2. Clean NTA originals, by year

| Year | In the collection already | New this round | Total | English-only |
|---|---|---|---|---|
| 2024 | 21 | 17 | 38 | 18 |
| 2025 | 13 | 17 | 30 | 1 (English) |
| 2026 | 0 | 15 | 15 | 1 (English) |

New English-only clean originals: 2026 English; 2024 History, Home Science, Computer Science, Psychology.

New clean originals that are **not** English-only (so they stay out of the English-only collection):

- 2026, English + Hindi: Accountancy, Biology, Business Studies, Chemistry, Economics, Geography, History, Mathematics, Physics, Political Science, Psychology, Sociology, General Test. Also the Hindi paper.
- 2025, English + Hindi: Psychology, Home Science, Environmental Science, Computer Science, Anthropology. Also 12 language papers.
- 2024, English + a regional language: Environmental Studies, Sociology, Chemistry, Geography, Mathematics, Physical Education, Political Science. Also Bengali, Hindi, Punjabi, Spanish, Urdu papers.
- 2024 Performing Arts: language not settled.

Each new file was opened once; its page count and language are in `nta-new-candidates.csv`.

Things to know:

- NTA's computer-based papers print no subject name. The subject is the one the linking page gives; the page looked at fits it in every case.
- VSI Jaipur's year labels are unreliable. The 2024 year for its files comes from NTA's file names.
- SciAstra gives one file two labels twice (Economics / Fine Arts, Accountancy / Agriculture). No trustworthy Fine Arts or Agriculture 2025 file was found.

## 3. Rights status

| Content | Owner | Permission on record | What we may do |
|---|---|---|---|
| NTA's files | NTA | None | Link to NTA, name NTA |
| AglaSem copies | NTA (questions), AglaSem (its additions) | None | Link, name the source |
| SelfStudys pages | NTA (questions), SelfStudys (solutions, layout) | None | Link, name the source |
| Adda247 papers | Adda247 | None | Link only |
| Sample papers on third-party sites | Not established | None | Link only |
| CUET Prep question bank | CUET Prep | Owned | Make CUET Prep PDFs |

The status of every paper is in `cuet-pyq-rights-status.csv`.

## 4. Eligible for CUET Prep PDFs

Only CUET Prep practice papers from our own question bank. Physics has 787 questions, enough for 15 sets of 50. One set is made. These are not previous-year papers and say so on every page.

## 5. Must remain external links

Every NTA and third-party paper: 229 distinct papers in the collection, plus the 49 new NTA files once approved. See `cuet-pyq-external-links.csv`.

## 6. Missing

No English-only paper was found anywhere for:

- 2026: every subject except English. NTA's 2026 papers are English + Hindi.
- 2025: Knowledge Tradition, Physical Education, Psychology, Sanskrit, Sociology (English-only). Fine Arts and Agriculture have no trustworthy NTA file at all.
- 2024: Anthropology, Engineering Graphics, Entrepreneurship, Fine Arts, Knowledge Tradition, Legal Studies, Sanskrit, Teaching Aptitude, Tourism; Environmental Studies and Performing Arts only in non-English-only versions.
- No NTA file in any year: Knowledge Tradition, Legal Studies, Mass Media, Sanskrit.

The full list by subject and session is in `cuet-pyq-missing.csv`. It was rebuilt after the 49 new NTA files were added.

## 7. Sample generated PDF, checked question by question

"CUET Prep practice paper: Physics, set 1": 11 pages, 50 questions, answer key on page 11.

- Every question's wording in the PDF matches the content file: 50 of 50.
- Every option (A to D) is present and matches: 50 of 50.
- Every answer in the key matches: 50 of 50.
- 6 questions contain formulas; their words were compared by text, the formulas themselves by eye only.
- The questions are still marked "Preview: not yet reviewed". A subject expert has approved none of them yet.

Result per question: `sample-pdf-verification.csv`. Re-run with `node research/cuet-pyq-2024-2026/verify_sample_pdf.mjs`.

## Files

| File | What it is |
|---|---|
| `cuet-pyq-source-inventory.csv` | Every record: source, year, subject, date, shift, language, addresses |
| `cuet-pyq-clean-pdf-availability.csv` | One row per paper: is there a clean original, and where |
| `nta-new-candidates.csv` | The 49 new NTA files: pages, language, where found |
| `cuet-pyq-rights-status.csv` | Rights status of every paper |
| `cuet-pyq-eligible-for-generation.csv` | What may be made into CUET Prep PDFs |
| `cuet-pyq-external-links.csv` | Papers that stay links |
| `cuet-pyq-missing.csv` | Subjects and sessions with no English-only paper |
| `sample-pdf-verification.csv` | The 50-question check of the sample PDF |

## Decisions needed

1. Add the 49 new NTA originals to the collection as links to NTA? The 5 English-only ones would appear for students; the rest would be stored but hidden.
2. Where NTA's clean file and a marked third-party copy are the same paper, show NTA's link first?
3. Show English + Hindi papers? Without them, 2026 has only the English paper.
4. Ask NTA for permission to reproduce its papers? Until then no previous-year paper can become a CUET Prep PDF.
