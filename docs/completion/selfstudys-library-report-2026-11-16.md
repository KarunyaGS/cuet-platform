# SelfStudys CUET-UG library: report (16 Nov 2026, local only)

Permission: management confirmed SelfStudys permission for CUET Prep to use its CUET-UG documents. The permission letter or reference is not in the repository: **add it to the record** (stored as the rights basis of each file). Nothing was committed, pushed or deployed; production storage and database were not touched.

## What was done
- Read SelfStudys' public year listings (2022-2025; it has no 2026 CUET-UG papers) and each document page, one request per second, honest identifying client, **obeying robots.txt**. Took the PDF address each page links itself and downloaded the original file. Scope: the seven active papers (Physics 322, Chemistry 306, Mathematics 319, Biology 304, Geography 313, Computer Science 308, General Aptitude Test 501). 326 documents listed: 186 are other subjects (not downloaded), 25 were not downloaded (below), 115 downloaded.
- 115 files (0 failures, all real PDFs, no duplicate hashes) stored unchanged in our own storage under `pyq/thirdparty/selfstudys/<year>/...` and recorded in `pyq_hosted_files` (source URL, document page, retrieval time, hash, pages, verification, rights basis). 35 matched documents already in the index; 80 are new.
- Open, read and download inside the site: same viewer and download route as NTA's files; the viewer states plainly "A copy from SelfStudys, hosted here unchanged with their permission. It is not an NTA document", with the original address and retrieval date.

## Verification (112 verified, 3 held)
- 26 files have a text layer: page 1 prints the subject (and date/shift) and matches the label.
- 89 files are scanned images: every first page was **read by an AI reviewer** from contact sheets (printed subject and date, or the first questions) and matched its label; no label was wrong. A person has not re-checked them.
- 3 short files are subject answer keys for 2024 (Geography, Mathematics, Physics). Answer keys are listed for the whole year, so they are stored but held back (`ANSWER_KEY_HELD`) until a decision.

## Coverage shown to students (question papers; NTA file + SelfStudys copies)
| Year | 304 Biology | 306 Chemistry | 308 Comp. Sci. | 313 Geography | 319 Maths | 322 Physics | 501 GAT |
|---|---|---|---|---|---|---|---|
| 2022 | 4 | 3 | 1 | 2 | 5 | 5 | none |
| 2023 | 13 | 12 | 4 | 10 | 11 | 10 | none |
| 2024 | 1 NTA + 3 | 2 NTA + 3 | 1 + 1 | 2 + 1 | 1 + 2 | 1 + 2 | 1 NTA |
| 2025 | 3 | 3 | 1 | 3 | 5 | 3 | 2 |
(2025 NTA files exist but are held for identity, see the NTA report; 2026: no SelfStudys papers.)

## Missing or not done
- **25 General Aptitude Test papers (2022-2025)** not downloaded: their SelfStudys page addresses contain "test-", which SelfStudys' robots.txt disallows for automated tools. Permission from SelfStudys may cover this, but it needs your decision (or SelfStudys can supply those files directly).
- 2026: SelfStudys lists no 2026 CUET-UG papers. Answer keys: none as standalone files (only the 3 held above).
- 2022/2023 official NTA papers do not exist as files (see the NTA report); the SelfStudys copies are the only source for those years and are labelled as copies.

## Duplicates
Hashes are unique. A SelfStudys copy is hidden only when NTA's verified file for the same exam, year and subject has the same date and shift; a copy of another session is a different paper and stays. NTA's file is listed first.

## Changed code
`research/nta-ug-library/selfstudys.py`, `ss_sheets.py`; `backend/scripts/ingest-selfstudys.mts`; `backend/src/services/pyq.ts` (copy-hiding rule, source links for hosted copies); `frontend/src/pages/Pyq.tsx` (labels); tests `backend/test/nta-library.test.ts` (+1), `backend/scripts/ui-nta-library-check.mjs` (25/25).

## Tests
Full check: all pass (three unrelated billing/console tests timed out once under memory load and pass when rerun alone); library browser check 25/25.

## To go live (needs your approval)
Apply migration 0035, upload the 205 files (NTA 90 + SelfStudys 115) to production storage with the two ingest scripts, deploy.
