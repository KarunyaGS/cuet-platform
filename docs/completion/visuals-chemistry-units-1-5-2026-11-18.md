# Chemistry visuals, units 1 to 5 (paper 306), 2026-11-18

Scope: Solutions, Electrochemistry, Chemical Kinetics, d- and f-Block, Coordination Compounds. Only new DIAGRAM blocks, "What to learn from this figure:" CALLOUT blocks and TABLE blocks were inserted. No existing block, question, key or id was changed. Nothing was committed, imported or deployed.

Validator: `npm run ingest -- content-validate --exam CUET_UG --paper 306` prints OK for all five files (diagrams 5, 5, 5, 4, 5; questions 20 each). One unrelated similarity warning on question `ug26-306-u5-coordination-compounds-g12` (existing question, not touched).

Note: `content/packs/CUET_UG/306/diagrams/` already held 24 committed SVGs from an earlier pass (for example `ug26-306-u1-solutions-raoult-ideal.svg`) that no pack declared. They were left untouched; the new files use different names.

Added per lesson: diagrams, new tables

| Lesson | Diagrams | New tables |
|---|---|---|
| Solutions | 5 | 2 |
| Electrochemistry | 5 | 2 |
| Chemical kinetics | 5 | 2 |
| d- and f-block | 4 | 2 |
| Coordination compounds | 5 | 2 |

## Diagrams

| Lesson | Diagram key | File | What the student learns |
|---|---|---|---|
| Solutions | vp-ideal-mixture | diagrams/ug26-306-u1-solutions-vp-ideal-mixture.svg | Partial and total vapour pressures of an ideal solution are straight lines in the mole fraction |
| Solutions | vp-deviations | diagrams/ug26-306-u1-solutions-vp-deviations.svg | Positive deviation curves above the ideal line, negative below, and why (A-B forces) |
| Solutions | bp-elevation-curves | diagrams/ug26-306-u1-solutions-bp-elevation-curves.svg | Lower vapour pressure of the solution means it boils at a higher temperature (delta Tb) |
| Solutions | cooling-curves | diagrams/ug26-306-u1-solutions-cooling-curves.svg | Pure solvent freezes at a constant temperature; the solution begins to freeze lower (delta Tf) |
| Solutions | osmosis-u-tube | diagrams/ug26-306-u1-solutions-osmosis-u-tube.svg | Solvent passes through a semipermeable membrane into the solution until column height h balances the osmotic pressure |
| Electrochemistry | daniell-cell | diagrams/ug26-306-u2-electrochemistry-daniell-cell.svg | Anode (Zn, negative, oxidation) and cathode (Cu, positive, reduction); electron flow in the wire; ion flow in the salt bridge |
| Electrochemistry | she | diagrams/ug26-306-u2-electrochemistry-she.svg | Parts and standard conditions of the standard hydrogen electrode (E = 0.00 V by definition) |
| Electrochemistry | electrolytic-cell | diagrams/ug26-306-u2-electrochemistry-electrolytic-cell.svg | Electrolysis of molten NaCl: cathode negative, anode positive, opposite polarity to a galvanic cell |
| Electrochemistry | conductivity-graphs | diagrams/ug26-306-u2-electrochemistry-conductivity-graphs.svg | kappa rises with concentration; molar conductivity against root c, straight for strong, steep for weak electrolytes |
| Electrochemistry | corrosion-cell | diagrams/ug26-306-u2-electrochemistry-corrosion-cell.svg | Rusting as a tiny galvanic cell: anodic pit, electron flow in iron, oxygen reduction at the cathode |
| Chemical kinetics | average-instantaneous-rate | diagrams/ug26-306-u3-chemical-kinetics-average-instantaneous-rate.svg | Average rate is the chord slope; instantaneous rate is the tangent slope |
| Chemical kinetics | linear-plots | diagrams/ug26-306-u3-chemical-kinetics-linear-plots.svg | [R] against t is straight for zero order; ln [R] against t is straight for first order; slope = -k |
| Chemical kinetics | half-life-comparison | diagrams/ug26-306-u3-chemical-kinetics-half-life-comparison.svg | First order has equal successive half-lives; zero order half-lives shrink (T, T/2, T/4) |
| Chemical kinetics | arrhenius-lnk-plot | diagrams/ug26-306-u3-chemical-kinetics-arrhenius-lnk-plot.svg | ln k against 1/T: slope -Ea/R, intercept ln A |
| Chemical kinetics | energy-profile-catalyst | diagrams/ug26-306-u3-chemical-kinetics-energy-profile-catalyst.svg | A catalyst lowers Ea only; delta H and reactant and product levels are unchanged |
| d- and f-block | periodic-table-blocks | diagrams/ug26-306-u4-d-f-block-periodic-table-blocks.svg | Position of s, p, d, f blocks; d series 3d to 6d; lanthanoids and actinoids below |
| d- and f-block | 3d-radius-trend | diagrams/ug26-306-u4-d-f-block-3d-radius-trend.svg | Atomic radius falls, levels off, then rises slightly across the 3d series (schematic) |
| d- and f-block | lanthanoid-contraction | diagrams/ug26-306-u4-d-f-block-lanthanoid-contraction.svg | Ln3+ radius falls from La to Lu; consequence: Zr and Hf have almost equal radii |
| d- and f-block | oxidation-states-3d | diagrams/ug26-306-u4-d-f-block-oxidation-states-3d.svg | Oxidation states of Sc to Zn from the lesson table; maximum at Mn (+7) |
| Coordination compounds | cis-trans-octahedral | diagrams/ug26-306-u5-coordination-compounds-cis-trans-octahedral.svg | cis (90 degrees) and trans (180 degrees) isomers of an [Ma4b2] octahedral complex |
| Coordination compounds | three-geometries | diagrams/ug26-306-u5-coordination-compounds-three-geometries.svg | Octahedral, tetrahedral and square planar shapes with examples |
| Coordination compounds | octahedral-splitting | diagrams/ug26-306-u5-coordination-compounds-octahedral-splitting.svg | t2g below eg; -0.4 delta o and +0.6 delta o; gap delta o |
| Coordination compounds | tetrahedral-splitting | diagrams/ug26-306-u5-coordination-compounds-tetrahedral-splitting.svg | e below t2 and delta t = 4/9 delta o, on the same scale as octahedral |
| Coordination compounds | high-low-spin-d6 | diagrams/ug26-306-u5-coordination-compounds-high-low-spin-d6.svg | [CoF6]3- high spin (4 unpaired) against [Co(NH3)6]3+ low spin (0 unpaired) |

