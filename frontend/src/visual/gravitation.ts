/**
 * Visual learning pack: Gravitation (prototype).
 *
 * Every fact, formula, number and term below was taken from the source after reading it page by page:
 * NCERT, "Physics Part I, Textbook for Class XI", Chapter 7 "Gravitation" (reprint 2026-27), sections 7.1 and 7.3 to 7.6
 * and the chapter Summary. The words and drawings here are CUET Prep's own; none of NCERT's text or figures is copied
 * (the book is marked "not to be republished"). `src` on each item names the section and book page it rests on.
 *
 * This is plain data with no React in it: the page, the mind map, the flowchart and the PDF builder all read it.
 */
export interface Src { section: string; page: number }
export interface Formula { latex: string; symbols: { sym: string; means: string }[] }

export const SOURCE = {
  publisher: 'NCERT',
  book: 'Physics Part I, Textbook for Class XI',
  chapter: 'Chapter 7: Gravitation',
  edition: 'Reprint 2026-27',
  url: 'https://ncert.nic.in/textbook/pdf/keph107.pdf',
  sha256: '631fbe30827cd5faa745698fe337ca2cf829356aa8124f1abb4f3d82b44d499a',
  pages: 17,
  readOn: '2026-11-13',
  sectionsUsed: ['7.1 Introduction', '7.3 Universal law of gravitation', '7.4 The gravitational constant', '7.5 Acceleration due to gravity of the earth', '7.6 Acceleration due to gravity below and above the surface of earth', 'Summary'],
  notUsed: ['7.2 Kepler’s laws', '7.7 Gravitational potential energy', '7.8 Escape speed', '7.9 Earth satellites', '7.10 Energy of an orbiting satellite'],
  rights: 'The textbook is NCERT’s and is marked “not to be republished”. Nothing from it is reproduced here: the wording and the drawings are CUET Prep’s own, written from the chapter’s facts and terms.',
};

export const TITLE = 'Gravitation';
export const QUESTION = 'Why does an apple fall towards the ground?';

export const FORMULAS = {
  law: {
    name: 'Universal law of gravitation',
    latex: 'F = G\\,\\dfrac{m_1 m_2}{r^2}',
    symbols: [
      { sym: 'F', means: 'gravitational force between the two bodies (newton, N)' },
      { sym: 'G', means: 'universal gravitational constant, 6.67 × 10⁻¹¹ N m² kg⁻²' },
      { sym: 'm_1,\\ m_2', means: 'masses of the two bodies (kg)' },
      { sym: 'r', means: 'distance between them (m)' },
    ],
    src: { section: '7.3', page: 130 },
  },
  g: {
    name: 'Acceleration due to gravity at the earth’s surface',
    latex: 'g = \\dfrac{F}{m} = \\dfrac{G M_E}{R_E^{\\,2}}',
    symbols: [
      { sym: 'g', means: 'acceleration due to gravity, about 9.8 m s⁻²' },
      { sym: 'M_E', means: 'mass of the earth' },
      { sym: 'R_E', means: 'radius of the earth' },
      { sym: 'F = mg', means: 'force on a body of mass m at the surface' },
    ],
    src: { section: '7.5', page: 133 },
  },
  height: {
    name: 'At a height h above the surface',
    latex: 'g(h) = \\dfrac{G M_E}{(R_E + h)^2} \\approx g\\left(1 - \\dfrac{2h}{R_E}\\right)\\quad (h \\ll R_E)',
    symbols: [
      { sym: 'h', means: 'height above the earth’s surface' },
      { sym: 'g(h)', means: 'acceleration due to gravity at that height: less than g' },
    ],
    src: { section: '7.6', page: 133 },
  },
  depth: {
    name: 'At a depth d below the surface',
    latex: 'g(d) = g\\left(1 - \\dfrac{d}{R_E}\\right)',
    symbols: [
      { sym: 'd', means: 'depth below the earth’s surface' },
      { sym: 'g(d)', means: 'acceleration due to gravity at that depth: also less than g' },
    ],
    src: { section: '7.6', page: 140 },
  },
  moon: {
    name: 'The moon’s acceleration towards the earth',
    latex: 'a_m = \\dfrac{V^2}{R_m} = \\dfrac{4\\pi^2 R_m}{T^2}',
    symbols: [
      { sym: 'a_m', means: 'centripetal acceleration of the moon, due to the earth’s gravity' },
      { sym: 'R_m', means: 'radius of the moon’s orbit, about 3.84 × 10⁸ m' },
      { sym: 'T', means: 'time period of the moon, about 27.3 days' },
      { sym: 'V', means: 'speed of the moon, $V = 2\\pi R_m / T$' },
    ],
    src: { section: '7.3', page: 129 },
  },
} satisfies Record<string, Formula & { name: string; src: Src }>;

