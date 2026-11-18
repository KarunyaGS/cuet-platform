# Visual aids: Geography (313) units u06 to u09 (agent geo-b), 2026-11-18

## 1. Lessons audited (4)
| Lesson key | Title |
|---|---|
| ug26-313-u06-human-activities | Human Activities: primary to quaternary |
| ug26-313-u07-transport-communication-and-internatio | Transport, communication and international trade of India |
| ug26-313-u08-transport-communication-and-trade | Transport, communication and trade |
| ug26-313-u09-geographical-perspective-on-selected-i | Geographical perspective on selected issues and problems |

The `zz-more-*` files hold questions only and were not touched. Every figure uses only facts and numbers that appear in the lesson text, or is labelled illustrative or schematic. No maps, no outlines of India or the world, no political boundaries.

## 2. Figures added (15), each followed by a "What to learn from this figure" callout
Files are in content/packs/CUET_UG/313/diagrams/.

| Lesson | Key | File | Title | What the student learns |
|---|---|---|---|---|
| u06 | sector-tree | ug26-313-u06-human-activities-sector-tree.svg | Classification of economic activities | Primary, secondary, tertiary, quaternary with examples; quinary as a higher level |
| u06 | sector-share-concept | ug26-313-u06-human-activities-sector-share-concept.svg | Sector shares of workers with development (illustrative) | Direction of change: primary falls, tertiary and quaternary rise, secondary peaks then falls |
| u06 | mining-methods | ug26-313-u06-human-activities-mining-methods.svg | Open-cast vs underground mining | Depth decides the method; cost and safety trade-off |
| u06 | shifting-cultivation-cycle | ug26-313-u06-human-activities-shifting-cultivation-cycle.svg | Cycle of shifting cultivation | Clear and burn, cultivate, fertility falls, abandon, recover; needs low density and plenty of land |
| u07 | port-hinterland | ug26-313-u07-transport-india-port-hinterland.svg | A port and its hinterland | Meaning of hinterland and its road, rail, river links |
| u07 | rail-gauges | ug26-313-u07-transport-india-rail-gauges.svg | Railway gauges compared | Gauge = distance between rails; widths drawn to scale from 1.676, 1.000, 0.762, 0.610 m |
| u07 | balance-of-trade | ug26-313-u07-transport-india-balance-of-trade.svg | Surplus, balanced, deficit (illustrative) | Balance of trade = exports minus imports |
| u08 | canal-route-distances | ug26-313-u08-transport-trade-canal-route-distances.svg | Distance saved by a canal | Bars from the worked problem: 21,000 and 12,000 km, saving 9,000 km |
| u08 | hub-vs-point-to-point | ug26-313-u08-transport-trade-hub-vs-point-to-point.svg | Hub-and-spoke vs point-to-point | 5 airports: 4 routes via a hub vs 10 direct routes |
| u08 | bilateral-multilateral | ug26-313-u08-transport-trade-bilateral-multilateral.svg | Bilateral and multilateral trade | Two partners vs many partners |
| u09 | pollution-cause-effect | ug26-313-u09-selected-issues-pollution-cause-effect.svg | Sources and effects of air and water pollution | Cause, type, effect, remedy for answers |
| u09 | eutrophication-chain | ug26-313-u09-selected-issues-eutrophication-chain.svg | How eutrophication develops | Run-off, nutrients, algae, oxygen loss, fish die |
| u09 | waste-hierarchy | ug26-313-u09-selected-issues-waste-hierarchy.svg | Waste hierarchy | Reduce, reuse, recycle, dispose (last resort) |
| u09 | push-pull-migration | ug26-313-u09-selected-issues-push-pull-migration.svg | Push and pull factors | Village push, city pull, remittances, strain on city services |
| u09 | waterlogging-salinity | ug26-313-u09-selected-issues-waterlogging-salinity.svg | Waterlogging leading to salinity | Rising water table without drainage brings salts up; remedies |

