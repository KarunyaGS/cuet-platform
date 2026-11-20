# Past papers: dropped questions and marking, by year (20 Nov 2026)

Status: **proposal only. No past-paper scoring has been changed.**

## Why this needs year-specific rules

NTA's wording for a dropped or wrong question is not the same in every year. Prepora's CUET-style simulation (the 2026 cycle) credits every candidate who appeared. A past paper from another year may have been evaluated differently.

| Year | Marking (correct / wrong / blank) | Question wrong or dropped | Source read |
|---|---|---|---|
| 2022 | Not read in the 2022 documents I could open | The original bulletin gave +5 to all candidates who appeared. A public notice of 18 Apr 2022 (corrigendum) changed this to +5 to candidates who **attempted** the dropped question. | [NTA public notice 18.04.2022](https://nta.ac.in/Download/Notice/Notice_20220419170451.pdf) (read in full) |
| 2023 | **Not verified** (the 2023 bulletin was not found) | **Not verified.** Answer keys of July 2023 mark such questions "DROP". | search results only |
| 2024 | Per the Information Bulletin (page 14); the +5 / −1 figures are not repeated in the FAQ | +5 to candidates who **attempted** the dropped question | [NTA FAQ for CUET (UG) 2024](https://nta.ac.in/Download/Notice/Notice_20240312193136.pdf), "Policy for Drop Question" (read in full) |
| 2025 | +5 correct, −1 incorrect, 0 unanswered (bulletin section 12.1) | +5 to **all candidates who appeared, whether or not they attempted it**. If more than one option is correct, +5 only to those who marked any correct option. | CUET (UG) 2025 Information Bulletin, section 12.1 (copy hosted at sscbs.du.ac.in, read in full) |
| 2026 | +5 / −1 / 0 | +5 to everyone who appeared (as supplied by the product owner; the bulletin link is stored in the exam cycle record) | cycle record `cycle_cuet_ug_2026` |

## What Prepora does today

`startPastPaper` leaves dropped questions out. A student sees only the stored questions, the time is scaled down, and the maximum becomes (questions shown) × marks. A dropped entry has no question content, so the student cannot attempt it.

| Paper year | Official evaluation | Prepora today | Difference |
|---|---|---|---|
| 2022, 2024 (attempted only) | Maximum stays N × 5. A candidate who attempted the dropped question gets +5, one who skipped it gets 0. | Maximum (N − d) × 5. | Same relative result as "not attempted", but the percentage is calculated on a smaller maximum. |
| 2025, 2026 (all appeared) | Maximum stays N × 5. Everyone gets +5 for each dropped question. | Maximum (N − d) × 5, no credit. | Score is lower by 5 × d and the maximum is lower by 5 × d. |
| 2023 | Unknown | As above | Cannot judge. |

Papers with dropped questions in the current local data: none (one paper, 2024, 50 of 50 questions stored).

## Proposed implementation (not applied)

1. Add the rule to each past paper, next to its marks: `dropped_rule` = `ALL_APPEARED` | `ATTEMPTED_ONLY` | `UNVERIFIED`, with the source document recorded. The import pack gets a matching field. A paper cannot be published until its rule is set by a reviewer who has checked the bulletin or corrigendum.
2. In `startPastPaper`, count the dropped entries `d` of the paper and store it with the attempt (the `credited_count` column added in migration 0041 already exists for results).
   - `ALL_APPEARED`: the attempt's maximum is N × marks. The result adds `d × marks` as credited questions, using the same `scoreAttempt` function and the same display as the 2026 tests ("Credited: d × +5").
   - `ATTEMPTED_ONLY` and `UNVERIFIED`: keep today's behaviour (dropped questions are not shown and not credited), but also show "Official maximum N × 5; dropped questions carry no marks here because they cannot be attempted in Prepora".
3. The result and the instructions page show which rule applied and its source, as they do for the 2026 scheme.
4. Duration: keep scaling by the questions shown. It is not an NTA rule.

## Proposed regression tests (to be written when the rule is approved)

- A paper with `ALL_APPEARED` and 2 dropped questions of 50: max 250, a blank attempt scores 10, all-correct scores 250, credited count 2.
- The same paper with a wrong answer on question 1: score 10 + 5 × correct − 1.
- A paper with `ATTEMPTED_ONLY` and 2 dropped: max (48 × 5) = 240, no credit, the "official maximum 250" note present.
- A paper with `UNVERIFIED`: behaves as `ATTEMPTED_ONLY`, and cannot be published.
- Publishing is refused without a `dropped_rule`.
- Re-importing a paper with a different rule replaces it and is audited.
- Progress totals and topic counters ignore credited slots (no topic).

## Open items before this can be built

- Confirm the 2023 rule from the 2023 Information Bulletin.
- Decide whether the 2022 papers follow the original bulletin or the corrigendum (the corrigendum applies to the 2022 test).
- Confirm that the other years' papers in the library really were evaluated under the rule above (an answer key notice can differ from the bulletin).
