# Prepora local data audit (read-only)

Date: 2026-11-16. Source: private copy at D:/tmp/audit/db-copy/ of `backend/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`. The application DB is `faaf2b04...05fb.sqlite` (82 tables, the only one containing `admission_sources`). The other two 43-table DBs (`cddd4647...`, `f20ed085...`) are stale older local DBs: 7 migrations, 0 questions. R2 was read from `backend/.wrangler/state/v3/r2/` (two buckets). The audit scripts are D:/tmp/audit/s1.py to s12.py. Nothing in the repo or the real DB was modified. No emails, passwords, hashes or tokens are shown.

Scope note: every check below was actually run. Where a table is empty (0 rows) the check is trivially passed and is marked EMPTY. It does not show the feature works.

## 0. Headline

- `PRAGMA integrity_check` = ok. `PRAGMA foreign_key_check` = 0 violations. All manual orphan checks = 0.
- The 33 migration files match the 33 applied migrations exactly, in order.
- Content is thin: only **one paper (Physics, CUET UG 322)** has any questions (787), and only 31 lessons exist (all Physics).
- Nothing is PUBLISHED in the learning content. All 194 test papers, 31 lessons, 121+1 media assets and all questions are status DRAFT.
- The real problems are mostly workflow or consistency issues, not broken references (see section 13).

## 1. Inventory (row counts)

SQL: for each table, `select count(*) from "<t>"` (script s1.py).

**Content:** exams 2, exam_cycles 2, subject_categories 9, subjects 194, test_papers 194, syllabus_versions 347, curriculum_nodes 9367, curriculum_relations 0, questions 787, question_options 3148, answer_keys 787, explanations 787, question_topics 787, question_media 0, question_tags 0, tags 0, passages 0, learning_resources 31, content_blocks 1666, media_assets 122, diagram_labels 0, source_documents 194, source_page_texts 1107, source_page_checks 546, source_references 347, source_tables 0, usage_permissions 7, past_papers 0, past_paper_questions 0, mock_papers 0, mock_paper_questions 0, pyq_documents 335, official_paper_links 23, official_paper_sessions 899, extraction_jobs 194, import_runs 350, verification_evidence 1832, review_records 2700, bulk_approval_batches 1, bulk_approval_items 786, review_assignments 0.

**Students:** users 4, user_credentials 4, user_roles 7, user_sessions 17, practice_sessions 10, practice_answers 46, topic_progress 2, daily_goals 0, study_plan_items 6, learning_activity 36, student_preferences 0, bookmarks 11, annotations 5, flashcards 8, flashcard_reviews 8, reminder_dismissals 0.

**Billing:** plans 4, subscriptions 0, payment_orders 0, payment_transactions 0, payment_events 0.

**Email:** email_messages 1, email_suppressions 0, email_verification_tokens 0, password_reset_tokens 1.

**Admissions:** admission_sources 3, admission_programmes 109, admission_facts 186, participating_universities 442, official_info_items 231, official_notices 51.

**Notices:** gov_notices 81, gov_notice_versions 81, gov_notice_events 81, gov_notice_sources 4.

**Audit and system:** audit_logs 1484, d1_migrations 33, roles 6, permissions 10, role_permissions 24.

## 2. Referential integrity

| Check | SQL (abridged) | Result |
|---|---|---|
| Integrity | `PRAGMA integrity_check` | ok |
| FK | `PRAGMA foreign_key_check` | 0 rows |
| option -> question | `question_options where question_id not in (select id from questions)` | 0 |
| answer_key -> question (both ways) | `answer_keys` vs `questions` | 0 orphans, 0 questions without a key, 0 duplicate keys |
| explanation -> question (both ways) | | 0 / 0 |
| question -> topic node | `questions where id not in (select question_id from question_topics)`; `question_topics.curriculum_node_id not in curriculum_nodes` | 0 / 0 |
| question topic belongs to the same paper as the question | join through syllabus_versions | 0 mismatches |
| question -> test_paper, usage_permission | | 0 / 0 |
| option media -> media_assets; diagram question `structure_json.mediaAssetId` -> media_assets | | 0 / 0 (71 diagram questions all resolve) |
| lesson -> node, paper, permission | | 0 |
| content_blocks -> resource, media | | 0 |
| flashcards -> question / resource / node / paper / user | | 0 (see section 5) |
| practice_answers -> session, question; question in the session's list | | 0 |
| bookmarks -> entity (QUESTION, LESSON, TOPIC, REVISION) | | 0 |
| annotations -> resource, question, node, paper, user | | 0 |
| test paper items -> question | mock_paper_questions, past_paper_questions | EMPTY (0 rows) |
| past papers -> source documents | past_papers | EMPTY (0 rows) |
| media -> R2 key | see section 7 | 0 missing in `cuet-platform-media-dev` |
| extraction_jobs, syllabus_versions, source_references, page texts and checks, import_runs -> test_papers / source_documents | | 0 orphans |
| curriculum_nodes.parent_id, syllabus_version_id | | 0 orphans |
| admission_facts / programmes -> sources, programmes | | 0 orphans |
| gov_notice_versions / events / sources | | 0 orphans |
| user_roles, role_permissions, sessions, credentials | | 0 orphans |

