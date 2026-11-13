# Official previous-year papers: the directory

**Date:** 13 November 2026. Local only; nothing is deployed.

## Correction to earlier documents

Earlier today's documents said NTA does not publish CUET question papers at all. That was too broad. A second, deeper search found question-paper files on NTA's own server for some CUET (PG) 2024 subjects. I opened all 14 that were found and read their headings. For 2025 and 2026, NTA's notices say candidates see their own paper after login, and no openly published paper was found.

## What the directory holds

Every row is a fact read from a document on NTA's own sites. Nothing is invented, and no document is copied or stored: only the address, the subject, the date, the shift and page numbers.

| Exam | Year | Papers listed | Subjects | Question papers | Official answer key | Source |
|---|---|---|---|---|---|---|
| CUET-UG | 2026 | 332 | 37 | Not published by NTA | Final key, 334 pages | cuet.nta.nic.in |
| CUET-UG | 2025 | 322 | 37 | Not published by NTA | Final key, 324 pages | cuet.nta.nic.in archive |
| CUET-UG | 2024 | 74 (computer-based papers only) | 63 | Not published by NTA | Final key for computer-based papers, 151 pages. It prints no shift | nta.ac.in |
| CUET-PG | 2025 | 157 | 157 | Not published by NTA | Final key, 159 pages | nta.ac.in |
| CUET-PG | 2024 | 14 | 14 | **14 published on NTA's server** | Not found | nta.ac.in |

Total: 899 papers across five exam-years.

The 14 CUET-PG 2024 question papers: Agricultural Science, Botany, Chemistry, Economics, English, General MBA, History, Mathematics, Physics, Political Science, Psychology, Sanskrit, Sociology and Spanish. Each file names its subject, date and shift on its first page, with 105 minutes and 300 marks.

## Limits, stated on screen where they apply

- **The 14 files do not print "CUET (PG)".** They are listed under CUET (PG) 2024 because their dates (12 to 21 March 2024) fall inside that exam's dates and their length and marks match it. NTA has no index page for them, so more may exist that were not found.
- **Those files carry no answers**, and each question is an image.
- **CUET-UG 2024** was held partly on paper. The directory covers the computer-based papers; the paper-based (OMR) key is a separate file that lists booklets, not sessions, and is not included.
- **Not included yet:** CUET-UG 2023, CUET-PG 2023 and CUET-PG 2022 have final keys on NTA's site in three other layouts; CUET-PG 2026 publishes one small file per paper behind a page that refused automated reading. CUET-UG 2022 and CUET-PG 2024 final keys were not found. Three CUET-UG 2023 question-paper fragments exist without headings and were left out, because their subject and shift could only be guessed.

## What a student sees

Practice Centre, "Official previous-year papers": exam, then year, then the subject list with search, then a table per subject.

| Column | Shows |
|---|---|
| Exam date, Shift | As printed by NTA. "Shift not stated" where the key prints none |
| Question paper | "View paper" (opens NTA's site), or "Published by NTA" with the link pending, or "Not published by NTA" |
| Official answer key | "View key, page N" (opens NTA's file at that paper's page), or "Published, page N of NTA's key file", or "Not found on NTA's sites" |
| Extra | Questions NTA dropped in that paper; a link to practise the subject with our own questions |

Each year also shows the status of its question papers, the key's title, its source and the date it was checked.

## Links and NTA's linking condition

NTA's site says prior permission is required before another site links to it. So the directory is complete without links, and each address is released only after a member of staff records why linking is allowed, in the admin console under Practice Centre, Official links.

- One action per answer-key file switches on "View key" for every paper of that year (4 files).
- One action per question paper switches on "View paper" (14 files).

Until then a row says the document is published and that the link is pending.

## How it is built

```
npm run ingest -- official-directory-build --exam CUET_UG --year 2026 --url <NTA key address> --title "<title as printed>"
npm run ingest -- official-directory-import
```

The build reads the key from a temporary copy, writes `content/official-papers/directory/<EXAM>-<year>.json`, and deletes the copy. A page whose heading cannot be read is reported and left out. Question papers hosted by NTA are listed in `content/official-papers/papers/<EXAM>-<year>.json`.

| Part | File |
|---|---|
| Reading NTA's key files | `content-ingestion/src/official-directory.ts` |
| Import and student API | `backend/src/services/practice-centre.ts` (`/api/learn/official-directory`, `/api/admin/official-directory`, `/api/admin/official-question-papers`) |
| Tables | migrations `0017_official_directory.sql`, `0018_official_papers.sql` |
| Screen | `frontend/src/pages/OfficialDirectory.tsx` |
| Tests | `backend/test/official-directory.test.ts`, `content-ingestion/test/official-directory.test.ts` |

## Viewing a paper inside CUET Prep (added 13 November 2026)

"View paper" and "View key" open a viewer page inside CUET Prep (`/official-papers/view/<id>`) with page navigation, a page-number box, zoom in and out, fit to width, full screen and keyboard keys. The document shown is always NTA's original. Question papers and answer keys are separate documents with separate labels.

How a document may be shown depends on what NTA's own server allows. These headers were read on 13 November 2026:

| Where the file is | What NTA's server says | What CUET Prep does |
|---|---|---|
| `cdnbbsr.s3waas.gov.in` (UG 2025 and 2026 answer keys) | `Access-Control-Allow-Origin: *`, no frame restriction | The student's browser loads the file straight from NTA into the viewer. Our server never handles it |
| `nta.ac.in` (the 14 PG 2024 papers; PG 2025 and UG 2024 keys) | `X-Frame-Options: SAMEORIGIN`, no cross-origin header | The file cannot be embedded or read by another site. "View paper" opens a page that sends the student to NTA's own site in a new tab |

Showing an `nta.ac.in` file inside the viewer is possible only by passing it through our server. That is reproduction, which NTA's copyright policy allows "after taking proper permission". So it is a separate, recorded step: in the admin console, **Allow viewing inside CUET Prep** asks for NTA's permission reference and a confirmation. Once recorded, the paper opens in the integrated viewer for signed-in students; the file is passed through and never stored or cached. Withdrawing the permission or unpublishing the link stops it at once.

Steps to switch on, per document:

1. **Publish the link** with the linking basis. Result: "View paper" appears and opens NTA's site.
2. **Allow viewing inside CUET Prep** with NTA's permission (only for `nta.ac.in` files). Result: the paper opens in the integrated viewer.

| Part | File |
|---|---|
| Viewer page | `frontend/src/pages/OfficialViewer.tsx` (uses `pdfjs-dist`, loaded only when a document is opened) |
| How a document may be shown, and the pass-through | `backend/src/services/practice-centre.ts` (`viewerMode`, `officialDocument`, `officialDocumentFile`) |
| Routes | `GET /api/learn/official-documents/:id`, `GET /api/student/official-documents/:id/file` |
| Table change | migration `0019_official_viewer.sql` (two columns) |

Checked in a browser on a throwaway copy, with sample permission text: the Physics paper (87 pages) loaded from NTA and was paged, zoomed and shown full screen; the UG 2026 key opened at page 26 of 334 straight from NTA's server.
