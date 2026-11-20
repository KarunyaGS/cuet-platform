# University Admission Intelligence: Phase 1 audit (20 Nov 2026)

**Status: audit and report only.** No code, schema, data or navigation was changed for this report. Nothing was committed, migrated, deployed or written to production. Production was read only to list applied migrations.

Evidence sources: Git history (`git log`, `git show`), the working tree on 20 Nov 2026, the local D1 database (read-only SQL), the preview database (read-only `SELECT count(*)`), and the production migration list (read-only).

---

## 0. Headline findings

1. **Nothing was removed.** The admissions page, backend, tables and admin screens have existed since 16 Nov and still exist. On 17 Nov (`9abd981`) only the **navigation link** was hidden. `09a9332` (20 Nov) put the link back and added practice context. There is no deleted implementation to recover.
2. **A substantial admissions module already exists**: 3 tables, 19 admin and student routes, 2 admin screens, 3 student pages, 28 backend tests. The honest gap is **data and logic**, not screens.
3. **Only 4 of 109 programmes are published** (University of Delhi, 2026-27). 105 are drafts. **There are 0 cut-offs, 0 campuses, 0 PG programmes, 0 structured eligibility rules.**
4. **Nothing in the student system stores a CUET score.** The only student signals are practice accuracy per subject (`/api/student/progress`) and the papers a student says they plan to take (`student_preferences.paper_ids_json`). Practice marks are not NTA scores and must not be compared with cut-offs.
5. **Production has none of this.** Production `cuet-db` is at migration 0008. Migrations 0009 to 0041 (including every admissions and notices table) are not applied there. The module exists only locally and, with demo data, in the preview.
6. **The navigation request is already in the working tree** (uncommitted, made by the other active session): Admissions sits beside Official Government Updates in the account menu. One related inconsistency is listed in section 2.5.
7. **The "required subjects" data is too thin for an eligibility engine.** Each programme stores one named subject (`subjects_json = ["English"]`) while the real rule is a combination (any three from List B, and so on) held only as printed text. A client-side parser (`frontend/src/subject-rule.ts`) already turns that text into combinations; it is not server-side and not stored.

---

## 1. Git history and recovery

| Commit | Date | What it did |
|---|---|---|
| `0a81553` | 13 Nov | Design only: `docs/admissions-design.md` (9 sources, 8 proposed tables, phases A to E). No code. |
| `e676b00` | 16 Nov | Government notices from UGC and the first admissions code: `admission_sources`, `admission_facts` (migration `0029`), `backend/src/services/admissions.ts`, admin console routes, `frontend/src/admin/Admissions.tsx`, `frontend/src/pages/University.tsx`. |
| `53433f6` | 16 Nov | Programme directory: `admission_programmes` (migration `0031`), student page `frontend/src/pages/Admissions.tsx` (316 lines), notice history tables. |
| `a2d2876` | 16 Nov | Previous-cycle labels, review flags (migration `0033`), draft import pack for Delhi, BHU and JNU (`docs/admissions-import-2026-11-16/pack.json`, `backend/scripts/import-admissions-pack.mts`). |
| `cf434b3`, `ef2c412`, `f8f347a` | 16 Nov | Stronger historical warnings, rule layout (languages, other subjects, separate tests), four Delhi programmes and List A / List B published locally. |
| `3849f91`, `4ee3f8b` | 16 to 17 Nov | Science-only scope; minor page edits (1 to 3 lines). |
| `9abd981` | 17 Nov | **One-level sidebar commit: hid the admissions link** (replaced it with "Official Government Updates" in the account menu). Page, data and routes unchanged. |
| `09a9332` | 20 Nov | Restored the link in "My Learning" (`frontend/src/Layout.tsx`), added `/admissions` and `/universities` to `navGroup`, and added practice context to `Admissions.tsx` (+39 lines) and `docs/admissions.md`. |

