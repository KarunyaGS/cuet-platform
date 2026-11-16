# NTA CUET-UG library: report (16 Nov 2026, local only)

Permission: management confirmed on 16 Nov 2026 that CUET Prep may download and host NTA question papers and official answer keys. NTA's own copyright policy (cuet.nta.nic.in/copyright-policy/) allows reproduction after permission, accurately, never in a misleading context, with the source prominently acknowledged; it excludes anything marked as third-party copyright. The written permission itself is not in the repository: **please add the reference to the record** (stored as the rights basis of each file).

Everything below was done on the local database and local storage. Nothing was committed, pushed or deployed, and no production storage or database was touched.

## What was done

1. **Discovery.** Read NTA's public listing pages (cuet.nta.nic.in public notices and the 2025 archive, NTA's notice archive of 1,939 documents), one page per second with an honest identifying client. 99 official documents were targeted: the 86 NTA files already recorded (83 question papers, 3 final keys) plus 13 more found on NTA's own pages.
2. **Download and checks.** All 99 downloaded (HTTP 200, real PDF files, 0 failures). Each was checked for PDF header, size, page count, SHA-256, first-page text, printed subject code or paper name, date and shift where printed, and any copyright mark. Recorded size and page counts matched for every previously recorded file. 2 files were exact duplicates by hash and are stored once.
3. **Storage.** 90 distinct files (about 333 MB) are in our own storage under `pyq/official/ug/<year>/<kind>/…`, original bytes unchanged, one row each in the new table `pyq_hosted_files` (SHA-256 unique, so no file can be stored twice). The row keeps source URL(s), retrieval time, HTTP status, last-modified, checks and notes, printed subject, rights status and basis.
4. **Viewer and download.** Hosted files open in the existing PDF viewer inside CUET Prep and can be downloaded. The viewer page shows the provenance: "NTA's own file, hosted here unchanged. Original: … Retrieved … checked: verified. Source: National Testing Agency." Browser check: reading a paper or key makes **no request to NTA or any other website** (only our own origin), opens no new tab, and renders the PDF; every hosted science file is served from our storage with a SHA-256 equal to the recorded one.
5. **No third-party copies where NTA's file is available.** A copy of a paper is not listed when NTA's verified file for the same exam, year and subject is hosted. Third-party copies stay only where no verified NTA file exists, labelled as copies.
6. **Scope.** Student lists still follow the active catalogue (CUET UG, the seven science-focused papers, General Aptitude Test included).
7. NTA's bilingual booklets (English plus Hindi or another language) are shown when hosted, because NTA prints almost every booklet that way; the earlier English-only rule still applies to every other source. This is a one-line rule (`shownSql` in `backend/src/services/pyq.ts`); tell me if you want the old rule back.

## Result

| | Hosted and shown (verified) | Stored but held back (flagged) | Not available from NTA |
|---|---|---|---|
| Question papers | **29** | **54** | 2022 and 2023: NTA published no question-paper files |
| Answer keys | **6** | **1** | see below |

**Science and General Aptitude Test question papers** (V = verified and shown, F = stored, held back, – = none):

| Year | 322 Physics | 306 Chemistry | 319 Mathematics | 304 Biology | 313 Geography/Geology | 308 Computer Science/IP | 501 GAT |
|---|---|---|---|---|---|---|---|
| 2022 | – | – | – | – | – | – | – |
| 2023 | – | – | – | – | – | – | – |
| 2024 | V (English + Assamese) | V ×2 | V (English + Odia), F ×1 | V | V ×2 | V (date 19 Jul 2024, Shift 1 printed) | V, F ×1 |
| 2025 | F | F | F | F | F | F | F |
| 2026 | F | F | F | F | F | – | F |

Date and shift are shown only where the file prints them (5 papers so far); otherwise they are not stated by NTA and are left empty, not guessed. The official answer-key files list every paper's date and shift, and the existing official directory links them.

**Official answer keys**

