# Visual aids for CUET-UG Chemistry (306) units 6 to 10, 2026-11-18

All figures are original code-drawn SVG in `content/packs/CUET_UG/306/diagrams/`. Each is declared in its pack's `diagrams` array, placed as a DIAGRAM block right after the text it illustrates, and followed by a CALLOUT beginning "What to learn from this figure:". No existing block, question, key or id was changed. Nothing was committed, imported or deployed.

Validator: `npm run ingest -- content-validate --exam CUET_UG --paper 306` printed OK for all five packs (30 of 30 packs valid at the time of the run). Every SVG was rendered with `render-svg` and checked by eye (PNGs in `D:/tmp/render-chem-b/`).

## Counts

| Lesson | Diagrams added | New tables added |
|---|---|---|
| u6 haloalkanes and haloarenes | 4 | 2 |
| u7 alcohols, phenols and ethers | 4 | 2 |
| u8 aldehydes, ketones and acids | 5 | 2 |
| u9 amines | 4 | 1 |
| u10 biomolecules | 5 | 2 |
| Total | 22 | 9 |

## Diagrams

| Lesson | Diagram key | File | What the student learns |
|---|---|---|---|
| u6 | haloalkane-map | diagrams/ug26-306-u6-haloalkanes-haloalkane-map.svg | Reaction map of R-X: the reagent for each conversion (alcohol, ether, nitrile, isocyanide, amine, alkene, Grignard, Wurtz, reduction) and three ways of making R-X |
| u6 | sn2-mechanism | diagrams/ug26-306-u6-haloalkanes-sn2-mechanism.svg | One step, backside attack, partial bonds, inversion; one-hump energy profile (illustrative) |
| u6 | sn1-mechanism | diagrams/ug26-306-u6-haloalkanes-sn1-mechanism.svg | Slow ionisation, planar carbocation, attack from either face (racemisation); two-hump energy profile (illustrative) |
| u6 | sn-reactivity | diagrams/ug26-306-u6-haloalkanes-sn-reactivity.svg | SN2 order is methyl > 1° > 2° > 3°, SN1 order is the reverse (qualitative bars) |
| u7 | boiling-points | diagrams/ug26-306-u7-alcohols-boiling-points.svg | Hydrogen bonding lifts alcohol boiling points; values taken from the lesson table |
| u7 | alcohol-map | diagrams/ug26-306-u7-alcohols-alcohol-map.svg | How alcohols are made and what they become (alkoxide, ester, halide, alkene, ether, aldehyde, acid, ketone) |
| u7 | test-flow | diagrams/ug26-306-u7-alcohols-test-flow.svg | Neutral FeCl3 picks out phenol, then the Lucas reagent separates 3°, 2° and 1° alcohols |
| u7 | phenol-map | diagrams/ug26-306-u7-alcohols-phenol-map.svg | Four preparations of phenol and ten reactions (O-H reactions and ring substitution) |
| u8 | nucleophilic-addition | diagrams/ug26-306-u8-carbonyls-nucleophilic-addition.svg | Planar C=O, attack by Nu-, tetrahedral alkoxide, protonation; why HCHO > RCHO > ketone |
| u8 | boiling-points | diagrams/ug26-306-u8-carbonyls-boiling-points.svg | Boiling point order for similar molar mass; values from the lesson table |
| u8 | carbonyl-map | diagrams/ug26-306-u8-carbonyls-carbonyl-map.svg | Preparation routes and ten reactions of aldehydes and ketones, marking which need an aldehyde or a special group |
| u8 | test-flow | diagrams/ug26-306-u8-carbonyls-test-flow.svg | 2,4-DNP, Tollens', Fehling's and iodoform tests in order |
| u8 | acid-map | diagrams/ug26-306-u8-carbonyls-acid-map.svg | Four preparations and seven reactions of carboxylic acids |
| u9 | basicity-bars | diagrams/ug26-306-u9-amines-basicity-bars.svg | pKb bars: (CH3)2NH, CH3NH2, (CH3)3N, NH3, aniline |
| u9 | test-flow | diagrams/ug26-306-u9-amines-test-flow.svg | Hinsberg test splits 1°, 2°, 3° amines; carbylamine and nitrous acid confirm |
| u9 | amine-map | diagrams/ug26-306-u9-amines-amine-map.svg | Five preparations (with limits) and eight reactions of a primary amine, including Hinsberg, carbylamine and HNO2 |
| u9 | diazonium-map | diagrams/ug26-306-u9-amines-diazonium-map.svg | Replacement (Sandmeyer, KI, Balz-Schiemann, H2O, H3PO2) and coupling reactions of benzenediazonium chloride |
| u10 | carbohydrate-tree | diagrams/ug26-306-u10-biomolecules-carbohydrate-tree.svg | Classification by hydrolysis; aldose and ketose; sugars and non-sugars |
| u10 | glucose-forms | diagrams/ug26-306-u10-biomolecules-glucose-forms.svg | Open chain (Fischer) closing to alpha and beta pyranose (Haworth) forms, anomers, mutarotation |
| u10 | peptide-bond | diagrams/ug26-306-u10-biomolecules-peptide-bond.svg | Gly + Ala gives Gly-Ala + H2O; the -CO-NH- bond; n amino acids give n-1 bonds |
| u10 | protein-levels | diagrams/ug26-306-u10-biomolecules-protein-levels.svg | Primary, secondary (helix and sheet), tertiary and quaternary structure with the forces involved (schematic) |
| u10 | dna-pairing | diagrams/ug26-306-u10-biomolecules-dna-pairing.svg | A-T two hydrogen bonds, G-C three; antiparallel backbones; Chargaff's rule |