**Original design versus what was built.** The design proposed `universities`, `university_cycles`, `programmes`, `programme_paper_rules`, `programme_eligibility`, `admission_events`, `cutoffs` and `admission_sources`. The build is smaller: **`admission_sources` + `admission_facts` + `admission_programmes`**, with facts of kind `EVENT`, `ELIGIBILITY`, `SUBJECTS`, `PROCEDURE`, `COUNSELLING`, `CUTOFF` standing in for the events, eligibility, paper-rule and cut-off tables.

**Reusable now:** all three tables and their services; the publish / reject / withdraw flow; the "no source, no fact" rule; personal-data refusal (`personalDataProblem`); reliability labels (`reliabilityOf`); previous-cycle labelling (`cycleInfo`, `CURRENT_ADMISSION_CYCLE = '2027-28'`); the subject-rule parser; the import pack script.

**Must be developed:** structured requirements, subject-name mapping, cut-off data, student scores, eligibility and competitiveness logic, notice-to-programme links (see sections 10 and 11).

---

## 2. Current Admissions frontend

### 2.1 Pages and routes (`frontend/src/main.tsx`, lines 165 to 168)

| Route | Component | File |
|---|---|---|
| `/admissions` | `AdmissionsPage` (list, filters, practice context) | `frontend/src/pages/Admissions.tsx` |
| `/admissions/programmes/:id` | `ProgrammePage` (requirements and facts, each with source) | same file, from line 291 |
| `/universities/:slug` | `UniversityPage` (official pages, dates, eligibility, cut-offs, each with source) | `frontend/src/pages/University.tsx` |
| `/cuet/ug/universities` | `InfoPages.tsx` participating-universities list, links to `/universities/:slug` where information exists | `frontend/src/pages/info/InfoPages.tsx` (line 320) |
| `/updates` | `UpdatesPage` (Government Updates) | `frontend/src/pages/Updates.tsx` |
| Admin | sources, facts, programmes, out-of-date list | `frontend/src/admin/Admissions.tsx`, `AdmissionsDirectory.tsx` |

### 2.2 What the student page does today

- **Discovery:** published programmes only (`programmesList`: `p.status = 'PUBLISHED'` and source `APPROVED`). Filters: university type, CUET subject, year, exam, name. Result today: **4 programmes**.
- **Programme cards:** show which of eligibility, subjects, procedure, counselling, deadline and cut-offs are known, and "Not yet available" otherwise.
- **Programme detail:** each fact with its source link, page and check date; a banner when the information is from the previous cycle; the subject rule laid out as combinations.
- **Practice context:** `Card` matches a programme's named required subjects against `/api/student/progress` subject rows using `matchesSubject` (normalised name matching) and shows accuracy and answered counts, labelled as practice context only.
- **API versus static data:** everything comes from the API (`api.ts`, lines 505 to 513). There is no mock or static data.

### 2.3 Gaps in the student workflow

- No eligibility check ("do the papers I take meet this rule?").
- No search by the papers a student takes (only a free-text subject filter on the one named subject).
- No saved or target programmes, no comparison, no application tracker.
- No cut-off view (no data), no deadline calendar, no notice links on programme pages.
- `matchesSubject` is name-matching, so "Mathematics/Applied Mathematics" and "Biology/Biological Studies/..." are only partly matched (section 3.4).
- PG and the 438 other participating universities have no admission content.

### 2.4 Navigation: exact components

Both desktop and mobile show the same **account (avatar) menu** (`UserMenu`) in the top bar (`StudioBar`, line 310, and the second layout branch, line 408). The mobile bottom bar and the desktop top bar also show a **"My Learning"** menu built from the `MY` list.

| Item | Location | State |
|---|---|---|
| `MY` array (My Learning menu: desktop top bar and mobile bottom bar) | `frontend/src/Layout.tsx`, lines 62 to 68 | HEAD has the Admissions entry here. **Working tree (uncommitted, other session) has removed it.** |
| `UserMenu`, "Official Government Updates" link | `Layout.tsx`, about line 219 | unchanged |
| `UserMenu`, "University Admissions" link **beside** it | `Layout.tsx`, about line 223 | **Added in the working tree (uncommitted, other session).** |
| `navGroup()` (which header tab is highlighted) | `Layout.tsx`, line 75 | **Still maps `/admissions` and `/universities` to `'my'`**, so the "My Learning" tab highlights for a page it no longer lists |

