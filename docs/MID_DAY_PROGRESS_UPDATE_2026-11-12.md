# CUET Platform — Mid-Day Progress Update

**Date:** 12 November 2026  ·  **Prepared from:** the project files, Git history, local and remote database counts,
Cloudflare checks and test runs taken while writing this report (nothing was changed to produce it).

---

## 1. Project overview

We are building **one complete CUET platform** that supports a student from the moment they hear about CUET,
through preparation and the examination, to university admission:

- **CUET-UG and CUET-PG**, with official examination information, and application and registration guidance.
- **The complete official syllabus**: every subject, unit, topic and subtopic, traceable to the official NTA PDF.
- **Learning materials, previous-year papers, practice questions and timed mock examinations.**
- **Student performance tracking, a study planner,** and university, course, admission and counselling information.
- **Three workspaces:** a student portal, an admin portal, and a reviewer workspace where people check the syllabus and content.

Today's work concentrated on the foundation that everything else depends on:
1. **A complete, accurate, traceable copy of the official syllabus.**
2. **The database that holds it.**
3. **The Cloudflare infrastructure the website will run on.**

---

## 2. Official CUET data collection and syllabus extraction

| Activity | Total | Completed | Remaining | Status |
|---|---:|---:|---:|---|
| Official CUET-UG papers identified | 37 | 37 | 0 | Complete: matches NTA's official list |
| Official CUET-PG papers identified | 157 | 157 | 0 | Complete: matches NTA's official list |
| Official PDFs collected | 194 | 194 | 0 | Complete, each with a digital fingerprint (checksum) |
| Syllabus PDFs extracted automatically | 194 | 191 | 3 | Kashmiri, Urdu, Lepcha: the automatic reader cannot read these scripts (see below) |
| Independent OCR check of every page | 546 pages | 546 | 0 | Complete: 99.70% of words read by OCR found in our records |
| Papers passing all automatic checks | — | 92 | — | Wording proven against the PDF by two independent text readers |
| Papers needing further review | — | 99 | — | All 99 now reviewed page by page (Section 7); corrections not yet stored |

**What the terms mean**
- **Extraction:** turning the text of a PDF into structured records (paper → unit → topic → subtopic), each pointing
  to the PDF page it came from.
- **OCR** (optical character recognition): software that reads text from an *image* of a page. We used it on
  scanned pages, and as an independent second reading of every page, to catch text the normal reader missed.

**How the work was done**
1. **Collection:** every syllabus PDF was downloaded from NTA's official CUET-UG and CUET-PG pages and fingerprinted,
   so any later change to a file can be detected.
2. **Extraction:** two independent PDF text readers, plus OCR where a page is scanned or uses an old non-standard font.
3. **Checking against the originals:**
   - every record's words must appear on its own PDF page;
   - every word on the page must appear in the records;
   - an OCR re-reading of all 546 pages compared what it saw with what we stored.
4. **Problems found in NTA's own PDFs** were recorded separately, 24 entries in all, for example:
   - the Law (LLM) syllabus cites Acts that have been replaced;
   - the Urdu PDF reuses another university's 2017 syllabus;
   - some papers are typed in old non-standard fonts.

**Corrections completed today**

| Correction | Result |
|---|---|
| Page footers ("2 \| P a g e") were being captured as syllabus text | Extractor fixed; **25** affected rows corrected, with before and after kept in the history |
| An automatic correction step matched rows by position and changed **801** rows wrongly | Detected the same day; all **801 restored** to their original text, confirmed record by record |
| Marathi and Pali page 2: letters in the wrong order from an old PDF font | Re-read with OCR; the readable text is stored as a new draft and the old version is kept |
| Kashmiri and Urdu: no OCR model reads these scripts reliably | Tested extra OCR models (Urdu and Persian): only 25–41% confidence, so used as a reading aid only, never stored as fact |