/** The guided story: six steps. `scene` names the drawing the page shows for the step. */
export interface Step { id: string; scene: 'tree' | 'fall' | 'pair' | 'law' | 'quiz' | 'recap'; title: string; lines: string[]; formula?: keyof typeof FORMULAS; src: Src[] }
export const STEPS: Step[] = [
  { id: 'question', scene: 'tree', title: 'A question to begin', lines: ['An apple hangs from a tree. The stalk gives way.', 'It does not float, and it does not go sideways. It goes down.'], src: [{ section: '7.1', page: 127 }] },
  {
    id: 'fall', scene: 'fall', title: 'Gravity in action',
    lines: [
      'Anything thrown up falls down towards the earth. Raindrops fall from the clouds. Going uphill is more tiring than going downhill. All material objects are attracted towards the earth.',
      'Galileo recognised that all bodies, irrespective of their masses, are accelerated towards the earth with a constant acceleration. That is why the apple covers more distance in each moment than in the one before.',
    ],
    src: [{ section: '7.1', page: 127 }],
  },
  {
    id: 'force', scene: 'pair', title: 'The force behind the fall',
    lines: [
      'The earth attracts the apple. This pull is the gravitational force. It is attractive, and it acts along the line joining the two bodies.',
      'The apple attracts the earth too, with a force of the same size in the opposite direction (Newton’s third law).',
      'A sphere like the earth attracts a body outside it as though all its mass were concentrated at its centre. So the apple is pulled towards the centre of the earth.',
    ],
    src: [{ section: '7.3', page: 130 }, { section: 'Summary 9', page: 140 }],
  },
  {
    id: 'law', scene: 'law', title: 'The scientific principle', formula: 'law',
    lines: [
      'Newton’s universal law of gravitation: every body in the universe attracts every other body with a force that is directly proportional to the product of their masses and inversely proportional to the square of the distance between them.',
      'Try it: change a mass or the distance and watch the force.',
    ],
    src: [{ section: '7.3', page: 130 }],
  },
  { id: 'check', scene: 'quiz', title: 'Check your understanding', lines: [], src: [{ section: '7.3', page: 130 }] },
  { id: 'recap', scene: 'recap', title: 'Recap', lines: ['Tap any idea to see it again. Tap “Go to that step” to revisit it in the story.'], src: [{ section: 'Summary', page: 139 }] },
];

export interface Choice { text: string; correct: boolean; why: string }
export const QUIZ: { question: string; choices: Choice[]; src: Src } = {
  question: 'What causes the apple to fall towards Earth?',
  choices: [
    { text: 'The gravitational force of attraction between the earth and the apple', correct: true, why: 'Right. Every body attracts every other body. The earth’s pull on the apple is the gravitational force, and it points towards the centre of the earth.' },
    { text: 'The air pushing the apple down', correct: false, why: 'Not this. The fall is caused by the earth’s attraction. The law of gravitation involves only the two masses and the distance between them, not the air.' },
    { text: 'The apple is heavy, and only heavy things fall', correct: false, why: 'Not this. Galileo recognised that all bodies, irrespective of their masses, are accelerated towards the earth with the same constant acceleration.' },
    { text: 'Only the earth pulls; the apple exerts no force', correct: false, why: 'Not quite. The apple also attracts the earth, with a force of the same size in the opposite direction (Newton’s third law).' },
  ],
  src: { section: '7.3', page: 130 },
};