**Report:** the relocation is one file, `frontend/src/Layout.tsx`, and it is done in the working tree. Remaining items for that file: remove `/admissions` and `/universities` from the `'my'` group in `navGroup` (or map them to the same group as Government Updates, which has none), and decide mobile discoverability, because on a phone the only route is now the avatar menu. Government Updates functionality is untouched (`/updates`, `Updates.tsx`, `routes/public.ts`).

---

## 3. Database audit (local database, 20 Nov 2026)

### 3.1 Admissions tables

| Table | Rows | Important fields | Relationships | Missing or weak |
|---|---|---|---|---|
| `admission_sources` | **3** (Delhi, BHU, JNU: all APPROVED, `USE_WITH_CARE`, last checked 2026-11-16) | `university_slug`, `url` (unique), `kind`, `status`, `recommendation`, `reviewed_by/at`, `last_checked_on` | referenced by facts and programmes (`RESTRICT`) | 6 further reviewed sources are not loaded or approved (Hyderabad, Jamia, Allahabad, AMU, NTA UG/PG); no counselling-portal sources |
| `admission_programmes` | **109** (105 DRAFT, 4 PUBLISHED) | `university_slug`, `programme_name`, `degree`, `level`, `academic_year` (text, `2026-27`), `exam_code`, `source_id/page/locator`, `last_verified_on`, `status` | unique on slug + name + year + exam; facts link by `programme_id` | **38 of 109 have no `degree`**; `academic_year` is text while facts use integer `cycle_year`; all 109 are UG, none PG; no seats, duration, department or campus |
| `admission_facts` | **186** (ELIGIBILITY 111, SUBJECTS 75; 8 published, 178 draft) | `kind`, `programme_id`, `value_text`, `subjects_json`, `basis`, `category`, `round`, `event_date`, `cycle_year`, `review_flag`, `status` | `source_id` → source (`RESTRICT`); `programme_id` (no foreign key constraint) | **0 EVENT, 0 PROCEDURE, 0 COUNSELLING, 0 CUTOFF facts**; **23 carry an open review flag** (22 BHU, 1 Delhi); 2 eligibility facts are general rules not tied to a programme; the pack held 185 rows and the table has 186 (unreconciled, as `docs/admissions.md` notes) |
| `participating_universities` | **442** (UG 244: 49 central, 41 state, 27 deemed, 120 private, 7 other; PG 198) | `exam_code`, `cycle`, `name`, `type`, `state`, `source_url` | no foreign key from admissions; admissions use `university_slug = slugify(name)` | **`state` is empty for all 442**; no campus, city or website; replaced wholesale per cycle by the official-info import, so nothing can safely point at its row ids |
| `official_info_items` / `official_notices` | 231 / 51 | NTA exam information for the cycle | none to admissions | exam-level only, not university-level |
| `gov_notices`, `gov_notice_sources`, `gov_notice_versions`, `gov_notice_events` | 244, 7, 244, 244 | see section 6 | none to admissions | no university or programme link |
| `student_preferences` | per user | `paper_ids_json`, `target_year`, `exam_date`, `exam_code` | `user_id` | intention only; no scores |

### 3.2 Models that do **not** exist (checked, not assumed)

Universities (canonical table), campuses, academic-year table, courses beyond `admission_programmes`, programme-specific minimum criteria, **structured** CUET subject requirements, previous-year cut-offs, merit lists, closing scores, counselling and deadline events (the `EVENT` kind exists but holds 0 rows), reservation-specific eligibility, verification records beyond the three `reviewed_*` and `last_checked_on` fields, student CUET scores, target programmes.

### 3.3 Admission facts: published versus draft

| University | Programmes | Published | Facts |
|---|---|---|---|
| University of Delhi | 73 | 4 (Economics, Mathematics, Physics, B.Com. Hons.) | 114 |
| Jawaharlal Nehru University | 25 | 0 | 50 |
| Banaras Hindu University | 11 | 0 | 22 (all 22 flagged) |

