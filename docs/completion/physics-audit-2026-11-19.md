# Physics (CUET-UG 322): complete audit, 19 November 2026

**Status: audit complete; first gap closed. Physics is NOT yet declared complete.** All content here is AI-assisted and **Draft – unverified**. Nothing was committed, pushed, deployed or applied to production.

## 1. Method
- Official syllabus: `content/syllabus/CUET_UG/322.json` (9 units, 32 syllabus rows).
- Every pack in `content/packs/CUET_UG/322/` was read and measured (words, formulas, solved problems, diagrams, tables, question types).
- The official validator (`npm run ingest -- content-validate --paper 322`) was run: **55 of 55 packs valid**.
- Mapping rule: a syllabus row is "covered" only if a lesson is attached to that row. A lesson existing is not treated as proof that the topic is complete.

## 2. Headline findings
1. **One syllabus row had no lesson at all:** *Diffraction due to a single slit, width of central maxima* (Unit 6). The earlier "31 lessons" were never 32 rows. **Closed in this session** (section 4).
2. **Existing lessons are deep, not superficial:** 2,000 to 7,000 words each, 3 to 13 solved problems, 3 to 15 diagrams, tables, formulas with variable explanations. The weak spots are specific (see the table), not general.
3. **Question bank:** 1,000 questions before this work (+20 now). Types present: MCQ, assertion-reason, statement-based, diagram-based, match-the-following. **Not supported by the pack format and absent:** passage or case-based questions and previous-year questions (only one 2024 paper pilot exists). These are platform-level gaps, not just content gaps.
4. **Interactive experiences:** one (Lens Lab, thin lenses). Nothing for the other 30 lessons yet.
5. **Applications and "common mistakes":** most lessons have only one short common-mistakes callout, and many have no dedicated real-world applications section.

