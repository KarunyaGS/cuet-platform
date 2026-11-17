# DuBuddy content audit — CUET UG (17 November 2026)

**Status: catalogue and comparison only. Nothing was downloaded, copied or imported from DuBuddy.**

## What was done, and what was deliberately not done
- Read `https://dubuddy.in/robots.txt`: public pages are allowed. It disallows `/login`, `/register`, `/admin`, session/token URLs and `/app/TestSubFolders/*?*` (the in-app test folders with query strings).
- Read the public sitemap and the public listing pages for the seven subjects, one request per second, with a plain identifying user-agent. Only titles, years and counts were recorded.
- Read DuBuddy's user terms (`/user-terms`). Relevant clauses: *"All content, trademarks, logos, and intellectual property on our website belong to Cyberflow Tech Private Limited and cannot be used without permission."* and the prohibition on *"misuse, copy, or distribute our content without permission"*.
- **Not done:** no PDF or question was downloaded or stored; no login; no request to any `/app/…` path; no attempt to get around the "Attempt / Start Test" screens. The question-bank pages inside DuBuddy's app are reachable only through those disallowed, in-app paths, so they were not examined.

## 1. Resources found on DuBuddy (public listings)
| Subject | PYQ page | Years listed | 2025 shift PDFs (download links) | Mock-test page |
|---|---|---|---|---|
| General Aptitude Test | yes | 2022, 2023, 2024, 2025, 2026 | 5 | no listing |
| Mathematics / Applied Mathematics | yes | 2022, 2023, 2024, 2025, 2026 | 5 | yes |
| Physics | yes | 2022, 2023, 2024, 2025, 2026 | 5 | yes |
| Chemistry | yes | 2022, 2023, 2024, 2025, 2026 | 5 | yes |
| Biology | yes | 2022, 2023, 2024, 2025, 2026 | 5 | yes |
| Geography / Geology | yes | 2023, 2024, 2025, 2026 | 5 | yes |
| Computer Science / Informatics Practices | no listing | none listed | – | no listing |

Also on DuBuddy: "CUET Most Repeated Questions" (in-app only), per-subject mock tests (in-app only, "NTA-like interface"), about 1,000 public single-question pages (`/questions/…`, with solutions), and a Resources menu that currently returns "page not found".
- 2022–2024: listed as in-app "Attempt … in CBT mode" only; no downloadable file is shown publicly.
- 2025: shift-wise question-paper PDFs with solutions, plus in-app tests for each shift.
- 2026: appears in the year table without a visible download link; whatever exists is behind the app.
- **No Computer Science / Informatics Practices resources exist on DuBuddy** (the pages load but contain nothing).
- "Chapter-wise Question Bank", its 2020–2021 and 2023 editions, Study Material, Subject PDFs and Answer Keys as named in the brief are **not visible on any public page**. The only mention is a button "Attempt all chapter-wise PYQs", which leads into the app.

## 2. Resources already on our platform
| Subject | Our chapter-wise question bank | Lessons | Previous-year papers hosted (year: files) | Mock papers |
|---|---|---|---|---|
| General Aptitude Test | 75 (5 topics) | 5 | 2024 (4), 2025 (3) | 0 |
| Mathematics / Applied Mathematics | 512 (25 topics) | 25 | 2022 (5), 2023 (11), 2024 (3), 2025 (5) | 0 |
| Physics | 787 (31 topics) | 31 | 2022 (5), 2023 (10), 2024 (3), 2025 (3) | 0 |
| Chemistry | 200 (10 topics) | 10 | 2022 (3), 2023 (12), 2024 (5), 2025 (3) | 0 |
| Biology | 195 (13 topics) | 13 | 2022 (4), 2023 (13), 2024 (4), 2025 (3) | 0 |
| Geography / Geology | 135 (9 topics) | 9 | 2022 (2), 2023 (10), 2024 (3), 2025 (3) | 0 |
| Computer Science / Informatics Practices | 444 (22 topics) | 22 | 2022 (1), 2023 (4), 2024 (1), 2025 (1) | 0 |

All our previous-year files are held unchanged in our own storage (NTA originals and SelfStudys copies, with provenance on each). Our years are 2022–2025. We hold **no 2026 papers** and **no mock papers**.

## 3. Missing resources (exists on DuBuddy, not on ours)
| Item | Gap | Can we take it? |
|---|---|---|
| 2025 shift PDFs with solutions | DuBuddy lists 5 shift PDFs per subject; our 2025 files per subject are shown in section 2 (between 1 and 5), so some shifts may be missing | **No, not without permission** |
| 2026 papers and tests | We have none | **No, in-app only and behind terms** |
| Mock tests (all subjects) | We have none | **No** |
| Chapter-wise banks, "Most repeated questions" | We have our own authored chapter-wise bank only | **No**, in-app only and behind terms |
| Computer Science / IP | DuBuddy has nothing | n/a, nothing to import |

## 4. Duplicates
- Without the files, a content-level comparison is not possible, and filename comparison was ruled out. The 2025 and 2022–2024 papers on DuBuddy are the same NTA exam papers that we already hold (NTA originals and SelfStudys copies), so those questions would be **duplicates by content**. Only the DuBuddy solutions and the extra shifts would be new.
- Our authored chapter-wise questions (2,348, written for this platform) are original and do not overlap with any third-party content.

## 5. Needs permission or manual acquisition
Everything above in section 3. DuBuddy's terms reserve all content to Cyberflow Tech Private Limited. There is no permission on record for DuBuddy (permissions recorded earlier were for NTA and SelfStudys only).
- **Action for the owner:** obtain written permission from Cyberflow Tech Private Limited that covers copying and hosting their PDFs, solutions and tests, or decline.
- For the same exam papers, the **NTA originals** (already authorised) remain the cleanest source for the official 2025 papers. Missing 2025 shifts could be sought from NTA, not from DuBuddy.

## 6. Proposed import plan
1. **Blocked until permission:** import only what the written permission lists. Keep DuBuddy-sourced files separate from NTA originals (classification and source recorded per file), never merged into official papers.
2. On permission: download only the permitted public PDFs (2025 shifts), compare by extracted question text against our papers, import only the files that add something (extra shifts, the solutions), with source, year and shift recorded and nothing overwritten.
3. In-app content (chapter-wise, mocks, most-repeated) needs DuBuddy to supply files or an export; it must not be scraped.
4. Computer Science / IP: author our own, as already done.
