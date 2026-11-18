# Visual aids: Geography 313, lessons u01 to u05 (agent geo-a, 2026-11-18)

## 1. Lessons audited (5)
- `ug26-313-u01-people.json` (People of India)
- `ug26-313-u02-human-geography-nature-and-scope.json`
- `ug26-313-u03-people.json` (People of the world)
- `ug26-313-u04-human-settlements.json`
- `ug26-313-u05-resources-and-development.json`

All five had an empty `diagrams` array. No existing block, question, key or id was changed; only DIAGRAM, CALLOUT and TABLE blocks were inserted and the `diagrams` array filled. No maps, no political boundaries; all drawings are schematic and labelled "schematic / illustrative / not to scale". Files are in `content/packs/CUET_UG/313/diagrams/` (21 SVGs). Generator scripts are outside the repo in `D:\tmp\gen-geo-a\`.

## 2. Figures added (21)
| Lesson | Key | File (under diagrams/) | Title | What the student learns |
|---|---|---|---|---|
| u01 | density-vs-distribution | ug26-313-u01-people-density-vs-distribution.svg | Density and distribution are different ideas | Same area and same total people give the same density, yet the spread can differ |
| u01 | growth-components | ug26-313-u01-people-growth-components.svg | Three components of population change | Births and in-migrants add, deaths and out-migrants remove; natural increase + net migration = total change |
| u01 | growth-phases | ug26-313-u01-people-growth-phases.svg | Birth and death rates behind the four phases (schematic) | The gap between birth and death rates explains each of the four growth phases |
| u02 | naturalisation-humanisation | ug26-313-u02-human-geography-naturalisation-humanisation.svg | Naturalisation of humans and humanisation of nature | Which side dominates in early vs later societies; nature still sets limits |
| u02 | three-approaches | ug26-313-u02-human-geography-three-approaches.svg | Determinism, neo-determinism, possibilism on a line | Position, scholar and example of each approach |
| u02 | branches | ug26-313-u02-human-geography-branches.svg | Fields and sub-fields | One keyword per sub-field |
| u02 | stages-of-growth | ug26-313-u02-human-geography-stages-of-growth.svg | Seven stages in the growth of the subject | The ordered stages with a keyword each |
| u03 | three-densities | ug26-313-u03-people-world-three-densities.svg | Arithmetic, physiological, agricultural density | Same people and land, different numerator and denominator |
| u03 | demographic-transition | ug26-313-u03-people-world-demographic-transition.svg | Three stages of demographic transition (schematic) | Death rate falls first, birth rate later; the gap is natural increase |
| u03 | age-sex-pyramids | ug26-313-u03-people-world-age-sex-pyramids.svg | Expanding, constant, declining pyramids (schematic) | How to read population structure from the pyramid shape |
| u03 | hdi-components | ug26-313-u03-people-world-hdi-components.svg | How the HDI is built | Three dimensions, each an index 0 to 1, combined; income is one part only |
| u04 | rural-grouping | ug26-313-u04-human-settlements-rural-grouping.svg | Clustered, semi-clustered, hamleted, dispersed (plans) | Classification by grouping of houses |
| u04 | rural-patterns | ug26-313-u04-human-settlements-rural-patterns.svg | Rural settlement patterns (plans) | Classification by shape: linear, rectangular, circular, star-like, T-shaped, double village |
| u04 | census-town-tests | ug26-313-u04-human-settlements-census-town-tests.svg | How the Census decides a place is urban | Statutory town OR census town passing all three tests |
| u04 | size-classes | ug26-313-u04-human-settlements-size-classes.svg | Six size classes of towns | Class I largest to VI smallest; city and million-plus city |
| u05 | net-sown-and-gross-cropped | ug26-313-u05-resources-development-net-sown-and-gross-cropped.svg | NSA, GCA and cropping intensity (illustrative) | Land cropped twice counts once in NSA, twice in GCA |
| u05 | cropping-seasons | ug26-313-u05-resources-development-cropping-seasons.svg | Kharif, rabi, zaid in order (schematic) | Sowing trigger and example crops of each season |
| u05 | rooftop-rainwater-harvesting | ug26-313-u05-resources-development-rooftop-rainwater-harvesting.svg | Rooftop rainwater harvesting (cross-section) | Store the water or recharge groundwater |
| u05 | mineral-classification | ug26-313-u05-resources-development-mineral-classification.svg | Classification of minerals | Metallic (ferrous / non-ferrous), non-metallic, mineral fuels |
| u05 | energy-sources | ug26-313-u05-resources-development-energy-sources.svg | Conventional and non-conventional energy | The two groups with examples |
| u05 | indira-gandhi-canal-case-study | ug26-313-u05-resources-development-indira-gandhi-canal-case-study.svg | Indira Gandhi Canal Command Area | Canal, problems, measures (no map) |

Each figure is followed by a "What to learn from this figure" CALLOUT. Figures were rendered with `render-svg` and checked; overlaps and clipping found in the first renders (u01 density footer, u02 traffic-light text, u03 transition label, u04 panel overflow, u04 size bars, u05 cropping caption) were fixed and re-rendered.

## 3. New tables added (5)
| Lesson | Caption | Confusion resolved |
|---|---|---|
| u01 | Absolute increase, growth rate and natural increase | Number added vs percentage vs births minus deaths (already flagged as a common mistake in the lesson) |
| u03 | Natural growth and actual growth | Whether migration is included |
| u03 | Stages of the demographic transition | Birth rate, death rate and growth in each stage |
| u04 | Rural and urban settlements compared | Main work and density, using only statements in the lesson |
| u05 | Kharif, rabi and zaid crops compared | Sowing/harvest timing and crops per season |

## 4. Lessons given no figure
None; all five received figures. Not illustrated (deliberately): linguistic and religious composition (u01) and the nine land-use categories, because the lesson gives no numbers that could be charted and a map or invented shares would be inaccurate. India and world maps were not drawn, per instructions.

## 5. Needs subject-expert review
- u01 growth-phases: the curve shapes are qualitative (death rate "with ups and downs" in 1901 to 1921, high flat birth rate to 1981, birth rate falling after 1981, gap still present). Claim to check: that a schematic birth/death-rate graph is acceptable for the four Census phases, and that "birth rate high and flat up to 1981" is fair for a schematic.
- u03 demographic-transition: shows only the three stages the lesson names (NCERT-style); the later stages (low and stable, declining) are not drawn. Check this matches the CUET syllabus expectation.
- u03 age-sex-pyramids: country examples (Nigeria expanding, Australia constant, Japan declining) are copied from the lesson text "as per NCERT"; check they are still the NCERT examples in the current edition.
- u03 hdi-components: wording "years of schooling" and "GNI per capita adjusted for purchasing power" follows the lesson; check against the current UNDP definition (the lesson also mentions the earlier literacy/enrolment measure, not drawn).
- u04 census-town-tests: "A place that is neither is treated as rural" is my wording of the lesson's rural/urban split; and "no further test needed" for a statutory town is an inference from "statutory town OR census town". Check both.
- u04 size-classes: Class VI "fewer than 5,000" is as in the lesson, but the census-town test needs 5,000; check that the class table is stated correctly.
- u04 rural-grouping: the hamleted drawing shows hamlets "with the same name as the parent village" per the lesson caption; the drawing itself cannot show names.
- u05 energy-sources: nuclear energy is listed under non-conventional, as the lesson does; the callout notes it is not renewable. Check the intended classification.
- u05 cropping-seasons: bar positions show order only, no months; "harvested in autumn" for kharif and "summer" for rabi are the lesson's words.
- u05 mineral-classification: "Mineral fuels" is shown as a third branch of minerals because the lesson says mineral fuels such as coal and petroleum are sources of energy; check this is the preferred structure.
- u05 rooftop-rainwater-harvesting: the layout (gutter, filter, storage tank or recharge pit to water table) is a generic conceptual design, not taken from the lesson beyond "collecting and storing rain, or letting it sink to recharge groundwater". The filter is my addition; check it is acceptable.
- u02 stages-of-growth: ordered as in the lesson; the lesson gives only one date (about the 1960s), so none were added.
