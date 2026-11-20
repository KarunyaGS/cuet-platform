# Admissions programme detail: sourced content pass (20 Nov 2026)

## Implemented locally

- Added a collapsed, three-step DU 2026–27 process guide on published DU programme pages. It summarizes CUET eligibility, the separate CSAS application/preferences, and how CUET and Class XII marks were used. It links to the official DU FAQ and CSAS schedule. The section is explicitly historical and does not show next-cycle dates.
- Eligibility and subject facts now show the structured combination first. The complete university wording is inside a second, collapsed disclosure so the programme page does not dump a long paragraph by default.
- Source locators containing an official PDF URL now expose an **Open cited document** link. The cited page/section remains beside the source and check date.
- Historical allocation-score rows now show the college/programme label, year, round, category, score basis, and document source.
- Added 16 **local DRAFT** facts to the four published Delhi programmes: one process and one counselling summary per programme, plus eight 2026–27 minimum allocation-score examples. None was approved or published.

## Official material checked

- DU Updated UG Admissions FAQ 2026–27: <https://admission.uod.ac.in/userfiles/downloads/2026/17052026_Updated_FAQsUG%202026-final.pdf>. Questions 11, 16 and 27 cover the separate CSAS form and preferences, CUET merit and Class XII tie-breaking. Other questions confirm that programme requirements are in the Bulletin and CUET papers must match subjects passed in Class XII.
- DU Admission Schedule for UG CSAS: <https://admission.uod.ac.in/userfiles/downloads/2026/02072026_CSAS-UG-Schedule_compressed.pdf>. Linked from the official admission portal; the document is retained as the authoritative schedule reference.
- DU Round III minimum allocation score 2026–27: <https://admission.uod.ac.in/userfiles/downloads/2026/09082026_Minimum_Allocation_Score_RoundThree.pdf>. PDF p.23, Ramjas College rows, UR column: Economics 807.1652, B.Com. (Hons.) 889.7461, Mathematics 715.7681, Physics 446.2456.
- DU Spot Round minimum allocation score 2026–27: <https://admission.uod.ac.in/userfiles/downloads/27-08-2026CutOff_UG_SpotRound.pdf>. PDF p.22, Ramjas College rows, UR column: Economics 802.757, B.Com. (Hons.) 878.8513, Mathematics 700.0825, Physics 443.5761.
- DU official notices hub: <https://admission.uod.ac.in/>. Round III and spot notices state their scores are independent from earlier rounds; spot figures appear only for programmes with a seat allocated in that round. These scores are not admission guarantees.

## Data safety

- Facts refer only to the 2026–27 cycle, now historical. They remain drafts, so the student API does not return them. They cannot alter eligibility results.
- The eight score rows are an initial, clearly college-specific sample for Ramjas College and UR. They are not the complete DU cutoff/allocation-score set. The source PDF has other colleges and categories that need a separate systematic extraction and reviewer check.
- Exact application registration/deadline dates have not been entered. The CSAS schedule PDF is linked, but its date table still needs extraction and a second-person check before import.
- No 2027–28 dates, cutoffs or eligibility rules have been inferred from the 2026–27 documents.

## Local import

`backend/scripts/prepare-delhi-2026-details.mts` is a local-only, dry-run-by-default importer. It uses the approved DU source, inserts only missing draft facts, and does not approve/publish anything. `--write-local` writes only to Wrangler's local D1 database.
