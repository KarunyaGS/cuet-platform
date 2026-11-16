# NTA CUET-UG previous-year papers and answer keys: library plan (16 Nov 2026)

Scope: **CUET UG only**, science-focused papers first (NTA codes 322 Physics, 306 Chemistry, 319 Mathematics / Applied Mathematics, 304 Biology / Biological Studies / Biotechnology / Biochemistry, 313 Geography / Geology, 308 Computer Science / Informatics Practices, 501 General Aptitude Test). Nothing was downloaded, stored or republished for this plan. Figures are read-only counts from the local database.

## 1. What the system already holds (recorded, not hosted)

| Item | Count | Notes |
|---|---|---|
| Previous-year index records, CUET UG | 335 across all papers | 86 are NTA's own files (classification OFFICIAL); 136 AglaSem, 85 SelfStudys, 27 Adda247 are third-party copies; 1 is a CUET Prep original |
| NTA question-paper records, science codes | 24 (304: 3, 306: 4, 308: 2, 313: 4, 319: 4, 322: 3, 501: 4) | years 2024, 2025, 2026; each keeps source page, file URL, hash fields, pages, status |
| NTA answer-key records | 3 (one combined file per year 2024, 2025, 2026) covering every paper of the year | the key file lists each paper's pages; per-paper key pages are recorded for science papers |
| Official session directory (paper, date, shift) | science papers: 8 (2024), 135 (2025), 151 (2026) | shifts recorded as Shift 1 / Shift 2 / not stated; 74 have no shift stated |
| Question papers published by NTA per session | **0** of those sessions have an NTA-hosted paper recorded as available | the directory is built from NTA's answer-key files |
| Files held in our own storage | **1** of 335 (a CUET Prep original) | nothing from NTA is stored |

All numbers are about what the system has *recorded*. I did not open NTA's sites in this step, so I have **not** verified that nothing newer exists there.

## 2. What is missing or unverified

- **Provisional versus final answer keys:** the records hold one key file per year; whether NTA published separate provisional and final files, with their dates, is **not recorded** and must be read from NTA's notices (the 81 stored government notices may mention them).
- **Question papers per subject and shift:** only some NTA-hosted files are recorded (24 for the science codes). Whether NTA publishes the rest is unverified; none will be invented.
- **Paper code and shift for every file:** present for the directory; missing for 74 sessions (shift not stated).
- **Rights:** see section 3. This is the gate for everything else.

## 3. Rights position (must be settled before any PDF is stored or shown on our site)

- The recorded permission for NTA material is **"NTA official document (reference; cite and link)"**: *"No licence stated by NTA ... Do not republish the PDF."* Material with no established licence is "all rights reserved until checked".
- NTA's site asks for prior permission before reproduction or linking (earlier research). Management decided on 13 and 16 Nov 2026 to keep embedded viewing off and the permission letter on hold. `OFFICIAL_IN_APP_VIEWING` and `PYQ_IN_APP_VIEWING` are off in production.
- Third-party copies (AglaSem, SelfStudys, Adda247) have **no reuse rights on record** and must not be copied or hosted.
- **Needed before hosting:** (a) read NTA's own copyright, terms and reuse statements (the sites I would check are cuet.nta.nic.in, nta.ac.in and the government-hosted file store they use); (b) if reuse is not clearly allowed, written permission or an official clarification from NTA. A draft request exists (`docs/nta-permission-request.md`); **it has not been sent and needs your approval to send**; (c) a recorded `rights_basis` per document (permission reference and date).

## 4. How the library will work once rights are confirmed

1. **Collect:** from NTA's own pages only, list every UG question paper and answer key (provisional and final) with its page URL and file URL. A person confirms each file's subject, paper code, year and shift from the file's own first page.
2. **Download and verify:** fetch each PDF once, record SHA-256, byte size, page count and retrieval date; compare with the official page; mark `verification` (machine-checked first, then a person) and keep the original URL.
3. **Store:** put permitted files in our own storage (R2) under `pyq/ug/{year}/{paper-code}/{shift}/{kind}-{version}.pdf`, linked from the existing `pyq_documents` row (`r2_key`, `rights_basis`, `review_state`). Files without a recorded rights basis cannot be switched on.
4. **Organise:** by subject, year, paper code and shift, with question paper and matching provisional and final key side by side, and the key's page for that paper.
5. **Show:** the integrated PDF viewer and a download option already exist (`/pyq/view/:id`, file route with byte ranges). They stay off until the rights step is done for each file.
6. **Never:** no file without a source URL; no invented paper, key or explanation; no third-party copy; missing items are shown as "not published by NTA" or "not yet collected".
7. **Active catalogue:** the lists already respect the science-only scope, so only the seven science-focused papers appear to students.

## 5. What is already built (no new build needed for the first steps)

The record model (`pyq_documents`, official session directory, link registry, storage column, rights and review fields), the in-site viewer, the download route and the staff screens for linking basis and permission. The only code added in this step is the active-catalogue filter on the student lists.

## 6. Decisions needed

1. Approve sending the permission or clarification request to NTA (or tell me to read NTA's published terms first and decide).
2. Until then, keep papers as links to NTA's own pages (current behaviour), with hosting and embedded viewing off.
3. Confirm that third-party copies stay out of scope.