## 3. Questions (787)

SQL: `select status,verification,count(*) from questions group by 1,2`, etc.

- Status/verification: DRAFT/VERIFIED 787. Origin AI_ASSISTED 787, not flagged as demonstration. Language en 787.
- Types: MCQ_SINGLE 517, ASSERTION_REASON 104, DIAGRAM_BASED 71, STATEMENT_BASED 53, MATCH_THE_FOLLOWING 42.
- Subject: all 787 are Physics (`paper_cuet_ug_2026_322`). 193 of 194 papers have no questions.
- Options: every question has exactly 4 options labelled A,B,C,D at positions 1 to 4 (`select l,count(*) ... group_concat(label)` gives `A,B,C,D` = 787). No empty option text. No duplicate option text within a question.
- Answer keys: 787 keys, each a single position in {1,2,3,4}. Spread is 197 / 202 / 202 / 186 for A, B, C, D (balanced). No numeric or multi-answer keys exist.
- Stems: 0 empty, shortest 31 chars (none under 25), mean 182. Explanations: 0 empty, 0 under 40 chars, min 132, mean 304, max 527. No TODO, placeholder or lorem text. Heuristic check for an explanation naming a different option letter than the key: 0 hits (this only catches explicit "option X" phrasing).
- Duplicate stems (normalised whitespace and case): 1 group, 2 questions: `q_8a9e4f1ddef6458d83765afff81dee18` and `q_c46e09e48c134cb690adb0e080fde3b8`. Both are MATCH_THE_FOLLOWING with the stem "Match each quantity in List-I with its SI unit in List-II" but different lists. This is a stem-wording duplicate only, not a content duplicate. Detail is in `dup_stems.json`.
- content_hash duplicates: 0.
- Questions with no curriculum node: 0. All 787 link to a SUBTOPIC node, one primary each.
- Bulk-approval consistency:
  - 1 batch (`bulk_3612053fd403404ab01ce640119dfe08`), `question_count` 786, status ACTIVE, with 786 items, all state ACTIVE and from_verification UNVERIFIED.
  - All 786 item questions are now VERIFIED. 0 items are orphaned.
  - The 1 remaining question, `q_2237f57e624c4a77ae417c39bf590c4e`, was verified individually (audit REVIEW_VERIFIED, review_records VERIFIED 1) and is not in the batch. This is consistent: 786 + 1 = 787.
  - Audit has 1 BULK_APPROVAL row (requested 786, applied 786).
  - review_records has QUESTION VERIFIED 786 + 1 and QUESTION EDITED 3.

## 4. Lessons and learning resources

- learning_resources: 31, all type LESSON, status DRAFT, UNVERIFIED, AI_ASSISTED, permission OWNED_ORIGINAL, all on SUBTOPIC nodes of the Physics paper.
- Resources without content blocks: 0 (min 29, mean 53.7, max 107 blocks per lesson). No duplicate block positions. No empty blocks.
- Block types: HEADING 252, FORMULA 227, DEFINITION 143, DIAGRAM 121, CALLOUT 92, IMPORTANT_FACT 48, CONCEPT 16, EXAMPLE 10.
- Duplicate lesson titles: 0 (`group by lower(trim(title))`).
- Broken references: 0 (section 2).
- media_assets: 121 SVG diagrams (DRAFT, UNVERIFIED, AI_ASSISTED) and 1 PNG (official source figure `med_a677e56357bf46d288e138f03427ae3a`). All have alt text. No duplicate sha256 or r2_key. The PNG is not used by any block or question (low, a stored source figure).
- Visual lessons: the app has one hard-coded visual lesson, `/visual/gravitation` (frontend/src/pages/Visual.tsx). Its file `frontend/public/visual/gravitation.pdf` exists, is a valid PDF with 6 pages, and has the %PDF magic. It is not stored in the DB, and no other visual lesson files exist.
- Repo content packs:
  - `content/packs/CUET_UG/322` holds 31 lesson JSON files and the diagrams.
  - Of the 145 SVGs in the packs, 121 match DB media by sha256.
  - The other 24 are all in `content/packs/CUET_UG/306/diagrams` (Chemistry). There is no Chemistry lesson JSON and nothing in the DB for them. They are orphan repo files, not an error.

