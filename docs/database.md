# Database (Cloudflare D1)

## Design

- **D1 is SQLite.** Enums and JSON are stored as text and validated by the API.
- **Media never lives in D1.** Rows hold R2 object keys (`sources/<sha256>.pdf`, `media/<sha256>.png`)
  and metadata only. Keys are content-addressed, so the same bytes are stored once.
- **Answer keys are in their own table** (`answer_keys`). Public endpoints never read it before an
  attempt; only the admin API and the scoring module do.
- **Every content row has a publishing status and a verification status.** Imports always create
  `DRAFT` / `UNVERIFIED` rows. Demonstration records can never be published.
- **Traceability.** Curriculum rows belong to a syllabus version, which points at the official source
  document (URL, SHA-256, retrieval time, R2 copy). Each row keeps its source page.
- **Multi-row writes are atomic.** D1 has no interactive transactions, so imports, question saves and
  review steps use `db.batch([...])`, which commits all statements or none. Re-runs are idempotent
  (idempotency keys, SHA-256 checks, unique content hashes).

Main groups of tables: exams and cycles; subject categories, subjects and test papers; syllabus versions
and curriculum nodes (section, unit, chapter, topic, subtopic, item, note); source documents, usage
permissions and source references; learning resources, content blocks, media assets, diagram labels and
passages; questions, options, answer keys, explanations, tags and topic links; review records, import
runs, extraction jobs, source tables and audit logs; users, roles and permissions.

## Migration workflow

Prisma Migrate does not support D1, so migrations are plain SQL files applied by Wrangler.

1. Change `database/prisma/schema.prisma`.
2. `npm run db:migration:new -- <short_name>` - rebuilds a scratch SQLite from the existing migrations
   and writes only the difference to `database/migrations/NNNN_<short_name>.sql`. Read it.
   It warns if the migration drops or rebuilds tables.
3. `npm run db:migrate:local` - apply to the local D1 (`backend/.wrangler/state`).
4. `npm test` - API tests apply all migrations to a throwaway D1 and exercise the schema.

Never edit a migration that has been applied anywhere except your own local copy.

## Remote development database (not created yet)

Only after explicit approval:

```bash
cd backend
npx wrangler d1 create cuet-platform-dev                 # prints the database_id
# put that id into wrangler.jsonc (it is not a secret), replacing the placeholder
npx wrangler d1 migrations list DB --remote              # inspect first: must be the new, empty database
npx wrangler d1 migrations apply DB --remote
npx wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

Before any destructive migration on a database that holds data: take a D1 Time Travel bookmark or an
export (`wrangler d1 export`), and review the SQL.