## New comparison tables

| Lesson | Table | Placed after |
|---|---|---|
| Solutions | Raoult's law and Henry's law compared | text "Raoult's law is a special case of Henry's law" |
| Solutions | Osmosis and reverse osmosis compared | key point on reverse osmosis |
| Electrochemistry | Conductivity and molar conductivity compared | molar conductivity formula |
| Electrochemistry | Primary and secondary batteries compared | text on nickel-cadmium cell |
| Chemical kinetics | Rate of reaction and rate constant compared | definition of rate constant |
| Chemical kinetics | Raising the temperature and adding a catalyst compared | text on the role of a catalyst |
| d- and f-block | d-block elements and transition elements compared | text on lanthanoids and actinoids positions |
| d- and f-block | Chromate and dichromate ions compared | text on chromate-dichromate interconversion |
| Coordination compounds | Octahedral and tetrahedral crystal fields compared | formula for tetrahedral splitting |
| Coordination compounds | Valence bond theory and crystal field theory compared | text on limitations of CFT |

## Needs subject-expert review

1. Electrochemistry, electrolytic-cell figure: shows molten NaCl with inert electrodes. Check that "inert electrodes" is acceptable (the figure does not name the electrode material).
2. Electrochemistry, conductivity graphs: kappa against c is drawn as a rising, concave-down curve for both strong and weak electrolytes. Real strong-electrolyte kappa can level off or fall at high concentration; the figure only claims the dilute-range trend and is labelled illustrative. The weak-electrolyte Lambda_m curve is drawn with a dashed steep part and no numbers.
3. Solutions, cooling curves: the solution curve is drawn without supercooling and with a slow fall during freezing (standard textbook shape). The shape of the plateau is schematic.
4. Solutions, bp-elevation curves: the solution vapour pressure curve is drawn as the pure curve shifted to higher temperature, which is a schematic simplification (a real curve is lowered by a factor of x1, not shifted exactly).
5. d-block 3d-radius-trend: heights follow the typical fall, level and rise but are smoothed (the measured Mn value is slightly higher than the trend); the figure says it is schematic. No numbers are printed.
6. d-block lanthanoid-contraction: uses La3+ about 106 pm, Lu3+ about 85 pm, Ti about 147 pm, Zr about 160 pm, Hf about 159 pm. The 106, 85, 160 and 159 values already appear in the lesson text; the Ti value of 147 pm is the NCERT metallic radius from memory and should be confirmed. The bar chart has a non-zero baseline (stated in a note).
7. d-block oxidation-states-3d: uses the lesson's own table (bold = most common). Cr +6 and Mn +3, +4, +6, +7 are marked as "other states"; the expert may prefer a different "common" set.
8. d-block d-block versus transition table: row for Sc and Cu follows the lesson's definition (atom or common ion has an incomplete d subshell). Check wording on whether Sc is treated as a transition element.
9. Coordination, three-geometries: tetrahedron drawn with an apex and three base ligands rather than the usual cube inscription; the 109.5 degree angle is stated, not measured. The square planar view is a top view.
10. Coordination, tetrahedral-splitting: the octahedral and tetrahedral diagrams use the same energy scale with delta t = 4/9 delta o (48 and 108 px). Energies are schematic.
11. Coordination, high-low-spin-d6: the up and down electron arrows are tiny; confirm they read clearly at the size used in the lesson page.
12. Chemical kinetics, Arrhenius figure uses ln k; the lesson text uses log k. The callout states the 2.303 factor, but the expert may want the axis changed to match the lesson.
13. Chemical kinetics, half-life-comparison: zero-order successive half-lives T, T/2, T/4 follow from t1/2 proportional to [R]0; check the wording "2nd halving T/2, then T/4".
14. Chemical kinetics table: "Raising the temperature and adding a catalyst compared" says the equilibrium constant "changes (depends on delta H)" for temperature. This is correct but may be more than the syllabus needs.
15. Batteries table lists the mercury cell as a primary example; confirm it is within the intended syllabus (the lesson body covers the dry cell, lead storage and Ni-Cd cells).
16. All SVG text uses a minimum of 13 px; superscript and subscript digits are drawn as smaller tspans (about 75 percent of the label size), which is below 13 px for the digit only.
