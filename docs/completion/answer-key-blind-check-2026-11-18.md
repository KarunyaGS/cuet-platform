# Answer-key blind check: Physics and Chemistry numerical and counting questions (18 November 2026)

## Why

Every Physics (1,000) and Chemistry (600) question already has an explanation of at least 120 characters and a note on each wrong option (checked: 0 questions without an explanation; 5 with a very short wrong-option note, all of the assertion-reason or statement type where the reasoning sits in the explanation body). The open risk is not a missing explanation but a **wrong answer key**, which an explanation would then defend. Numerical and counting questions are where that is most likely, so they were checked first.

## Method

1. 530 multiple-choice questions were selected whose options are mostly numbers or counts (374 Physics, 156 Chemistry).
2. Four independent solvers (AI models working in separate sessions) were given **only the stem and four options**, with no key, no explanation and no access to the database, and asked to solve each and say if a question was ambiguous or had no single correct option.
3. Their answers were compared with the stored keys by a script. Disagreements were solved again by hand.

## Result

| | Questions | Same answer as the key | Different |
|---|---|---|---|
| Physics | 374 | 371 | 3 |
| Chemistry | 156 | 156 | 0 |
| **Total** | **530** | **527** | **3** |

The three differences were worked by hand. In each, **the stored key is correct and the solver was wrong**:

| Question | Key | Solver | Why the key is right |
|---|---|---|---|
| Distance of closest approach of a 7.2 MeV alpha particle to gold (Z = 79) | 31.6 fm | 15.8 fm | d = 2Ze^2/(4 pi e0 K) = 2 x 79 x 1.44 / 7.2 = 31.6 fm; the solver dropped the factor 2 for the alpha particle's charge |
| Radius of the secondary wavelet from A in the Huygens proof of refraction | v2 t | v1 t | A's wavelet spreads in the second medium, where the speed is v2 (BC = v1 t is the other side of the construction) |
| Magnetic field of a proton at 1.0 mm, moving at 2.0 x 10^6 m/s at right angles | 3.2 x 10^-14 T | 3.2 x 10^-17 T | B = 1e-7 x 1.6e-19 x 2e6 / (1e-3)^2 = 3.2e-14 T |

Items the solvers flagged: one Physics question where "normal adjustment" of a compound microscope can mean the final image at infinity (answer 212, which fits) or at the near point (about 232, not offered); one Physics question where the computed value (14.5 mA) lies between options and the nearest (14 mA) was chosen. Both match the stored keys. Neither was changed.

## What this is and is not

- It is a strong automated check that the keys of the numerical and counting questions are consistent with independent solutions: **527 of 530 agree, no key error was found**.
- It is **not** expert verification. Conceptual, statement-based, assertion-reason and match-the-following questions (about 1,000 of the 1,600) were not part of this check; the sample review (`docs/sample-review.md`) is the tool for a subject expert to cover them.
- Several solvers wrote only generic working notes; the check rests on their final answers, not on their reasoning, and the agreement rate with the keys was not 100% (the solvers did not copy the keys: they never saw them).

## Files

Inputs and the solvers' raw outputs are in `D:\tmp\blind\` (scratch, not in the repository). The selection and the comparison can be repeated from the database.
