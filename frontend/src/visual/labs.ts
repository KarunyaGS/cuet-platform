/**
 * Registry of interactive labs and where each one appears in an existing lesson.
 * A lab is shown as a card at the END of the named section, so no lesson text is changed or duplicated.
 * Adding a lab is one entry here plus its page and route. Status of all lab content: Draft - unverified.
 */
/** The seven CUET-UG subjects that have (or will have) practical labs. */
export type LabSubject = 'Physics' | 'Chemistry' | 'Biology' | 'Mathematics' | 'Computer Science' | 'Geography' | 'General Aptitude Test';
export const LAB_SUBJECTS: LabSubject[] = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Computer Science', 'Geography', 'General Aptitude Test'];

import { SPECS } from './engine/specs';

export interface LabEntry {
  id: string;
  /** Which subject the lab belongs to (shown on the Practical Labs page). */
  subject: LabSubject;
  /** The kind of experience, in plain words, e.g. "3D virtual lab", "coding playground", "map activity". */
  format: string;
  /** The lesson's title starts with this. */
  lessonTitleStartsWith: string;
  /** Exact text of the section heading after which the card appears. */
  afterHeading: string;
  path: string;
  title: string;
  blurb: string;
  can: string[];
  minutes: number;
}

const MANUAL: LabEntry[] = [
  {
    id: 'lens',
    subject: 'Physics',
    format: '2D simulation · virtual experiment',
    lessonTitleStartsWith: 'Ray optics',
    afterHeading: 'Thin lenses and the thin lens formula',
    path: '/lab/lens',
    title: 'Lens Lab',
    blurb: 'Move an object along an optical bench, switch between convex and concave lenses, and see where the image forms.',
    can: ['Drag the object and watch the three principal rays', 'Predict the image, then test it', 'Record u and v readings and check 1/v − 1/u = 1/f'],
    minutes: 10,
  },
  {
    id: 'diffraction',
    subject: 'Physics',
    format: 'Virtual experiment · graph exploration',
    lessonTitleStartsWith: 'Diffraction of light',
    afterHeading: 'Width of the central maximum',
    path: '/lab/diffraction',
    title: 'Diffraction Lab',
    blurb: 'Send light through a single slit and see the pattern it makes. Change the slit width, the colour and the screen, and test the formula for the width of the central maximum.',
    can: ['Predict how the pattern changes, then test it', 'Drag a probe to the dark bands and read a sin θ = nλ', 'Record widths and check that they follow 2λD/a, near field and far field'],
    minutes: 12,
  },
  {
    id: 'young',
    subject: 'Physics',
    format: '3D virtual lab · animated tours',
    lessonTitleStartsWith: 'Coherent sources',
    afterHeading: 'Expression for fringe width',
    path: '/lab/young',
    title: 'Young’s Double-Slit 3D Lab',
    blurb: 'Walk around a real optical bench in 3D, watch the waves from both slits overlap, and measure the fringe width yourself as you change the wavelength, the slit separation and the screen distance.',
    can: ['Rotate, zoom and inspect the laser, the slit plate and the screen', 'Watch waves from two coherent sources add and cancel', 'Predict, measure and fit the fringe width β = λD/d'],
    minutes: 20,
  },
  {
    id: 'efield',
    subject: 'Physics',
    format: '2D simulation · virtual experiment',
    lessonTitleStartsWith: 'Electric charges',
    afterHeading: 'Forces between multiple charges: the superposition principle',
    path: '/lab/efield',
    title: 'Electric Field Lab',
    blurb: 'Drag positive and negative charges around, see the Coulomb forces and the field lines change live, and measure how the force depends on distance.',
    can: ['Drag charges and watch the force arrows and field lines', 'Predict, then test: distance, charge size, attraction and repulsion', 'Measure F at three distances and find k from a straight-line graph'],
    minutes: 15,
  },
  {
    id: 'efield',
    subject: 'Physics',
    format: '2D simulation · virtual experiment',
    lessonTitleStartsWith: 'Electric field, field lines',
    afterHeading: 'Electric field lines',
    path: '/lab/efield',
    title: 'Electric Field Lab',
    blurb: 'Place charges, drag a field probe around them, and see how the field lines, the field arrows and a dipole behave.',
    can: ['Watch field lines run from + to − with density proportional to charge', 'Move a probe and read the field from every charge added together', 'Try the dipole and compare its axial and equatorial fields'],
    minutes: 15,
  },
  {
    id: 'circuit',
    subject: 'Physics',
    format: 'Circuit builder · virtual experiment',
    lessonTitleStartsWith: 'Electric current, drift velocity',
    afterHeading: 'Internal resistance of a cell',
    path: '/lab/circuit',
    title: 'Circuit Bench',
    blurb: 'Build a circuit with a real cell, add resistors in series and in parallel, and read the current and voltage with a voltmeter and an ammeter as moving charge flows through it.',
    can: ['Change ε, r and R and watch the terminal voltage V = ε − I r fall', 'Predict, then test: series, parallel and the Wheatstone bridge', 'Measure V against I and find the emf and internal resistance from the line'],
    minutes: 20,
  },
  {
    id: 'circuit',
    subject: 'Physics',
    format: 'Circuit builder · virtual experiment',
    lessonTitleStartsWith: "Kirchhoff's rules",
    afterHeading: "Solving circuits with Kirchhoff's rules",
    path: '/lab/circuit?exp=kirch',
    title: 'Circuit Bench',
    blurb: 'Two cells, three branches: read every current, check the junction rule and both loop rules with live meters, then balance a Wheatstone bridge until the galvanometer reads zero.',
    can: ['Check that the currents at a junction and the volts round a loop sum to zero', 'Reverse a cell and see the branch currents change sign', 'Balance a Wheatstone bridge and find the unknown resistance'],
    minutes: 20,
  },
  {
    id: 'area',
    subject: 'Mathematics',
    format: 'Graph manipulation · simulation',
    lessonTitleStartsWith: 'Integrals: methods of integration',
    afterHeading: 'Fundamental Theorem of Calculus',
    path: '/lab/area',
    title: 'Area Under a Curve Lab',
    blurb: 'Drag the limits of an integral on a graph, fill the area with 1 to 200 strips, and watch the Riemann sum close in on the exact value from the fundamental theorem.',
    can: ['Compare left, right, midpoint and trapezoid sums as n grows', 'Predict, then test: error and n, which rule overestimates, odd functions', 'Record sums for n = 4, 8, 16, 32 and fit the slope of the error on a log-log graph'],
    minutes: 15,
  },
  {
    id: 'area',
    subject: 'Mathematics',
    format: 'Graph manipulation · simulation',
    lessonTitleStartsWith: 'Applications of integrals',
    afterHeading: 'Areas bounded by lines',
    path: '/lab/area?mode=between',
    title: 'Area Under a Curve Lab',
    blurb: 'Find where two curves meet, shade the region between them and see its area as the integral of (upper − lower); then explore signed area, where sin x over a whole period has integral 0 but total area 4.',
    can: ['Lines, parabolas, a circle and an ellipse, with the intersections found for you', 'Move the limits and see the area and the integral of the difference', 'Compare signed area and total area'],
    minutes: 15,
  },
  {
    id: 'area',
    subject: 'Mathematics',
    format: 'Graph manipulation · simulation',
    lessonTitleStartsWith: 'Integration and its applications',
    afterHeading: 'Definite Integrals',
    path: '/lab/area',
    title: 'Area Under a Curve Lab',
    blurb: 'See a definite integral as the limit of a sum: choose a function and interval, and watch the sums with 1 to 200 strips approach F(b) − F(a).',
    can: ['Compare left, right, midpoint and trapezoid sums as n grows', 'Check the exact value from the antiderivative', 'Find the area between curves and the signed area'],
    minutes: 15,
  },
  {
    id: 'galvanic',
    subject: 'Chemistry',
    format: 'Virtual experiment · graph exploration',
    lessonTitleStartsWith: 'Electrochemistry',
    afterHeading: 'Nernst equation and its applications',
    path: '/lab/galvanic',
    title: 'Galvanic Cell and Electrolysis Lab',
    blurb: 'Build a galvanic cell from two half-cells, choose the ion concentrations, and see the anode, the electron flow and the salt-bridge ions. Then pass a current through an electrolyte and weigh what is deposited.',
    can: ['Name the anode, then read E°cell, the Nernst Ecell, ΔG° and K', 'Predict, then test: concentration changes, Ecell = 0, and double the current', 'Record Ecell at three concentration ratios and recover n and E° from a straight line'],
    minutes: 20,
  },
  {
    id: 'algo',
    subject: 'Computer Science',
    format: 'Step-by-step visualiser',
    lessonTitleStartsWith: 'Stack',
    afterHeading: 'PUSH and POP: implementing a stack with a Python list',
    path: '/lab/algo?tab=stack',
    title: 'Data Structures and Algorithms Visualiser',
    blurb: 'Operate a stack, queue and deque, step through bubble, selection and insertion sort, and compare linear and binary search, with the Python code and live counts of comparisons and swaps.',
    can: ['Push, pop, enqueue and dequeue, with overflow and underflow, and check balanced brackets or reverse a string by hand', 'Step each sort one comparison at a time, or do the swaps yourself and be told if they are right', 'Count comparisons for linear and binary search and see n against log n and n squared'],
    minutes: 20,
  },
  {
    id: 'algo',
    subject: 'Computer Science',
    format: 'Step-by-step visualiser',
    lessonTitleStartsWith: 'Queue and Deque',
    afterHeading: 'Implementing a deque in Python',
    path: '/lab/algo?tab=stack',
    title: 'Data Structures and Algorithms Visualiser',
    blurb: 'Operate a stack, queue and deque, step through bubble, selection and insertion sort, and compare linear and binary search, with the Python code and live counts of comparisons and swaps.',
    can: ['Push, pop, enqueue and dequeue, with overflow and underflow, and check balanced brackets or reverse a string by hand', 'Step each sort one comparison at a time, or do the swaps yourself and be told if they are right', 'Count comparisons for linear and binary search and see n against log n and n squared'],
    minutes: 20,
  },
  {
    id: 'algo',
    subject: 'Computer Science',
    format: 'Step-by-step visualiser',
    lessonTitleStartsWith: 'Sorting',
    afterHeading: 'Best, worst and average cases by dry run',
    path: '/lab/algo?tab=sort',
    title: 'Data Structures and Algorithms Visualiser',
    blurb: 'Operate a stack, queue and deque, step through bubble, selection and insertion sort, and compare linear and binary search, with the Python code and live counts of comparisons and swaps.',
    can: ['Push, pop, enqueue and dequeue, with overflow and underflow, and check balanced brackets or reverse a string by hand', 'Step each sort one comparison at a time, or do the swaps yourself and be told if they are right', 'Count comparisons for linear and binary search and see n against log n and n squared'],
    minutes: 20,
  },
  {
    id: 'algo',
    subject: 'Computer Science',
    format: 'Step-by-step visualiser',
    lessonTitleStartsWith: 'Searching',
    afterHeading: 'Analysis of sequential and binary search',
    path: '/lab/algo?tab=search',
    title: 'Data Structures and Algorithms Visualiser',
    blurb: 'Operate a stack, queue and deque, step through bubble, selection and insertion sort, and compare linear and binary search, with the Python code and live counts of comparisons and swaps.',
    can: ['Push, pop, enqueue and dequeue, with overflow and underflow, and check balanced brackets or reverse a string by hand', 'Step each sort one comparison at a time, or do the swaps yourself and be told if they are right', 'Count comparisons for linear and binary search and see n against log n and n squared'],
    minutes: 20,
  },
  {
    id: 'genetics',
    subject: 'Biology',
    format: 'Interactive simulation',
    lessonTitleStartsWith: 'Principles of inheritance',
    afterHeading: "Mendel's laws: inheritance of one gene",
    path: '/lab/genetics?tab=cross',
    title: 'Genetics Lab: crosses and Hardy-Weinberg',
    blurb: 'Choose a cross, predict the boxes of a Punnett square, raise offspring with a seed you can repeat, solve a mystery parent, and see the allele frequency of a population change with drift and selection.',
    can: ['Predict each box of a Punnett square, then see the genotype and phenotype ratios', 'Raise 10, 50, 200 and 1000 offspring and watch the observed ratio close in on the expected one', 'Work out p from genotype counts, test for Hardy-Weinberg equilibrium and watch drift and selection'],
    minutes: 20,
  },
  {
    id: 'genetics',
    subject: 'Biology',
    format: 'Interactive simulation',
    lessonTitleStartsWith: 'Evolution',
    afterHeading: "Hardy-Weinberg principle and factors affecting it",
    path: '/lab/genetics?tab=hw',
    title: 'Genetics Lab: crosses and Hardy-Weinberg',
    blurb: 'Choose a cross, predict the boxes of a Punnett square, raise offspring with a seed you can repeat, solve a mystery parent, and see the allele frequency of a population change with drift and selection.',
    can: ['Predict each box of a Punnett square, then see the genotype and phenotype ratios', 'Raise 10, 50, 200 and 1000 offspring and watch the observed ratio close in on the expected one', 'Work out p from genotype counts, test for Hardy-Weinberg equilibrium and watch drift and selection'],
    minutes: 20,
  },
  {
    id: 'population',
    subject: 'Geography',
    format: 'Interactive simulation · graph exploration',
    lessonTitleStartsWith: 'People of the world',
    afterHeading: 'Population growth and change: spatial patterns',
    path: '/lab/population?tab=transition',
    title: 'Population and Human Development Lab',
    blurb: 'Work out arithmetic, physiological and agricultural density, steer a population through the demographic transition, morph an age-sex pyramid, and build a Human Development Index from health, education and income. All regions and profiles are illustrative.',
    can: ['Compute the three densities for a region and see what each tells a geographer', 'Move the death rate and birth rate falls and read the stage, the natural increase gap and the population', 'Morph a pyramid between expanding, constant and declining, and set the HDI inputs to see which dimension holds it back'],
    minutes: 20,
  },
  {
    id: 'population',
    subject: 'Geography',
    format: 'Interactive simulation · graph exploration',
    lessonTitleStartsWith: 'People of India',
    afterHeading: 'Population of India: distribution and density',
    path: '/lab/population?tab=density',
    title: 'Population and Human Development Lab',
    blurb: 'Work out arithmetic, physiological and agricultural density, steer a population through the demographic transition, morph an age-sex pyramid, and build a Human Development Index from health, education and income. All regions and profiles are illustrative.',
    can: ['Compute the three densities for a region and see what each tells a geographer', 'Move the death rate and birth rate falls and read the stage, the natural increase gap and the population', 'Morph a pyramid between expanding, constant and declining, and set the HDI inputs to see which dimension holds it back'],
    minutes: 20,
  },
  {
    id: 'syllogism',
    subject: 'General Aptitude Test',
    format: 'Puzzle board',
    lessonTitleStartsWith: 'Logical and analytical reasoning',
    afterHeading: 'Syllogisms and Venn diagrams',
    path: '/lab/syllogism?tab=build',
    title: 'Venn Diagram and Syllogism Lab',
    blurb: 'Drag three Venn circles, set the four statement types, and place X marks to build a picture that fits. Then test conclusions: the lab tries every possible picture and shows a counter-example or the shortest argument.',
    can: ['Drag and resize circles, add statements, and have your X marks checked for consistency', 'Decide Follows, Does not follow or Possible, then see the proof over every Venn picture', 'Practise generated syllogisms at three levels, with a hint that points to the region to check'],
    minutes: 20,
  },
];

/** Chapter labs described by a spec (visual/specs/*.tsx) are listed automatically: no edit here is needed to add one. */
const FROM_SPECS: LabEntry[] = SPECS.map((p) => ({
  id: p.id,
  subject: p.subject,
  format: p.format,
  lessonTitleStartsWith: p.lessonTitleStartsWith,
  afterHeading: p.afterHeading,
  path: `/lab/c/${p.id}`,
  title: p.title,
  blurb: p.blurb,
  can: p.can,
  minutes: p.minutes,
}));
export const LABS: LabEntry[] = [...MANUAL, ...FROM_SPECS];

export const labFor = (lessonTitle: string, heading: string) => LABS.find((l) => lessonTitle.startsWith(l.lessonTitleStartsWith) && l.afterHeading === heading);
export const labHref = (lab: LabEntry, lessonId: string, headingSlug: string) => `${lab.path}${lab.path.includes('?') ? '&' : '?'}lesson=${encodeURIComponent(lessonId)}&section=${encodeURIComponent(headingSlug)}`;
