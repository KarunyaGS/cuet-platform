# Previous-year papers found on public websites

**Date:** 13 November 2026. Local development only; nothing is deployed.

Students open `/pyq` (from Practice Centre): Year, then Subject, then that subject's papers, the year's answer key and sample papers. Every "Open paper" opens the paper itself.

- **Nothing is copied or hosted.** `content/pyq/index.json` holds addresses and facts only. It is built by `research/cuet-pyq-2024-2026/build_index.py` and `build_extra.py`, then loaded with `npm run ingest -- pyq-index-import`.
- **A document is listed only with a destination that opened when checked.** Links a site's robots rules did not allow to be checked (Adda247) are listed and say so.
- **Inside CUET Prep or on the source:** a file is shown in the viewer here only when its own host lets other websites read it and `PYQ_IN_APP_VIEWING` is `on` (on locally, off in the production configuration). The student's browser then loads it straight from that host. Today that applies to NTA's 2025 and 2026 final answer keys. Every other paper opens on its source's page in a new tab; no file passes through our server.
- **Labels:** "NTA's own file" only for files on NTA's website; "Copy on <site>"; "Memory-based"; "Sample paper". Dates, shifts and languages appear only where the source or the file states them.
- **One record per paper:** where NTA hosts a paper itself, a third-party copy of it is kept as another address, not shown as a second paper.

| Part | File |
|---|---|
| Table | migration `0022_pyq_documents.sql` (additive) |
| Import, lists, viewer rule | `backend/src/services/pyq.ts` |
| Routes | `GET /api/learn/pyq`, `/api/learn/pyq/:year/:slug`, `/api/learn/pyq/documents/:id`; `POST /api/admin/pyq-index` |
| Screens | `frontend/src/pages/Pyq.tsx` (uses the viewer in `OfficialViewer.tsx`) |
| Tests | `backend/test/pyq.test.ts` |
