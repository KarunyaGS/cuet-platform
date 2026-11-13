# Native CUET Prep documents

**Date:** 13 November 2026. Local development only; nothing is deployed.

A native document is a PDF CUET Prep generates itself, keeps in its own storage (R2) and shows in its own viewer, with zoom, page navigation and download.

## Rights come first

A document is generated only from content we may reproduce.

| Content | May it become a native document? |
|---|---|
| Our own questions (permission `OWNED_ORIGINAL`) | Yes. The server checks every question before the document is recorded |
| A previous-year paper on AglaSem, SelfStudys or NTA's site | Not without a permission on record. Today there is none, so each keeps its link to the source |
| Third-party content with permission | Yes, once the permission reference is recorded with the document (`PERMISSION_ON_RECORD`) |

`research/cuet-pyq-2024-2026/aglasem-rights-audit.csv` lists all 136 AglaSem records with year, subject, date, shift, language, source and rights status. Eligible today: 0.

No third-party paper is read, extracted or copied by this pipeline, and no third-party mark is removed from anything.

## Build a practice paper

```
npm run ingest -- native-paper-build --paper-id paper_cuet_ug_2026_322 --set 1
```

1. The server drafts the paper from our own questions, spread over the syllabus units; the answer key is kept apart.
2. The page is typeset by the Chrome on the machine (print to PDF); formulas by KaTeX; figures are our own media.
3. The PDF is stored in R2 and recorded. The content that went in is saved under `content/native-papers/`.

Each PDF says on its first page and in every footer that it is written by CUET Prep and is not a previous-year paper. While any question is unreviewed it carries "Preview: not yet reviewed" and is shown only where draft content is shown.

| Part | File |
|---|---|
| Draft, rights check, record, file serving | `backend/src/services/native-papers.ts`, `backend/src/services/pyq.ts` |
| Typesetting and upload | `content-ingestion/src/native-paper.ts` |
| Routes | `GET /api/admin/native-papers/draft`, `POST /api/admin/native-papers`, `GET /api/learn/pyq/documents/:id/file` |
| Columns | migration `0023_native_documents.sql` (`r2_key`, `review_state`, `rights_basis`) |
| Screens | "CUET Prep practice papers" in `frontend/src/pages/Pyq.tsx`; Download in `OfficialViewer.tsx` |
| Tests | `backend/test/native-papers.test.ts` |
