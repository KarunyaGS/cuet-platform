# Admissions import pack, 16 November 2026

`pack.json` holds the three approved sources, 109 programmes and 185 facts that were loaded into the **local** development database as DRAFT. It is the record of exactly what was imported. Nothing in it is published, and it was never run against production.

- Delhi University: 73 programmes, 113 facts (eligibility and required subjects from the Bulletin of Information 2026-27, with PDF and printed page numbers).
- Banaras Hindu University: 11 programmes, 22 facts, every one flagged (the bulletin is a draft).
- Jawaharlal Nehru University: 25 UG and COP programmes, 50 facts; PG is not included.
- Excluded on purpose: cut-offs, dates, the ~150 B.A. combinations, BHU B.A. B.Ed. (NCET), BHU B.Voc and Performing Arts, JNU PG and B.Tech.

Check without writing: `cd backend && npx tsx scripts/import-admissions-pack.mts ../docs/admissions-import-2026-11-16/pack.json --check`.

## Corrections the same day
- Page references on three groups of draft facts were corrected where the text starts on a different PDF page from the one first recorded (Delhi B.Sc. (Hons.) Mathematics, Delhi B.A. (Hons.) English, BHU B.Tech. Dairy Technology). `backend/scripts/correct-page-references-2026-11-16.mts` made the change in the local database (drafts only, audited); `pack.json` now matches.
- Student pages now open with a "historical reference only" banner; the list page and the university page carry the same warning.

## Local publication (16 November 2026)
Four Delhi programmes (B.Sc. (Hons.) Physics, B.Sc. (Hons.) Mathematics, B.A. (Hons.) Economics, B.Com. (Hons.)) and their seven facts were published in the **local** database as 2026-27 historical references, by `backend/scripts/publish-delhi-four-2026-11-16.mts` (it refuses to run unless the set is exactly four programmes and seven unflagged drafts). Everything else is still a draft. One more draft was added (the List A and List B lists the rules refer to). Student pages lay out each subject rule from the university's own wording: named subjects, languages, how many other subjects, and any separate test. Nothing was deployed or published to production.

## List A and List B published locally (16 November 2026)
The fact holding the Delhi List A (14 languages) and List B (22 subjects) lists was published in the **local** database after its wording was checked item by item against a fresh download of the bulletin (PDF p.20 / printed xvi: the 14 languages, the 22 subjects and the five sentences are identical; only the layout differs, because the PDF prints the languages in a four-column table). `backend/scripts/publish-delhi-lists-fact-2026-11-16.mts` did it. The university page shows it with the previous-cycle label. BHU and JNU records, flagged facts and cut-offs remain drafts.