**Still unavailable or unreadable:**
- **Kashmiri, Urdu and Lepcha:** the main syllabus text of these 3 papers is not in the database yet; only their English instruction lines are.
- **Draft transcriptions:** made from the page images (Section 7), but not yet stored.
- **Lepcha:** the 8 topic lines are written entirely in Lepcha script and need a Lepcha reader.

---

## 3. Local database: how the data is organised

The collected information is no longer just a folder of PDF files. It is organised into **searchable records**
that the website can use directly, for example "show all topics of Unit 3 of Physics, with the PDF page each comes from".

| Data category | Records stored | Purpose |
|---|---:|---|
| Official papers and subjects | 194 + 194 | One record per official paper and its subject |
| Source documents | 194 | The official PDFs, with fingerprint and page count |
| Syllabus versions | 196 | 194 current + 2 earlier versions kept (Marathi, Pali) |
| Current syllabus rows | 4,718 | The structured syllabus |
| Archived syllabus rows | 15 | Earlier versions, preserved |
| — Units | 450 | |
| — Sections | 252 | Plus 3 "parts" and 3 "courses" |
| — Topics | 1,490 | |
| — Subtopics | 1,205 | |
| — Items | 1,083 | |
| — Notes and instructions | 232 | |
| PDF page-text records | 1,107 | The text of every page, as each reading method saw it |
| Page checks | 546 | The OCR check result for every page |
| NTA document issues | 24 | Problems found in the official PDFs themselves |
| Figure references | 1 | The Lepcha page-2 image holding its syllabus text |
| Verification evidence | 1,719 | Proof records behind each automatic check |
| Review records | 1,632 | History of every change and decision |
| Audit logs | 900 | Who did what, and when |

**Status of the syllabus rows:**
- 1,723 rows are machine-verified (they passed every automatic check).
- 2,995 rows are unverified, meaning they need a person.
- **0 rows are recorded as verified by a person** (see Section 7).

**Health checks (latest run):**
- All **8** database migrations applied. A *migration* is a step that creates or changes the database structure.
- **22 of 22** integrity checks passed.
- **0** foreign-key violations: no record points to something that doesn't exist.
- **0** exact duplicate rows.
- **All 194 PDFs** present in local file storage.

**Backups:** taken before every risky step, so any mistake can be undone exactly. They are kept outside the code repository because they contain private account data.

| Backup | Size | Why |
|---|---:|---|
| D:\cuet-backups\20261112-145801 | 81 MB | Before the first remote-migration rehearsal |
| D:\cuet-backups\20261112-154600 | 156 MB | Before importing the missing collected data |
| D:\cuet-backups\pre-migration-20261112-160227 | 159 MB | Immediately before the remote migration |

---

## 4. Cloudflare infrastructure: what was created and connected

Cloudflare is where the website will run. Three resources were **created by you in the company Cloudflare account**.
We prepared the configuration that connects the application to them.

| Component | Name | What it does | Setup status |
|---|---|---|---|
| Cloudflare Worker | `cuet` | Runs the website's server-side application | Created. It still serves its original "Hello World" page; **the CUET application is not deployed** |
| Cloudflare D1 (database) | `cuet-db` | Stores the platform's structured information | Created; structure prepared; data transfer in progress (Section 5) |
| Cloudflare R2 (file storage) | `cuet-storage` | Stores official PDFs, figures and other files | Created (Asia-Pacific, private); **empty** (Section 6) |

**What was done:**
- **Account and resources:** we checked there is exactly one company account, that `cuet-db`'s ID matches our configuration, and that `cuet-storage` exists.
- **Connections:** in the project's deployment configuration, the application connects to the database as **DB** and to file storage as **MEDIA**.
  These connections are written in our configuration and take effect only when the application is deployed. Today the live Worker still has none, because it still runs Hello World.
- **Remote database structure:**
  - all **8** migrations were applied remotely;
  - local and remote structures were compared: **117 of 117** database objects (tables, indexes, rules) match.