All data is for admission year 2026-27. The platform's `CURRENT_ADMISSION_CYCLE` is 2027-28, so everything is labelled "Previous admission cycle".

### 3.4 Data quality issues

- **Required subjects are single names, not rules.** `subjects_json` examples: `["English"]`, `["Mathematics/Applied Mathematics"]`. The printed rule ("Combination I: English from List A + any three subjects from List B OR Combination II: ...") is only in `value_text`.
- **Only 13 distinct subject names** appear (General Aptitude Test 34 programmes, English 26, Physics 26, Chemistry 24, Mathematics/Applied Mathematics 20, Biology/Biological Studies/Biotechnology/Biochemistry 10 plus a spelling variant, and a few others).
- **6 of those names do not match a CUET paper name exactly** (all are alternatives such as "Mathematics/Applied Mathematics", "Accountancy/Book Keeping", or have spacing variants). They need a mapping to paper codes, not string matching.
- **BHU rule ambiguity (22 facts):** whether all or any of the listed CUET papers are required is not stated in BHU's documents; the bulletin is a "final draft". This needs BHU's answer, not a guess.
- **Delhi B.A. (Programme)** combinations (about 150) are not imported; the bulletin says they will be notified later.
- Duplicates: none found. Orphans: no programme without a fact.

---

## 4. Admission data research requirements

Existing source register (`docs/completion/sources-review-6-universities-2026-11-16.md`, `docs/admissions.md`):

| Source | Status | Needed for |
|---|---|---|
| University of Delhi, admission.uod.ac.in | approved, partly imported | programmes, seat matrix, **round-wise minimum allocation scores (cut-offs)**, 2023 to 2026 |
| JNU, jnuee.jnu.ac.in | approved, UG imported; PG reviewed, **not imported** (61 programmes, 24 rows not image-checked) | prospectus, cut-off scores by list |
| BHU, admission.bhu.ac.in | approved, 11 programmes, flags open | bulletin, round allocations |
| NTA CUET UG participating universities (cuet.nta.nic.in) | review: USE; **not approved** | the official university list and one programme PDF per university |
| NTA CUET PG | not verified (403 to automated reading) | PG list |
| Hyderabad, Jamia, Allahabad, AMU | reviewed, **not approved** | later |

**Per programme the future record must hold** (and what exists today):

| Required item | Exists today |
|---|---|
| University and programme name | yes |
| Admission year | yes (`academic_year`) |
| Required CUET subjects | text and one name only; **no structured combination** |
| Minimum eligibility | printed text only; **no structured fields** (Class XII percentage, subject prerequisites) |
| Subject-combination requirement | printed text only |
| Previous-year cut-off | **none**; `CUTOFF` kind and `basis` exist but unused |
| Admission and counselling process | kinds exist; **0 rows** |
| Application deadline | `EVENT` kind exists; **0 rows** |
| Source URL, document title, page | yes (`admission_sources`, `source_page`, `source_locator`) |
| Verification status and last verified date | yes (`status`, `last_verified_on` / `checked_on`) |

**Rules to keep (already enforced in `admissions.ts`):** no source, no fact; staff publish; text as printed; no personal data (rejects names, roll numbers, emails, phone numbers); no stored PDFs; missing information shown as "Not yet available". **Cut-offs published by universities use different score bases** (Delhi "minimum allocation score", JNU "cut-off score"): the `basis` field is mandatory and bases are never mixed.

**Cut-off source constraint:** NTA publishes no cut-offs. Only universities do, in PDFs. Extraction needs the existing PDF pipeline and a second independent read (as the syllabus pipeline does) before a figure is published. This is the largest single piece of data work.

---

## 5. Student performance and qualification intelligence

### 5.1 What exists to build on