## 5. Revision and concept cards (flashcards, 8)

- All 8 are FORMULA cards for one user and one lesson (`res_6791ea4f...`), question_id null on all. All have reviews: 4 GOOD and 4 AGAIN, one review each, dated 2026-11-13.
- Cards whose question, lesson or node no longer exists: 0. Duplicate (user, concept_key): 0.
- Due dates: all 8 due 2026-11-14, so all 8 are overdue as of today (2026-11-16). This is expected for a test user.
- Interval, ease and review checks: ease and interval are within bounds. `reps` differs from the review count on 4 cards. These are the AGAIN ones, where reps resets to 0, which is normal SM-2 behaviour (not a defect).
- **Finding F-FC (low):** `back` is an empty string on all 8 cards (`select count(*) from flashcards where trim(back)=''` = 8). The `latex` column is populated on all 8, so the back may be rendered from `latex`. This needs a check in the UI. If the back is blank when shown, the cards are unusable.
- The question-based "question cards" feature (migration 0027) has 0 rows.

## 6. Mock, topic and test papers

- test_papers 194, all DRAFT: 157 CUET_PG, 37 CUET_UG. Configured sizes are 75 questions (157 papers) and 50 questions (37 papers).
- The 23 papers whose name repeats (for example English, Chemistry) repeat only across CUET_UG and CUET_PG (`select code,name,count(*) ... group by 1,2 having count(*)>1` = 0 within an exam). No duplicate code or name within an exam.
- Papers with zero questions: 193 of 194. This is a content-coverage gap, not a data error.
- Size mismatch: `paper_cuet_ug_2026_322` Physics is configured for 50 questions but its bank holds 787. This is expected for a question bank, but note that no paper-assembly check enforces 50.
- mock_papers, mock_paper_questions, past_papers, past_paper_questions, review_assignments: all EMPTY. These checks do not apply yet.
- practice_sessions: PRACTICE 8 and TOPIC_TEST 2, all SUBMITTED.
- extraction_jobs: IMPORTED/SUCCEEDED 152, VALIDATED/SUCCEEDED 40, VALIDATED/PENDING 2.
- **Finding F-EXT (medium):** the 2 PENDING jobs are `job_19e3760ed91f48f2b59e9be9f9cc003d` (paper_cuet_pg_2026_scqp29: 5 of 10 rows fail the record-level check) and `job_74eb7eed03054e549ba664e51a96b222` (paper_cuet_pg_2026_coqp22: 17 of 22 rows fail). Both have blocker_reason "heading_inferred_from_formatting".
- syllabus_versions: none are PUBLISHED. DRAFT/MACHINE_VERIFIED 153, DRAFT/UNVERIFIED 40, DRAFT/VERIFIED 1, ARCHIVED 153. At most one live version per paper (0 papers have more than one non-archived version).
- curriculum_nodes: MACHINE_VERIFIED 5,480, UNVERIFIED 3,879, VERIFIED 8 (`select verification,count(*) from curriculum_nodes group by 1`). No orphan parents.

## 7. PDFs, images and storage

SQL: `select key,blob_id,size from _mf_objects` in each R2 metadata DB, compared with `source_documents.r2_key`, `media_assets.r2_key` and `pyq_documents.r2_key`. Files were checked for existence, size match, magic bytes, sha256 against the key name, and pypdf. Detail is in `r2_objects.json`.

