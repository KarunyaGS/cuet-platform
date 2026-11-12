# Content packs (lessons, diagrams, questions)

One **pack** teaches one verified syllabus row completely and tests it. Packs are files in the repo; the
importer loads them into local D1/R2. Everything authored with AI help is stored as `origin = AI_ASSISTED`,
`status = DRAFT`, `verification = UNVERIFIED`, and students see it labelled "AI-assisted, not yet expert-reviewed"
until a subject expert verifies it in the reviewer tools. Nothing in a pack can mark content verified.

```
content/syllabus/<EXAM>/<code>.json            verified syllabus rows (export: npm run ingest -- content-snapshot --exam CUET_UG --paper 322)
content/packs/<EXAM>/<code>/<slug>.json        one pack per syllabus row
content/packs/<EXAM>/<code>/diagrams/<x>.svg   its diagrams
```

Commands (run from the repo root, with `TEMP=D:/tmp` on this machine):

| Command | What it does |
|---|---|
| `npm run ingest -- content-validate --exam CUET_UG --paper 322` | Validates every pack of the paper. Must print `OK` for every file. |
| `npm run ingest -- render-svg <in.svg> <out.png>` | Renders a diagram to PNG so you can look at it before import. |
| `npm run ingest -- content-import --exam CUET_UG --paper 322` | Imports valid packs (local API must be running). Idempotent. |

## Pack format

```jsonc
{
  "schema": "cuet-content-pack/1",
  "exam": "CUET_UG", "year": 2026, "paperCode": "322", "origin": "AI_ASSISTED",
  "node": { "id": "cn_…", "title": "<the syllabus row title, copied from the snapshot>" },
  "lesson": {
    "key": "ug26-322-coulombs-law",          // lowercase, unique everywhere
    "title": "Electric charge and Coulomb's law",
    "coverage": [                              // every concept the syllabus row names -> the HEADING that teaches it
      { "phrase": "Conservation of charge", "section": "Conservation and quantisation of charge" }
    ],
    "blocks": [ /* see block types */ ]
  },
  "diagrams": [
    { "key": "two-charges-forces", "file": "diagrams/ug26-322-coulombs-law-two-charges.svg",
      "alt": "Two point charges q1 and q2 separated by r, with equal and opposite force arrows",
      "caption": "Coulomb forces between two like charges", "description": "Longer description for screen readers" }
  ],
  "questions": [ /* see questions */ ]
}
```

### Block types (in teaching order)

| type | fields | use |
|---|---|---|
| `HEADING` | `text` | Section titles. Every `coverage.section` must be one of these. At least 3. |
| `TEXT` | `text` | Explanations and theory (Markdown subset, below). |
| `CONCEPT` | `text` | The core idea of a section, stated precisely. |
| `DEFINITION` | `term`, `text` | Formal definitions (with SI units where relevant). At least 1. |
| `FORMULA` | `latex`, `text` | Display formula in LaTeX (KaTeX), `text` = what each symbol means, conditions, units. |
| `TABLE` | `caption`, `columns`, `rows` | Comparisons, properties, revision tables. |
| `DIAGRAM` | `diagram` | Key of an entry in `diagrams`. |
| `EXAMPLE` | `text` | Short illustrative example. |
| `SOLVED_PROBLEM` | `problem`, `solution`, `answer` | Full working, step by step. At least 2 per pack. |
| `KEY_POINT` / `IMPORTANT_FACT` | `text` | Revision points. At least 1. |
| `CALLOUT` | `text` | Exam tips, common mistakes, shortcuts. |

**Text format:** paragraphs separated by a blank line; `- ` bullets; `1. ` numbered lists; `**bold**`, `*italic*`;
inline maths `$...$` and display maths `$$...$$` in LaTeX (KaTeX subset; the validator renders every formula and
rejects any that fail). Use `\times`, `\varepsilon_0`, `\mu_0`, `\vec{E}`, `\frac{}{}`, `^{}`, `_{}`, `\,\text{N}` for units.

### Questions (CUET format: 4 options, one correct)

```jsonc
{
  "key": "ug26-322-coulombs-law-q01", "type": "MCQ_SINGLE", "difficulty": "MEDIUM", "skill": "numerical",
  "stem": "Two point charges …", "options": ["…", "…", "…", "…"], "answer": 3,
  "explanation": "Full reasoning and working (30+ words): why 3 is right.",
  "optionRationale": { "1": "why 1 is wrong", "2": "…", "4": "…" },
  "objective": "Apply Coulomb's law with the superposition principle"
}
```

| type | rules |
|---|---|
| `MCQ_SINGLE` | Conceptual, numerical (numeric options), application. |
| `ASSERTION_REASON` | Stem contains `Assertion (A): …` and `Reason (R): …`; options are exactly the four standard ones (`AR_OPTIONS` in `content-ingestion/src/content.ts`). |
| `MATCH_THE_FOLLOWING` | `list: { left: [...], right: [...] }` (List-I items A–D, List-II items I–IV); options are codes such as `A-II, B-IV, C-I, D-III`. |
| `STATEMENT_BASED` | Stem lists statements `A.` `B.` `C.` (`D.`); options such as `A and B only`. |
| `DIAGRAM_BASED` | `diagram` = key of a declared diagram, shown with the stem. |

Validator rules: 4 distinct options; answer 1–4; explanation 30+ words; at least 10 questions per pack (about
2–3 per distinct concept in the row, no padding); at least 3 formats; at least 15% easy, 25% medium, 15% hard; no
duplicate questions anywhere in the paper; no placeholder text; all maths renders.

## Diagrams (SVG)

Hand-drawn, accurate, labelled SVG: `viewBox` set, `font-family="Arial, Helvetica, sans-serif"`, labels 13–16
px, strokes 1.5–2.5 px, dark ink (`#1f2937`) on transparent background, accents `#2563eb` (blue), `#dc2626` (red),
`#059669` (green), `#d97706` (amber). Draw arrowheads as small filled `<polygon>`s (the preview renderer does not draw `<marker>`s, so do not use them).
Not allowed: `<script>`, event handlers, `<image>`, `<foreignObject>`, external links. At least two `<text>`
labels. Graphs need labelled axes (quantity and unit). Render each one with `render-svg` and look at the PNG:
check that nothing overlaps, labels are legible, and the physics is right (directions, signs, shapes).

## Quality bar

- Scope: the CUET syllabus row, at the depth of the NCERT Class 12 (UG) or the stated PG course; examination-focused.
- Original writing. Do not copy textbook text.
- Every number is computed and re-checked; units on every quantity; SI units.
- A student must be able to learn the topic from the lesson alone: theory, definitions, formulas with meanings,
  derivations where the syllabus asks for them, worked examples, common mistakes, revision points.