/** Mind map: a centre and branches. `icon` picks a small drawing; `step` is the story step that explains the idea. */
export interface MapNode { id: string; label: string; icon?: 'apple' | 'earth' | 'law' | 'constant' | 'g' | 'up' | 'down' | 'moon' | 'arrows' | 'sum' | 'scale'; text: string; formula?: keyof typeof FORMULAS; step?: string; src: Src; children?: MapNode[] }
export const MIND_MAP: MapNode = {
  id: 'gravitation', label: 'Gravitation', icon: 'earth', text: 'The attraction between any two bodies that have mass. It makes the apple fall and keeps the moon in its orbit.', src: { section: '7.1', page: 127 },
  children: [
    {
      id: 'falling', label: 'Falling bodies', icon: 'apple', step: 'fall', src: { section: '7.1', page: 127 },
      text: 'All material objects are attracted towards the earth. Anything thrown up falls down.',
      children: [
        { id: 'galileo', label: 'Same acceleration for all masses', icon: 'scale', step: 'fall', src: { section: '7.1', page: 127 }, text: 'Galileo recognised that all bodies, irrespective of their masses, are accelerated towards the earth with a constant acceleration.' },
      ],
    },
    {
      id: 'law', label: 'Universal law of gravitation', icon: 'law', formula: 'law', step: 'law', src: { section: '7.3', page: 130 },
      text: 'Every body attracts every other body with a force directly proportional to the product of their masses and inversely proportional to the square of the distance between them.',
      children: [
        { id: 'attractive', label: 'Attractive, along the joining line', icon: 'arrows', step: 'force', src: { section: '7.3', page: 130 }, text: 'The gravitational force is attractive. The forces on the two bodies are equal in size and opposite in direction: F₁₂ = −F₂₁.' },
        { id: 'inverse', label: 'Inverse square of distance', icon: 'moon', formula: 'moon', step: 'law', src: { section: '7.3', page: 130 }, text: 'Twice the distance gives one quarter of the force. Newton compared the moon’s acceleration with g: the ratio $g / a_m$ equals $R_m^2 / R_E^2$, about 3600.' },
        { id: 'superposition', label: 'Many masses: add the forces', icon: 'sum', src: { section: 'Summary 2', page: 139 }, text: 'The law is stated for point masses. For several masses, each force acts independently, and the resultant is found by vector addition (the principle of superposition).' },
      ],
    },
    {
      id: 'constant', label: 'Gravitational constant G', icon: 'constant', src: { section: '7.4', page: 139 },
      text: 'G is the universal gravitational constant. Its value is 6.67 × 10⁻¹¹ N m² kg⁻². It was first measured by Cavendish’s experiment.',
    },
    {
      id: 'g', label: 'Acceleration due to gravity g', icon: 'g', formula: 'g', src: { section: '7.5', page: 133 },
      text: 'At the earth’s surface the force on a mass m is F = mg, so $g = G M_E / R_E^2$. Its value is about 9.8 m s⁻². Knowing g, G and $R_E$ gives the mass of the earth: “Cavendish weighed the earth”.',
      children: [
        { id: 'height', label: 'Above the surface: smaller', icon: 'up', formula: 'height', src: { section: '7.6', page: 133 }, text: 'At a height h the distance from the earth’s centre is $R_E + h$, so g is less. For small heights it falls by the factor $(1 - 2h/R_E)$.' },
        { id: 'depth', label: 'Below the surface: smaller', icon: 'down', formula: 'depth', src: { section: '7.6', page: 140 }, text: 'At a depth d only the sphere of radius $R_E - d$ below the point pulls on it; the shell outside exerts no force. So g falls by the factor $(1 - d/R_E)$.' },
      ],
    },
  ],
};

