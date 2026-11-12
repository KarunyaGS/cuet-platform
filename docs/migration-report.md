# CUET production migration report (for approval)

Prepared 2026-11-12. **Nothing has been deployed and nothing has been written to `cuet-db` or `cuet-storage`.**
Every remote step below waits for explicit approval, and the scripts refuse to run without it
(`CUET_DEPLOY_APPROVED=yes`, `CUET_REMOTE_DATA_APPROVED=yes`).

## 1. Worker

| | |
|---|---|
| Name | `cuet` (exists; currently the manually uploaded Hello World, 1 deployment) |
| URL | https://cuet.ceo-3a7.workers.dev |
| Config | `backend/wrangler.jsonc`, environment `production` (`--env production`) |
| Code | `backend/src/index.ts` (Hono): `/api/learn`, `/api/auth`, `/api/student`, `/api/review`, `/api/admin`, `/api/public`, `/api/health` + the built React app as static assets |
| Vars | `APP_ENV=production`, `CONTENT_PREVIEW=true` (owner's decision, see 8.1), `MAX_PAGE_SIZE=100`, `MAX_UPLOAD_BYTES=26214400`, `SESSION_TTL_HOURS=168` |
| Secret | `ADMIN_API_TOKEN` (to be set with `wrangler secret put`; never in files) |
| Build check | `wrangler deploy --env production --dry-run`: 4,951 KiB, **1,423 KiB gzip** (Workers limit 3 MiB free / 10 MiB paid) |
| Local development | unchanged top-level config (`cuet-platform-dev`, local only, never deployed) |

## 2. D1 binding

`DB` → `cuet-db`, id `c2902e7e-d77a-49fc-ae05-f18a513df22a`. Checked read-only: it exists and is empty (only
Cloudflare's internal `_cf_KV`). Schema comes from `database/migrations/0001…0007` (Prisma-generated SQLite SQL,
applied by Wrangler, which records them in `d1_migrations`; migrations only create tables/indexes and insert
reference rows; 0007 replaces one index with a covering one, no data change).

## 3. R2 binding

`MEDIA` → `cuet-storage` (private, Asia Pacific, Standard). Checked read-only: it exists. Files are never public;
the Worker serves them: official PDFs only to signed-in reviewers (`/api/review/sources/:id/file`), lesson diagrams
and images to students only when published (`/api/learn/media/:id`, served with `nosniff` and a sandboxing CSP).
Key layout (content-addressed, so the same file is never stored twice and keys match D1 exactly):

| Prefix | Contents | Metadata in D1 |
|---|---|---|
| `sources/<sha256>.pdf` | official NTA syllabus PDFs (194) | `source_documents` |
| `media/<sha256>.svg/png/jpg/webp` | diagrams, labelled illustrations, images | `media_assets` (kind, alt text, caption, syllabus row) |

## 4. Tables and rows planned for migration

Export of the local development D1 (`backend/scripts/db-transfer.mjs export`), file sha256 starts `6b9c0e17d70d5674`.
Not copied: `d1_migrations` (Wrangler's own record) and `user_sessions` (development sign-in tokens must not work in
production; the account itself is copied and its owner signs in again).

| Group | Table | Rows |
|---|---|---:|
| Reference | exams | 2 |
| Reference | exam_cycles | 2 |
| Reference | subject_categories | 9 |
| Reference | usage_permissions | 7 |
| Reference | roles | 6 |
| Reference | permissions | 9 |
| Reference | role_permissions | 23 |
| Syllabus | subjects | 194 |
| Syllabus | test_papers | 194 |
| Syllabus | source_documents | 194 |
| Syllabus | source_references | 194 |
| Syllabus | extraction_jobs | 194 |
| Syllabus | import_runs | 194 |
| Syllabus | syllabus_versions | 194 |
| Syllabus | curriculum_nodes | 4706 |
| Syllabus | curriculum_relations | 0 |
| Syllabus | source_tables | 0 |
| Syllabus | source_page_checks | 546 |
| Syllabus | verification_evidence | 1719 |
| Content and questions | media_assets | 0 |
| Content and questions | diagram_labels | 0 |
| Content and questions | learning_resources | 0 |
| Content and questions | content_blocks | 0 |
| Content and questions | passages | 0 |
| Content and questions | tags | 0 |
| Content and questions | questions | 0 |
| Content and questions | question_options | 0 |
| Content and questions | answer_keys | 0 |
| Content and questions | explanations | 0 |
| Content and questions | question_tags | 0 |
| Content and questions | question_topics | 0 |
| Content and questions | question_media | 0 |
| Review and audit | review_records | 1627 |
| Review and audit | audit_logs | 206 |
| Accounts and progress | users | 1 |
| Accounts and progress | user_credentials | 1 |
| Accounts and progress | user_roles | 1 |
| Accounts and progress | practice_sessions | 0 |
| Accounts and progress | practice_answers | 0 |
| Accounts and progress | topic_progress | 0 |
| **Total** | **40 tables** | **10223** |

The 1 local account is a student test account created during development. Record statuses are copied exactly:
4,706 syllabus rows = 1,723 `MACHINE_VERIFIED` + 2,983 `UNVERIFIED` (review drafts and blocked-paper drafts);
0 `VERIFIED` (no person has signed off yet); every version stays `DRAFT`.

## 5. Compatibility

- All 7 migrations applied cleanly to a fresh database with the production configuration.
- Schema of the migrated copy vs local development: **115 objects (tables, indexes, constraints) identical**.
- Foreign keys: export ordered parents-first (computed from the schema) and loaded with deferred FK checks;
  `PRAGMA foreign_key_check` → **0 violations**.
- Worker bundle compiles for production with the D1 and R2 bindings above.

## 6. Local rehearsal (production configuration, separate local database and bucket)

| Step | Result |
|---|---|
| Backup of local D1 + R2 | `D:\cuet-backups\20261112-145801` (81 MB; SQL dump sha256 `1724b5d9…`) |
| Export | 41 tables, 10,224 rows (now 40 / 10,223 without dev sessions) |
| Migrations on fresh DB | 0001–0007 applied |
| Import | 10,225 statements, no errors |
| Row-by-row comparison | **41/41 tables identical** (35 byte-identical; 6 reference tables identical apart from their own migration timestamps) |
| Re-run import (idempotency) | no change (`INSERT OR IGNORE`: an existing row is never overwritten) |
| R2 upload through the Worker | 260 files (194 PDFs + 66 diagrams at that time), 0 failed, 0 checksum mismatches; re-run safe |
| 22 integrity checks on the migrated copy | **22/22 PASS** (incl. "every source PDF present in R2", "no VERIFIED without a signed-in reviewer") |
| API on the migrated copy | health `production`, D1 reachable, exams 2, auth cookie `Secure; HttpOnly`, admin/review/student 401 without credentials, SPA routes 200 |

## 7. Backup and rollback

- **Before import**: local backup above (keep private: it contains a password hash). Take a D1 Time Travel
  bookmark of the empty `cuet-db`: `npx wrangler d1 time-travel info cuet-db`.
- **Data rollback**: `npx wrangler d1 time-travel restore cuet-db --bookmark=<bookmark from before import>`
  (D1 keeps 30 days of history on the paid plan, 7 on free).
- **Code rollback**: `npx wrangler rollback --name cuet` (back to the previous version, i.e. Hello World),
  or `npx wrangler versions list --name cuet` and deploy a chosen version.
- **R2**: uploads are additive and content-addressed; nothing is overwritten with different bytes. Removing objects
  is a separate, explicitly approved step.
- Local development data is never modified by the transfer (`load` refuses the development database).

## 8. Open decisions and blockers

1. **What students see in production — decided 2026-11-12 (owner):** machine-verified syllabus and AI-assisted
   lessons/questions are shown without status labels (`CONTENT_PREVIEW=true`). Flagged or rejected items and
   unverified syllabus rows stay hidden; internal statuses are unchanged.
2. **Reviewer accounts** in production: sign up, then grant the role (`POST /api/admin/users/roles` with the token).
3. **Content packs** (lessons/questions/diagrams) are being written now; they are not in the export yet. Re-run
   export + import after they are imported locally (idempotent; nothing already reviewed is overwritten).
4. Admin token protection: recommended to put `/api/admin/*` behind Cloudflare Access in addition to the token.
5. Custom domain: not decided (the workers.dev URL works meanwhile).

## 9. Exact commands (run from `D:\cuet-platform`, in this order, only after approval)

```sh
# 0. bookmark the empty database (rollback point)
cd backend && npx wrangler d1 time-travel info cuet-db && cd ..
# 1. schema
npm run migrate:production -w @cuet/api                     # applies 0001…0007 to cuet-db
# 2. data (fresh export at that moment)
cd backend && node scripts/db-transfer.mjs export D:/tmp/cuet-full.sql
CUET_REMOTE_DATA_APPROVED=yes node scripts/db-transfer.mjs load D:/tmp/cuet-full.sql --target remote
node scripts/db-transfer.mjs compare --target remote        # must print identical: true, 0 FK violations
cd ..
# 3. secret + code
cd backend && npx wrangler secret put ADMIN_API_TOKEN --env production && cd ..
npm run build -w @cuet/web
CUET_DEPLOY_APPROVED=yes npm run deploy:production -w @cuet/api
# 4. files into cuet-storage through the Worker
CUET_ADMIN_TOKEN=<the secret> node backend/scripts/r2-transfer.mjs --api https://cuet.ceo-3a7.workers.dev
# 5. proof on production
CUET_D1_ARGS="--env production --remote" CUET_ADMIN_TOKEN=<the secret> npm run ingest -- trace --api https://cuet.ceo-3a7.workers.dev
curl https://cuet.ceo-3a7.workers.dev/api/health            # {"ok":true,"env":"production"}
```