- Two local R2 buckets exist. `cuet-platform-media-dev` is the default dev binding (wrangler.jsonc line 33) and has 317 objects. `cuet-storage` is the other environment's binding (line 90) and has 265 objects.
- Every object's blob file exists (0 missing blobs, 0 unreferenced blobs), and sizes match the metadata (0 mismatches). All magic bytes are OK (PDF %PDF, SVG, PNG). sha256 of content equals the sha in the key name for every `sources/` and `media/` object (0 mismatches).
- media-dev holds 194 `sources/` PDFs, 122 SVG/PNG media and 1 practice PDF (`media/c64040f4...aedd02372a411aab.pdf`, 11 pages, 354,472 bytes). The practice PDF is the only row with `pyq_documents.r2_key` (1 of 335).
- cuet-storage holds 194 `sources/` PDFs and 71 `media/` SVGs.
- pypdf: all 194 source PDFs in each bucket open without error. 0 corrupt. Total pages 546, min 2, max 10. This matches `source_documents.page_count` exactly (0 mismatches). byte_size also matches on all.
- DB rows pointing to missing files:
  - source_documents: 0 missing in either bucket.
  - media_assets: 0 missing in media-dev, **55 missing in `cuet-storage`**.
  - pyq_documents: 0 missing in media-dev, 1 missing in `cuet-storage` (the practice PDF).
- Files with no DB row: media-dev 0. `cuet-storage` has 4 objects with no DB row (e.g. `media/79640514...fc4f1e.svg`, `media/410f3dc6...c2c8.svg`, `media/f0945307...2567.svg`). These are stale diagrams from an earlier import.
- 261 keys exist in both buckets. `cuet-storage` is a stale subset and is not what local dev reads.
- Repo folders:
  - `frontend/public` contains one file, `visual/gravitation.pdf` (valid).
  - `content-ingestion` contains `registry/` (3 JSON files), `src`, `scripts` and `test`, no content files.
  - `D:/cuet-platform/storage` (325 MB) holds the cache and local files: 256 pdf, 607 png, 1171 json, 27 traineddata. I did not cross-check these individually (they are an ingestion cache, not referenced by DB keys).
  - `content/` holds 52 JSON, 145 SVG and 2 CSV.
- pyq_documents (335 rows): 305 are `working=1, embeddable=0` (external links, not stored), 27 are `working=0` (HTTP -1, all `www.adda247.com`), 3 are embeddable. Classification: OFFICIAL 86 (83 papers + 3 keys), THIRD_PARTY_COPY 196, MEMORY_BASED 27, SAMPLE 25, CUET_PREP_ORIGINAL 1. `replaced_by_key` references: 0 dangling.
- **Finding F-PYQ (medium, rights risk):** 196 rows are THIRD_PARTY_COPY (aglasem.com 136, selfstudys.com 85 hosts, among others). They are only links, not stored. Make sure they are not shown as official.
- **Finding F-PYQ2 (low):** 27 adda247 links are dead (`working=0`).

## 8. University and admissions

- admission_sources 3 (DU, BHU, JNU), all APPROVED, `personal_data_risk` LISTS_LINKED, recommendation USE_WITH_CARE.
- admission_programmes 109 (DRAFT 105, PUBLISHED 4). admission_facts 186 (DRAFT 178, PUBLISHED 8); kinds ELIGIBILITY 111 and SUBJECTS 75.
- Facts without a source: 0. Programmes without a source: 0. Published facts or programmes citing a non-approved source: 0 (all sources APPROVED).
- Published fact whose programme is not published: 0 (7 published facts / 7 published programmes; the 8th published fact has no programme).
- Published rows with no published_by or published_at: 0. Published facts with no page or locator: 0, with no checked_on: 0.
- Duplicates: 0 duplicate programmes, 0 duplicate facts, 0 programmes whose university name differs within a slug.
- **Finding F-ADM (low):** 2 facts have `programme_id` NULL: `afact_fab71c636d3a475f94e4b00ebfecfe8f` (DRAFT, common eligibility) and `afact_28d6fcad3f1249eeac05a0d580da18d1` (PUBLISHED, CUET subject lists). These are university-level facts by design (probably). Confirm the UI can show a fact without a programme.
- review_flag text is present on 8 draft facts (known caveats, e.g. BHU "FINAL DRAFT" bulletin with a 2025/2026 tie-break year conflict and unverified B.Voc duration). These are review notes, not defects. Only the 8 published facts are reportable as live.
- participating_universities 442: CUET_UG 244 (Central 49, Deemed 27, Other Govt 7 and others) and CUET_PG 198. Cycle is 2026 for all. No duplicate (exam, cycle, name) and no near-duplicates by the 0.93 spelling-similarity test (`near_dup_universities.json` is empty).
- **Finding F-TYPE (low):** the type labels are inconsistent between exams. UG uses "Central University", "Deemed University" and "Other Government Institution". PG uses "Central", "Deemed", "Government Institution", "Private" and "Fully funded Deemed University". This is cosmetic but breaks filtering across exams. Fix: add a normalised type column or a mapping in the UI.
- official_info_items 231 (UG 125, PG 106). 15 have a null source_url, all in section `not-yet-published`. This is probably intended.
- official_notices 51 with no duplicate URLs.