| Item | Where | Use |
|---|---|---|
| Papers a student plans to take | `student_preferences.paper_ids_json`, `/api/student/preferences` | inputs to a minimum-eligibility check |
| Subject accuracy from submitted practice | `progress()` in `backend/src/services/practice.ts` → `subjects[]`; shown by `Admissions.tsx` | **practice context only** |
| Test paper list with codes | `test_papers` (37 CUET UG 2026 papers) | the paper side of a subject mapping |
| Subject-rule parser | `frontend/src/subject-rule.ts` (+ 7 tests) | combinations for display; reusable logic, but client-side and string-based |
| Exam marking scheme and attempt results | `scoring.ts`, `practice_sessions.scheme_json` (my 20 Nov work) | mock scores; **not NTA scores** |

### 5.2 What does not exist

CUET scores per subject (raw or NTA-normalised), score basis and attempt date, Class XII subject and percentage data, category fields (none needed until an official rule requires one), target programmes, application tracking, any link from a programme rule to a paper code.

### 5.3 Three separate concepts (requirements, no implementation)

| Concept | Question | Inputs needed | Output rules |
|---|---|---|---|
| **1. Minimum eligibility** | Does the student satisfy the **published** minimum requirements? | A structured, reviewed rule per programme (papers with alternatives and counts, language rule, extra tests, minimum Class XII marks, subject prerequisites) and the student's papers (and Class XII facts if a rule needs them) | Three results only: **meets**, **does not meet**, **cannot tell** (rule is text-only, flagged, unpublished or about the previous cycle). Never "eligible" on a draft. Always shows the printed rule and the source. |
| **2. Historical competitiveness** | How does the student's score compare with **previous** cut-offs? | Published cut-offs with the **same basis**, year, round and category as the student's score; the student's real CUET score on that basis (self-entered and unverified until NTA scorecard format is checked) | Comparison against published figures only, with year and sample size; refuses to compare mismatched bases; no figure when evidence is insufficient. Mock or practice scores are **never** used. |
| **3. Admission outcome** | Was the student admitted? | A student-entered record or an official list the platform may legally use (none stored today) | Never inferred from concept 1 or 2. |

**A / B / C bands** are Prepora's own competitiveness labels. They are defined only on top of concept 2, must carry their own name (for example "Prepora competitiveness band"), and must never share a label, colour or wording with NTA categories or reservation categories (General, EWS, OBC-NCL, SC, ST, PwBD). They cannot exist before cut-off data does. The definition (thresholds, minimum evidence) needs the owner's approval before any code.

**Calculation requirements (to be specified, not assumed):** score scale and range per paper (unverified, check the NTA scorecard), how a university combines papers (best-of, sum, weighted), category and round matching, how many years of cut-offs a band may use, and what counts as "insufficient evidence".

---

## 6. Government Updates integration

### 6.1 Verified facts about the existing system (`backend/src/services/gov-notices.ts`, 895 lines)

| Requirement | Finding |
|---|---|
| Scheduled fetching | `scheduled()` in `backend/src/index.ts` (line 74) calls `syncNotices(env)`; cron `*/30 * * * *`; `fetchSettings` reads `NOTICE_FETCH` (`on`/`off`) and `NOTICE_FETCH_MINUTES` (15 to 1,440, default 180). **Off in production**; on locally. |
| Sources | 7 official sources in `SOURCES` (NTA CUET UG, NTA CUET PG, NTA notice board, UGC home, UGC notices archive, UGC circulars archive, UGC DEB board). Only NTA and UGC hosts pass `isOfficialUrl`. **No university notice sources.** |
| Duplicate detection | by `document_url` and `content_hash`, and by `baseKey(title)` (`duplicate_of_id`) |
| Source URL storage | `source_url`, `document_url`, `source_key`, `authority` |
| Version and revision tracking | `gov_notice_versions` (244), `gov_notice_events` (244), `revision_of_id`, `revision_kind` (corrigendum, extension, and so on) |
| Verification and approval | `verification_status`: **PUBLISHED 242 (all `auto_published = 1`), NEEDS_REVIEW 2**; a notice that stops passing the checks is auto-withdrawn to NEEDS_REVIEW; staff decide via `decideNotice` |
| Last and next fetch | `gov_notice_sources.last_checked_at`, `last_success_at`, `next_check_at`, `consecutive_failures`, `last_error` (all 7 healthy on 20 Nov, 0 failures) |
| Notifications | `student_preferences.email_notices`, `notice_cursor`; `sendNoticeAlerts` in `backend/src/services/email.ts`; in-app bell (`RemindersBell`) |
| Admission notices | category `ADMISSION`: 4 notices (3 published, 1 needs review); 45 titles mention admission, counselling or university |