- **Worker name:** Cloudflare's tool rejects capital letters, so "CUET" is used as `cuet`.
- **Safety lock:** the application can only be deployed after an explicit "approved" setting. Nothing has been deployed.

Worker address: **https://cuet.ceo-3a7.workers.dev**. It currently shows Hello World, not the CUET platform.

---

## 5. Remote database migration (local → `cuet-db`)

*Migration here means copying all the stored records from the local database into the Cloudflare database.*

| Migration activity | Status | Explanation |
|---|---|---|
| Cloudflare account verification | Done | One company account; correct resources |
| Remote database identification | Done | `cuet-db`; ID matches the configuration |
| Remote database preparation | Done | It was empty; a restore point (bookmark) was recorded before anything was written |
| Eight migrations applied | Done | All 8, in order |
| Database structure matching | Done | 117 / 117 objects identical |
| Initial data transfer | Partial | Stopped part-way without reporting an error |
| Chunk-based transfer | **Paused** | 1 further row added; paused for this report |
| Complete record comparison | Done (for what is loaded) | Every row compared by its key: **0 conflicts** |
| Foreign-key checks | Done (for what is loaded) | 0 violations |
| Final remote verification | **Not yet** | Waits for the missing rows |

**Latest comparison** (41 tables; each row matched by its key and content):

| Result | Rows |
|---|---:|
| Already in `cuet-db` and identical to local | 14,965 |
| Reference rows identical apart from their creation time (set automatically by the migrations) | 35 |
| **Still missing in `cuet-db`** | **2,798** |
| Rows in `cuet-db` that differ from local, or are not in local | 0 |

The 2,798 missing rows are:
- page texts: 879 (228 of 1,107 loaded);
- verification evidence: 1,719 (0 loaded);
- source references: 196 (0 loaded);
- password records and roles of the 2 real student accounts: 2 + 2.

Those 2 accounts already exist remotely but cannot sign in there until these rows load. No passwords appeared in any log or report.

