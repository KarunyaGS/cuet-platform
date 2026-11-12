# CUET-PG Syllabus Structure Audit

**Date:** 12 November 2026  
**Scope:** all 157 CUET-PG 2026 papers in the local database, their official NTA PDFs and the page-image review files  
**Type:** investigation only. No database records were changed.

## How this was checked

- **Database:** every row of every CUET-PG syllabus (3,428 rows) was exported read-only. Each row was checked for:
  - row type and parent;
  - depth, numbering and source page;
  - whether it sits inside the "Note" instruction box.
- **`curriculum_relations`:** it holds 0 rows for any exam. The syllabus hierarchy is stored only in `curriculum_nodes.parent_id`, and every parent link resolves (no orphans, no cross-version parents, no depth errors).
- **PDFs viewed directly for this audit:**
  - ACQP04, pages 1 and 2;
  - ACQP10, page 2;
  - ACQP08, page 2;
  - HUQP16, page 2;
  - SCQP23, page 8;
  - SCQP08, page 3.
- **Other papers:** their PDF structure is taken from the page-image review done earlier, in which every page of all 157 PDFs was compared with the stored rows. Those results are in `storage/local/syllabus-review/CUET_PG/`.
- **What students see** comes from `GET /api/learn/exams/CUET_PG/subjects`. It counts "units" as rows of type UNIT or CHAPTER, and "topics" as rows of type TOPIC, SUBTOPIC or ITEM.

## The two papers you reported

| Paper Code | Subject | PDF Structure | Database Units | Database Topics | Root Cause | Required Fix |
|---|---|---|---|---|---|---|
| ACQP04 | Baudha Darshan / Buddhist Studies (Trilingual) | No units. Page 2 lists 4 topics: 1 Metaphysics, 2 Logic and Epistimology, 1 Ethics, 2 Bauddha Culture (NTA numbers them 1, 2, 1, 2) | 0 | 4 (the screen shows 8) | "0 units" is correct: the PDF has none. "8 topics" is wrong: the 4 lines of the "Note" box are counted as topics. Also, the cover-page title (page 1) was stored as a row | Fix the counts (code). Import the page-image correction, which removes the cover-title row. Keep the 1, 2, 1, 2 numbering as printed |
| ACQP10 | Jain Darshan | No units. Page 2 lists 4 topics: 1 Metaphysics, 2 Logic, 3 Ethics, 4 Jain Culture | 0 | 4 (the screen shows 8) | "0 units" is correct: the PDF has none. "8 topics" is wrong: the 4 "Note" lines are counted as topics | Fix the counts (code) only. The data matches the PDF |

No unit headings were missed for these two papers. NTA’s documents list topics directly, so no units should be created.

## Root causes across all 157 papers

### A. Counting error on the subject list (code, all 157 papers)
- **Topics are overcounted.** Every CUET-PG PDF has the same "Note" box (75 questions, subject-specific, compulsory, language). Its 4 lines are stored as ITEM rows, and the subject list counts them as topics, so every PG paper shows 4 extra topics.
- **Sections are not counted.** Only UNIT and CHAPTER rows count as units, so papers organised in sections or parts also show "0 units".
- **The subject page shows flat syllabi as if they had units.** When a syllabus has no units, its left-hand "Units" column lists each topic as a unit, and the right side then says "This unit has no listed subtopics".

### B. Many official syllabi have no units (not an error)
According to the PDFs (page-image review):
- **Topics listed directly, with no units:** 96 papers.
- **Organised in sections or parts, with no units:** 22 papers.
- **Units:** 36 papers.
- **Units within sections:** 2 papers.
- **No readable text yet (Lepcha):** 1 paper.

"0 units" is correct for the first two groups and must not be "fixed" with invented units.

### C. Extraction errors in the stored data
| Error | Papers | Visible to students now | Fixed by the page-image corrections? |
|---|---|---|---|
| Syllabus topics stored inside the "Note" instruction box | 11 (COQP13, COQP19, HUQP03, HUQP05, HUQP06, HUQP10, HUQP15, HUQP23, HUQP24, SCQP20, SCQP28) | 10 | Yes |
| Whole syllabus stored as hidden text on a "Note" line | 10 (ACQP11, COQP20, HUQP09, LAQP25, LAQP32, SCQP16, SCQP18, SCQP19, SCQP24, SCQP26) | 7 | Yes |
| No text extracted (scanned or regional-script pages) | 5 (ACQP07, ACQP25, LAQP17, LAQP21, LAQP37) | 0 | Yes, except LAQP21 (Lepcha) |
| Cover-page title stored as a row | 40 | 19 | Yes |
| Unit headings missing | 10 (ACQP09, ACQP24, COQP02, COQP08, COQP14, HUQP22, LAQP03, LAQP13, LAQP17, LAQP24) | 0 | Yes; see the list below |
| Rows missing (numbering gaps) | 8 | 0 | Yes |
| Rows split or duplicated | 4 | 0 | Yes |

**Most serious:** 17 papers that students can open today show a syllabus with no topics, or with topics hidden in the "Note" box. Their syllabus text is stored in the wrong place.

Why the automatic checks passed these: they confirmed that every word of the PDF exists somewhere in the stored rows, but not that it sits under the right parent.

### D. Corrections are ready but not imported
- **Page-image review results:**
  - 123 papers corrected;
  - 3 transcribed;
  - 0 confirmed as stored.
