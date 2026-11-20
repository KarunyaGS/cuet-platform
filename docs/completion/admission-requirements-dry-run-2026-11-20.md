# Phase 2A: subject normalisation and server-side requirement reader: dry-run report (20 Nov 2026)

**Nothing was written to the database.** No migration was created or applied. No programme or fact was inserted or updated. Nothing was committed, pushed or deployed. The existing student-facing eligibility display and scoring were not changed. No subject mapping is published; every result below is a dry-run reading awaiting your approval.

Command used (read-only database connection, report file only):
`cd backend && npx tsx scripts/admission-requirements-dry-run.mts --out <report.json>`

---

## 1. What was built (all new files, none persisted anywhere)

| File | Purpose |
|---|---|
| `backend/src/services/admission-subjects.ts` | Canonical identifier for each of the 37 NTA CUET (UG) 2026 papers, aliases, and `resolveSubject()` returning MAPPED / AMBIGUOUS / CONFLICT / UNKNOWN |
| `backend/src/services/admission-requirements.ts` | `parseRequirementText()`: the server-side reader. Pure code, no database, no network |
| `backend/scripts/admission-requirements-dry-run.mts` | The dry run (opens the local database read-only) |
| `backend/test/admission-requirements.test.ts` | 32 tests |

Reused, unchanged: `frontend/src/subject-rule.ts` (display only). The server reader is a **superset** of what it understands (it also reads BHU-style and JNU-style wording) and is the only one that may be used for a decision.

## 2. Subject alias mapping

**Canonical identifiers.** One per NTA paper, for example `physics` (322), `biology` (304), `mathematics-applied-mathematics` (319), `general-aptitude-test` (501). The table is checked by a test against NTA's own 2026 paper list in the repository (`content-ingestion/registry/cuet-2026-official-papers.json`), so the two cannot drift apart silently.

**How a name is resolved (never by similarity):**

1. Exact NTA name, or a listed alias, after normalising spacing, punctuation and brackets.
2. A name for one part of a combined paper ("Biotechnology" is a part of paper 304) maps but is flagged `PART_OF_COMBINED_PAPER` so a person confirms it. With the paper code printed beside it, it maps by the code.
3. A printed code is a cross-check. A name and a code that disagree are a **CONFLICT**, never resolved.
4. A name that can mean two things is **AMBIGUOUS**.
5. Anything else is **UNKNOWN** (for example "Astrology", "Science", "Physic").

**Every subject wording found in the 109 programmes (29 distinct strings, 20 papers):**

| Printed wording (examples) | Result | Paper | Basis |
|---|---|---|---|
| General Aptitude Test | mapped | 501 | code or name |
| Physics, Chemistry | mapped | 322, 306 | code or name |
| Mathematics/Applied Mathematics (and `Mathematics/ Applied Mathematics`) | mapped | 319 | official name |
| Mathematics (BHU, with code 319) | mapped | 319 | printed code |
| English, English Test, Hindi, Bengali, Punjabi, Urdu | mapped | 101, 102, 104, 110, 113 | official name or code |
| Performing Arts, Physical Education | mapped | 320, 321 | official name (brackets removed) |
| Biology/Biological Studies/Biotechnology/Biochemistry (5 spellings with different spacing) | mapped | 304 | **alias** (NTA says "Biological Science"; Delhi says "Studies") |
| Biology/ Biological Science/ Biotechnology/ Biochemistry (BHU, with code 304) | mapped | 304 | code |
| Biology (JNU/BHU, with code 304) | mapped | 304 | code |
| Computer Science/Informatics Practices | mapped | 308 | **alias** (NTA says "Information Practices") |
| Accountancy/Book Keeping, Business Studies, Agriculture, Geography/Geology, Mass Media/Mass Communication | mapped | 301, 305, 302, 313, 318 | name or code |
| Fine Arts / Visual Arts (Sculpture/Painting) with code 312 | mapped | 312 | code; the specialisation is kept as a note |
| **Sanskrit** in a language list (`Sanskrit from List A`, Delhi, 2 programmes) | **AMBIGUOUS** | none | see below |
| Sanskrit with code 325 (BHU, 1 programme) | mapped | 325 | printed code |
| Unrecognised names | **0** | | |

**The one ambiguity found.** Delhi prints "Sanskrit from List A", a language list. NTA offers Sanskrit as a *domain* paper (325), not as one of the language papers 101 to 113. They may or may not be the same thing for Delhi's purposes, so the name is left unmapped until Delhi's List A is checked. The reader refuses to choose.

**Not mapped, by design:** "Any one Language from List A" and "Any three subjects from List B" are groups, not subjects. See section 4.

## 3. The server-side reader