**Why the transfer stopped (corrected finding):**
- The first explanation was a 15,000-statement limit, because the first run stopped exactly after 15,000.
- Further investigation showed the real cause: **3 page-text records contain an invisible "NUL" character** (an unprintable symbol from the PDF's font). Cloudflare's import stops silently when it meets one, and the first such record happened to be statement 15,001.
- You approved storing these 3 records **exactly** (encoding the invisible character safely) and proving it byte by byte. That step is ready but paused.

**This is not a problem with the collected CUET data.** It is an incomplete copy that needs one more batch and a final comparison.

**Left out on purpose (listed, not hidden):**
- 2 test accounts I created for local testing (with their 13 related rows), because one has reviewer rights and a known password;
- 4 local sign-in sessions, which are temporary development logins.

---

## 6. R2 file storage

*R2 is Cloudflare's file storage. "Local storage" is the copy on this computer; "remote" is in Cloudflare.*

| Activity | Status |
|---|---|
| R2 bucket creation | Done (by you): `cuet-storage`, Asia-Pacific, private |
| Worker-to-R2 configuration | Done in the deployment configuration (MEDIA); active only after deployment |
| Local PDF storage | Done: all 194 PDFs, plus the Lepcha figure and lesson diagrams |
| Remote PDF upload | **Not started**: `cuet-storage` holds **0 objects** |
| Other asset upload | Not started |
| File checksum verification | Done locally (rehearsal: 260 files, 0 mismatches); remote not yet |
| Database file-reference verification | Done locally (integrity check "every PDF present"); remote not yet |

---

## 7. Manual verification and review

| | Status |
|---|---|
| Manual verification confirmed by you | Yes (your message today) |
| Verification decisions recorded in the database | **0**: no reviewer decision is stored yet |
| What is needed | Your decisions must be recorded (reviewer screen or a supplied list) before the database can show human verification |

**Page-by-page review against the PDF images.** This was done today with AI assistance; it is *not* human verification.

| | Papers |
|---|---:|
| Papers reviewed | **194 of 194** |
| Confirmed exactly as stored | 42 |
| Corrected | 149 (97 of the 99 "needs review" papers, and 52 of the 92 "passed automatic checks") |
| Transcribed from images | 3 (Kashmiri 46 rows, Urdu 16 rows, Lepcha 5 rows) |
| Items left for a person to decide | 38, in 22 papers |
| **Stored in the database** | **Not yet**: the corrections are in review files, waiting for import |

The review found errors that automatic checks cannot see, because every word was present but in the wrong place:
- the whole syllabus stored under an instruction line (e.g. "The Questions will be Bilingual");
- cover titles stored as syllabus rows;
- headings split at line breaks;
- broken Hindi and Sanskrit letters in the PDF itself.

**The three difficult scripts:**

| Paper | Transcribed | Still needs a specialist |
|---|---:|---|
| Kashmiri | 46 rows | 13 entries (9 unit headings, ~40 list lines): low-resolution scan, vowel marks unreadable |
| Urdu | 16 rows | 3 small points (spacing, one digit form, two letter forms) |
| Lepcha | 5 English rows | 8 topic lines written entirely in Lepcha script |

---

## 8. Earlier content work (background only)

- **Physics:**
  - lessons and practice questions were created and checked;
  - the database holds 21 lessons, 552 questions and 86 diagrams;
  - 31 lesson files exist on disk, some unfinished.
- **Chemistry:** started, with 24 diagrams drawn, but no lesson files were finished.
- **Status:** content creation is **paused on your instruction**. The current focus is the data foundation and the website.

---

## 9. Website: what exists and what is planned

**Already built and working locally** (on this computer, with real data):

| Function | Status |
|---|---|
| Student learning flow: exam → subject → unit → topic → lesson | Built |
| Practice, topic tests and timed full mock tests | Built; scoring checked (+5/−1 UG, +4/−1 PG) |
| Results with explanations; progress and weak-topic tracking | Built |
| Sign-up / sign-in | Built |
| Reviewer workspace: PDF page beside the records; correct, verify, flag, reject, transcribe | Built; checked in a browser |
| Admin and reviewer server functions | Built and tested |
| Worker configuration and deployment lock | Built |

**Planned complete website.** All modules should appear at launch, with features released step by step.

| Module | Main functionality | Today |
|---|---|---|
| Public Homepage | Introduction, navigation, registration | Basic version exists |
| CUET-UG | UG examination information | Subject lists exist |
| CUET-PG | PG examination information | Subject lists exist |
| Exam Information | Eligibility, pattern, dates, notifications | Not started |
| Application Guidance | Registration and application support | Not started |
| Syllabus Explorer | Subjects, units, topics, subtopics | Exists |
| Learning Centre | Lessons, notes, explanations | Exists (Physics) |
| Previous-Year Papers | Official papers and answer keys | Not started |
| Practice Centre | Topic- and subject-wise questions | Exists |
| Mock Tests | Timed examinations and results | Exists |
| Performance Analytics | Scores, accuracy, weak areas | Basic version exists |
| Study Planner | Daily and weekly targets | Not started |
| University Explorer | Universities and courses | Not started |
| Admission Information | Eligibility, counselling, merit updates | Not started |
| Student Portal | Profile, bookmarks, progress | Partly (sign-in, progress) |
| Admin Portal | Complete platform management | Server functions only; no admin screens yet |
| Reviewer Workspace | Syllabus and content verification | Exists |

---

## 10. GitHub and source code

| | |
|---|---|
| Repository | https://github.com/KarunyaGS/cuet-platform |
| Branch | `main` |
| Commits on this computer | 5. **4 are not pushed**: GitHub still shows only "Initial commit" |
| Latest commits | `3f5c8b5` Store all collected CUET syllabus data in local D1 · `8dff13c` Show unreviewed content to students; OCR re-extraction · `cd54da2` Syllabus reviewer, content pipeline, Worker production configuration · `ce2dac2` Syllabus pipeline, database, server and student app |
| Changed today (committed) | 140 files, 28,002 lines added |
| Not yet committed | 3 files: remote-transfer tool improvements; machine-verification support (not connected yet); the extra OCR test script. Plus the lesson files folder (`content/packs`) |
| Tests (run while writing this report) | Code checks: 0 errors · data-pipeline tests 21/21 · server tests 25/25 · website build: OK |

**Never committed** (protected by the project's ignore rules and checked):
- passwords, API keys and environment secrets (`.dev.vars`);
- the local databases (`.wrangler/`);
- downloaded PDFs and working data (`storage/`);
- backups (kept outside the repository);
- any personal user information.

---

## 11. Status dashboard

| Workstream | Completed | In progress | Pending | Overall |
|---|---|---|---|---|
| Official PDF collection | 194 / 194 | — | — | ✅ Complete |
| Syllabus extraction | 191 automatic; 194 reviewed page by page | — | Import 149 corrections + 3 transcriptions; 38 items for a person | 🟡 Largely done |
| Local D1 storage | All collected data stored | — | Reviewed corrections | 🟡 |
| Local database integrity | 22/22 checks, 0 FK violations, 0 duplicates | — | Re-check after importing corrections | ✅ |
| Manual verification | Confirmed by you | — | Record decisions in the database (0 today) | 🟠 |
| Cloudflare Worker setup | Created; configuration and deploy lock ready | — | Deploy (needs approval) | 🟡 |
| Remote D1 setup | Created; 8 migrations; structure 117/117 | — | — | ✅ |
| Remote D1 data migration | 14,965 rows identical; 0 conflicts | Paused (NUL fix approved) | 2,798 rows + final comparison | 🟠 |
| R2 bucket setup | Created, private | — | — | ✅ |
| R2 file upload | Local copies + checksums | — | Upload 194 PDFs + assets; verify | 🔴 Not started |
| GitHub repository | Repository + 5 local commits | — | Push 4 commits (needs approval) | 🟠 |
| Website implementation | Learning, practice, mock, results, progress (local) | — | Remaining modules (Section 9) | 🟡 |
| Student portal | Sign-in, progress | — | Profile, bookmarks, planner | 🟡 |
| Admin portal | Server functions; reviewer screen | — | Admin screens | 🟠 |
| Production deployment | — | — | Only after approval | ⏸ Not started |

---

## 12. Next steps, in order

1. **Finish the remote database transfer** (2,798 rows, the 3 special records stored exactly).
2. **Compare every local and remote record**, plus foreign-key and integrity checks.
3. **Upload the 194 PDFs and other files** to `cuet-storage`.
4. **Verify file checksums** and that every database file reference finds its file.
5. **Reconcile manual verification:** record your verification decisions in the database. Then import the 149 page-image corrections and 3 transcriptions, and settle the 38 open items.
6. **Push** the approved code and documentation to GitHub (after your approval).
7. **Finalise** the page-by-page website design and build plan.
8. **Build** the complete website progressively (all modules visible at launch).
9. **Test** security, functions and mobile layouts.
10. **Deploy** only after your explicit approval.

---

### Discrepancies noted while preparing this report

| Topic | What the earlier report said | What the evidence shows |
|---|---|---|
| Cause of the stopped transfer | Cloudflare limit of 15,000 statements | 3 records with an invisible NUL character; the stop at 15,000 was where the first one sat |
| "Passed automatic checks" | 92 papers fine | 52 of the 92 still needed structure corrections in the page-image review |
| Human verification | Manual verification completed | 0 human decisions recorded in the database |
| Accounts | Local 4, remote 1–2 | Remote 2 is correct: 2 local test accounts excluded on purpose; 1 new account created during the day |
| "Worker configured" | Connected to D1 and R2 | Connections are in the deployment configuration; the live Worker has none until deployment |
