# Practical Labs across all seven CUET-UG subjects: audit and roadmap (19 November 2026)

All lab content is AI-assisted and **Draft – unverified** until a subject expert reviews it. Nothing here is committed, pushed or deployed.

## 1. What already exists (audit, to avoid duplication)
| Area | Existing | Notes |
|---|---|---|
| Lesson content | 7 subjects with lessons: Biology 13, Chemistry 10, Computer Science 22, Geography 9, Mathematics 25, Physics 32, General Aptitude Test (GAT) 5 | From the loaded content packs. |
| Static visuals | 269 diagrams added on 18 Nov across Biology, Mathematics, Computer Science, Geography and GAT, plus Physics (147 figures with notes) and Chemistry (about 60); flashcards, quick-revision sheets and chapter decks | The labs do **not** redraw these figures: a lab starts where a figure stops (a figure shows one state, a lab lets the student change it). |
| Practical labs | **Physics only, 5 labs:** Lens, Diffraction, Young's double slit (3D), Electric Field and Coulomb, Circuit Bench | The other six subjects have no practical lab. |
| Shared framework | `visual/labkit.tsx`: guided Predict, Experiment, Measure, Analyse, Understand, Apply flow; sliders; predict-then-test card; practice-question card with a "not complete yet" notice; scroll-to-top on open; completion saved once through the existing `LAB_COMPLETE` activity | Every new lab must use it, so the experience is the same in every subject. |
| Integration | `visual/labs.ts` registry: a card at the end of the right lesson section, plus (new) the **Practical labs** page `/labs` (sidebar link) listing every lab by subject | One registry entry per lab. Each entry now also names its **subject** and **format**. |
| Completion rule | A lab saves progress only after the whole practical (predictions, enough measured readings, all questions) | Verified by browser tests for all Physics labs. |

## 2. How labs are chosen
A topic gets a lab only if a student can **do** something that changes an outcome and **measure** it, and the result teaches a syllabus idea that a static figure cannot. 3D is used only where spatial understanding is the point (coordination compounds, vectors in 3D). Otherwise the format is the simplest honest one: a graph to manipulate, a virtual experiment, a step-by-step algorithm visualiser, a coding playground, a map activity or a puzzle board.

## 3. Subject-by-subject plan (from the real lessons and syllabus rows)
Status: **built**, **wave 1** (being built now), **wave 2** (next), later.