## 9. Notices

- gov_notices 81: all PUBLISHED and auto_published=1. Authority NTA 81 (sources: cuet-ug-public-notices 24, cuet-pg-website 10, nta-notice-board 47). CUET_UG 51 and CUET_PG 30. Categories: APPLICATION 18, ADMIT_CARD 13, ADVISORY 9, EXAM_SCHEDULE 9, plus ANSWER_KEY, CITY_INTIMATION, GENERAL and RESULT at 8 each.
- Versions/events consistency: 81 versions and 81 events, each notice has exactly 1 of each, version_count matches in all 81, the latest event status equals the notice status in all 81, 0 duplicate (notice, version), 0 orphans.
- Duplicates: 0 duplicate document_url and 0 duplicate content_hash. There are 17 groups of notices with the same title (34 notices). `duplicate_of_id` is set on 26 notices, and all 26 are still PUBLISHED. 3 title groups have no duplicate marking at all. Detail is in `gov_notice_dup_titles.json`.
- **Finding F-GN1 (medium):** 26 notices marked `duplicate_of_id` are still `PUBLISHED`. If the student view lists them, students see the same notice twice. Check that the student query filters `duplicate_of_id is null`. Safest fix: do not delete. Set them to a non-public status, or filter in the read query.
- **Finding F-GN2 (low):** all 81 are auto-published with no human review, and 0 `revision_of_id` is set even where same-title notices have different URLs. This is by design (auto_published) but is worth knowing.
- **Finding F-GN3 (low):** source `ugc-home-notices` (UGC) has never succeeded (`last_success_at` NULL, 0 consecutive failures, 0 notices from it).

## 10. Students and progress (counts only)

- users 4, all ACTIVE, none with a verified email (`email_verified_at` null on 4). Roles (user_roles 7): STUDENT 4, SUPER_ADMIN 2, REVIEWER 1. No user without a role or credentials. No duplicate emails (case-insensitive).
- user_sessions 17 (11 revoked, 0 expired).
- practice_sessions 10 (PRACTICE 8, TOPIC_TEST 2), all SUBMITTED. practice_answers 46 (CORRECT 12, INCORRECT 34).
- Checks all 0: answers with a missing session or question, answers for questions not in the session, duplicate (session, question), submitted sessions without score/max_score/submitted_at, non-submitted sessions with submitted_at, correct_count not matching answers, counts not summing to the question count, submitted before started.
- topic_progress 2 rows (attempted 6/40) reconcile exactly with practice_answers for the same user and node. No orphan nodes or users.
- study_plan_items 6 and learning_activity 36 (LESSON_VIEW 8, TOPIC_VIEW 28): no orphans. daily_goals, student_preferences: EMPTY.
- Because all 4 emails are unverified and there are 2 super-admin assignments, treat this DB as a dev DB only.

## 11. Email and billing

- email_messages 1: SENT, kind PASSWORD_RESET, provider cloudflare, attempts 1, retry_count 0, no error, sent_at set. email_suppressions 0. password_reset_tokens 1 (not used, not expired, user exists). email_verification_tokens 0.
- plans 4: FREE (active, price 0) and MONTHLY, QUARTERLY, YEARLY (inactive, price 0). These match the "payments built and OFF" status.
- subscriptions, payment_orders, payment_transactions, payment_events: all EMPTY, so order/subscription/transaction consistency, overlapping subscriptions and orders without users cannot be tested. I did not run those and make no claim about them.

## 12. Audit logs and migrations