/** Flowchart: how Newton went from the falling apple to the universal law. */
export interface FlowNode {
  id: string; kind: 'stage' | 'decision' | 'result' | 'wrong'; label: string; icon: MapNode['icon']; x: number; y: number;
  title: string; text: string; formula?: keyof typeof FORMULAS; src: Src;
  /** Where "Next" goes; a decision offers `yes` and `no` instead. */
  next?: string; yes?: string; no?: string; ask?: string;
}
export const FLOW_TITLE = 'From the falling apple to the universal law';
export const FLOW: FlowNode[] = [
  { id: 'apple', kind: 'stage', icon: 'apple', label: 'An apple falls', x: 250, y: 60, next: 'moon', src: { section: '7.3', page: 129 },
    title: 'Stage 1: an apple falls', text: 'Legend has it that seeing an apple fall from a tree set Newton thinking. Near the earth’s surface every body falls with the acceleration due to gravity, g ≈ 9.8 m s⁻².' },
  { id: 'moon', kind: 'stage', icon: 'moon', label: 'The moon goes round', x: 250, y: 180, next: 'compare', formula: 'moon', src: { section: '7.3', page: 129 },
    title: 'Stage 2: the moon goes round the earth', text: 'The moon moves in an orbit of radius $R_m$, so it has a centripetal acceleration towards the earth. Newton reasoned that this, too, is due to the earth’s gravity. With T ≈ 27.3 days and $R_m$ ≈ 3.84 × 10⁸ m, the formula gives about 0.0027 m s⁻².' },
  { id: 'compare', kind: 'decision', icon: 'scale', label: 'Same pull at the moon?', x: 250, y: 310, yes: 'same', no: 'weaker', src: { section: '7.3', page: 129 },
    title: 'Decision: is the earth’s pull the same at the moon’s distance?', ask: 'The apple’s acceleration is 9.8 m s⁻². The moon’s is about 0.0027 m s⁻². Is the earth’s pull the same at both distances?',
    text: 'Compare the two accelerations before you choose.' },
  { id: 'same', kind: 'wrong', icon: 'apple', label: 'Then the moon would fall like the apple', x: 470, y: 310, next: 'compare', src: { section: '7.3', page: 129 },
    title: 'Not this way', text: 'If the pull were the same, the moon’s acceleration would also be 9.8 m s⁻². It is much smaller. Go back and choose again.' },
  { id: 'weaker', kind: 'stage', icon: 'down', label: 'The pull weakens with distance', x: 250, y: 450, next: 'inverse', src: { section: '7.3', page: 130 },
    title: 'Stage 3: the force due to earth’s gravity decreases with distance', text: 'The moon’s acceleration is much smaller than g. This clearly shows that the force due to the earth’s gravity decreases with distance. The question is: how fast?' },
  { id: 'inverse', kind: 'stage', icon: 'law', label: 'Try the inverse square', x: 250, y: 570, next: 'law', src: { section: '7.3', page: 130 },
    title: 'Stage 4: assume the inverse square of the distance', text: 'If the force falls as the inverse square of the distance from the centre of the earth, then $g / a_m$ should equal $R_m^2 / R_E^2$, which is about 3600. Measured values agree: 9.8 ÷ 0.0027 is about 3600.' },
  { id: 'law', kind: 'result', icon: 'earth', label: 'Universal law of gravitation', x: 250, y: 690, formula: 'law', src: { section: '7.3', page: 130 },
    title: 'Result: the universal law of gravitation', text: 'These observations led Newton to propose the law: every body in the universe attracts every other body with a force directly proportional to the product of their masses and inversely proportional to the square of the distance between them.' },
];
export const FLOW_CHECK: { question: string; choices: Choice[] } = {
  question: 'The distance between two bodies is made three times as large. The gravitational force between them becomes:',
  choices: [
    { text: 'one ninth', correct: true, why: 'Right. The force is inversely proportional to the square of the distance: 3² = 9, so the force is one ninth.' },
    { text: 'one third', correct: false, why: 'Not this. The force depends on the square of the distance, not on the distance itself.' },
    { text: 'three times', correct: false, why: 'Not this. A larger distance makes the force smaller, not larger.' },
    { text: 'unchanged', correct: false, why: 'Not this. The force changes with distance; that is what the comparison of the apple and the moon showed.' },
  ],
};