### Physics (32 lessons)
Built: Lens, Diffraction, Young's 3D, Electric Field, Circuit Bench.
Later, in value order: electromagnetic induction (magnet through a coil, Lenz's law); photoelectric effect (frequency, intensity, stopping potential); Bohr model and hydrogen spectrum; radioactive decay and binding energy; AC circuits and resonance; p-n junction and rectifier; ray optics (Snell, total internal reflection, prism); magnetic force and field of a current; capacitors; Gauss's law.

### Chemistry (10 units)
| Lab | Format | Syllabus unit | Wave |
|---|---|---|---|
| **Galvanic cell and electrolysis**: choose electrodes, build the cell, E°cell, Nernst equation, direction of electron flow, Faraday's laws, mass deposited | virtual experiment + graph | II Electrochemistry | **1** |
| Coordination compounds in 3D: geometries, cis/trans and other isomers, crystal-field splitting and spin | 3D model | V Coordination Compounds | 2 |
| Reaction rates: order from data, integrated rate laws, Arrhenius plot, effect of temperature and catalyst | graph exploration + particle simulation | III Chemical Kinetics | later |
| Colligative properties: Raoult's law, boiling-point elevation, freezing-point depression, osmosis | virtual experiment | I Solutions | later |
| SN1 and SN2 mechanism steppers; qualitative tests for aldehydes and amines | animated mechanism / virtual tests | VI, VIII, IX | later |
| Amino-acid pH and isoelectric point; glucose ring forms | interactive | X Biomolecules | later |

### Biology (13 lessons)
| Lab | Format | Lessons | Wave |
|---|---|---|---|
| **Genetics lab**: Punnett squares (monohybrid, dihybrid, test cross), ratios from simulated offspring, Hardy–Weinberg | interactive simulation | Principles of Inheritance; Evolution | **2** |
| Biotechnology bench: restriction digest, gel electrophoresis, PCR cycles | virtual experiment | Biotechnology: principles and processes | 2 |
| DNA replication, transcription and translation step-through | animated process | Molecular Basis of Inheritance | later |
| Population growth and predator–prey models | simulation + graph | Organisms and Populations; Ecosystem | later |
| Menstrual cycle hormones | interactive graph | Human Reproduction | later |

### Mathematics (25 lessons)
| Lab | Format | Lessons | Wave |
|---|---|---|---|
| **Area under a curve**: Riemann sums that converge to the definite integral, area between curves, signed area | graph manipulation | Integrals; Applications of integrals (this lesson has a table but no figure of its own) | **1** |
| Linear programming: constraints, feasible region, corner points, moving objective line | graph manipulation | Linear programming | 2 |
| Derivatives: tangent slope, increasing/decreasing, maxima and minima | graph exploration | Applications of derivatives | later |
| Probability distributions: binomial simulator, mean and variance | simulation | Probability distributions | later |
| Vectors, lines and planes in 3D | 3D | Vectors; Three-dimensional geometry | later |
| Time series: trend and moving average | data exploration | Time based data | later |

### Computer Science (22 lessons)
| Lab | Format | Lessons | Wave |
|---|---|---|---|
| **Data-structure and algorithm visualiser**: stack, queue and deque operations; bubble, insertion and selection sort; linear and binary search with step counts | step-by-step visualiser | Stack; Queue and Deque; Sorting; Searching | **1** |
| SQL playground: write queries on sample tables, see clause order and joins execute | coding playground (needs an in-browser SQL engine: a small custom interpreter or a library, decided when built) | SQL I and II; Database concepts | 2 |
| Pandas and Matplotlib workbench | coding playground | Data handling using Pandas; Plotting data | later |
| Networks: topologies, packet switching, data transmission | animated simulation | Computer Networks; Data Communication | later |

### Geography (9 lessons)
| Lab | Format | Lessons | Wave |
|---|---|---|---|
| **Population and human development**: demographic transition model, growth components, Human Development Index calculator (formula-based) | interactive simulation | People; Human Geography | **2** |
| Transport and trade network planner on a schematic India map | map activity | Transport, Communication and Trade | later |
| Settlement patterns: clustered, dispersed, linear; urban hierarchy | map sorting | Human Settlements | later |
| Land use, irrigation and water balance | interactive | Resources and Development | later |
Note: any map or statistic must come from a licensed, citable source (Census of India, NCERT, Natural Earth); illustrative numbers are labelled "illustrative".

### General Aptitude Test (5 lessons)
| Lab | Format | Lessons | Wave |
|---|---|---|---|
| **Venn diagram and syllogism builder**: drag circles, test which conclusions follow | puzzle board | Logical and analytical reasoning | **2** |
| Direction and distance grid; blood-relation trees; seating puzzles | puzzle board | Logical and analytical reasoning | later |
| Number series generator; coding–decoding | guided practice | Basic mathematics for reasoning | later |
| Data-interpretation charts with timed questions; clock and calendar | interactive | General mental ability and numerical aptitude | later |
General knowledge and general-science content is mostly factual recall, so no lab is planned for it unless a real hands-on idea appears.

## 4. Execution order
- **Wave 1 (building now):** Chemistry galvanic cell lab; Mathematics area-under-a-curve lab; Computer Science data-structure visualiser.
- **Wave 2:** Biology genetics lab; Geography population and human development lab; GAT Venn and syllogism lab. Then Chemistry coordination compounds (3D), Mathematics linear programming, Biology biotechnology bench, Computer Science SQL playground.
- **After that:** the "later" rows, Physics first (the most mature subject), then the others in the order above.
Each lab is a separate unit of work with its own tests, so a stopped agent never leaves a half-working lab in the app.

## 5. Quality rules for every lab (checked by tests)
1. The model is **pure code with its own unit tests**: every formula, every prediction answer and every practice answer is recomputed in a test.
2. Guided flow from the shared kit; at least 3 recorded readings or actions and a fit or comparison in Analyse; 4 predictions; 5 new CUET-style questions with explanations.
3. Completion saved only after the whole practical, once, through the existing `LAB_COMPLETE` mechanism; existing student records are never altered.
4. Opens at the top of the page; browser Back restores the lesson; touch, keyboard and phone layout; reset; no external services, no AI API.
5. Each lab appears as a card inside its lesson and on the Practical labs page.
6. Browser-tested against the real local app with isolated test students, never a real student's account.
7. All content marked Draft – unverified; each lab's claims added to `physics-expert-review` style lists for its subject expert.
