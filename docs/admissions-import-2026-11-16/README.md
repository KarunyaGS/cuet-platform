# Admissions import pack, 16 November 2026

`pack.json` holds the three approved sources, 109 programmes and 185 facts that were loaded into the **local** development database as DRAFT. It is the record of exactly what was imported. Nothing in it is published, and it was never run against production.

- Delhi University: 73 programmes, 113 facts (eligibility and required subjects from the Bulletin of Information 2026-27, with PDF and printed page numbers).
- Banaras Hindu University: 11 programmes, 22 facts, every one flagged (the bulletin is a draft).
- Jawaharlal Nehru University: 25 UG and COP programmes, 50 facts; PG is not included.
- Excluded on purpose: cut-offs, dates, the ~150 B.A. combinations, BHU B.A. B.Ed. (NCET), BHU B.Voc and Performing Arts, JNU PG and B.Tech.

Check without writing: `cd backend && npx tsx scripts/import-admissions-pack.mts ../docs/admissions-import-2026-11-16/pack.json --check`.
