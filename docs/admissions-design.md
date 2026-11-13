# Admissions and cut-offs: technical design

**Status:** design for approval, 13 November 2026. Nothing is built and no data is imported. The source list in section 2 is the one to approve before any import.

## 1. What students get

| Screen | Question it answers |
|---|---|
| University page | Which courses does this university offer through CUET, and where is its admission page? |
| Course finder | Which courses can I apply to with the CUET papers I am taking? |
| Eligibility check | Do I meet the stated eligibility for this course? Shown as the university's own words with a link, never as a yes or no the platform works out |
| Cut-off view | What score did this course close at, by category and round, in earlier years? |
| Admission timeline | When does registration, each allocation round and reporting happen for this university? |

Out of scope: predicting a student's chance of admission. Cut-offs are shown as published facts with their year and round. A predictor would need a separate decision, because it gives advice a student may rely on.

## 2. Source list (for approval before any import)

Opened on 13 November 2026 unless marked. Full notes in `docs/provider-and-source-research-2026-11-13.md`.

| # | Source | Address | What it gives | Format | Checked |
|---|---|---|---|---|---|
| 1 | NTA participating universities, CUET-UG | cuet.nta.nic.in/participating-universities/ | The official list; one programme-and-eligibility PDF per university | HTML + PDF | Opened |
| 2 | NTA participating universities, CUET-PG | exams.nta.nic.in/cuet-pg/ | The official list for PG | HTML + PDF | Home page only; sub-pages refused automated reading |
| 3 | University of Delhi | admission.uod.ac.in | Bulletins, seat matrix, round-wise minimum allocation scores, 2023–2026 | PDF tables | Index opened; PDFs not opened |
| 4 | Banaras Hindu University | admission.bhu.ac.in | Bulletins, round allocations, cut-off pages for UG and PG | HTML + PDF | Home page opened |
| 5 | Jawaharlal Nehru University | jnuee.jnu.ac.in | Prospectus; cut-off score and rank by list, 2024–2026 | PDF | Opened; PDFs not opened |
| 6 | University of Hyderabad | acad.uohyd.ac.in | Programmes and minimum qualifications; no cut-offs found | HTML + PDF | Opened |
| 7 | Jamia Millia Islamia | admission.jmi.ac.in | Selection lists per programme | PDF | Not verified |
| 8 | University of Allahabad | allduniv.ac.in/admission | Per-programme, per-round cut-off notices | PDF | Not verified |
| 9 | Aligarh Muslim University | amucontrollerexams.com | Guide to Admissions | unknown | Not verified |

Proposed first phase: sources 1, 3 and 5. They are official, open without a login, and were opened. Sources 2, 4 and 6 follow once their pages are read by a person. Sources 7 to 9 stay out until verified.

Limits to accept before approving:

- **NTA publishes no cut-offs.** Cut-offs come only from universities, and each uses its own format and its own score basis. Delhi's "minimum allocation score" is not comparable with JNU's "cut-off score".
- **No reuse licence.** The university sites say "all rights reserved". The platform would store facts (a course, a category, a round, a number) with a link to the source, and would not republish the PDFs. Whether that is enough is a legal question for the owner; this document does not settle it.
- **Personal data.** Some lists (Jamia's selection lists) contain candidates' names and roll numbers. Those documents must not be stored or parsed. The importer refuses any row with a name or roll-number column.
- **It changes every round.** Addresses carry dates and new files appear from June to August. Someone must re-check the sources each cycle.

## 3. Data model

New tables. Each fact row carries the source document and page it came from, the same way syllabus rows do.

| Table | One row is | Main columns |
|---|---|---|
| `universities` | A university, once, across exams and years | name, short name, type (central, state, deemed, private), state, official site, admission site |
| `university_cycles` | A university taking part in one exam in one year | university, exam (UG or PG), year, NTA listing address, programme PDF (source document) |
| `programmes` | A course at a university for one cycle | university cycle, name, degree, department or college, level, seats (if published), official page |
| `programme_paper_rules` | Which CUET papers a course asks for | programme, rule text exactly as printed, plus a structured form: paper codes, how many from which group |
| `programme_eligibility` | Eligibility as printed | programme, text exactly as printed, minimum marks if stated, category notes |
| `admission_events` | A dated step | university cycle, kind (registration opens, round 1 list, reporting ends…), date, source |
| `cutoffs` | One published closing figure | programme, year, round, category, gender or quota if the source splits it, value, **basis** (what the number is: allocation score out of N, percentile, rank), source document and page |
| `admission_sources` | The register of approved sources | university, address, what it covers, approved by, approved on, last checked on |

The existing `participating_universities` table (442 rows from NTA's lists) becomes the seed for `universities` and `university_cycles`. It is kept until the new tables are verified against it.

Rules built into the model:

- **`basis` is required on every cut-off.** Two numbers are never shown side by side unless their basis is the same.
- **Text is stored as printed.** Eligibility and subject rules are quoted, not rewritten. The structured paper rule is an addition used for the course finder, and it is shown beside the printed text.
- **Every fact has a source and a status.** The same statuses as the syllabus: not reviewed, machine-checked, approved by a person. Only machine-checked or approved rows reach students.
- **No source, no row.** The import refuses a row whose source is not in `admission_sources`.

## 4. How data gets in

The same shape as the syllabus pipeline, which already exists:

1. **Register the source** in `admission_sources` with the owner's approval recorded.
2. **Download** the document politely (delays, retries), store a private copy with its SHA-256 and retrieval date.
3. **Extract** tables with the existing PDF tools. Cut-off PDFs are tables, which the pipeline already reads for syllabi.
4. **Normalise** to a pack file per university and year (`content/admissions/<university>/<year>.json`), in the repository so changes are reviewable.
5. **Validate**: every row cites a page; numbers are within the stated range for their basis; categories come from a fixed list; no personal-data columns; totals match the document where it prints them.
6. **Import** as not reviewed. A second, independent read of the same PDF must agree before a row is machine-checked.
7. **Review** on a reviewer screen that shows the PDF page beside the rows, as for syllabi.

No language model writes or fills in any figure. A cell that cannot be read is left empty and listed for a person.

## 5. API and screens

| Route | Purpose |
|---|---|
| `GET /api/public/universities/:id` | University page: cycles, programmes, events, admission links |
| `GET /api/public/programmes?exam=&paper=&state=&q=` | Course finder |
| `GET /api/public/programmes/:id` | Course page: paper rule, eligibility as printed, cut-offs by year and round |
| `GET /api/student/programmes/matching` | Courses that fit the papers in the student's preferences |
| `POST /api/admin/admissions/packs` | Import a pack (dry run supported) |
| `/api/review/admissions/*` | Review rows against the source page |

Screens: university page, course finder with filters, course page with a cut-off table, and "Courses for my subjects" on the Today page. Every table shows its source, year and basis in the caption.

## 6. Phases

| Phase | Work | Needs |
|---|---|---|
| A | Tables, pack format, importer with validation, admin list | Approval of this design |
| B | NTA university lists and programme PDFs for UG (source 1): universities, programmes, paper rules, eligibility | Approval of source 1 |
| C | Course finder and university pages | Phase B data reviewed |
| D | Cut-offs for Delhi and JNU (sources 3 and 5) with the cut-off table | Approval of sources 3 and 5, and the owner's view on reuse |
| E | More universities, one at a time | Each source verified and approved |

## 7. Decisions needed from the owner

1. Approve, change or reject the source list in section 2, and the first phase (sources 1, 3 and 5).
2. Whether storing cut-off figures as facts with a source link is acceptable without legal advice, given the "all rights reserved" notices.
3. Who re-checks sources each admission cycle.
4. Whether a "chance of admission" predictor is wanted later. It is not part of this design.