### 6.2 Important difference to protect

Notices **auto-publish** when they pass checks. Admission **facts never do**: they are drafts until a person publishes them. That separation is the safeguard and must stay.

### 6.3 Proposed connection (no overwrite possible)

- A notice **never writes** an admission fact, programme or requirement.
- Add a link table (section 11): `admission_notice_links(notice_id, university_slug, programme_id nullable, relation, status PROPOSED/CONFIRMED, linked_by, linked_at)`. A link is proposed by a keyword/university match and **confirmed by staff**.
- A confirmed link may do two things only: show the notice on the university and programme pages as "Related official notice", and **raise the existing `review_flag`** on the affected facts ("a notice that may change this was published on ...") so a person re-reads the source. A flagged fact already cannot be published without a written resolution.
- A corrigendum (`revision_kind`) linked to a published fact moves that fact to "May be out of date" using the existing `reliabilityOf` logic.
- New facts from a notice are created only as DRAFT through `importFacts`, from an approved source.

---

## 7. Existing functionality to preserve

- Tables `admission_sources`, `admission_facts`, `admission_programmes` and their migrations (`0029`, `0031`, `0033`); do not replace them.
- Services and rules in `backend/src/services/admissions.ts` (`personalDataProblem`, `factProblems`, `decideFact`, `decideProgramme`, `reliabilityOf`, `cycleInfo`).
- Routes in `backend/src/routes/public.ts` (lines 46 to 50) and `console.ts` (lines 103 to 116).
- `frontend/src/pages/Admissions.tsx` and `University.tsx` as restored (extend, do not rewrite), `frontend/src/subject-rule.ts` and its tests.
- Import pack and script (`docs/admissions-import-2026-11-16/`, `backend/scripts/import-admissions-pack.mts`).
- Government Updates in full: `gov-notices.ts`, `Updates.tsx`, the cron, email alerts.
- Practice and scoring logic (`practice.ts`, `scoring.ts`) is **not to be changed**; Admissions only reads `progress()`.
- Tests: `backend/test/admissions.test.ts` (13), `admissions-directory.test.ts` (15), `subject-rule.test.ts` (7).

---

## 8. Files requiring modification (by phase, none changed yet)

| File | Why |
|---|---|
| `database/prisma/schema.prisma` + a new migration (0042 or later) | additive tables and columns (section 11) |
| `backend/src/services/admissions.ts` | structured requirement CRUD, eligibility evaluation, notice links; keep existing exports |
| New `backend/src/services/admission-eligibility.ts` | pure, tested evaluation (no database access in the core function) |
| New `backend/src/services/subject-map.ts` | subject alias → paper code mapping |
| `backend/src/routes/public.ts`, `student.ts`, `console.ts` | new routes (section 12) |
| `frontend/src/api.ts` | new types and calls |
| `frontend/src/pages/Admissions.tsx` | eligibility result on cards and programme page, filter by "papers I take" |
| `frontend/src/admin/AdmissionsDirectory.tsx` | review screen for structured rules and notice links |
| `frontend/src/Layout.tsx` | `navGroup` fix (section 2.4); remainder of nav already changed in the working tree |
| `frontend/src/subject-rule.ts` | logic to be ported to the server; keep the client version for display until replaced |
| `backend/scripts/import-admissions-pack.mts` and pack format | optional structured requirement block |

---

## 9. Missing functionality requiring development