- **Effect of importing them**, re-checked with the same rules:
  - cover-title rows: 40 → 0;
  - papers with no syllabus rows: 26 → 1 (Lepcha);
  - numbering gaps: 15 → 2 (both match the PDF).
- **One correction is wrong and must be fixed before import:** SCQP08 (Chemistry) prints "Unit-I", "Unit-II" and "Unit-III" under Molecular Spectroscopy & Photochemistry (PDF page 3). The database has these as units, but the correction turns them into topics.
- The review files also contain 34 open items in 18 PG papers, which need a person’s decision.

### E. Not errors: numbering exactly as NTA printed it
- **ACQP04:** 1, 2, 1, 2.
- **ACQP08:** 1–4, 1, 2.
- **HUQP16:** section II skips 6.
- **SCQP23:** sub-items a–d, f, g, g.
- **LAQP13:** lettered with Gujarati letters, which a number check misreads as a gap.

These must stay as printed.

## Unit headings in the PDFs that are missing from the database

These come from the page-image review. ACQP24 and COQP14 also store some headings merged with their text; those are not listed as missing.

**ACQP09, Indian Knowledge System (Trilingual)** (4 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | I | वैदिकसाहित्यस्य परिचयः Introduction to Vedic Literature | 2 |
| – | II | अनुप्रयुक्तं संस्कृतव्याकरणं साहित्यं च - Applied Sanskrit Grammar & L | 2 |
| – | III | अष्टादशानां पुराणानां परिचयः - Introduction to Puranas | 2 |
| – | IV | संस्कृतवाङ्मये विज्ञानम् - Science in Sanskrit | 2 |

**ACQP24, Vedanta, Sarvadarshan, Mimansa, Nyaya Etc.** (1 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | 12 | बौद्धदर्शनम् - | 2 |

**COQP02, Applied Geography and Geoinformatics** (8 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | – | Human Geography | 2 |
| – | – | General Cartography | 2 |
| – | – | Environmental Geography: | 2 |
| – | – | Geography of India | 2 |
| – | – | Economic Geography | 3 |
| – | – | Disaster Management | 3 |
| – | – | Geography of Tourism | 3 |
| – | – | Sustainability and Development | 3 |

**COQP08, Commerce** (25 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | – | Micro Economics | 2 |
| – | – | Currency and Banking | 2 |
| – | – | Essential of Management | 2 |
| – | – | Office Management | 2 |
| – | – | Accounting | 3 |
| – | – | Business Organization | 3 |
| – | – | Statistical Methods | 3 |
| – | – | Public Finance | 3 |
| – | – | Business Law | 3 |
| – | – | Cost Accounting | 3 |
| – | – | Company law and Secretarial Practice | 3 |
| – | – | Selling and Advertising | 4 |
| – | – | Business Mathematics | 4 |
| – | – | Insurance Law and Accounts | 4 |
| – | – | Insurance Law and Accounts | 4 |
| – | – | Income Tax Law and Accounts | 5 |
| – | – | Contemporary Audit | 5 |
| – | – | Indian Economic Structure | 5 |
| – | – | Marketing, Practice and Finance | 5 |
| – | – | Macro- Economics | 5 |
| – | – | Trade of India | 6 |
| – | – | Applied & Business Statistics | 6 |
| – | – | Law and Practice of Banking | 6 |
| – | – | Development Banking | 6 |
| – | – | Quantitative Economics | 6 |

**HUQP22, Sociology** (24 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| Basic Concepts in Sociology: | I | UNIT – I | 2 |
| Basic Concepts in Sociology: | II | UNIT – II | 2 |
| Basic Concepts in Sociology: | III | UNIT – III | 2 |
| Basic Concepts in Sociology: | IV | UNIT – IV | 2 |
| Social Processes and Problems: | I | UNIT – I | 2 |
| Social Processes and Problems: | II | UNIT – II | 2 |
| Social Processes and Problems: | III | UNIT – III | 2 |
| Social Processes and Problems: | IV | UNIT – IV | 2 |
| Society, Culture and Social Ch | I | UNIT – I | 2 |
| Society, Culture and Social Ch | II | UNIT – II | 2 |
| Society, Culture and Social Ch | III | UNIT – III | 2 |
| Society, Culture and Social Ch | IV | UNIT – IV | 3 |
| Indian Society: | I | UNIT – I | 3 |
| Indian Society: | II | UNIT – II | 3 |
| Indian Society: | III | UNIT – III | 3 |
| Indian Society: | IV | UNIT – IV | 3 |
| Social Research: | I | UNIT – I | 3 |
| Social Research: | II | UNIT – II | 3 |
| Social Research: | III | UNIT – III | 3 |
| Social Research: | IV | UNIT – IV | 3 |
| Social Problems in India: | I | UNIT – I | 3 |
| Social Problems in India: | II | UNIT – II | 3 |
| Social Problems in India: | III | UNIT – III | 3 |
| Social Problems in India: | IV | UNIT – IV | 3 |

**LAQP03, Sanskrit** (4 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | 1 | संस्कृतसाहित्येतिहासः– History of Sanskrit Literature | 2 |
| – | 2 | संस्कृतव्याकरणम् (Sanskrit Grammar) | 2 |
| – | 3 | संस्कृतकाव्यशास्त्रं छन्दशास्त्रश्च (Sanskrit Poetics and Prosody) | 2 |
| – | 4 | संस्कृतसाहित्यग्रन्थाः (Sanskrit Literary Works) | 2 |

**LAQP13, Gujarati** (1 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | 5 | વિશ્વસાહિત્ય/ તુલનાત્મક સાહિત્ય (World Literature / Comparative Litera | 2 |

**LAQP17, Kashmiri** (10 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | 1 | اکائی:1 | 2 |
| – | 2 | اکائی:2 | 2 |
| – | 3 | اکائی:3 | 2 |
| – | 4 | اکائی:4 | 3 |
| – | 5 | اکائی:5 | 3 |
| – | 6 | اکائی:6 | 4 |
| – | 7 | اکائی:7 | 4 |
| – | 8 | اکائی:8 | 5 |
| – | 9 | علم البلاغت | 5 |
| – | 10 | اکائی:10 | 5 |

**LAQP24, Manipuri** (4 missing)

| Section | Unit | Heading as printed | PDF page |
|---|---|---|---|
| – | II | ময়ায় চনবা মতমগী মণিপুরী সাহিত্য: | 2 |
| – | III | অনৌবা মণিপুরী সাহিত্য: | 2 |
| – | VI | ফোকলোরিস্তিক্স অমসুং মণিপুরী ফোকলোর: | 2 |
| – | IX | হন্দোকপা সাহিত্য: | 3 |

**COQP14, Law (LL.M.):** 71 of the 158 unit headings ("UNIT – I" to "UNIT – V" under each law subject, PDF pages 2–6) are missing. The other 87 are stored with their syllabus text merged into the heading. The full list is in `storage/local/syllabus-review/CUET_PG/COQP14/reviewed.json`.

## Required fixes (in order; nothing done yet)

1. **Code: correct what students see (no database change).**
   - Do not count rows inside the "Note" box.
   - Count sections and parts.
   - Describe each structure in words, for example "4 topics" or "5 sections, 43 topics", instead of "0 units".
   - On the subject page, show a flat syllabus as one list rather than a list of "units".
2. **Data: fix the SCQP08 review file** so Unit-I to Unit-III stay units.
3. **Data: import the page-image corrections into the local database** (126 papers).
   - Run this audit again afterwards.
   - Then import into the live database, only with your approval.
4. **Data: LAQP21 (Lepcha).** It needs a transcription from the page images, or a decision to leave it hidden.
5. **Pipeline: add checks so this cannot recur:**
   - the Note box may only hold its own instruction lines;
   - no long text attached to a Note line;
   - no cover-page rows;
   - warn when a correction turns printed "Unit" headings into topics.

## All 157 CUET-PG papers

"Shown now" is what the subject list displays today. "DB topics" excludes the 4 Note lines.

Every row also needs fix 1 (the counts). Papers marked "Structure matches the PDF" need nothing else.

| Paper Code | Subject | Students | PDF Structure | Database Units | Database Topics | Shown now | After corrections (units / topics) | Root Cause | Required Fix |
|---|---|---|---|---|---|---|---|---|---|
| ACQP01 | Shiksha Shastri (B.Ed.) | Hidden | Sections or parts, no units | 0 (+3 sections) | 0 | 0 units, 4 topics | 0 / 0 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| ACQP02 | Shiksha Acharya (M.Ed.) | Hidden | Sections or parts, no units | 0 (+3 sections) | 0 | 0 units, 4 topics | 0 / 0 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: cover-page title stored as a row | Import the page-image corrections |
| ACQP03 | Agama | Hidden | Topic list, no units | 0 | 5 | 0 units, 8 topics | 0 / 31 | PDF has no units; topics are listed directly; Extraction: rows missing (numbering gap) | Import the page-image corrections |
| ACQP04 | Baudha Darshan or Buddhist Studies (Trilingual) | Visible | Topic list, no units. Checked: PDF lists 4 topics numbered 1, 2, 1, 2 (NTA numbering) | 0 | 4 | 0 units, 8 topics | 0 / 4 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Numbering as printed in the NTA PDF (not an error) | Import the page-image corrections |
| ACQP05 | Dharmashastra, Vastu & Paurohitya | Hidden | Units | 3 | 0 | 3 units, 4 topics | 3 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| ACQP06 | Dharm Vijnan | Hidden | Topic list, no units | 0 | 5 | 0 units, 9 topics | 0 / 5 | PDF has no units; topics are listed directly | Import the page-image corrections |
| ACQP07 | Dharmashastra | Hidden | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 3 | PDF has no units; topics are listed directly; Extraction: no text could be read (scanned or regional-script pages) | Import the page-image corrections |
| ACQP08 | Hindu Studies (Bilingual) | Hidden | Topic list, no units. Checked: PDF lists 6 topics numbered 1–4, 1, 2 (NTA numbering) | 0 (+1 sections) | 6 | 0 units, 9 topics | 0 / 6 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Numbering as printed in the NTA PDF (not an error) | Import the page-image corrections |
| ACQP09 | Indian Knowledge System (Trilingual) | Hidden | Units | 1 | 0 | 1 units, 4 topics | 5 / 16 | Extraction: cover-page title stored as a row; Extraction: 4 unit heading(s) missing | Import the page-image corrections |
| ACQP10 | Jain Darshan | Visible | Topic list, no units. Checked: PDF lists 4 topics, 1 to 4 | 0 | 4 | 0 units, 8 topics | 0 / 4 | PDF has no units; topics are listed directly | None needed for data |
| ACQP11 | Jyotish – Falit | Hidden | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 20 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (474 characters) | Import the page-image corrections |
| ACQP12 | Jyotish – Ganit | Hidden | Topic list, no units | 0 | 17 | 0 units, 20 topics | 0 / 17 | PDF has no units; topics are listed directly | Import the page-image corrections |
| ACQP13 | Krishna Yajurveda | Hidden | Topic list, no units | 0 | 26 | 0 units, 30 topics | 0 / 26 | PDF has no units; topics are listed directly | Import the page-image corrections |
| ACQP14 | Nyaya Vaisheshika | Hidden | Units | 4 | 0 | 4 units, 4 topics | 4 / 0 | Structure matches the PDF | Import the page-image corrections |
| ACQP15 | Phalit Jyotish and Siddhant Jyotish | Visible | Units | 2 | 0 | 2 units, 4 topics | 2 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| ACQP16 | Puranetihasa | Hidden | Units | 5 | 0 | 5 units, 4 topics | 5 / 0 | Extraction: unit text not captured | Import the page-image corrections |
| ACQP17 | Rigveda | Hidden | Topic list, no units | 0 | 25 | 0 units, 29 topics | 0 / 25 | PDF has no units; topics are listed directly; Extraction: rows missing (numbering gap) | Import the page-image corrections |
| ACQP18 | Sahitya | Hidden | Topic list, no units | 0 | 10 | 0 units, 14 topics | 0 / 10 | PDF has no units; topics are listed directly | Import the page-image corrections |
| ACQP19 | Sahitya (Alankara and Kavya Varga) | Visible | Units | 2 | 0 | 2 units, 4 topics | 2 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| ACQP20 | Samveda | Hidden | Topic list, no units | 0 | 16 | 0 units, 20 topics | 0 / 17 | PDF has no units; topics are listed directly; Extraction: rows missing (numbering gap) | Import the page-image corrections |
| ACQP21 | Shukla Yajurveda | Hidden | Topic list, no units | 0 | 18 | 0 units, 22 topics | 0 / 18 | PDF has no units; topics are listed directly | Import the page-image corrections |
| ACQP22 | Veda Etc. | Hidden | Units | 2 | 0 | 2 units, 4 topics | 2 / 0 | Extraction: unit text not captured | Import the page-image corrections |
| ACQP23 | Vedanta | Hidden | Units | 6 | 0 | 6 units, 4 topics | 6 / 0 | Structure matches the PDF | Import the page-image corrections |
| ACQP24 | Vedanta, Sarvadarshan, Mimansa, Nyaya Etc. | Hidden | Units | 11 | 0 | 11 units, 4 topics | 12 / 0 | Extraction: cover-page title stored as a row; Extraction: unit text not captured; Extraction: 1 unit heading(s) missing | Import the page-image corrections |
| ACQP25 | Vyakaran | Hidden | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 8 | PDF has no units; topics are listed directly; Extraction: no text could be read (scanned or regional-script pages) | Import the page-image corrections |
| ACQP26 | Vyakarana and Shabdabodha System | Visible | Units | 2 | 0 | 2 units, 4 topics | 2 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| COQP01 | Agribusiness Management | Hidden | Topic list, no units | 0 | 9 | 0 units, 13 topics | 0 / 14 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| COQP02 | Applied Geography and Geoinformatics | Hidden | Units | 0 | 47 | 0 units, 51 topics | 8 / 39 | Extraction: cover-page title stored as a row; Extraction: 8 unit heading(s) missing | Import the page-image corrections |
| COQP03 | B.Ed. | Visible | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF has no units; topics are listed directly | None needed for data |
| COQP04 | B.Ed. Humanities and Social Science | Visible | Sections or parts, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: cover-page title stored as a row | Import the page-image corrections |
| COQP05 | B.Ed. Languages | Visible | Sections or parts, no units | 0 | 3 | 0 units, 7 topics | 0 / 3 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| COQP06 | B.Ed. Science | Visible | Sections or parts, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| COQP07 | B.Ed. Mathematics | Visible | Topic list, no units | 0 | 3 | 0 units, 7 topics | 0 / 3 | PDF has no units; topics are listed directly | Import the page-image corrections |
| COQP08 | Commerce | Hidden | Units | 0 | 139 | 0 units, 143 topics | 25 / 116 | Structure matches the PDF; Extraction: 25 unit heading(s) missing | Import the page-image corrections |
| COQP09 | Disaster Studies | Visible | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF has no units; topics are listed directly | None needed for data |
| COQP10 | Economics | Hidden | Topic list, no units | 0 | 36 | 0 units, 40 topics | 0 / 37 | PDF has no units; topics are listed directly | Import the page-image corrections |
| COQP11 | General Paper | Hidden | Topic list, no units | 0 | 5 | 0 units, 9 topics | 0 / 97 | PDF has no units; topics are listed directly | Import the page-image corrections |
| COQP12 | General Paper (MBA etc.) | Hidden | Topic list, no units | 0 | 2 | 0 units, 6 topics | 0 / 59 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| COQP13 | Library & Information Science | Visible | Topic list, no units | 0 | 0 | 0 units, 35 topics | 0 / 31 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Extraction: the syllabus topics were stored inside the "Note" instruction box (31 rows) | Import the page-image corrections |
| COQP14 | Law (LLM) | Hidden | Units within sections | 92 (+35 sections) | 2 | 92 units, 6 topics | 158 / 0 | Extraction: rows missing (numbering gap); Extraction: unit text not captured; Extraction: 71 of 158 unit headings missing, the rest merged with their text | Import the page-image corrections |
| COQP15 | Master of Education | Hidden | Units | 10 | 88 | 10 units, 92 topics | 10 / 93 | Structure matches the PDF | Import the page-image corrections |
| COQP16 | M.A. Education | Visible | Topic list, no units | 0 | 14 | 0 units, 18 topics | 0 / 14 | PDF has no units; topics are listed directly | None needed for data |
| COQP17 | Mass Communication and Journalism | Visible | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| COQP18 | Physical Education | Visible | Topic list, no units | 0 | 14 | 0 units, 18 topics | 0 / 14 | PDF has no units; topics are listed directly | Import the page-image corrections |
| COQP19 | Public Health | Visible | Topic list, no units | 0 | 0 | 0 units, 9 topics | 0 / 5 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (5 rows) | Import the page-image corrections |
| COQP20 | Sports Physiology etc. | Visible | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 6 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (3102 characters) | Import the page-image corrections |
| COQP21 | Yoga | Visible | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF has no units; topics are listed directly | None needed for data |
| COQP22 | Hospital Management | Hidden | Topic list, no units | 0 | 17 | 0 units, 21 topics | 0 / 17 | PDF has no units; topics are listed directly | None needed for data |
| HUQP01 | Ancient Indian History, Culture & Architecture | Hidden | Topic list, no units | 0 | 9 | 0 units, 17 topics | 0 / 10 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| HUQP02 | Anthropology | Hidden | Topic list, no units | 0 | 7 | 0 units, 11 topics | 0 / 4 | PDF has no units; topics are listed directly | Import the page-image corrections |
| HUQP03 | Applied Arts | Hidden | Topic list, no units | 0 | 0 | 0 units, 30 topics | 0 / 26 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (26 rows) | Import the page-image corrections |
| HUQP04 | Art and Aesthetics | Hidden | Topic list, no units | 0 | 3 | 0 units, 7 topics | 0 / 3 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| HUQP05 | Dance | Visible | Topic list, no units | 0 | 0 | 0 units, 19 topics | 0 / 15 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (15 rows) | Import the page-image corrections |
| HUQP06 | Development and Labour Studies | Visible | Topic list, no units | 0 | 0 | 0 units, 14 topics | 0 / 10 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Extraction: the syllabus topics were stored inside the "Note" instruction box (10 rows) | Import the page-image corrections |
| HUQP07 | Fine Arts | Hidden | Topic list, no units | 0 | 1 | 0 units, 5 topics | 0 / 4 | PDF has no units; topics are listed directly | Import the page-image corrections |
| HUQP08 | Geography | Hidden | Sections or parts, no units | 0 (+17 sections) | 1 | 0 units, 5 topics | 0 / 0 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: rows split or duplicated | Import the page-image corrections |
| HUQP09 | History | Visible | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 4 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (2251 characters) | Import the page-image corrections |
| HUQP10 | History of Art | Visible | Topic list, no units | 0 | 0 | 0 units, 26 topics | 0 / 22 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (22 rows) | Import the page-image corrections |
| HUQP11 | Home Science | Hidden | Sections or parts, no units | 0 (+6 sections) | 1 | 0 units, 5 topics | 0 / 0 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| HUQP12 | Karnatak Music (Vocal-Instrumental) | Hidden | Units | 15 | 8 | 15 units, 12 topics | 15 / 8 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| HUQP13 | Museology | Visible | Topic list, no units | 0 | 9 | 0 units, 13 topics | 0 / 9 | PDF has no units; topics are listed directly | None needed for data |
| HUQP14 | Hindustani Music (Vocal-Instrumental) | Hidden | Units | 13 (+3 sections) | 15 | 13 units, 19 topics | 13 / 17 | Extraction: cover-page title stored as a row; Extraction: rows missing (numbering gap); Extraction: rows split or duplicated | Import the page-image corrections |
| HUQP15 | Painting | Visible | Topic list, no units | 0 | 0 | 0 units, 41 topics | 0 / 37 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (37 rows) | Import the page-image corrections |
| HUQP16 | Philosophy | Hidden | Sections or parts, no units. Checked: 5 sections; section II skips 6 in the PDF | 0 (+5 sections) | 51 | 0 units, 55 topics | 0 / 51 | PDF groups topics in sections/parts, which the unit count ignores; Numbering as printed in the NTA PDF (not an error) | Import the page-image corrections |
| HUQP17 | Plastic Arts | Visible | Topic list, no units | 0 | 12 | 0 units, 16 topics | 0 / 12 | PDF has no units; topics are listed directly | None needed for data |
| HUQP18 | Political Science | Hidden | Topic list, no units | 0 | 64 | 0 units, 68 topics | 0 / 65 | PDF has no units; topics are listed directly | Import the page-image corrections |
| HUQP19 | Pottery and Ceramic | Visible | Topic list, no units | 0 | 15 | 0 units, 19 topics | 0 / 15 | PDF has no units; topics are listed directly | Import the page-image corrections |
| HUQP20 | Psychology | Visible | Topic list, no units | 0 | 13 | 0 units, 17 topics | 0 / 13 | PDF has no units; topics are listed directly | None needed for data |
| HUQP21 | Social Work | Visible | Units | 9 | 0 | 9 units, 4 topics | 9 / 5 | Structure matches the PDF | Import the page-image corrections |
| HUQP22 | Sociology | Hidden | Units within sections | 0 | 32 | 0 units, 36 topics | 24 / 0 | Structure matches the PDF; Extraction: 24 unit heading(s) missing | Import the page-image corrections |
| HUQP23 | Textile Design | Visible | Topic list, no units | 0 | 0 | 0 units, 34 topics | 0 / 30 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (30 rows) | Import the page-image corrections |
| HUQP24 | Theatre | Visible | Topic list, no units | 0 | 0 | 0 units, 12 topics | 0 / 8 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (8 rows) | Import the page-image corrections |
| HUQP25 | Music – Percussion | Visible | Units | 12 | 30 | 12 units, 34 topics | 12 / 30 | Structure matches the PDF | None needed for data |
| HUQP26 | Rabindra Sangit | Hidden | Topic list, no units | 0 (+3 sections) | 12 | 0 units, 16 topics | 0 / 15 | PDF has no units; topics are listed directly; Extraction: rows split or duplicated | Import the page-image corrections |
| LAQP01 | English | Visible | Topic list, no units | 0 | 57 | 0 units, 61 topics | 0 / 57 | PDF has no units; topics are listed directly | None needed for data |
| LAQP02 | Hindi | Hidden | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 7 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP03 | Sanskrit | Hidden | Units | 0 (+1 sections) | 0 | 0 units, 4 topics | 4 / 0 | Structure matches the PDF; Extraction: 4 unit heading(s) missing | Import the page-image corrections |
| LAQP04 | Linguistics | Hidden | Topic list, no units | 0 | 1 | 0 units, 5 topics | 0 / 7 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP05 | Arabic | Visible | Topic list, no units | 0 | 7 | 0 units, 11 topics | 0 / 7 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP06 | Assamese | Visible | Units | 3 | 10 | 3 units, 14 topics | 3 / 10 | Structure matches the PDF | None needed for data |
| LAQP07 | Bengali | Hidden | Units | 5 | 15 | 5 units, 18 topics | 5 / 15 | Extraction: cover-page title stored as a row; Extraction: rows missing (numbering gap) | Import the page-image corrections |
| LAQP08 | Bhutia | Hidden | Topic list, no units | 0 | 5 | 0 units, 8 topics | 0 / 7 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Extraction: rows missing (numbering gap) | Import the page-image corrections |
| LAQP09 | Chinese | Visible | Topic list, no units | 0 | 4 | 0 units, 8 topics | 0 / 4 | PDF has no units; topics are listed directly | None needed for data |
| LAQP10 | French | Hidden | Sections or parts, no units | 0 (+2 sections) | 11 | 0 units, 15 topics | 0 / 11 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| LAQP11 | Garo | Visible | Topic list, no units | 0 | 8 | 0 units, 12 topics | 0 / 8 | PDF has no units; topics are listed directly | None needed for data |
| LAQP12 | German | Hidden | Topic list, no units | 0 | 1 | 0 units, 5 topics | 0 / 5 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP13 | Gujarati | Hidden | Units | 5 | 7 | 5 units, 11 topics | 6 / 7 | Items are lettered in Gujarati script (not a gap); Extraction: 1 unit heading(s) missing | Import the page-image corrections |
| LAQP14 | Spanish (Hispanic) | Visible | Topic list, no units | 0 | 4 | 0 units, 8 topics | 0 / 4 | PDF has no units; topics are listed directly | None needed for data |
| LAQP15 | Japanese | Visible | Topic list, no units | 0 | 7 | 0 units, 11 topics | 0 / 7 | PDF has no units; topics are listed directly | None needed for data |
| LAQP16 | Kannada | Visible | Topic list, no units | 0 | 15 | 0 units, 19 topics | 0 / 15 | PDF has no units; topics are listed directly | None needed for data |
| LAQP17 | Kashmiri | Hidden | Units | 0 | 0 | 0 units, 1 topics | 10 / 31 | Extraction: no text could be read (scanned or regional-script pages); Extraction: 10 unit heading(s) missing | Import the page-image transcription |
| LAQP18 | Khasi | Visible | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF has no units; topics are listed directly | None needed for data |
| LAQP19 | Kokborok | Visible | Topic list, no units | 0 | 10 | 0 units, 14 topics | 0 / 10 | PDF has no units; topics are listed directly | None needed for data |
| LAQP20 | Korean | Visible | Topic list, no units | 0 | 5 | 0 units, 9 topics | 0 / 5 | PDF has no units; topics are listed directly | None needed for data |
| LAQP21 | Lepcha | Hidden | No readable syllabus text | 0 | 0 | 0 units, 4 topics | 0 / 0 | Extraction: no text could be read (scanned or regional-script pages); Lepcha script: no machine-readable text; transcription unresolved | Transcribe the Lepcha text from the page images (decision needed); nothing to import yet |
| LAQP22 | Limbu | Hidden | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP23 | Malayalam | Hidden | Units | 5 | 0 | 5 units, 4 topics | 5 / 0 | Structure matches the PDF | Import the page-image corrections |
| LAQP24 | Manipuri | Hidden | Units | 5 | 6 | 5 units, 10 topics | 9 / 6 | Extraction: rows missing (numbering gap); Extraction: 4 unit heading(s) missing | Import the page-image corrections |
| LAQP25 | Marathi | Hidden | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 4 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (865 characters) | Import the page-image corrections |
| LAQP26 | Nepali | Hidden | Topic list, no units | 0 | 34 | 0 units, 38 topics | 0 / 34 | PDF has no units; topics are listed directly; Extraction: rows split or duplicated | Import the page-image corrections |
| LAQP27 | Odia | Visible | Topic list, no units | 0 | 6 | 0 units, 10 topics | 0 / 6 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP28 | Pali | Hidden | Units | 5 | 0 | 5 units, 4 topics | 5 / 0 | Extraction: unit text not captured | Import the page-image corrections |
| LAQP29 | Pashto | Visible | Topic list, no units | 0 | 5 | 0 units, 9 topics | 0 / 5 | PDF has no units; topics are listed directly | None needed for data |
| LAQP30 | Persian | Visible | Topic list, no units | 0 | 16 | 0 units, 20 topics | 0 / 16 | PDF has no units; topics are listed directly | None needed for data |
| LAQP31 | Prakrit | Hidden | Units | 5 | 0 | 5 units, 4 topics | 5 / 0 | Structure matches the PDF | Import the page-image corrections |
| LAQP32 | Prayojanmoolak | Hidden | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 8 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (1636 characters) | Import the page-image corrections |
| LAQP33 | Punjabi | Hidden | Topic list, no units | 0 | 8 | 0 units, 11 topics | 0 / 8 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP34 | Russian | Visible | Topic list, no units | 0 | 7 | 0 units, 11 topics | 0 / 7 | PDF has no units; topics are listed directly | None needed for data |
| LAQP35 | Tamil | Visible | Units | 7 | 21 | 7 units, 25 topics | 7 / 21 | Structure matches the PDF | None needed for data |
| LAQP36 | Telugu | Hidden | Topic list, no units | 0 | 4 | 0 units, 8 topics | 0 / 4 | PDF has no units; topics are listed directly | Import the page-image corrections |
| LAQP37 | Urdu | Hidden | Topic list, no units | 0 | 0 | 0 units, 3 topics | 0 / 10 | PDF has no units; topics are listed directly; Extraction: no text could be read (scanned or regional-script pages) | Import the page-image transcription |
| LAQP38 | Urdu Journalism | Visible | Topic list, no units | 0 | 7 | 0 units, 11 topics | 0 / 7 | PDF has no units; topics are listed directly | None needed for data |
| LAQP39 | Indo-Tibetan | Hidden | Sections or parts, no units | 0 (+2 sections) | 8 | 0 units, 11 topics | 0 / 8 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| LAQP40 | Santali | Visible | Topic list, no units | 0 | 8 | 0 units, 12 topics | 0 / 8 | PDF has no units; topics are listed directly | None needed for data |
| LAQP41 | Italian | Hidden | Sections or parts, no units | 0 (+2 sections) | 8 | 0 units, 12 topics | 0 / 7 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| MTQP01 | Chemical, Thermal and Polymer Engineering | Hidden | Topic list, no units | 0 | 11 | 0 units, 15 topics | 0 / 11 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP02 | Civil, Structural and Transport Engineering | Visible | Units | 8 | 1 | 8 units, 5 topics | 8 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP03 | Dairy Technology | Hidden | Topic list, no units | 0 | 45 | 0 units, 49 topics | 0 / 45 | PDF has no units; topics are listed directly | Import the page-image corrections |
| MTQP04 | Data Science, Artificial Intelligence, Cyber Security etc. | Visible | Topic list, no units | 0 | 12 | 0 units, 16 topics | 0 / 12 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP05 | Electronics, Communication and Information Engineering | Visible | Units | 8 | 1 | 8 units, 5 topics | 8 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP06 | Food Engineering and Technology | Visible | Sections or parts, no units | 0 (+4 sections) | 0 | 0 units, 4 topics | 0 / 26 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP07 | Mechanical Engineering | Visible | Units | 5 | 1 | 5 units, 5 topics | 5 / 27 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP08 | Nanoscience | Hidden | Sections or parts, no units | 0 (+3 sections) | 0 | 0 units, 4 topics | 0 / 10 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| MTQP09 | Nanoelectronics | Hidden | Units | 4 | 0 | 4 units, 4 topics | 4 / 0 | Structure matches the PDF | Import the page-image corrections |
| MTQP10 | Electrical, Power and Energy Engineering | Visible | Units | 7 | 1 | 7 units, 5 topics | 7 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP11 | Water Engineering & Management | Hidden | Sections or parts, no units | 0 (+1 sections) | 23 | 0 units, 27 topics | 0 / 34 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: cover-page title stored as a row | Import the page-image corrections |
| MTQP12 | Textile Engineering | Visible | Sections or parts, no units | 0 (+5 sections) | 0 | 0 units, 4 topics | 0 / 0 | PDF groups topics in sections/parts, which the unit count ignores | None needed for data |
| SCQP01 | Agricultural Science | Visible | Topic list, no units | 0 | 10 | 0 units, 14 topics | 0 / 10 | PDF has no units; topics are listed directly | None needed for data |
| SCQP02 | Agro-forestry | Hidden | Topic list, no units | 0 | 5 | 0 units, 9 topics | 0 / 5 | PDF has no units; topics are listed directly | Import the page-image corrections |
| SCQP03 | Applied Microbiology | Hidden | Topic list, no units | 0 | 60 | 0 units, 64 topics | 0 / 60 | PDF has no units; topics are listed directly | Import the page-image corrections |
| SCQP04 | Architecture and Planning | Visible | Units | 7 | 0 | 7 units, 4 topics | 7 / 0 | Extraction: cover-page title stored as a row | Import the page-image corrections |
| SCQP05 | Biochemistry | Hidden | Topic list, no units | 0 | 8 | 0 units, 12 topics | 0 / 14 | PDF has no units; topics are listed directly | Import the page-image corrections |
| SCQP06 | Bio-Informatics | Visible | Units | 8 | 1 | 8 units, 5 topics | 8 / 0 | Structure matches the PDF | Import the page-image corrections |
| SCQP07 | Botany | Visible | Topic list, no units | 0 | 14 | 0 units, 18 topics | 0 / 14 | PDF has no units; topics are listed directly | None needed for data |
| SCQP08 | Chemistry | Hidden | Sections or parts, no units | 6 (+3 sections) | 51 | 6 units, 55 topics | 0 / 60 | Units match the PDF ("Unit-I" printed); the page-image correction wrongly turns 6 units into topics | Fix the review file first (keep Unit-I to Unit-III as units), then import |
| SCQP09 | Computer Science and Information Technology | Hidden | Topic list, no units | 0 | 9 | 0 units, 19 topics | 0 / 17 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| SCQP10 | Criminology | Hidden | Topic list, no units | 0 | 4 | 0 units, 8 topics | 0 / 7 | PDF has no units; topics are listed directly | Import the page-image corrections |
| SCQP11 | Environmental Science | Hidden | Topic list, no units | 0 | 1 | 0 units, 5 topics | 0 / 15 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
| SCQP12 | Food Science and Technology | Hidden | Sections or parts, no units | 0 (+7 sections) | 18 | 0 units, 22 topics | 0 / 27 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: cover-page title stored as a row | Import the page-image corrections |
| SCQP13 | Forensic Science | Hidden | Sections or parts, no units | 0 (+13 sections) | 1 | 0 units, 5 topics | 0 / 18 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| SCQP14 | Geology, Earth Science | Hidden | Units | 2 | 14 | 2 units, 18 topics | 2 / 16 | Structure matches the PDF | Import the page-image corrections |
| SCQP15 | Geophysics | Hidden | Sections or parts, no units | 0 (+2 sections) | 17 | 0 units, 21 topics | 0 / 18 | PDF groups topics in sections/parts, which the unit count ignores | Import the page-image corrections |
| SCQP16 | Horticulture | Visible | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 9 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Extraction: the whole syllabus was stored as hidden text on a "Note" line (4771 characters) | Import the page-image corrections |
| SCQP17 | Life Sciences | Visible | Topic list, no units | 0 | 8 | 0 units, 12 topics | 0 / 8 | PDF has no units; topics are listed directly | Import the page-image corrections |
| SCQP18 | Material Science | Visible | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 8 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (3230 characters) | Import the page-image corrections |
| SCQP19 | Mathematics | Visible | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 7 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (3323 characters) | Import the page-image corrections |
| SCQP20 | Medical Laboratory Technology | Visible | Topic list, no units | 0 | 0 | 0 units, 14 topics | 0 / 10 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Extraction: the syllabus topics were stored inside the "Note" instruction box (10 rows) | Import the page-image corrections |
| SCQP21 | MPT_Master in Respiratory Theory (MRT) | Hidden | Sections or parts, no units | 0 (+23 sections) | 141 | 0 units, 145 topics | 0 / 140 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: cover-page title stored as a row | Import the page-image corrections |
| SCQP22 | Nanoscience Integrative Biosciences | Hidden | Sections or parts, no units | 0 (+5 sections) | 0 | 0 units, 4 topics | 0 / 0 | PDF groups topics in sections/parts, which the unit count ignores; Extraction: cover-page title stored as a row | Import the page-image corrections |
| SCQP23 | Pharmacy | Hidden | Sections or parts, no units. Checked: PDF page 8 lists a–d, f, g, g (NTA numbering) | 0 (+43 sections) | 269 | 0 units, 273 topics | 0 / 352 | PDF groups topics in sections/parts, which the unit count ignores; Numbering as printed in the NTA PDF (not an error) | Import the page-image corrections |
| SCQP24 | Physics | Visible | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 7 | PDF has no units; topics are listed directly; Extraction: the whole syllabus was stored as hidden text on a "Note" line (4974 characters) | Import the page-image corrections |
| SCQP25 | Plant Biotechnology | Visible | Units | 4 | 0 | 4 units, 4 topics | 4 / 0 | Structure matches the PDF | Import the page-image corrections |
| SCQP26 | Soil Science – Soil & Water Conservation | Visible | Topic list, no units | 0 | 0 | 0 units, 4 topics | 0 / 5 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row; Extraction: the whole syllabus was stored as hidden text on a "Note" line (2091 characters) | Import the page-image corrections |
| SCQP27 | Statistics | Visible | Topic list, no units | 0 | 13 | 0 units, 17 topics | 0 / 13 | PDF has no units; topics are listed directly | None needed for data |
| SCQP28 | Zoology | Visible | Topic list, no units | 0 | 0 | 0 units, 18 topics | 0 / 14 | PDF has no units; topics are listed directly; Extraction: the syllabus topics were stored inside the "Note" instruction box (14 rows) | Import the page-image corrections |
| SCQP29 | Atmospheric Science | Hidden | Topic list, no units | 0 | 5 | 0 units, 9 topics | 0 / 5 | PDF has no units; topics are listed directly | None needed for data |
| SCQP30 | Animal Science (Poultry) | Visible | Topic list, no units | 0 | 5 | 0 units, 9 topics | 0 / 5 | PDF has no units; topics are listed directly; Extraction: cover-page title stored as a row | Import the page-image corrections |