/** The notes in reading order: the "Read" tab and the PDF are built from this. */
export const NOTES: { heading: string; paragraphs: string[]; points?: string[]; formula?: keyof typeof FORMULAS; figure?: 'fall' | 'pair' | 'inverse' | 'heightdepth'; example?: { title: string; body: string }; src: Src }[] = [
  {
    heading: '1. Bodies fall towards the earth', figure: 'fall', src: { section: '7.1', page: 127 },
    paragraphs: ['All material objects are attracted towards the earth. Anything thrown up falls down, raindrops fall from the clouds, and going uphill is more tiring than going downhill.', 'Galileo recognised that all bodies, irrespective of their masses, are accelerated towards the earth with a constant acceleration.'],
  },
  {
    heading: '2. The gravitational force', figure: 'pair', src: { section: '7.3', page: 130 },
    paragraphs: ['The earth attracts the apple, and the apple attracts the earth. The two forces are equal in size and opposite in direction (Newton’s third law): F₁₂ = −F₂₁.'],
    points: ['The force is attractive.', 'It acts along the line joining the two bodies.', 'A sphere whose mass is spread symmetrically attracts an outside body as though all its mass were at its centre.'],
  },
  {
    heading: '3. Newton’s universal law of gravitation', formula: 'law', figure: 'inverse', src: { section: '7.3', page: 130 },
    paragraphs: ['Every body in the universe attracts every other body with a force which is directly proportional to the product of their masses and inversely proportional to the square of the distance between them.', 'The law is stated for point masses. When there are several masses, each force acts independently and the resultant is found by vector addition (the principle of superposition).'],
    example: { title: 'Example from the chapter: the apple and the moon', body: 'The moon’s centripetal acceleration is $a_m = 4\\pi^2 R_m / T^2$. With T ≈ 27.3 days and $R_m$ ≈ 3.84 × 10⁸ m this is about 0.0027 m s⁻², much smaller than g ≈ 9.8 m s⁻². If the force falls as the inverse square of the distance, $g / a_m$ should equal $R_m^2 / R_E^2$ ≈ 3600, and it does.' },
  },
  {
    heading: '4. The gravitational constant G', src: { section: '7.4', page: 139 },
    paragraphs: ['G is the universal gravitational constant. Its value is 6.67 × 10⁻¹¹ N m² kg⁻². It was first measured in Cavendish’s experiment.'],
  },
  {
    heading: '5. Acceleration due to gravity', formula: 'g', src: { section: '7.5', page: 133 },
    paragraphs: ['At the surface of the earth the gravitational force on a body of mass m is $F = G M_E m / R_E^2$. The acceleration it produces is called g, and F = mg.', 'g is easy to measure and $R_E$ is known. Together with G from Cavendish’s experiment they give the mass of the earth. Hence the saying “Cavendish weighed the earth”.'],
  },
  {
    heading: '6. g above and below the surface', formula: 'height', figure: 'heightdepth', src: { section: '7.6', page: 133 },
    paragraphs: ['At a height h the body is at a distance $R_E + h$ from the centre of the earth, so g is smaller than at the surface.', 'At a depth d only the sphere of radius $R_E - d$ below the body attracts it; the outer shell exerts no force on it. So g is smaller there too: $g(d) = g(1 - d/R_E)$.'],
  },
];

export const KEY_POINTS = [
  'The gravitational force is always attractive and acts along the line joining the two bodies.',
  'F = G m₁m₂ / r². Double a mass: the force doubles. Double the distance: the force becomes one quarter.',
  'G = 6.67 × 10⁻¹¹ N m² kg⁻² is the same everywhere; g ≈ 9.8 m s⁻² is its effect at the earth’s surface.',
  '$g = G M_E / R_E^2$ does not depend on the mass of the falling body.',
  'g decreases both above the surface (height h) and below it (depth d).',
];