1. Canonical subject mapping (name → paper code).
2. Structured programme requirements (combinations) and minimum-eligibility fields.
3. Server-side eligibility evaluation, with three outcomes and reasons.
4. Student CUET score entry (self-reported, with basis) and target programmes.
5. Cut-off data pipeline and table fields (quota, list, scale).
6. Competitiveness definition and engine; A/B/C bands (after approval).
7. Notice links and "related notices" display.
8. More universities and PG; counselling and deadline facts.
9. Production readiness: apply migrations 0009 to 0041 (needs approval and a backup first).

---

## 10. Recommended database structure (additive; reuse before adding)

| Need | Recommendation | Why not a new copy |
|---|---|---|
| University identity | Keep slug-based identity. Add a small `university_directory(slug PK, name, type, state, official_site, admission_site, participating_name)` only when state and site data exist | `participating_universities` is replaced wholesale each cycle, so nothing can reference its ids |
| Programmes | Reuse `admission_programmes`. Add nullable columns: `duration_years`, `seats`, `campus_note`. Backfill `degree` from the name only where the printed text allows | no duplicate model |
| Structured subject rule | **New** `admission_programme_requirements`: `id, programme_id, fact_id (the printed fact it comes from), combo_label, requirement_json, parse_method (PARSER/MANUAL), status (DRAFT/PUBLISHED), reviewed_by, reviewed_at` | `subjects_json` cannot express combinations |
| Minimum criteria | New columns or rows for printed minimums: `min_class12_percent`, `class12_subject_prerequisite`, each nullable and **null means unavailable**, with `source_fact_id` | none exists |
| Subject names | **New** `cuet_subject_aliases(alias, test_paper_id, exam_code, cycle)` seeded from `test_papers` | replaces the string heuristic in `matchesSubject` |
| Cut-offs | **Reuse `admission_facts` kind `CUTOFF`** (already has `basis`, `category`, `round`, `value_number`, `programme_id`, `cycle_year`). Add nullable `quota`, `list_name`, `scale_max` | the design's separate `cutoffs` table would duplicate this |
| Events and counselling | Reuse `EVENT`, `PROCEDURE`, `COUNSELLING` fact kinds | already modelled |
| Student scores | New `student_cuet_scores(user_id, cycle, test_paper_id, score, basis, source = SELF_REPORTED, entered_at)` | no equivalent |
| Student targets | New `student_target_programmes(user_id, programme_id, created_at)` | no equivalent |
| Notice links | New `admission_notice_links` (section 6.3) | no equivalent |
| Outcome | Out of scope for now; if built, a separate self-reported table, never derived | |

All additions are new tables or nullable columns; existing rows stay valid.

---

## 11. Recommended API structure

Existing (keep): `GET /api/public/admissions/filters`, `/programmes`, `/programmes/:id`, `/universities/:slug`, `GET /api/public/universities`; console `/api/console/admissions/*`.

| New route | Who | Purpose |
|---|---|---|
| `GET /api/public/admissions/programmes/:id/requirements` | public | published structured rule beside the printed text |
| `GET /api/public/admissions/programmes?papers=<codes>` | public | find programmes whose rule can be met with these papers (returns meets / cannot tell) |
| `POST /api/student/admissions/eligibility` | student | body: papers and optional Class XII facts → per-programme `MEETS` / `DOES_NOT_MEET` / `CANNOT_TELL` with reasons and source links |
| `GET/PUT /api/student/admissions/scores` | student | self-reported CUET scores with basis |
| `GET/POST/DELETE /api/student/admissions/targets` | student | target programmes |
| `GET /api/student/admissions/competitiveness?programmeId=` | student | **only** when comparable published cut-offs exist; otherwise "not enough published data" |
| `GET /api/public/admissions/notices?university=&programme=` | public | confirmed related notices |
| `/api/console/admissions/requirements` (list, create, decision) | `content:write` / `content:publish` | structured rule review |
| `/api/console/admissions/notice-links` (list, propose, decision) | `content:write` / `content:publish` | notice links |

---

## 12. Implementation sequence and dependencies

