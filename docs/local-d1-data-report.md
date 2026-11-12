# CUET data in local D1 — collected vs stored (2026-11-12)

Local D1 only (`backend/.wrangler/state`). Nothing was written to remote Cloudflare. Backup taken before this
import: `D:\cuet-backups\20261112-154600` (SQL dump + raw state).

## 1. Collected vs stored

| Collected (files on disk) | Collected | In local D1 | Notes |
|---|---:|---:|---|
| Official papers (registry, checked against both NTA bulletins) | 194 (UG 37, PG 157) | 194 `test_papers`, 194 `subjects` | complete |
| Official syllabus PDFs (SHA-256) | 194 | 194 `source_documents`, 194 PDFs in local R2 | complete |
| Extracted syllabus rows (extraction datasets) | 4,733 | **4,718** current rows (+15 in 2 archived versions) | 2 exact repeats merged on import (UG 323, PG COQP08); 13 unreadable OCR rows of blocked papers left out on purpose |
| Papers with syllabus rows | 194 | 194 | the 3 blocked papers hold only their machine-readable rows (11) |
| Page texts (text layer, pdftotext, OCR) | 546 pages | 1,107 `source_page_texts` | every non-empty text of every page |
| Visual (OCR) check per page | 546 | 546 `source_page_checks` | |
| Figure cut from a PDF | 1 | 1 `media_assets` (OFFICIAL_SOURCE) | Lepcha p.2 image, linked to its row |
| Verification evidence | 92 papers + corrections | 1,719 `verification_evidence` | |
| Problems in NTA's own PDFs | 7 issues → 24 paper entries | 24 `audit_logs` (`SOURCE_DOCUMENT_ISSUE`) | |
| Extraction pipeline per paper | 194 | 194 `extraction_jobs`, 199 `import_runs` | |
| Review drafts (failed automatic checks) | 99 papers | 99 draft versions (UNVERIFIED) | LAQP25, LAQP28 v1 archived, v2 from OCR re-read |
| Page-image review files (paused task) | 6 partial, unvalidated | **not imported** | resume needs your go-ahead |

## 2. Statuses (current versions)

| | UG | PG | Total |
|---|---:|---:|---:|
| Syllabus versions MACHINE_VERIFIED / UNVERIFIED | 21 / 16 | 71 / 86 | 92 / 102 |
| Rows MACHINE_VERIFIED | 647 | 1,076 | 1,723 |
| Rows UNVERIFIED (review drafts + blocked papers) | 643 | 2,352 | 2,995 |
| Rows VERIFIED by a person | 0 | 0 | **0** |

Rows by level: units/sections 708 · topics 1,490 · subtopics 1,205 · items 1,083 · notes 232.
Independent OCR words found in stored rows: 58,430 / 58,604 (99.70%). Per-paper detail:
`storage/local/audit/scraping-audit.csv`.

## 3. Table-wise row counts (local D1, 43 tables)

| Group | Table | Rows |
|---|---|---:|
| Exams and papers | exams | 2 |
| Exams and papers | exam_cycles | 2 |
| Exams and papers | subject_categories | 9 |
| Exams and papers | subjects | 194 |
| Exams and papers | test_papers | 194 |
| Official documents | source_documents | 194 |
| Official documents | source_references | 196 |
| Official documents | source_page_texts | 1,107 |
| Official documents | source_page_checks | 546 |
| Official documents | source_tables | 0 |
| Syllabus | syllabus_versions | 196 |
| Syllabus | curriculum_nodes | 4,733 |
| Syllabus | curriculum_relations | 0 |
| Pipeline and evidence | extraction_jobs | 194 |
| Pipeline and evidence | import_runs | 199 |
| Pipeline and evidence | verification_evidence | 1,719 |
| Pipeline and evidence | review_records | 1,632 |
| Pipeline and evidence | audit_logs | 900 |
| Media | media_assets | 87 |
| Media | diagram_labels | 0 |
| Content (from earlier, not syllabus) | learning_resources | 21 |
| Content (from earlier, not syllabus) | content_blocks | 1,206 |
| Content (from earlier, not syllabus) | questions | 552 |
| Content (from earlier, not syllabus) | question_options | 2,208 |
| Content (from earlier, not syllabus) | answer_keys | 552 |
| Content (from earlier, not syllabus) | explanations | 552 |
| Content (from earlier, not syllabus) | question_topics | 552 |
| Content (from earlier, not syllabus) | question_tags | 0 |
| Content (from earlier, not syllabus) | question_media | 0 |
| Content (from earlier, not syllabus) | tags | 0 |
| Content (from earlier, not syllabus) | passages | 0 |
| Accounts and practice | users | 3 |
| Accounts and practice | user_credentials | 3 |
| Accounts and practice | user_roles | 4 |
| Accounts and practice | user_sessions | 3 |
| Accounts and practice | practice_sessions | 1 |
| Accounts and practice | practice_answers | 6 |
| Accounts and practice | topic_progress | 1 |
| Reference and access | usage_permissions | 7 |
| Reference and access | roles | 6 |
| Reference and access | permissions | 9 |
| Reference and access | role_permissions | 23 |
| Reference and access | d1_migrations | 8 |

## 4. Integrity

- 22/22 traceability checks PASS on 4,718 current rows (`npm run ingest -- trace`), including: every row has its
  parent, version, document and paper; depths consistent; pages inside their PDF; no duplicate rows; no VERIFIED
  without a signed-in reviewer; every stored row matches the extraction dataset field for field; every
  machine-verified row's words are on its cited PDF page; every source PDF present in local R2.
- `PRAGMA foreign_key_check`: 0 violations.
- Idempotency: running the import twice adds nothing (second run: 0 rows, 0 page texts, 0 issues, 0 figures).
- Additive only: the import inserted rows; no existing row was changed or deleted (table diff before/after).

## 5. Not in D1, and why

- 13 OCR rows of the Kashmiri and Urdu papers: unreadable (English OCR on Nastaliq script); kept in the dataset.
- Those papers' syllabus body (and Lepcha's image text): needs transcription from the page images.
- 99 papers' structure/wording not confirmed by machine checks, and 7 machine-verified papers whose syllabus is
  stored as one long body under an instruction line: the page-image review that fixes these is paused.
- 0 rows human-verified.