Shapes it understands (all seen in the data):

| Family | Example | Programmes |
|---|---|---|
| `DU_COMBINATIONS` | "Combination I: Any one Language from List A + Any three subjects from List B OR Combination II: ..." | 73 |
| `NUMBERED_PAPERS` | "1. Language Test - English (101) or Hindi (102) 2. General Aptitude Test (501)", sets joined by OR | 11 |
| `OPT_FOR` | "They are required to opt for English Test (Paper Code 101) and General Aptitude Test (Paper Code 501) ..." | 25 |

What it produces: alternative **combinations**; in each, **mandatory subjects**, **any-N-of-group** (a list the university names), **any-N-of-set** (a choice among listed papers), **subject groups** (List A, List B), a named subject plus "one more language", sentences that apply to every combination, tests set by the university (practical or performance, kept at programme level), and a list of **issues** for everything it was unsure of. Text it cannot read is kept as `UNRESOLVED`, never dropped.

Interpretation choices made (each can be changed on your instruction):

- "Candidates must appear in any one language from List A in CUET" is added to a combination only if that combination has no language of its own (the browser reader does the same).
- "... AND Performance-Based Test" after the last combination is a **programme-level** requirement, because the same text says "Candidates must appear in both CUET and Performance-based test" at its start.
- A numbered list of papers (BHU) does **not** say whether all papers or any one is needed. The reader reports `ALL_OR_ANY_NOT_STATED` and does not choose.
- Merit formulas ("50% weightage") are noted and not read; they concern competitiveness, not minimum eligibility.

## 4. Dry-run results (109 programmes, local database)

