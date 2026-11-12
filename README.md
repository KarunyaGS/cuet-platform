# CUET Platform

Preparation platform for **CUET-UG** and **CUET-PG**, built on Cloudflare Workers, D1 and R2.

Current stage: **official syllabus acquisition and verification.** The pipeline discovers, downloads,
extracts and audits every official NTA syllabus PDF. Nothing is imported into a database until the
audit is reviewed, and every extracted row stays `UNVERIFIED` until a person checks it.

## Rules this codebase follows

- **No live LLM.** Students' answers are evaluated from stored answer keys with deterministic code
  (`backend/src/services/scoring.ts`). Explanations come from stored, reviewed records.
- **No invented syllabus content.** Rows come only from official NTA documents, with page references.
  Scanned pages are read by local OCR (Tesseract), and low-confidence text is flagged, never guessed.
- **UG and PG are separate exams** with separate papers, cycles and marking rules.
- **Local first.** Development uses Wrangler's local D1 and local R2 simulation. No remote Cloudflare
  resource is created or changed by any script here.

## Layout

| Folder | What it holds |
| --- | --- |
| `database/` | Prisma schema (SQLite provider for D1), ordered SQL migrations, Prisma client factory |
| `backend/` | Cloudflare Worker API (Hono): imports, review, coverage, question bank, scoring |
| `content-ingestion/` | Offline pipeline: discover, download, extract (pdf.js + local OCR), validate, audit, import |
| `frontend/` | Admin interface (React + Vite + Tailwind) - not built yet |
| `storage/` | Local, git-ignored working files (PDF cache, extracted results, review images, audit reports) |
| `docs/` | Database, ingestion and security notes |

## Local setup (Windows, no Docker, no local database server)

Requirements: Node 22.12+ (24 recommended), `pdftotext` optional (used only as an independent audit check).

```bash
npm install                                   # also generates the Prisma client
cp backend/.dev.vars.example backend/.dev.vars # then put a long random ADMIN_API_TOKEN in it
npm run db:migrate:local                      # creates the local D1 database and applies migrations
```

If drive C: is short of space, point npm's cache and temp files elsewhere first:
`npm_config_cache=D:/npm-cache TEMP=D:/tmp`.

## Syllabus pipeline

```bash
npm run ingest -- discover    # list official papers from NTA pages and check them against the bulletins
npm run ingest -- extract     # download, extract, OCR scanned pages, validate (resumable; one run at a time)
npm run ingest -- audit       # page-by-page reconciliation of every paper against its PDF
npm run ingest -- status      # summary of the last extraction
npm run dev:api               # start the local API (needed only for import)
npm run ingest -- import      # import into LOCAL D1 - refuses while any official paper is not extracted
```

Outputs land in `storage/local/` (results per paper, OCR page images for reviewers, `audit/audit.csv`).

## Tests and checks

```bash
npm run db:validate                    # Prisma schema
npm run typecheck                      # all workspaces
npm test                               # ingestion rules + API tests (API tests run in workerd with throwaway D1/R2)
```

## Remote Cloudflare

Not created. See `docs/database.md` for the exact, reviewed steps once creation is approved.