## New comparison tables (none duplicates an existing table)

| Lesson | Table | Placed after |
|---|---|---|
| u6 | Which reagent gives which product from R-X (aq. vs alc. KOH, KCN vs AgCN, KNO2 vs AgNO2) | haloalkane map |
| u6 | Stereochemical outcome: inversion, racemisation, retention | the configuration text |
| u7 | Primary, secondary and tertiary alcohols compared | alcohol map |
| u7 | Alcohol versus phenol | phenol map |
| u8 | Aldehyde versus ketone | nucleophilic addition figure |
| u8 | Aldol condensation versus Cannizzaro reaction | the exam-tip callout on alpha hydrogens |
| u9 | Aliphatic amines versus aniline | the basicity callout |
| u10 | alpha-glucose versus beta-glucose | glucose forms figure |
| u10 | Fibrous versus globular proteins | levels-of-structure table |

## Needs subject-expert review

1. **Aromatic aldehyde against ketone reactivity.** The lesson's key point says aromatic aldehydes are more reactive than ketones. The u8 figure shows only HCHO > CH3CHO > CH3COCH3 and notes that aromatic aldehydes are less reactive than aliphatic ones, because textbooks disagree about benzaldehyde against propanone. The old key point in the pack was left unchanged.
2. **Neutral FeCl3 test for phenol (u7 flow chart and alcohol-versus-phenol table).** It is standard, but the existing u7 lesson text never mentions it. Consider adding a sentence to the lesson text.
3. **Lucas test range.** The flow chart says it is reliable for alcohols of about 3 to 6 carbons that dissolve in the reagent. This is from general knowledge, not from the lesson.
4. **Aniline pKb 9.38.** The lesson gives pKb values only for the methyl and ethyl series. The aniline value (9.38) is the usual textbook figure, labelled "typical textbook values" on the chart. The methylamine and dimethylamine values (3.38, 3.27) follow the lesson's list.
5. **Azo dye colours (u9 diazonium map).** p-hydroxyazobenzene is labelled orange and p-aminoazobenzene yellow. Check against the syllabus wording.
6. **Alkane + X2 / light as a route to R-X (u6 map).** Included as a standard route, but it is non-selective and gives mixtures. Check that you want it on the map.
7. **Solvent statements in the SN1 and SN2 boxes** (polar aprotic favours SN2, polar protic favours SN1, strong or weak nucleophile) go slightly beyond the lesson text; they are standard but may be beyond NCERT depth.
8. **Dehydration temperatures in the 1°/2°/3° alcohol table** (443 K, about 440 K, 358 K) are copied from the lesson text. In the map, 413 K for ether formation is the usual NCERT value.
9. **Simplified conditions.** Gabriel synthesis is shown as "KOH; R-X; then NaOH"; Kolbe as "NaOH; CO2; then H+"; Hofmann as "Br2 + NaOH". Pressure and temperature details are left out on purpose.
10. **Energy profiles** (SN1, SN2) are illustrative shapes. The SN2 drawing uses H, CH3 and C2H5 as the three other groups (a 2-bromobutane-type carbon); it is a pictorial example, not a specific worked case.
11. **Schematic drawings.** The Haworth rings (the C-3 OH label sits close to the ring interior), the alpha-helix, beta-sheet, tertiary fold and haemoglobin subunits are schematic, not to scale.

## Reactions deliberately left out (not certain they are in the syllabus, or too detailed)

- Sodium hydrogensulphite addition to aldehydes and ketones (the lesson mentions it; left off the carbonyl map).
- Finkelstein and Swarts halogen exchange (R-X map).
- Gattermann (Cu powder) variant of the diazonium replacement (it is in the lesson table, not on the map).
- Kolbe electrolysis, Etard, Gattermann-Koch and ozonolysis routes (the carbonyl map shows only the main preparations).
- KNO2 and AgNO2 are in the new u6 table but not on the R-X map, to keep the map readable.