| Measure | Result |
|---|---|
| Programmes examined | **109** (Delhi 73, JNU 25, BHU 11) |
| Rule text source | required-subjects fact 75, eligibility fact 34 (same order the student page uses) |
| **Successfully parsed** | **106** |
| **Partially parsed** | **3** |
| Unparsed | 0 |
| Unrecognised subject names | **0** |
| Ambiguous subject mappings | **1 name in 1 programme** (Sanskrit, 2 combinations) |
| Unsupported rule formats | **2** (JNU prose conditions; Delhi "Any one subject from either List B") |
| Invalid or incomplete combinations | **1** (the "either List B" combination, kept as unresolved text) |
| Name variants mapped by alias | 19 occurrences (Delhi's "Biological Studies", "Informatics Practices") |
| Programmes with a university-set test | 5 (4 performance-based, 1 practical) |
| **Evaluable today with nothing else** | **24** (JNU: English 101 + General Aptitude Test 501) |
| Need the university's List A / List B | **73** (all Delhi rules) |
| **Requiring manual verification** | **15** |

**What "evaluable" means.** A rule is evaluable only when nothing is left for a person to decide: every subject mapped, no unlisted group, no part-name mapping, no slash read as a choice, no unstated all-or-any. Today that is the 24 JNU programmes only.

**The 73 Delhi rules read correctly but cannot be evaluated**, because "List A" and "List B" are named, and their members are not in the stored text (Delhi defines them in its bulletin). Which papers count as List A or List B must come from a sourced, reviewed fact. This is the largest finding: the parser is ready, the group definitions are data we do not have yet.

**The 15 programmes requiring manual verification:**

| # | Programmes | Why |
|---|---|---|
| 11 | All 11 BHU programmes | The numbered paper lists do not say whether all or any are needed. This is also the open review flag already recorded on all 11 (the any/all question for BHU). |
| 1 | Delhi B.A. (Programme) | Open review flag already recorded (about 150 combinations not published by Delhi). |
| 1 | JNU B.Sc. in Ayurveda Biology (AYBU 411) | Prose: Physics and Chemistry compulsory, one of Biology (304) or Mathematics (319), higher marks counted. Reader lists the papers and stops. |
| 1 | Delhi B.A. (Hons.) Sanskrit | Sanskrit in a language list is ambiguous. |
| 1 | Delhi B.Voc. Health Care Management | Combination III says "Any one subject from either List B"; the reader keeps it unresolved. |

## 5. Representative examples

**Parsed (Delhi, three combinations, a mandatory subject and a list-B named subject):**
Printed: "Combination I: Any one Language from List A + Mass Media/Mass Communication from List B + General Aptitude Test OR Combination II: Any one Language from List A + General Aptitude Test"
Read as: `Combination I: any 1 from LIST_A + mass-media-mass-communication(318) + general-aptitude-test(501) || Combination II: any 1 from LIST_A + general-aptitude-test(501)`

**Parsed (alternatives, mandatory, alias):**
Printed: "Combination I: Physics + Chemistry + Biology/Biological Studies/Biotechnology/Biochemistry OR Combination II: Physics + Chemistry + Mathematics/Applied Mathematics ... Candidates must appear in any one language from List A in CUET"
Read as: `Combination I: physics(322) + chemistry(306) + biology(304) + any 1 from LIST_A || Combination II: physics(322) + chemistry(306) + mathematics-applied-mathematics(319) + any 1 from LIST_A`

**Parsed (BHU, alternative sets, flagged all-or-any):**
Printed: "1. Subject Test - Chemistry (306) 2. Subject Test - Mathematics (319) 3. Subject Test - Physics (322) OR 1. ... Biology ... (304) 2. ... 3. ... OR 1. Agriculture (302) 2. Biology (304) 3. Chemistry (306)"
Read as: `Option 1: chemistry + mathematics + physics || Option 2: biology + chemistry + physics || Option 3: agriculture + biology + chemistry`, plus issue `ALL_OR_ANY_NOT_STATED`.

**Parsed (JNU):** "required to opt for English Test (Paper Code 101) and General Aptitude Test (Paper Code 501)" → `english(101) + general-aptitude-test(501)`; evaluable.

**Programme-level test:** Hindustani Music (Delhi): `Combination I..IV` read, plus `Also required for the programme: PERFORMANCE_TEST`.

**Failed or partial:**
- JNU Ayurveda Biology: `physics(322) + chemistry(306) + any 1 of [304, 319]` with `UNSUPPORTED_CLAUSE` (prose conditions) and `SLASH_READ_AS_CHOICE`. Partial, not evaluable.
- Delhi Sanskrit: `Combination I: any 1 from LIST_A + ?Sanskrit? + any 2 from LIST_B ...`, `AMBIGUOUS_SUBJECT`.
- Delhi B.Voc.: `... + !Any one subject from either List B! + general-aptitude-test(501)`, `UNRESOLVED_TEXT`.

## 6. Does the browser agree with the server?

For all **73** Delhi-style rules in the stored import pack, the browser reader (`frontend/src/subject-rule.ts`) and the server reader give **identical** results on combination count, named subjects, and the number asked from each list (test: "every Delhi-style rule in the import pack"). On the 11 BHU and 25 JNU rules the browser reader returns nothing (it shows the printed text), while the server reader parses them; that is intentional and keeps the browser display-only. `frontend/src/subject-rule.ts` and its 7 tests are unchanged.

## 7. Tests

`backend/test/admission-requirements.test.ts`: **32 tests, all passing.**

| Area | Tests |
|---|---|
| Canonical subjects (unique ids and codes, agrees with NTA list, every official name maps) | 3 |
| Aliases (variants, part names, code-confirmed, specialisation kept) | 3 |
| Ambiguous / conflict / unknown / not guessed | 4 |
| Any-N-of-M, mandatory, alternatives, "one more language", common sentence, programme-level test, number words | 7 |
| Papers by code (numbered, OR sets, conflict, opt-for, prose) | 5 |
| Invalid input (empty, not a rule, empty combination, unknown subject, ambiguous subject, not understood) | 6 |
| Browser/server agreement (73 rules), and the whole import pack classified | 4 |

Full backend suite after this work: **398 of 399 pass.** The one failure is the existing, unrelated `flashcard-decks.test.ts` ("day must be today's date"), which also fails without any of these changes. Two other tests (`billing`, `billing-security`) failed once in a busy-machine run and passed on rerun and in isolation. Backend type check passes. Frontend files were not changed.

## 8. What I did **not** do (awaiting your approval)

- Persist normalised requirements or subject mappings (no table exists; no migration created).
- Publish any mapping. All 109 results are in-memory.
- Decide the 11 BHU all-or-any rules, the Sanskrit mapping, or the Delhi "either List B" wording. These need the university's answer or a source.
- Define List A and List B membership (needs Delhi's bulletin pages, as a reviewed fact).

## 9. Decisions for you

1. **Approve the canonical subject ids and aliases** (section 2), in particular the two alias rulings: Delhi's "Biological Studies" and "Informatics Practices" read as NTA's papers 304 and 308.
2. **Sanskrit:** keep it ambiguous until Delhi's List A is read? (recommended)
3. **List A / List B:** agree that membership comes from Delhi's bulletin as a sourced, staff-reviewed fact, not from our assumption that List A means papers 101 to 113 and List B means 301 to 326.
4. **BHU:** agree the all-or-any rule stays undecided until BHU answers (the question is already open in the 16 Nov completion report).
5. **After approval, Phase 2B:** a migration for structured requirements (DRAFT only, linked to the printed fact), a reviewer screen showing the printed text beside the reading, and no publication without a person's confirmation.
