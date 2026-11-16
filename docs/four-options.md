# Four options, A to D

A CUET choice question has four options labelled A, B, C, D. There is no fifth option anywhere, and no question is padded or trimmed to fit.

## Where the rule is applied

| Place | What it does |
| --- | --- |
| `backend/src/services/question-audit.ts` | One set of rules (`shapeProblems`, `auditQuestion`) used by everything below |
| Saving a question (`questionInputSchema`) | Refuses anything but four options labelled A to D in order, a key outside 1 to 4, or the wrong number of correct options |
| Past-paper import | Same shape rules. An official key that lists two accepted answers on a single-answer question is still accepted |
| Answers (`answerSchema`, preview evaluation) | Positions 1 to 4 only; an answer naming a fifth option is refused |
| Bulk approval preview | Uses the same checks; failing questions are left out and listed with the reason |
| Database (migration 0026) | Triggers refuse a new or edited option outside position 1 to 4 or with a label that does not match its position |
| Practice screen | Keyboard shortcuts are 1 to 4 and A to D |
| Content pack checker, native PDFs, mock papers | Already required four |

Not changed: numerical questions (no options), the mock-paper `optionsPerQuestion` rule (data, defaults to 4), and every existing row.

## Backward compatibility

The database triggers fire only when an option is inserted, or its position or label is changed. Existing rows are never read, rewritten or rejected. If an older question with a different option count ever turns up (production has not been inspected), the audit reports it and everything else keeps working.

## Answer-key cross-checks

`auditQuestion` also compares the answer key with the explanation, but only where the explanation states the answer in a form that can be read reliably. When it cannot be read, nothing is claimed.

- The notes on wrong options must cover exactly the options that are not the answer.
- "So option N is correct" must match the key.
- Match-the-following: the pairing the explanation states must be the pairing in the keyed option.
- Assertion-reason: what the explanation says about A and R must be the keyed option.

These are consistency checks. They do not prove an answer is scientifically correct.

## Auditing the whole bank

`GET /api/review/questions/audit` (signed-in reviewer; optional `?testPaperId=`) returns counts of option numbers and answer positions, how many questions failed which rule, the first 100 failures with reasons, and how many questions each cross-check could actually read.

Local bank, 16 November 2026: 787 of 787 pass. Option count 4 for all. Cross-checks read: wrong-option notes 787, "option N" 2, match pairings 39 of 42, assertion-reason 38 of 104.