| Year | Final key | Provisional key |
|---|---|---|
| 2022 | not found as a file | not found as a file (NTA published only a notice) |
| 2023 | "Answer Key, revised" hosted (737 pages; its first page says "Final Answer Key" although NTA's title says revised provisional, flagged in the title) | Provisional Answer Key hosted (704 pages) |
| 2024 | Computer-based test key hosted (151 pages) and OMR test key hosted (219 pages) | notice only |
| 2025 | Hosted (324 pages, government file store). A second copy on NTA's notice board differs in about 0.7% of its text, so it is stored but **flagged** until a person says which version is current | notice only |
| 2026 | Hosted (334 pages). NTA's notice-board copy has identical text and is recorded as an alternate source, not stored twice | notice only |

**Unavailable, reported rather than invented:** NTA question-paper files for 2022 and 2023; provisional answer keys for 2022, 2024, 2025 and 2026 as public files (NTA published notices saying they were displayed on the candidate portal; those six notices are listed in the manifest as notices, not keys); a 2022 final key file; 2025 and 2026 science papers that could be confirmed (see next section); a 2026 Computer Science / Informatics Practices paper (none recorded).

## Flagged separately (stored, not shown, nothing excluded silently)

- **54 question papers: subject identity unverified.** These files (2025, 2026 and a few 2024) have scanned first pages with no readable subject or code. Their subject labels came from third-party listing pages. A visual spot check of 15 scanned science files found several whose first question does not match the label (for example the 2026 "Physics" file opens with an aptitude question, and the 2026 "General Aptitude Test" file opens with a physics circuit question; a 2025 "Computer Science" file opens with a genetics question). Showing them under those labels would mislead students, so they are held back (`review_state = IDENTITY_UNVERIFIED`, reversible). **To release them:** read each file's content (OCR or a person), correct the label, and clear the state. The 24 files whose text prints the subject code and the 5 that print the paper name, date and shift all matched their labels with no exception.
- **1 answer key (2025 notice-board copy)** as above.
- **Permission:** no file carries an explicit copyright or third-party mark on its first page, so none is flagged for rights; but NTA's policy excludes material "explicitly identified as copyright of NTA or third party", so a person should confirm that none of the hosted files contains such a mark on later pages.

## Files and commands

- `research/nta-ug-library/discover.py`, `fetch.py`, `postprocess.py` (find, download and verify; the downloads live outside the repository).
- `backend/scripts/ingest-nta-library.mts` (store and record; repeatable, skips files already stored, never overwrites or deletes) and `backend/scripts/ui-nta-library-check.mjs` (end-to-end check).
- `database/migrations/0035_pyq_hosted_files.sql` and the Prisma model; `backend/src/services/pyq.ts` (hosted provenance, bilingual NTA rule, no copies where NTA's file is hosted); `frontend/src/pages/Pyq.tsx` and `api.ts`.
- `docs/completion/nta-library-manifest-2026-11-16.json`: all 90 hosted files (hash, size, pages, URLs, retrieval time, verification notes) and the 6 notices.
- Screens: `docs/completion/nta-library-screens-2026-11-16/`.

## Tests

Full project check: backend 272 (one new test file: hosted file served in whole, in ranges and as a download, provenance, flagged files hidden and not served, copies hidden, no duplicate hash), frontend 7, ingestion 40, build and deploy dry-run. Library browser check: **25 of 25** (integrity of all hosted science files 12/12, only our own origin contacted, viewer draws the PDF, download offered, keys open). Earlier UG scope check (81) and navigation check (85) still pass. Existing records: the core tables (subjects, papers, syllabus, questions, lessons, answers, users, progress, bookmarks, admissions, notices) are identical; the only changes are the new table, 4 new document rows, the `r2_key`/`review_state` fields of the NTA rows, 5 dates and shifts filled where NTA's file prints them, and one audit row.

## To put this on the live site (needs your approval)

Apply migration 0035 to production, upload the 90 files to the production storage with the same script, run the ingestion against production, and deploy. None of that was done.

## Decisions needed

1. Add the written NTA permission reference to the record.
2. Which 2025 key is current (government-store copy or notice-board copy).
3. How to settle the 54 unverified papers (OCR plus review, or a person reading each file). 2025 and 2026 science papers stay hidden until then.
4. Keep showing NTA's bilingual booklets (current) or return to English-only.