All 15 were rendered with `render-svg` and viewed; overlaps and clipping were fixed and re-rendered. Generator scripts are in D:\tmp\gen-geo-b\ (outside the repo).

## 3. New tables added (4)
| Lesson | Caption | Confusion it resolves |
|---|---|---|
| u06 | Primitive subsistence, intensive subsistence and modern agriculture compared | The lesson described the three agriculture types only in prose |
| u07 | Five modes of transport in India compared | Roads vs rail vs waterways vs air vs pipelines (the lesson's only table covers road classes) |
| u08 | Modes of transport compared | The "no single mode is best" criteria were never tabulated |
| u08 | Comparative advantage worked with illustrative numbers (plus a callout) | Comparative vs absolute advantage; opportunity cost |

## 4. Not drawn, and why
- Weber's least-cost triangle, industrial location diagram: the lessons only list location factors in one line; skipped rather than invent content.
- Gravity or distance-decay graph, containerisation flow, trade blocs: not taught in these lessons.
- Maps of the Golden Quadrilateral, National Waterways, ports, canals, air and rail routes: would need outlines, which the brief forbids.
- Slums, urban waste methods, land-degradation remedies: already served by existing text and a waste-methods table (u09); a slum cycle was not drawn to avoid unsupported claims.

## 5. Format note
These four JSON files use 1-space indent and CRLF line endings with no trailing newline (not 2-space as the brief says). I preserved each file's existing style (an exact round-trip check passed before patching), so only the inserted blocks and diagram entries differ. Validator: `npm run ingest -- content-validate --exam CUET_UG --paper 313` printed OK for all 18 packs.

## 6. Needs subject-expert review
1. u06 sector-tree: quinary shown as "a higher level" under quaternary, "top decision makers in government and business" (as the lesson states). Check it matches the expected NCERT treatment.
2. u06 sector-share-concept: the 60/15/25, 25/40/35 and 8/27/65 splits are invented and labelled illustrative. Check the stated pattern (secondary peaks at the industrial stage, then falls).
3. u06 shifting-cultivation-cycle: the "then a new patch is cleared" arrow from recovery back to step 1 is my wording; the lesson says only that the farmer moves on and the plot recovers.
4. u06 mining-methods: the shallow seam under the pit versus the deep seam reached by a shaft and gallery is schematic.
5. u06 agriculture table: check the three columns against NCERT for anything the lesson text simplifies.
6. u07 rail-gauges: gaps drawn in proportion to the lesson's values (1.676, 1.000, 0.762, 0.610 m). Check these values against NCERT.
7. u07 modes table: "Railways: run only on track, with three gauges in use" is a mild paraphrase, not a drawback stated in the lesson.
8. u08 hub-vs-point-to-point: the counts (4 routes via a hub for 5 airports; 10 routes for every pair) are arithmetic, not lesson text.
9. u08 comparative-advantage table: all numbers invented (A: 6 wheat or 3 cloth per day; B: 2 and 2). Opportunity costs (cloth 2 vs 1 wheat; wheat 0.5 vs 1 cloth) were hand-checked.
10. u08 canal-route-distances: uses only the worked problem's 21,000 and 12,000 km, labelled as not real route lengths.
11. u08 modes table: "most long-distance trade by volume" (ocean routes) and "rail network densest where traffic is large" come from the lesson text; check wording against NCERT.
12. u09 pollution-cause-effect: effects follow the lesson (smog, acid rain, harm to crops and monuments, cholera, typhoid, dysentery); check the attributions.
13. u09 eutrophication-chain: the step "excess nutrients build up in the water" is standard but not worded so in the lesson.
14. u09 waterlogging-salinity: panel A (water table well below the roots) is a conceptual baseline not stated in the lesson; panel B and the gypsum remedy follow the lesson.
15. u09 waste-hierarchy: funnel width is only a visual device, not a quantity.
