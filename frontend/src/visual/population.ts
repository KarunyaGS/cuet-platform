/**
 * Population and Human Development Lab: the pure logic (no React). Everything the page shows is computed here
 * and re-checked in population.test.ts. Status of all lab content: Draft - unverified.
 *
 * Syllabus (CUET-UG Geography, 313): population distribution and density (arithmetic, physiological, agricultural),
 * growth and change (birth rate, death rate, natural increase, migration), the demographic transition theory,
 * age-sex structure and pyramids, and human development (health, knowledge, resources; the HDI).
 *
 * NO real statistics are used. Every region, country-like profile and pyramid below is ILLUSTRATIVE, made up for
 * practice, and labelled so on the page. The only published method used is the UNDP formula for the HDI.
 */

// ====================================================================== 1. densities
export interface Region {
  id: string;
  name: string;
  /** one-line description shown to the student */
  note: string;
  /** total area, km2 (illustrative) */
  area: number;
  /** net cultivated (net sown) area, km2 (illustrative) */
  cultivated: number;
  /** population (illustrative) */
  pop: number;
  /** share of the population that works in agriculture (farmers and farm workers), 0 to 1 (illustrative) */
  farmerShare: number;
}

export const REGIONS: Region[] = [
  { id: 'A', name: 'Region A (the lesson’s worked example)', note: 'Half of the area is cultivated and half of the people farm.', area: 3000, cultivated: 1500, pop: 900000, farmerShare: 0.5 },
  { id: 'B', name: 'Region B: a fertile river delta', note: 'Most of the land is farmed and the population is large.', area: 2000, cultivated: 1200, pop: 2400000, farmerShare: 0.45 },
  { id: 'C', name: 'Region C: a dry plateau with a desert edge', note: 'A very large area, but little of it can be cultivated.', area: 10000, cultivated: 800, pop: 500000, farmerShare: 0.3 },
  { id: 'D', name: 'Region D: an urban and industrial belt', note: 'Many people, mostly working outside agriculture.', area: 1500, cultivated: 300, pop: 1500000, farmerShare: 0.04 },
];

export function getRegion(id: string): Region {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0]!;
}

export interface Densities {
  /** total population / total area */
  arithmetic: number | null;
  /** total population / net cultivated area */
  physiological: number | null;
  /** agricultural population / net cultivated area */
  agricultural: number | null;
}

const ok = (x: number) => Number.isFinite(x) && x >= 0;

/**
 * The three densities, in persons per km2. A density whose denominator is zero (or invalid) is NOT defined: it is null,
 * never Infinity or NaN. For example a region with no cultivated land has no physiological or agricultural density.
 */
export function densities(pop: number, area: number, cultivated: number, farmers: number): Densities {
  const okPop = ok(pop);
  return {
    arithmetic: okPop && ok(area) && area > 0 ? pop / area : null,
    physiological: okPop && ok(cultivated) && cultivated > 0 ? pop / cultivated : null,
    agricultural: ok(farmers) && ok(cultivated) && cultivated > 0 ? farmers / cultivated : null,
  };
}

/** Farm workers for a population in a region (rounded to a whole person). */
export const farmersOf = (r: Region, pop: number) => Math.round(pop * r.farmerShare);

export interface DensityKind { id: keyof Densities; name: string; formula: string; unit: string }
export const DENSITY_KINDS: DensityKind[] = [
  { id: 'arithmetic', name: 'Arithmetic density', formula: 'total population ÷ total area', unit: 'persons per km²' },
  { id: 'physiological', name: 'Physiological density', formula: 'total population ÷ net cultivated area', unit: 'persons per km² of cultivated land' },
  { id: 'agricultural', name: 'Agricultural density', formula: 'agricultural population ÷ net cultivated area', unit: 'farmers per km² of cultivated land' },
];