| # | Task | Depends on | Notes |
|---|---|---|---|
| 1 | **Subject alias map and server-side requirement parser with tests** (port `subject-rule.ts`; table `cuet_subject_aliases`; dry-run report of all 109 programmes: parsed, partly parsed, unparsed) | nothing | read-only analysis first; no data change |
| 2 | Migration for requirement tables; backfill structured rules as DRAFT from published and draft printed text | 1, migration approval | no publication |
| 3 | Reviewer screen: printed text beside parsed rule; publish only after a person confirms | 2 | reuses the flag / decision pattern |
| 4 | Resolve open data flags: BHU any/all question (ask BHU), Delhi B.A. combinations, 38 missing degrees, publish reviewed JNU and BHU facts | 3, owner | data work, not code |
| 5 | Minimum-eligibility evaluation (pure function) and student-facing result on cards and programme pages | 3, student papers | tri-state; never from drafts |
| 6 | Student scores and targets | 5, check NTA scorecard format | self-reported label |
| 7 | Cut-off ingestion for Delhi, then JNU (extraction, second read, review) | owner approves sources and reuse position (open decision in `admissions-design.md`) | largest data task |
| 8 | Competitiveness engine and A/B/C definition | 6, 7, owner approves definition | refuses mismatched bases |
| 9 | Notice links | 2 | independent of 5 to 8 |
| 10 | Production readiness: migrations 0009 to 0041, data load, smoke test | owner approval | outside this module's code |

---

## 13. Testing and verification strategy

- **Parser and eligibility (unit):** every one of the 109 printed rules as a fixture; expected parse reviewed by a person; slash alternatives; "any three from List B"; language rules; extra tests; unparsable text must yield `CANNOT_TELL`, not a guess. Existing `subject-rule.test.ts` is the starting set.
- **Safety invariants (API):** drafts and flagged facts never produce a "meets"; previous-cycle data is labelled; unavailable fields stay unavailable; a notice cannot change a fact; mismatched cut-off bases are refused; no endpoint accepts or returns a name or roll number.
- **Data checks (scripts):** counts reconcile with the import pack (186 vs 185); every programme has a source and page; subject names all resolve to a paper code or are listed as unresolved.
- **Browser:** the 41-check pattern from the exam work (desktop and mobile, no horizontal scroll), plus menus: Admissions beside Government Updates on both layouts.
- **Regression:** existing 28 admissions tests and the exam, scoring and progress suites stay green; migrations tested on a copy before any remote apply.

---

## 14. Prioritised roadmap and Phase 2 first task

**P0 (decisions needed from you):**
1. Confirm the architecture here (reuse of existing tables; new tables listed in section 10).
2. Confirm that A/B/C is the "Prepora competitiveness band" and will wait for real cut-offs.
3. Decide the cut-off reuse position (facts with source link only) and who re-checks sources each cycle (both open in `admissions-design.md`).

**P1:** structured requirements and subject mapping (items 1 to 3), then eligibility (item 5).
**P2:** data: resolve flags, publish reviewed programmes, add PG and more universities.
**P3:** cut-offs, scores, competitiveness.
**P4:** notice links, production release.

**First development task for Phase 2:** build `cuet_subject_aliases` plus a **server-side requirement parser** with a dry-run report over the 109 existing programmes (how many parse fully, partly or not at all, and which subject names do not map to a paper). It is read-only, needs no migration to produce its report, depends on nothing, and tells us how much of the eligibility data can be trusted before any schema is committed.

---

## Appendix: counts at a glance (local, 20 Nov 2026)

| Item | Count |
|---|---|
| `admission_sources` | 3 |
| `admission_programmes` | 109 (4 published) |
| `admission_facts` | 186 (8 published, 23 flagged, 0 cut-offs) |
| `participating_universities` | 442 (state empty on all) |
| `gov_notices` | 244 (242 auto-published, 2 need review, 4 admission category) |
| `gov_notice_sources` | 7, all healthy |
| Preview database | programmes 109, facts 186, sources 3, notices 106 |
| Production database | migrations 0009 to 0041 not applied; none of the above tables exist |