## 3. Chapter-wise checklist (all 32 syllabus rows)
Word counts here count prose, solutions and problems only (the validator's own count is higher, e.g. 2,767 for the new lesson). The **Flags** column is a keyword heuristic, not a judgement: "no applications section" means the lesson text never uses the word "application"; "no worked EXAMPLE blocks" means it has no EXAMPLE-type block (it may still have solved problems). Treat flags as places to look.

Columns: lesson words · formula blocks · solved problems · diagrams · tables · questions (MCQ/A-R/Statement/Diagram/Match).

| Unit | Syllabus row | Words | Formulas | Solved | Diagrams | Tables | Questions | Question mix | Flags |
|---|---|---|---|---|---|---|---|---|---|
| Electrostatics | Electric charges, Conservation of charge, Coulomb's law-force … | 4,032 | 8 | 6 | 5 | 4 | 30 | 21/4/2/1/2 | none |
| Electrostatics | Electric potential, potential difference, electric potential d… | 3,011 | 7 | 9 | 5 | 4 | 32 | 23/4/2/2/1 | no applications section; no worked EXAMPLE blocks |
| Electrostatics | Electric field, electric field lines electric field due to a p… | 2,690 | 4 | 5 | 4 | 4 | 30 | 21/4/2/2/1 | no applications section; no worked EXAMPLE blocks |
| Electrostatics | Electric flux, statement of Gauss's theorem and its applicatio… | 2,860 | 5 | 6 | 6 | 3 | 30 | 21/4/2/2/1 | no applications section; no worked EXAMPLE blocks |
| Electrostatics | Conductors and insulators, free charges and bound charges insi… | 3,550 | 8 | 7 | 5 | 6 | 32 | 23/4/2/2/1 | no applications section; no worked EXAMPLE blocks |
| Current Electricity | Electric current, flow of electric charges in a metallic condu… | 6,592 | 14 | 12 | 8 | 4 | 45 | 31/5/3/3/3 | no applications section |
| Current Electricity | Kirchhoff's rules, Wheatstone bridge. | 3,335 | 7 | 6 | 4 | 2 | 30 | 17/3/3/4/3 | none |
| Magnetic Effects of Curr | Concept of magnetic field, Oersted's experiment. Biot - Savart… | 3,339 | 6 | 4 | 4 | 3 | 30 | 22/4/2/1/1 | no worked EXAMPLE blocks |
| Magnetic Effects of Curr | Ampere's law and its applications to infinitely long straight … | 3,189 | 8 | 6 | 4 | 2 | 30 | 21/3/2/3/1 | no applications section |
| Magnetic Effects of Curr | Force on a current-carrying conductor in a uniform magnetic fi… | 2,851 | 4 | 6 | 5 | 2 | 30 | 22/3/2/2/1 | no applications section; no worked EXAMPLE blocks |
| Magnetic Effects of Curr | Moving coil galvanometer- its current sensitivity and conversi… | 2,167 | 4 | 5 | 3 | 2 | 30 | 20/3/3/2/2 | no applications section; no worked EXAMPLE blocks |
| Magnetic Effects of Curr | Bar magnet, bar magnet as an equivalent solenoid, magnetic fie… | 2,508 | 5 | 5 | 3 | 3 | 30 | 21/3/2/2/2 | no applications section; no worked EXAMPLE blocks |
| Magnetic Effects of Curr | Magnetic properties of materials- Para-, dia- and ferro – magn… | 2,168 | 3 | 3 | 3 | 3 | 30 | 21/3/3/2/1 | few solved examples; no applications section; no worked EXAMPLE blocks |
| Electromagnetic Inductio | Electromagnetic induction; Faraday's laws, induced emf and cur… | 4,384 | 10 | 5 | 4 | 4 | 32 | 22/5/3/1/1 | no applications section |
| Electromagnetic Inductio | Alternating currents, peak and rms value of alternating curren… | 4,895 | 10 | 6 | 10 | 4 | 37 | 25/6/2/3/1 | no worked EXAMPLE blocks |
| Electromagnetic Inductio | AC generator, Transformer. | 2,844 | 4 | 5 | 3 | 5 | 30 | 20/4/2/2/2 | no applications section; no worked EXAMPLE blocks |
| Electromagnetic Waves | Concept of displacement current. | 2,993 | 10 | 4 | 3 | 2 | 30 | 22/3/2/1/2 | no applications section |
| Electromagnetic Waves | Electromagnetic waves, their characteristics, and their transv… | 2,899 | 10 | 5 | 3 | 1 | 30 | 22/4/2/1/1 | no applications section |
| Electromagnetic Waves | Electromagnetic spectrum (radio waves, microwaves, infrared, v… | 2,461 | 3 | 4 | 1 | 4 | 32 | 19/5/4/1/3 | no applications section; no worked EXAMPLE blocks |
| Optics | Reflection of light, spherical mirrors, mirror formula, refrac… | 7,886 | 18 | 12 | 15 | 5 | 44 | 29/6/3/4/2 | no worked EXAMPLE blocks |
| Optics | Optical instruments: Microscopes and astronomical telescopes (… | 3,093 | 6 | 6 | 4 | 2 | 30 | 19/5/2/2/2 | no applications section; no worked EXAMPLE blocks |
| Optics | Wave front and Huygen’s principle, reflection and refraction o… | 2,804 | 3 | 4 | 5 | 2 | 30 | 18/5/2/3/2 | no applications section; no worked EXAMPLE blocks |
| Optics | Proof of laws of reflection and refraction using Huygen’s prin… | 2,313 | 4 | 3 | 3 | 2 | 30 | 18/6/2/2/2 | few solved examples; no applications section; no worked EXAMPLE blocks |
| Optics | Coherent sources and interference of light, Young's double sli… | 2,560 | 8 | 5 | 3 | 3 | 30 | 19/5/2/2/2 | no worked EXAMPLE blocks |
| Optics | Diffraction due to a single slit, width of central maxima. | 2,226 | 4 | 7 | 4 | 1 | 20 | 13/2/2/2/1 | no applications section; no worked EXAMPLE blocks |
| Dual Nature of Matter an | Matter waves-wave nature of particles, de-Broglie relation. | 2,862 | 5 | 7 | 3 | 5 | 30 | 18/5/2/3/2 | none |
| Dual Nature of Matter an | Dual nature of radiation, Photoelectric effect, Hertz and Lena… | 4,209 | 8 | 7 | 6 | 4 | 39 | 24/4/3/5/3 | no applications section; no worked EXAMPLE blocks |
| Atoms and Nuclei | Alpha-particle scattering experiment; Rutherford's model of at… | 4,833 | 15 | 8 | 6 | 4 | 36 | 23/4/3/4/2 | no applications section; no worked EXAMPLE blocks |
| Atoms and Nuclei | Composition and size of nucleus, atomic number , atomic mass n… | 5,150 | 13 | 13 | 5 | 6 | 40 | 26/5/3/4/2 | no applications section |
| Electronic Devices | Energy bands in conductors, semiconductors and insulators (qua… | 2,758 | 3 | 3 | 3 | 2 | 30 | 21/4/2/1/2 | few solved examples; no applications section |
| Electronic Devices | Intrinsic and extrinsic semiconductors, p-type and n-type, p-n… | 4,438 | 8 | 5 | 7 | 3 | 31 | 22/4/2/2/1 | no applications section; no worked EXAMPLE blocks |
| Electronic Devices | Application of junction diode -diode as a rectifier. | 2,459 | 6 | 3 | 4 | 1 | 30 | 21/3/2/2/2 | few solved examples; no worked EXAMPLE blocks |

Totals: 32 of 32 syllabus rows now have a lesson; 1020 questions mapped to rows.

## 4. Newly implemented in this session
**Lesson:** *Diffraction of light: single slit and the width of the central maximum* (`ug26-322-u6-single-slit-diffraction.json`).
- Content (about 2,770 words by the validator's count): what diffraction is, the single-slit observation, the half-slit path-difference derivation of a sin θ = nλ, secondary maxima, width of the central maximum (angular, linear, with a lens, in a medium), single-slit versus double-slit table, the Fresnel distance, common mistakes and examination points.
- 7 solved problems (central width, first-minimum angle, slit width for 30°, immersion in water, lens form, Fresnel distance, number of minima).
- 4 original SVG figures, each followed by a "What to learn" note: set-up, path-difference construction, intensity pattern (drawn from the true sinc² curve), and the single-slit envelope on double-slit fringes (d = 4a, seven fringes).
- 20 questions: 13 MCQ, 2 assertion-reason, 2 statement-based, 2 diagram-based, 1 match. Difficulty 4 easy, 9 medium, 7 hard. Answer positions spread 7/4/4/5.
- Validation: passes the official content validator; each numerical answer was recomputed by hand (details in the build script's checks). Ingestion tests: 40 of 40.
- **Not yet done for this lesson:** loading into the local database, a flashcard deck, a quick-revision-sheet entry, and an interactive Diffraction Lab.

## 5. Gaps still open (in the order I recommend)
| Priority | Gap | Scope |
|---|---|---|
| 1 | Interactive labs for the highest-value topics: single-slit diffraction (pairs with the new lesson), Young's double slit, Coulomb and electric field lines, Ohm's law / Kirchhoff circuits, electromagnetic induction (magnet through a coil), photoelectric effect, Bohr model, radioactive decay, p-n junction | 1 lab per topic, reusing the Lens Lab framework (registry, card, activity API) |
| 2 | Passage and case-based questions, and previous-year questions for Physics | Needs a new question type in the pack format and validator (`DIAGRAM_BASED` and four others are the only types accepted today) |
| 3 | Dedicated "Applications" and "Common mistakes" content in lessons that have none | Additive blocks only |
| 4 | Question-bank depth for lessons with fewer than 20 questions | New, non-duplicate questions, validated for similarity |
| 5 | Revision layer for the new lesson: flashcards, quick-revision sheet | Reuse existing generators |
| 6 | Subject-expert review of every lesson, figure and question | Cannot be done by AI |

## 6. Remaining expert-review requirements
Every lesson, figure, formula, solved example and question in Physics, including the new diffraction lesson, still needs a physics subject expert. Two things in the new lesson deserve a specific look: the secondary-maxima intensity figures (about 5 % and 2 %, taken from the exact sinc² curve), and the statement that the first diffraction minimum removes the fourth-order fringe when d = 4a.

## 7. Honest limits of this audit
- Words, block counts and question counts are measured. Whether each lesson is *academically complete* against each phrase of each syllabus row has been checked only through the packs' own `coverage` lists and the validator; a line-by-line expert read is still needed.
- Previous-year question coverage was not audited beyond the one 2024 pilot paper.
- Flashcards, quick-revision sheets and chapter summaries were not re-audited in this pass.