- audit_logs 1484 rows, 1484 distinct ids, all `detail_json` valid JSON, range 2026-11-12 to 2026-11-16. By action: CREATE_QUESTION 787, IMPORT_SYLLABUS 350, CREATE_MEDIA 121, MACHINE_VERIFY_SYLLABUS_VERSION 113, CREATE_RESOURCE 31, SOURCE_DOCUMENT_ISSUE 24, REGISTER_PAPERS 16, IMPORT_OFFICIAL_DIRECTORY 14, ROLE_GRANTED 5, REVIEW_VERIFIED 5, IMPORT_OFFICIAL_PAPERS 3, ADMISSION_SOURCE_APPROVED 3, ADMISSION_PACK_IMPORTED 3, IMPORT_OFFICIAL_INFO 2, ADMISSIONS_PUBLISHED_LOCAL 2, and single rows for SOURCE_FIGURE_STORED, REQUEST_RESET_LINK, CREATE_NATIVE_DOCUMENT, BULK_APPROVAL and ADMISSION_PAGE_REFERENCES_CORRECTED.
- Every CREATE_QUESTION entity exists and every question has exactly one CREATE_QUESTION row. All CREATE_MEDIA and CREATE_RESOURCE entities exist. Questions have no audit row for their individual VERIFIED action except the 1 individually verified question; the 786 are covered by BULK_APPROVAL (no per-question audit rows, by design, plus review_records 786).
- Actors: admin:content-cli 939, admin:syllabus-review 264, admin:ingestion-cli 212, admin:import-missing 28, admin:official-directory-cli 17, a user 9.
- d1_migrations: 33 rows, ids 1 to 33 in order, the name prefix equals the id for every row (0 gaps, 0 out-of-order). Applied 2026-11-12 07:05:40 to 2026-11-16 08:11:46. The file list in `database/migrations/*.sql` (0001 to 0033) is identical to the applied list: missing 0, extra 0. I compared names only, not file contents or checksums.
- Note: the two stale local DBs have only 7 migrations. If a tool points at them, it will fail on missing tables. Safest fix: delete or archive them after you confirm no config uses their hash.

## 13. Problem list with severity and safest fix (not applied)

| ID | Problem | Count / examples | Severity | Safest fix |
|---|---|---|---|---|
| P1 | All content is DRAFT and nothing is published; questions are VERIFIED but their explanations are all UNVERIFIED | 787 questions VERIFIED, 787 explanations `DRAFT/UNVERIFIED`, 31 lessons DRAFT | High before launch | Decide a publish rule (explanation verified before question published). Run the bulk approval for explanations the same way, with a sampled human check |
| P2 | Content coverage: only Physics UG 322 has questions; 193 of 194 papers empty; no mock/past papers | 193 papers | High (product), no data error | Content plan, not a data fix |
| P3 | Bulk approval was an automated format check on AI-assisted questions, with no source document | `source_document_id` null on 787; `answer_keys.verified_by` null on 787 | Medium | Add reviewer sampling per batch before publishing; record verified_by when approved |
| P4 | Two extraction jobs stuck PENDING | `job_19e3760e...`, `job_74eb7eed...` | Medium | Review the 5/10 and 17/22 failing rows, then re-run validation |
| P5 | Duplicate-marked notices still PUBLISHED | 26 of 81 | Medium | Filter on `duplicate_of_id is null` in the read API, or set those rows to a hidden status |
| P6 | Third-party PYQ links, 27 dead | 196 THIRD_PARTY_COPY, 27 `working=0` | Medium (rights/UX) | Keep them off the official lists; re-check links; drop the dead adda247 rows |
| P7 | Local R2 `cuet-storage` is stale | 55 media rows missing, 4 files with no DB row | Low (not the dev bucket) | Re-run media sync for that bucket, or ignore it; do not delete until the production binding is confirmed |
| P8 | Flashcard `back` empty | 8 of 8 | Low (check UI) | Confirm rendering from `latex`; if blank in the UI, fill `back` at card creation |
| P9 | Admission fact without programme | 2 facts | Low | Confirm the UI handles university-level facts |
| P10 | Inconsistent university type labels UG vs PG | 11 labels | Low | Normalise in a mapping |
| P11 | 24 Chemistry diagrams in the repo with no lessons or DB rows | `content/packs/CUET_UG/306/diagrams` | Low | Add Chemistry lessons or move the files out |
| P12 | Only 1 duplicate stem pair (different match lists) | `q_8a9e4f1d...`, `q_c46e09e4...` | Low | Make the stem unique ("...SI unit, set 1/2") |
| P13 | UGC notice source never succeeds | 0 notices | Low | Check the source URL/parser |
| P14 | Stale DBs with 7 migrations | 2 files | Low | Archive them |

## 14. Not checked (stated honestly)

- Subscriptions overlapping or ending before start, orders without users, and order/transaction consistency: tables are empty, so these were not exercised.
- Mock, past and topic test paper item checks: tables are empty.
- Correctness of the physics content, such as whether each answer key is scientifically right. Only structure, counts and format were checked.
- File contents under `D:/cuet-platform/storage` and `content/official-papers` were not individually validated.
- Migration SQL contents versus the applied schema were not compared. Only names and order were.
