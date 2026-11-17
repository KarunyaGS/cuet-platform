# Internal review preview (16 Nov 2026)

A separate Worker for walkthroughs, with demo data only. **Nothing here is shared with production.**

| | Preview | Production |
|---|---|---|
| Worker | `cuet-prep-preview` | `cuet` |
| Database | `cuet-prep-preview-db` | `cuet-db` |
| Storage | `cuet-prep-preview-storage` | `cuet-storage` |
| Address | https://cuet-prep-preview.ceo-3a7.workers.dev | (unchanged) |

Config: `env.preview` in `backend/wrangler.jsonc` (purely additive). Payments, email, notice fetching and cron are off. The site sends `X-Robots-Tag: noindex`.

## What is in the preview
- Everything except people's data: syllabus, 787 Physics questions, 200 Chemistry questions and 10 Chemistry lessons, notices, admissions, universities, plans, 6 sample PDFs (3 NTA, 3 SelfStudys). Documents whose PDF was not uploaded keep their record but are hidden.
- Accounts: only two synthetic demo accounts (student, admin). **The address is public: anyone who opens it can also sign up**; those sign-ups live only in the preview database.

## Rebuild the data
```
python backend/scripts/preview-load.py build  <work-dir>   # demo-only copy of the local data
python backend/scripts/preview-load.py wipe   <work-dir>   # empty the preview content tables
python backend/scripts/preview-load.py load   <work-dir>   # load into the preview database
python backend/scripts/preview-load.py grant  <work-dir>   # restore the demo roles (a wipe cascades through roles)
python backend/scripts/preview-load.py compare <work-dir>  # row counts must match
python backend/scripts/preview-upload.py <work-dir>        # sample PDFs, lesson images, source documents
```
Deploy: build the frontend, copy `frontend/dist` to `frontend/dist-preview` with the extra header, then `wrangler deploy --env preview` (from `backend/`).

## Remove everything
```
python backend/scripts/preview-cleanup.py            # shows what would go
python backend/scripts/preview-cleanup.py --confirm  # deletes the Worker, the bucket (emptied first) and the database
```
