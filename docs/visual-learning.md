# Visual learning (Physics prototype: Gravitation)

Status: a **local prototype for one topic**, waiting for review. Not deployed. Screenshots are in `docs/visual-learning/`.

## Redesign (13 November 2026, later)

The first version looked like a cartoon. It was redrawn in a scientific style; the content is unchanged. Before and after screenshots: `docs/visual-learning/before/` and `docs/visual-learning/after/`.

- **Step 2 is now a simulation.** The apple's position is computed from s = ½gt² at every frame, in real time or in slow motion. The student releases the apple, pauses, resumes and resets, and sets the height of the branch (2 to 5 m) and the mass of the apple (0.05 to 0.30 kg). A ruler in metres, the force vector F = mg, the acceleration g and the velocity v are drawn and labelled. A table shows each equation with the present numbers in it, two graphs (distance and speed against time) are traced as it falls, and a log of runs shows that the fall time does not change with mass.
- **Drawings:** shaded objects with light and shadow, thin labelled vectors, grids and rulers. This is careful 2D drawing, not 3D: no 3D library was added, and a precise 2D diagram was judged better here than an approximate 3D one.
- **Mind map:** labels on fine rules with small line drawings and a restrained palette, in place of coloured bubbles.
- **Flowchart:** standard notation (process boxes, a decision diamond, a rounded terminal), numbered stages, straight connectors, a moving dash on the connector into the current stage.
- **Notes:** a reading column with a side panel for the PDF, the contents and the points to remember.
- **Equations not from the chapter read:** v = gt and s = ½gt² are the standard equations of motion for constant acceleration (kinematics, an earlier chapter of the same book, which was not read for this work). The page says so. Air resistance is left out, and the page says that too.

## What a student gets

Open Physics, then the "Visual learning" card, or go to `/visual/gravitation`.

| Option | What it is |
|---|---|
| Visual explanation | A six-step story: the question, the apple falling, the force, the law (with controls to change mass and distance), a check, and a recap map |
| Mind map | A central topic with coloured branches. Fold and open branches, tap an idea to read it, zoom, drag, fit to screen, or switch to a list |
| Flowchart | "From the falling apple to the universal law": six stages, one decision with a wrong branch that explains itself, then a check |
| Read | The notes in order, with drawings, formulas and the chapter's worked example |
| Download PDF | A4, 6 pages, selectable text, vector drawings, page numbers |

## Where the content comes from

- **Source read:** NCERT, *Physics Part I, Textbook for Class XI*, Chapter 7 "Gravitation" (reprint 2026-27), 17 pages, downloaded from `https://ncert.nic.in/textbook/pdf/keph107.pdf` into a local working folder (`D:/tmp/visual`, not in the repository). SHA-256 is recorded in the pack.
- **How it was read:** the file's text layer is partly garbled, so the pages used were also read as page images: book pages 127, 129, 130, 133, 139 and 140.
- **Sections used:** 7.1, 7.3, 7.4, 7.5, 7.6 and the Summary. **Not used:** Kepler's laws, potential energy, escape speed, satellites.
- **Rights:** every page of the chapter is marked "© NCERT, not to be republished". Nothing from it is reproduced. The wording and all drawings are CUET Prep's own, written from the chapter's facts and terms, and every step, idea, stage, formula and note cites its section and page.
- **Review state:** written with AI assistance and **not yet reviewed by a subject expert**. The page and the PDF both say so.
- **Syllabus:** Gravitation is a Class 11 topic. It is not in the CUET (UG) Physics syllabus (it does appear in CUET (PG) Physics). It was the topic asked for, and the page says this plainly.

One figure is worked out here, not printed in the chapter: the moon's acceleration, about 0.0027 m s⁻². It follows from the chapter's own formula and numbers (T about 27.3 days, R about 3.84 × 10⁸ m), and agrees with the ratio of about 3600 that the chapter states.

## How it is built

No new dependencies. No backend or API change. No database change.

| File | Role |
|---|---|
| `frontend/src/visual/gravitation.ts` | The content pack: source, formulas, story steps, quiz, mind map, flowchart, notes. Plain data |
| `frontend/src/visual/art.tsx` | The drawings (SVG): tree and apple, earth and apple, the law's two bodies, figures, small icons |
| `frontend/src/visual/mapdraw.tsx`, `MindMap.tsx` | Mind-map layout and drawing; the interactive map |
| `frontend/src/visual/flowdraw.tsx`, `Flowchart.tsx` | Flowchart drawing; the interactive flowchart and the check |
| `frontend/src/pages/Visual.tsx` | The page: tabs, story, notes, download |
| `frontend/src/pages/Subject.tsx` | The entry card, shown on Physics only |
| `content-ingestion/src/visual-pdf.ts` | Builds the PDF from the same data and drawings (`npm run ingest -- visual-pdf-build`) |
| `frontend/public/visual/gravitation.pdf` | The built PDF, served as a static file |

Animation is CSS transitions on SVG; the site's existing "reduce motion" rule applies. Mind-map nodes and flowchart stages are focusable and work with Enter, Space and the arrow keys; the story also moves with the left and right arrow keys.

## Reference research

The eleven reference products were looked at for interaction patterns only. Most block automated reading, so the findings rest mainly on excerpts of their help pages, not on pages opened in full. Patterns adopted: one colour per branch, automatic layout, a visible fold control showing how many ideas are hidden, open-all and fold-all, one-tap fit to screen, a list view beside the map, step-through with on-screen next and back, and immediate feedback on a short check. Avoided for phones: hover-only controls, keyboard-only features, and a free canvas as the only view.

## Tests

- `content-ingestion/test/visual-pack.test.ts` (7 tests): every item cites the chapter; one right answer per check; mind-map and flowchart links are valid; the chapter's numbers are kept; the PDF page has real text and vector drawings.
- Browser check (scratch script, 44 checks): the six steps, the mind map, the flowchart, the notes, the PDF download and its contents, phone (390 px, touch), tablet (820 px), and that existing Physics pages are unchanged.

## Limits

- One topic only. Each further topic needs its own pack written and its own drawings.
- Not reviewed by a subject expert.
- The drawings are simple vector illustrations, not artwork by an illustrator.
- The mind map supports two levels below the centre.
- Checked in Chrome only.
- The PDF is rebuilt by a command, not automatically when the content changes.