/** Parse what a student typed: spaces and commas (including Indian grouping 9,00,000) are ignored. */
export function parseNumber(text: string): number | null {
  const t = text.replace(/[,\s]/g, '').replace('−', '-');
  if (t === '' || !/^[-+]?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
}

export type Verdict = 'right' | 'close' | 'wrong' | 'empty' | 'undefined';

/**
 * Check an answer against the true value. 'right': within 0.5 per cent (or 0.05); 'close': within 3 per cent
 * (rounded too early); otherwise 'wrong'. A density that is not defined has no right number: any entry is 'undefined'.
 */
export function checkDensity(entered: string, truth: number | null): Verdict {
  if (truth === null) return 'undefined';
  const v = parseNumber(entered);
  if (v === null) return 'empty';
  const err = Math.abs(v - truth);
  if (err <= Math.max(0.05, 0.005 * Math.abs(truth))) return 'right';
  if (err <= 0.03 * Math.abs(truth)) return 'close';
  return 'wrong';
}

/** What each density tells a geographer, using the numbers of the region on the bench. */
export function densityMeaning(kind: keyof Densities, d: Densities, area: number, cultivated: number): string {
  const share = area > 0 ? (cultivated / area) * 100 : 0;
  if (kind === 'arithmetic') {
    return 'Arithmetic density is the simplest measure of crowding: people per km² of the whole area. It hides how the people are spread and how much of the land can be used.';
  }
  if (kind === 'physiological') {
    if (d.physiological === null) return 'With no cultivated land there is no physiological density: nobody can be fed from local farmland.';
    const times = d.arithmetic ? d.physiological / d.arithmetic : null;
    return `Physiological density shows the pressure of all the people on the farmland. Only ${share.toFixed(0)} per cent of this area is cultivated${times ? `, so it is ${times.toFixed(1)} times the arithmetic density` : ''}. The higher it is, the more people each hectare of cultivated land has to support.`;
  }
  if (d.agricultural === null) return 'With no cultivated land there is no agricultural density.';
  return 'Agricultural density counts only the people who depend on farming, per km² of cultivated land. A high value means many farmers share a small area of land: small holdings and pressure on agricultural land. A low value in a crowded region means most people live by other work.';
}

// ====================================================================== 2. growth and the demographic transition
/** Growth of a population in per cent per year from birth and death rates per 1000 (and optional net migration per 1000). */
export function naturalIncrease(birthRate: number, deathRate: number): number {
  return birthRate - deathRate;
}
export function growthRatePercent(birthRate: number, deathRate: number, netMigration = 0): number {
  return (birthRate - deathRate + netMigration) / 10;
}
/** Decadal-style growth rate: (P2 - P1) / P1 × 100. Zero starting population gives null (undefined). */
export function growthRateBetween(p1: number, p2: number): number | null {
  return p1 > 0 ? ((p2 - p1) / p1) * 100 : null;
}
/** Actual growth = (B - D) + (I - E): natural growth plus net migration. */
export const actualGrowth = (b: number, d: number, i: number, e: number) => b - d + (i - e);

export interface TransitionParams {
  /** birth rate before the transition, per 1000 per year */
  birthHigh: number;
  /** birth rate after the transition */
  birthLow: number;
  deathHigh: number;
  deathLow: number;
  /** the year in which the death rate is half way between its high and low value */
  deathMid: number;
  /** how many years LATER the birth rate is half way down */
  lag: number;
  /** smoothness of the fall: a larger value means a slower fall (years) */
  width: number;
  /** population at year 0 (millions; the figures are illustrative) */
  pop0: number;
  /** number of yearly steps simulated */
  years: number;
}

export const TRANSITION_DEFAULT: TransitionParams = { birthHigh: 40, birthLow: 12, deathHigh: 38, deathLow: 9, deathMid: 60, lag: 40, width: 8, pop0: 10, years: 200 };

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * A rate that falls smoothly from `high` to `low` around year `mid`:
 *   rate(t) = low + (high - low) × (1 - sigmoid((t - mid) / width))
 * so rate(mid) is exactly half way and the fall takes about 4.4 × width years from 10 to 90 per cent.
 */
export function rateAt(high: number, low: number, mid: number, width: number, t: number): number {
  return low + (high - low) * (1 - sigmoid((t - mid) / Math.max(width, 1e-6)));
}

export interface TransitionRun {
  year: number[];
  birth: number[];
  death: number[];
  /** natural increase per 1000 per year, birth - death */
  ni: number[];
  /** population in millions at the START of each year (length years + 1) */
  pop: number[];
  stage: (1 | 2 | 3)[];
}

/**
 * Discrete-time scheme (documented): years t = 0, 1, ..., years. In year t the birth rate b(t) and death rate d(t)
 * per 1000 are evaluated at the start of the year, and the population changes by the natural increase:
 *     P(t+1) = P(t) × (1 + (b(t) - d(t)) / 1000).
 * That is the explicit Euler step with a step of one year. Migration is left out (net migration = 0), as the lesson says
 * it is usually small for a whole country. The last entry of `pop` has no matching rate (the arrays of rates have `years` entries).
 */
export function simulateTransition(p: TransitionParams = TRANSITION_DEFAULT): TransitionRun {
  const year: number[] = [];
  const birth: number[] = [];
  const death: number[] = [];
  const ni: number[] = [];
  const pop: number[] = [p.pop0];
  const stage: (1 | 2 | 3)[] = [];
  for (let t = 0; t < p.years; t++) {
    const b = rateAt(p.birthHigh, p.birthLow, p.deathMid + p.lag, p.width, t);
    const d = rateAt(p.deathHigh, p.deathLow, p.deathMid, p.width, t);
    year.push(t);
    birth.push(b);
    death.push(d);
    ni.push(b - d);
    stage.push(stageAt(b, d));
    pop.push(pop[t]! * (1 + (b - d) / 1000));
  }
  return { year, birth, death, ni, pop, stage };
}

/** The teaching thresholds used to name the stage (they are NOT official definitions; the lesson describes the stages in words). */
export const HIGH_DEATH_RATE = 25;
export const RAPID_GROWTH = 10;

/**
 * Stage of the demographic transition from the two rates (per 1000), following the lesson:
 *  Stage 1: high birth rate and high death rate (death rate at or above 25), growth low.
 *  Stage 2: death rate has fallen (below 25) but the birth rate is still high, so natural increase is rapid (10 or more per 1000).
 *  Stage 3: both rates low and the gap has closed: growth slow or stable (below 10 per 1000, which may even be zero or negative).
 */
export function stageAt(birthRate: number, deathRate: number): 1 | 2 | 3 {
  if (deathRate >= HIGH_DEATH_RATE) return 1;
  return birthRate - deathRate >= RAPID_GROWTH ? 2 : 3;
}

export const STAGE_TEXT: Record<1 | 2 | 3, { name: string; text: string }> = {
  1: { name: 'Stage 1: high stationary', text: 'High birth rate and high death rate. Epidemics and famines keep numbers in check, so the population grows slowly.' },
  2: { name: 'Stage 2: early expanding', text: 'The death rate has fallen (better health and food) but the birth rate is still high. The gap is wide and the population grows rapidly.' },
  3: { name: 'Stage 3: late expanding or stable', text: 'The birth rate has also fallen (urbanisation, education, family planning). Both rates are low and growth is slow or the population is stable.' },
};

export interface RunSummary {
  peakNI: number;
  peakYear: number;
  finalPop: number;
  /** final population divided by the starting population */
  multiple: number;
}
export function summarise(run: TransitionRun): RunSummary {
  let peakNI = -Infinity;
  let peakYear = 0;
  run.ni.forEach((v, i) => {
    if (v > peakNI) { peakNI = v; peakYear = i; }
  });
  const finalPop = run.pop[run.pop.length - 1]!;
  return { peakNI, peakYear, finalPop, multiple: finalPop / run.pop[0]! };
}

/** The years in which a stage holds, as a list of [start, end] runs. */
export function stageBands(run: TransitionRun): { stage: 1 | 2 | 3; from: number; to: number }[] {
  const out: { stage: 1 | 2 | 3; from: number; to: number }[] = [];
  run.stage.forEach((s, i) => {
    const last = out[out.length - 1];
    if (last && last.stage === s) last.to = i + 1;
    else out.push({ stage: s, from: i, to: i + 1 });
  });
  return out;
}

/** A representative year for each stage (the middle of its longest band), or null if the stage never occurs. */
export function stageYear(run: TransitionRun, s: 1 | 2 | 3): number | null {
  const bands = stageBands(run).filter((b) => b.stage === s);
  if (!bands.length) return null;
  const best = bands.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
  return Math.min(run.year.length - 1, Math.floor((best.from + best.to - 1) / 2));
}

export interface Reading {
  key: string;
  deathMid: number;
  lag: number;
  birthHigh: number;
  peakNI: number;
  peakYear: number;
  finalPop: number;
}
export const readingKey = (p: TransitionParams) => `${p.birthHigh}|${p.deathMid}|${p.lag}`;
export function makeReading(p: TransitionParams): Reading {
  const s = summarise(simulateTransition(p));
  return { key: readingKey(p), deathMid: p.deathMid, lag: p.lag, birthHigh: p.birthHigh, peakNI: s.peakNI, peakYear: s.peakYear, finalPop: s.finalPop };
}
export const distinctReadings = (rows: Reading[]) => new Set(rows.map((r) => r.key)).size;

/** True if the final population never falls when the death-rate fall comes earlier (compare readings with all else equal). */
export function earlierMeansBigger(rows: Reading[]): boolean | null {
  const same = rows.filter((r) => r.lag === rows[0]?.lag && r.birthHigh === rows[0]?.birthHigh);
  if (new Set(same.map((r) => r.deathMid)).size < 2) return null;
  const sorted = [...same].sort((a, b) => a.deathMid - b.deathMid);
  return sorted.every((r, i) => i === 0 || r.finalPop <= sorted[i - 1]!.finalPop + 1e-9);
}

// ====================================================================== 3. age-sex pyramids
export const AGE_GROUPS = ['0–4', '5–9', '10–14', '15–19', '20–24', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60–64', '65–69', '70–74', '75–79', '80–84'];
const GAMMA_4_3 = 0.8929795115692493; // Γ(4/3): for the Weibull survival curve with shape 3, e0 = λ Γ(4/3)
const MALE_SHARE_AT_BIRTH = 105 / 205; // 105 male births for every 100 female births
/** Female life expectancy exceeds male by this many years in the model (illustrative; 2.5 each side of the average). */
const SEX_GAP = 2.5;
/** Share of a woman's children born in each 5-year age group 15-19 ... 45-49 (illustrative; sums to 1). */
export const FERTILITY_WEIGHTS = [0.1, 0.27, 0.27, 0.18, 0.12, 0.06];
const FERT_AGES = [17.5, 22.5, 27.5, 32.5, 37.5, 42.5];

/** Survival from birth to age a (fraction): l(a) = exp(-(a/λ)^3) with λ = e0 / Γ(4/3), so the mean length of life is e0. */
export function survival(age: number, e0: number): number {
  const lambda = e0 / GAMMA_4_3;
  return Math.exp(-Math.pow(Math.max(age, 0) / lambda, 3));
}

/** Net reproduction rate for a total fertility rate (children per woman) and a life expectancy: daughters per woman who survive to the age of having them. */
export function netReproduction(tfr: number, e0: number): number {
  const daughters = (1 - MALE_SHARE_AT_BIRTH) * tfr;
  return FERT_AGES.reduce((s, a, i) => s + FERTILITY_WEIGHTS[i]! * daughters * survival(a, e0 + SEX_GAP), 0);
}

/** Stable-population growth rate r (per year): the root of Σ w_i × daughters × exp(-r a_i) × l(a_i) = 1 (the Euler-Lotka equation), found by bisection. */
export function stableGrowth(tfr: number, e0: number): number {
  const f = (r: number) => FERT_AGES.reduce((s, a, i) => s + FERTILITY_WEIGHTS[i]! * (1 - MALE_SHARE_AT_BIRTH) * tfr * Math.exp(-r * a) * survival(a, e0 + SEX_GAP), 0) - 1;
  let lo = -0.2;
  let hi = 0.2;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface Pyramid {
  tfr: number;
  e0: number;
  /** growth rate of the stable population, per year */
  r: number;
  /** per cent of the whole population, 17 age groups from 0-4 to 80-84 */
  male: number[];
  female: number[];
  /** per cent of the population aged 0-14, 15-59, 60+ (the groups used in the lesson) */
  children: number;
  working: number;
  aged: number;
}

/**
 * An age-sex pyramid for a fertility and a life expectancy, using stable population theory:
 * the number in the cohort aged a is proportional to exp(-r a) × l(a), the share born that survived to age a, scaled down by growth r.
 * The oldest bar is 80 to 84: ages 85 and over are left out to keep the picture simple. The population is treated as closed (no migration). The numbers are made-up teaching shapes, not real data.
 */
export function pyramid(tfr: number, e0: number): Pyramid {
  const r = stableGrowth(tfr, e0);
  const raw = (sex: 'm' | 'f', k: number) => {
    const life = sex === 'm' ? e0 - SEX_GAP : e0 + SEX_GAP;
    const w = sex === 'm' ? MALE_SHARE_AT_BIRTH : 1 - MALE_SHARE_AT_BIRTH;
    const ages = [5 * k + 2.5];
    return ages.reduce((s, a) => s + w * Math.exp(-r * a) * survival(a, life), 0);
  };
  const m = AGE_GROUPS.map((_, k) => raw('m', k));
  const f = AGE_GROUPS.map((_, k) => raw('f', k));
  const total = m.reduce((a, b) => a + b, 0) + f.reduce((a, b) => a + b, 0);
  const male = m.map((v) => (v / total) * 100);
  const female = f.map((v) => (v / total) * 100);
  const both = (k: number) => male[k]! + female[k]!;
  const sum = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => both(a + i)).reduce((x, y) => x + y, 0);
  return { tfr, e0, r, male, female, children: sum(0, 2), working: sum(3, 11), aged: sum(12, 16) };
}

export type Shape = 'expanding' | 'constant' | 'declining';
export const SHAPE_NAME: Record<Shape, string> = { expanding: 'Expanding', constant: 'Constant', declining: 'Declining' };
/** Teaching thresholds on the base ratio (the 0-4 group divided by the 15-19 group). */
export const EXPAND_RATIO = 1.15;
export const DECLINE_RATIO = 0.95;

/** The base ratio of a pyramid: how much wider the bottom bar is than the bar for teenagers. */
export function baseRatio(p: Pyramid): number {
  return (p.male[0]! + p.female[0]!) / (p.male[3]! + p.female[3]!);
}

/** Classify the shape: a base clearly wider than the next generation is expanding, clearly narrower is declining, otherwise constant. */
export function classify(p: Pyramid): Shape {
  const b = baseRatio(p);
  return b >= EXPAND_RATIO ? 'expanding' : b <= DECLINE_RATIO ? 'declining' : 'constant';
}

/** The stage that each shape usually goes with, as taught in the lesson (the lesson names three stages; a declining shape is what comes after them). */
export const SHAPE_STAGE: Record<Shape, string> = {
  expanding: 'Stage 2 (early expanding): high birth rate, falling death rate. A stage 1 population also has a broad base but its bars shrink very quickly with age because many die young.',
  constant: 'Stage 3 (late stage): low birth and death rates, slow growth or a stable population.',
  declining: 'Beyond stage 3: births have fallen below replacement and the population is ageing. The lesson shows it as a narrow base and a wide middle.',
};

export interface PresetPyramid { id: string; name: string; tfr: number; e0: number; answer: Shape }
/** Three illustrative pyramids for the "read this pyramid" task (labelled as made up; no real country is meant). */
export const PRESETS: PresetPyramid[] = [
  { id: 'X', name: 'Population X', tfr: 5.6, e0: 54, answer: 'expanding' },
  { id: 'Y', name: 'Population Y', tfr: 1.25, e0: 83, answer: 'declining' },
  { id: 'Z', name: 'Population Z', tfr: 2.1, e0: 76, answer: 'constant' },
];

export function whyShape(s: Shape, p: Pyramid): string {
  const c = p.children.toFixed(0);
  const a = p.aged.toFixed(0);
  if (s === 'expanding') return `The base is very wide and the bars narrow quickly with age: ${c} per cent are children (0 to 14) and only ${a} per cent are aged 60 and above. That is a high birth rate and a young population: an expanding pyramid.`;
  if (s === 'declining') return `The base is narrower than the bars above it: only ${c} per cent are children and ${a} per cent are aged 60 and above. Few births and a long life give a declining pyramid and an ageing population.`;
  return `The bars have nearly equal width from the base up to the middle ages: ${c} per cent children and ${a} per cent aged 60 and above. Births roughly replace deaths: a constant pyramid.`;
}

// ====================================================================== 4. human development index
/** The published UNDP goalposts (Human Development Report technical notes): the minimum and maximum used to scale each indicator. */
export const GOALPOSTS = {
  life: { min: 20, max: 85 },
  eys: { min: 0, max: 18 },
  mys: { min: 0, max: 15 },
  gni: { min: 100, max: 75000 },
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Dimension index = (actual - minimum) / (maximum - minimum), kept between 0 and 1. */
export function dimensionIndex(actual: number, min: number, max: number): number {
  return clamp01((actual - min) / (max - min));
}
export const lifeIndex = (le: number) => dimensionIndex(le, GOALPOSTS.life.min, GOALPOSTS.life.max);
export const eysIndex = (v: number) => dimensionIndex(v, GOALPOSTS.eys.min, GOALPOSTS.eys.max);
export const mysIndex = (v: number) => dimensionIndex(v, GOALPOSTS.mys.min, GOALPOSTS.mys.max);
/** Education index: the average of the expected years of schooling index and the mean years of schooling index. */
export const educationIndex = (eys: number, mys: number) => (eysIndex(eys) + mysIndex(mys)) / 2;
/** Income index: (ln GNI - ln 100) / (ln 75000 - ln 100). The logarithm means each extra dollar counts for less at higher incomes. */
export function incomeIndex(gni: number): number {
  const g = Math.min(Math.max(gni, GOALPOSTS.gni.min), GOALPOSTS.gni.max);
  return clamp01((Math.log(g) - Math.log(GOALPOSTS.gni.min)) / (Math.log(GOALPOSTS.gni.max) - Math.log(GOALPOSTS.gni.min)));
}

export interface HdiInput { life: number; eys: number; mys: number; gni: number }
export type Dimension = 'health' | 'education' | 'income';
export const DIMENSION_NAME: Record<Dimension, string> = { health: 'Health (life expectancy)', education: 'Education (years of schooling)', income: 'Income (per person)' };

export interface HdiResult {
  health: number;
  education: number;
  income: number;
  /** geometric mean of the three indices */
  hdi: number;
  /** the dimension with the lowest index (the first in the order health, education, income on a tie) */
  limiting: Dimension;
}

/** HDI = (health index × education index × income index)^(1/3): the geometric mean, so a weak dimension pulls the HDI down more than an arithmetic mean would. */
export function hdi(x: HdiInput): HdiResult {
  const health = lifeIndex(x.life);
  const education = educationIndex(x.eys, x.mys);
  const income = incomeIndex(x.gni);
  const value = Math.cbrt(health * education * income);
  const limiting: Dimension = health <= education && health <= income ? 'health' : education <= income ? 'education' : 'income';
  return { health, education, income, hdi: value, limiting };
}

/** HDI gained if one dimension index is raised by `delta` (capped at 1): the weakest dimension gains the most. */
export function gainIfRaised(r: HdiResult, dim: Dimension, delta = 0.1): number {
  const idx = { health: r.health, education: r.education, income: r.income };
  idx[dim] = Math.min(1, idx[dim] + delta);
  return Math.cbrt(idx.health * idx.education * idx.income) - r.hdi;
}

/** HDI as income changes, the other three inputs fixed: the curve flattens (diminishing returns of the log income index). */
export function hdiVsIncome(base: HdiInput, points = 60): { gni: number; hdi: number }[] {
  const lo = Math.log(GOALPOSTS.gni.min);
  const hi = Math.log(GOALPOSTS.gni.max);
  return Array.from({ length: points + 1 }, (_, i) => {
    const gni = Math.exp(lo + ((hi - lo) * i) / points);
    return { gni, hdi: hdi({ ...base, gni }).hdi };
  });
}

export interface Profile { id: string; name: string; note: string; input: HdiInput }
/** Illustrative profiles (made up; they are not any real country). */
export const PROFILES: Profile[] = [
  { id: 'P', name: 'Profile P', note: 'People live long, but few stay in school and incomes are low.', input: { life: 76, eys: 8, mys: 4, gni: 2500 } },
  { id: 'Q', name: 'Profile Q', note: 'Good schooling and a fair income, but short lives.', input: { life: 58, eys: 14, mys: 10, gni: 12000 } },
  { id: 'R', name: 'Profile R', note: 'Long lives and good schooling, but a low income.', input: { life: 80, eys: 16, mys: 11, gni: 1500 } },
];
export const HDI_START: HdiInput = { life: 70, eys: 12, mys: 8, gni: 10000 };

// ====================================================================== 5. predictions and practice questions
export type Tab = 'density' | 'transition' | 'pyramid' | 'hdi';

export interface PredictDef { id: string; title: string; tab: Tab; prompt: string; options: string[]; answer: number }

export const PRED_REGION = getRegion('A');
/** Prediction 1: the cultivated area of Region A drops from 1500 to 900 km2 (a reservoir covers farmland); population and total area are unchanged. */
export const PRED_CULT_AFTER = 900;
/** Prediction 2: compare the natural increase in year 20 (before the death rate falls) and year 80 (death rate fallen, birth rate still high). */
export const PRED_YEARS = { before: 20, after: 80 };
/** Prediction 3: a stage 2 population (high birth, falling death) and a stable one for comparison. */
export const PRED_PYRAMID = { stage2: { tfr: 5.5, e0: 55 }, start: { tfr: 2.1, e0: 76 } };
export const PRED_PROFILE = PROFILES[0]!;

export const PREDICTS: PredictDef[] = [
  { id: 'dens', title: 'Density', tab: 'density', prompt: 'Region A has 9,00,000 people, 3,000 km² of area and 1,500 km² of cultivated land. A new reservoir floods 600 km² of its farmland. Population and total area stay the same. Which densities rise?', options: ['Arithmetic density only', 'Physiological and agricultural density, but not arithmetic', 'All three densities', 'None of them'], answer: 1 },
  { id: 'trans', title: 'Transition', tab: 'transition', prompt: 'A country’s death rate begins to fall because of better health care, but its birth rate stays high. What happens to its natural increase?', options: ['It rises: the gap between birth and death rates widens', 'It falls', 'It stays the same', 'It becomes negative'], answer: 0 },
  { id: 'pyr', title: 'Pyramid', tab: 'pyramid', prompt: 'Which age-sex pyramid shape belongs to a stage 2 population (high birth rate, falling death rate)?', options: ['Constant: nearly equal widths', 'Declining: narrow base, wide middle', 'Expanding: very wide base, narrowing quickly', 'It cannot be told from the shape'], answer: 2 },
  { id: 'hdi', title: 'HDI', tab: 'hdi', prompt: 'Profile P has a life expectancy of 76 years, 8 expected and 4 mean years of schooling, and a low income per person. Which dimension index is the lowest and so holds its HDI back?', options: ['Health', 'Education', 'Income', 'All three are equal'], answer: 1 },
];

/** What the bench shows for each prediction, computed from the model (the tests re-check each answer from these). */
export function predictFacts() {
  const r = PRED_REGION;
  const before = densities(r.pop, r.area, r.cultivated, farmersOf(r, r.pop));
  const after = densities(r.pop, r.area, PRED_CULT_AFTER, farmersOf(r, r.pop));
  const run = simulateTransition();
  const niBefore = run.ni[PRED_YEARS.before]!;
  const niAfter = run.ni[PRED_YEARS.after]!;
  const pyr = pyramid(PRED_PYRAMID.stage2.tfr, PRED_PYRAMID.stage2.e0);
  const h = hdi(PRED_PROFILE.input);
  return { before, after, niBefore, niAfter, birthAfter: run.birth[PRED_YEARS.after]!, deathBefore: run.death[PRED_YEARS.before]!, deathAfter: run.death[PRED_YEARS.after]!, shape: classify(pyr), pyr, h };
}

/** Index of the correct option for each prediction, derived from the model rather than typed in. */
export function predictAnswersFromModel(): number[] {
  const f = predictFacts();
  const rises = (a: number | null, b: number | null) => a !== null && b !== null && b > a + 1e-9;
  const arithUp = rises(f.before.arithmetic, f.after.arithmetic);
  const physUp = rises(f.before.physiological, f.after.physiological);
  const agrUp = rises(f.before.agricultural, f.after.agricultural);
  const dens = arithUp && physUp && agrUp ? 2 : physUp && agrUp && !arithUp ? 1 : arithUp && !physUp && !agrUp ? 0 : 3;
  const trans = f.niAfter > f.niBefore + 1e-9 ? 0 : f.niAfter < f.niBefore - 1e-9 ? 1 : 2;
  const pyr = f.shape === 'expanding' ? 2 : f.shape === 'constant' ? 0 : 1;
  const hd = f.h.limiting === 'health' ? 0 : f.h.limiting === 'education' ? 1 : 2;
  return [dens, trans, pyr, hd];
}

export interface QItem { id: string; q: string; options: string[]; answer: number; why: string }

const fmt = (x: number, d = 0) => x.toFixed(d);

/** Question 1: physiological density of a made-up district. */
export const Q1 = { pop: 240000, area: 800, cultivated: 300, farmers: 120000 };
/** Question 2: crude rates. */
export const Q2 = { b: 32, d: 8 };
/** Question 3: rates of a country. */
export const Q3 = { b: 38, d: 12 };
/** Question 4: the pyramid of a made-up country. */
export const Q4 = { tfr: 1.3, e0: 82 };
/** Question 5: three dimension indices. */
export const Q5 = { health: 0.9, education: 0.9, income: 0.4 };

export function buildApply(): QItem[] {
  const d1 = densities(Q1.pop, Q1.area, Q1.cultivated, Q1.farmers);
  const d2 = growthRatePercent(Q2.b, Q2.d);
  const s3 = stageAt(Q3.b, Q3.d);
  const shape4 = classify(pyramid(Q4.tfr, Q4.e0));
  const geo = Math.cbrt(Q5.health * Q5.education * Q5.income);
  const arith = (Q5.health + Q5.education + Q5.income) / 3;
  return [
    {
      id: 'q1',
      q: `A district has 2,40,000 people living in 800 km², of which 300 km² is net cultivated land. Half of the people (1,20,000) depend on agriculture. What is its physiological density?`,
      options: [`${fmt(d1.arithmetic!)} persons per km²`, `${fmt(d1.physiological!)} persons per km² of cultivated land`, `${fmt(d1.agricultural!)} persons per km² of cultivated land`, `${fmt(Q1.pop / (Q1.area - Q1.cultivated))} persons per km²`],
      answer: 1,
      why: `Physiological density = total population ÷ net cultivated area = 2,40,000 ÷ 300 = ${fmt(d1.physiological!)} per km². The arithmetic density (2,40,000 ÷ 800 = ${fmt(d1.arithmetic!)}) uses total area, and the agricultural density (1,20,000 ÷ 300 = ${fmt(d1.agricultural!)}) counts only the farmers.`,
    },
    {
      id: 'q2',
      q: `A country has a birth rate of ${Q2.b} per 1,000 and a death rate of ${Q2.d} per 1,000. There is no migration. What is its growth rate per year?`,
      options: ['0.24 per cent', `${fmt(d2, 1)} per cent`, '24 per cent', '4.0 per cent'],
      answer: 1,
      why: `Natural increase = births − deaths = ${Q2.b} − ${Q2.d} = ${naturalIncrease(Q2.b, Q2.d)} per 1,000, which is ${fmt(d2, 1)} per cent a year (24 per 1,000 is 2.4 in 100). Dividing by 1,000 only, or confusing per 1,000 with per cent, gives the wrong answers.`,
    },
    {
      id: 'q3',
      q: `A country has a birth rate of ${Q3.b} and a death rate of ${Q3.d} per 1,000. Which stage of the demographic transition does it fit?`,
      options: ['Stage 1: high birth rate and high death rate', 'Stage 2: high birth rate, low death rate, rapid growth', 'Stage 3: low birth rate and low death rate', 'None: the population is falling'],
      answer: s3 === 2 ? 1 : s3 === 1 ? 0 : 2,
      why: `The death rate (${Q3.d}) has already fallen, but the birth rate (${Q3.b}) is still high, so natural increase is ${Q3.b - Q3.d} per 1,000 a year (2.6 per cent). That is the wide gap of stage 2, the early expanding stage. In stage 1 both rates are high and the gap is small; in stage 3 the birth rate has fallen too.`,
    },
    {
      id: 'q4',
      q: `A country has very few births (about 1.3 children per woman) and a long life expectancy (about 82 years). What would its age-sex pyramid look like?`,
      options: ['Expanding: a very wide base', 'Constant: nearly equal widths', 'Declining: a narrow base and a wide middle, with an ageing population', 'A pyramid is not possible for such a country'],
      answer: shape4 === 'declining' ? 2 : shape4 === 'expanding' ? 0 : 1,
      why: `Few births make the bottom bars short; long life keeps the older bars long. The result is a narrow base and a wide middle: a declining pyramid, with an ageing population. A wide base would need a high birth rate.`,
    },
    {
      id: 'q5',
      q: `A country’s health index is ${Q5.health}, its education index ${Q5.education} and its income index ${Q5.income}. Using the UNDP method (geometric mean), its HDI is closest to which value?`,
      options: [fmt(arith, 2), fmt(geo, 2), '0.40', '0.90'],
      answer: 1,
      why: `The HDI is the geometric mean: (0.9 × 0.9 × 0.4)^(1/3) = 0.324^(1/3) = ${fmt(geo, 2)}. The simple average would be ${fmt(arith, 2)}: the geometric mean is lower because the weak income index pulls the HDI down more.`,
    },
  ];
}
export const APPLY: QItem[] = buildApply();
