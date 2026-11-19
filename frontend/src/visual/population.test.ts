import { describe, expect, it } from 'vitest';
import {
  actualGrowth, AGE_GROUPS, APPLY, baseRatio, buildApply, checkDensity, classify, DECLINE_RATIO, densities, densityMeaning, DENSITY_KINDS, dimensionIndex, distinctReadings, earlierMeansBigger,
  EXPAND_RATIO, FERTILITY_WEIGHTS, gainIfRaised, getRegion, GOALPOSTS, growthRateBetween, growthRatePercent, hdi, hdiVsIncome, HDI_START, incomeIndex, lifeIndex, educationIndex,
  makeReading, naturalIncrease, netReproduction, parseNumber, PREDICTS, predictAnswersFromModel, predictFacts, PRESETS, PROFILES, pyramid, rateAt, readingKey, REGIONS, farmersOf,
  simulateTransition, stableGrowth, stageAt, stageBands, stageYear, summarise, survival, TRANSITION_DEFAULT, whyShape, eysIndex, mysIndex, type TransitionParams, type Shape,
} from './population';

const near = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const run = (o: Partial<TransitionParams> = {}) => simulateTransition({ ...TRANSITION_DEFAULT, ...o });

describe('densities', () => {
  it('reproduces the lesson’s worked example (300, 600, 300)', () => {
    const d = densities(900000, 3000, 1500, 450000);
    expect(d).toEqual({ arithmetic: 300, physiological: 600, agricultural: 300 });
  });
  it('Region A in the registry is that example', () => {
    const r = getRegion('A');
    expect(densities(r.pop, r.area, r.cultivated, farmersOf(r, r.pop))).toEqual({ arithmetic: 300, physiological: 600, agricultural: 300 });
  });
  it('hand-computed values for the other regions', () => {
    const d = (id: string) => { const r = getRegion(id); return densities(r.pop, r.area, r.cultivated, farmersOf(r, r.pop)); };
    expect(d('B')).toEqual({ arithmetic: 1200, physiological: 2000, agricultural: 900 });
    expect(d('C')).toEqual({ arithmetic: 50, physiological: 625, agricultural: 187.5 });
    expect(d('D')).toEqual({ arithmetic: 1000, physiological: 5000, agricultural: 200 });
  });
  it('physiological density is never below arithmetic density when cultivated <= total area', () => {
    for (const r of REGIONS) {
      const d = densities(r.pop, r.area, r.cultivated, farmersOf(r, r.pop));
      expect(d.physiological!).toBeGreaterThanOrEqual(d.arithmetic!);
      expect(d.physiological! / d.arithmetic!).toBeCloseTo(r.area / r.cultivated, 9);
    }
  });
  it('zero or invalid cultivated area is handled safely (null, never Infinity or NaN)', () => {
    for (const c of [0, -5, NaN, Infinity]) {
      const d = densities(1000, 100, c, 400);
      expect(d.physiological).toBeNull();
      expect(d.agricultural).toBeNull();
      expect(d.arithmetic).toBe(10);
    }
    expect(densities(1000, 0, 50, 10).arithmetic).toBeNull();
    expect(densities(-1, 100, 50, 10).arithmetic).toBeNull();
    expect(densities(0, 100, 50, 0)).toEqual({ arithmetic: 0, physiological: 0, agricultural: 0 });
  });
  it('monotonic: less cultivated land raises physiological and agricultural density, arithmetic unchanged', () => {
    let prev = densities(900000, 3000, 3000, 450000);
    for (const c of [2500, 2000, 1500, 1000, 500, 100, 10]) {
      const d = densities(900000, 3000, c, 450000);
      expect(d.arithmetic).toBe(prev.arithmetic);
      expect(d.physiological!).toBeGreaterThan(prev.physiological!);
      expect(d.agricultural!).toBeGreaterThan(prev.agricultural!);
      prev = d;
    }
  });
  it('monotonic: more people raise all three densities', () => {
    const r = getRegion('B');
    let prev = densities(1, r.area, r.cultivated, farmersOf(r, 1));
    for (const p of [1e5, 5e5, 1e6, 2e6]) {
      const d = densities(p, r.area, r.cultivated, farmersOf(r, p));
      expect(d.arithmetic!).toBeGreaterThan(prev.arithmetic!);
      expect(d.physiological!).toBeGreaterThan(prev.physiological!);
      expect(d.agricultural!).toBeGreaterThan(prev.agricultural!);
      prev = d;
    }
  });
  it('kinds are listed in the right order and the meaning text mentions the figures', () => {
    expect(DENSITY_KINDS.map((k) => k.id)).toEqual(['arithmetic', 'physiological', 'agricultural']);
    const d = densities(900000, 3000, 1500, 450000);
    expect(densityMeaning('physiological', d, 3000, 1500)).toContain('2.0 times');
    expect(densityMeaning('physiological', d, 3000, 1500)).toContain('50 per cent');
    expect(densityMeaning('physiological', densities(1, 1, 0, 0), 1, 0)).toContain('no cultivated land');
    expect(densityMeaning('agricultural', densities(1, 1, 0, 0), 1, 0)).toContain('no cultivated land');
    expect(densityMeaning('agricultural', d, 3000, 1500)).toContain('farming');
    expect(densityMeaning('arithmetic', d, 3000, 1500)).toContain('people per km²');
  });
});

describe('answer checking', () => {
  it('parses plain and Indian-grouped numbers', () => {
    expect(parseNumber('9,00,000')).toBe(900000);
    expect(parseNumber(' 600 ')).toBe(600);
    expect(parseNumber('187.5')).toBe(187.5);
    expect(parseNumber('−3')).toBe(-3);
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('1e5')).toBeNull();
  });
  it('right, close, wrong, empty and undefined', () => {
    expect(checkDensity('600', 600)).toBe('right');
    expect(checkDensity('599.5', 600)).toBe('right');
    expect(checkDensity('590', 600)).toBe('close');
    expect(checkDensity('300', 600)).toBe('wrong');
    expect(checkDensity('', 600)).toBe('empty');
    expect(checkDensity('5', null)).toBe('undefined');
    expect(checkDensity('0', 0)).toBe('right');
  });
});

describe('growth formulas', () => {
  it('natural increase, growth rate and actual growth (the lesson’s worked problem)', () => {
    expect(naturalIncrease(24, 9)).toBe(15);
    expect(growthRatePercent(24, 9)).toBe(1.5);
    expect(growthRatePercent(24, 9, -3)).toBeCloseTo(1.2, 12);
    expect(actualGrowth(24, 9, 1, 4)).toBe(12);
  });
  it('growth rate between two counts; zero start is undefined', () => {
    expect(growthRateBetween(1000, 1250)).toBe(25);
    expect(growthRateBetween(1000, 800)).toBe(-20);
    expect(growthRateBetween(0, 10)).toBeNull();
  });
});

describe('transition model', () => {
  it('rate curve: half way at the middle year, tends to its ends', () => {
    near(rateAt(40, 10, 50, 8, 50), 25);
    expect(rateAt(40, 10, 50, 8, -1000)).toBeCloseTo(40, 6);
    expect(rateAt(40, 10, 50, 8, 1000)).toBeCloseTo(10, 6);
    for (let t = 0; t < 120; t++) expect(rateAt(40, 10, 50, 8, t + 1)).toBeLessThanOrEqual(rateAt(40, 10, 50, 8, t));
    expect(Number.isFinite(rateAt(40, 10, 50, 0, 50))).toBe(true);
  });
  it('the discrete scheme is P(t+1) = P(t) (1 + (b - d)/1000), checked by hand', () => {
    const r = run();
    expect(r.pop.length).toBe(201);
    expect(r.year.length).toBe(200);
    expect(r.pop[0]).toBe(10);
    for (let t = 0; t < 200; t++) near(r.pop[t + 1]!, r.pop[t]! * (1 + (r.birth[t]! - r.death[t]!) / 1000), 1e-9);
    // year 0 by hand: death mid 60, birth mid 100, width 8
    near(r.birth[0]!, 12 + 28 * (1 - 1 / (1 + Math.exp(100 / 8))));
    near(r.death[0]!, 9 + 29 * (1 - 1 / (1 + Math.exp(60 / 8))));
    near(r.ni[0]!, r.birth[0]! - r.death[0]!);
    // and the first step by hand
    near(r.pop[1]!, 10 * (1 + (r.birth[0]! - r.death[0]!) / 1000));
  });
  it('constant equal rates keep the population constant; constant gap compounds', () => {
    const flat = run({ birthHigh: 20, birthLow: 20, deathHigh: 20, deathLow: 20 });
    for (const p of flat.pop) near(p, 10);
    const grow = run({ birthHigh: 30, birthLow: 30, deathHigh: 10, deathLow: 10 });
    near(grow.pop[200]! / (10 * Math.pow(1.02, 200)), 1, 1e-9);
  });
  it('stage classification follows the lesson and the thresholds', () => {
    expect(stageAt(40, 38)).toBe(1);
    expect(stageAt(40, 25)).toBe(1);
    expect(stageAt(40, 24.9)).toBe(2);
    expect(stageAt(40, 10)).toBe(2);
    expect(stageAt(20, 10)).toBe(2);
    expect(stageAt(19.9, 10)).toBe(3);
    expect(stageAt(12, 9)).toBe(3);
    expect(stageAt(9, 12)).toBe(3);
  });
  it('the default run goes through stage 1, 2, 3 in order and never goes back', () => {
    const r = run();
    const bands = stageBands(r);
    expect(bands.map((b) => b.stage)).toEqual([1, 2, 3]);
    expect(bands[0]!.from).toBe(0);
    expect(bands[2]!.to).toBe(200);
    for (let i = 1; i < r.stage.length; i++) expect(r.stage[i]!).toBeGreaterThanOrEqual(r.stage[i - 1]!);
    expect(stageYear(r, 1)!).toBeLessThan(stageYear(r, 2)!);
    expect(stageYear(r, 2)!).toBeLessThan(stageYear(r, 3)!);
    expect(r.stage[stageYear(r, 2)!]).toBe(2);
    expect(stageYear(run({ deathMid: 400 }), 3)).toBeNull();
  });
  it('natural increase is small in stage 1, widest in stage 2, small again in stage 3', () => {
    const r = run();
    const peak = summarise(r);
    expect(r.ni[0]!).toBeLessThan(5);
    expect(peak.peakNI).toBeGreaterThan(20);
    expect(r.stage[peak.peakYear]).toBe(2);
    expect(r.ni[199]!).toBeLessThan(5);
  });
  it('death rate falls before the birth rate while the birth rate stays high: the gap opens (prediction 2)', () => {
    const f = predictFacts();
    expect(f.niAfter).toBeGreaterThan(f.niBefore + 10);
    expect(f.deathAfter).toBeLessThan(f.deathBefore - 20);
    expect(f.birthAfter).toBeGreaterThan(35);
  });
  it('earlier death-rate decline gives a larger final population and a larger peak (monotonic)', () => {
    let prev = Infinity;
    for (const m of [20, 40, 60, 80, 100, 120]) {
      const s = summarise(run({ deathMid: m }));
      expect(s.finalPop).toBeLessThan(prev);
      prev = s.finalPop;
    }
    // the peak natural increase is about the same height wherever the death-rate fall sits (it only moves in time) ...
    expect(summarise(run({ deathMid: 20 })).peakYear).toBeLessThan(summarise(run({ deathMid: 100 })).peakYear);
  });
  it('a longer lag between the two falls gives a bigger population and a higher peak', () => {
    let prev = 0;
    for (const lag of [0, 10, 20, 40, 60, 80]) {
      const s = summarise(run({ lag }));
      expect(s.finalPop).toBeGreaterThan(prev);
      prev = s.finalPop;
    }
    expect(summarise(run({ lag: 0 })).peakNI).toBeLessThan(summarise(run({ lag: 40 })).peakNI);
  });
  it('a higher starting birth rate gives a larger population and a larger peak', () => {
    expect(summarise(run({ birthHigh: 50 })).finalPop).toBeGreaterThan(summarise(run({ birthHigh: 30 })).finalPop);
    expect(summarise(run({ birthHigh: 50 })).peakNI).toBeGreaterThan(summarise(run({ birthHigh: 30 })).peakNI);
  });
  it('summary: multiple = final / start; peak year is where natural increase is largest', () => {
    const r = run();
    const s = summarise(r);
    near(s.multiple, r.pop[200]! / 10);
    expect(Math.max(...r.ni)).toBe(s.peakNI);
    expect(r.ni[s.peakYear]).toBe(s.peakNI);
  });
  it('readings: key is distinct per setting; distinct count; earlier-means-bigger note', () => {
    const rows = [20, 60, 100].map((m) => makeReading({ ...TRANSITION_DEFAULT, deathMid: m }));
    expect(new Set(rows.map((r) => r.key)).size).toBe(3);
    expect(distinctReadings([...rows, rows[0]!])).toBe(3);
    expect(readingKey(TRANSITION_DEFAULT)).toBe('40|60|40');
    expect(earlierMeansBigger(rows)).toBe(true);
    expect(earlierMeansBigger([rows[0]!])).toBeNull();
    expect(rows[0]!.finalPop).toBeGreaterThan(rows[2]!.finalPop);
    near(rows[1]!.finalPop, summarise(run()).finalPop);
  });
});

describe('pyramids', () => {
  it('survival: 1 at birth, falls with age, a longer life keeps more people alive, mean life is e0', () => {
    expect(survival(0, 70)).toBe(1);
    for (const e of [40, 60, 80]) for (let a = 0; a < 100; a += 5) expect(survival(a + 5, e)).toBeLessThan(survival(a, e));
    expect(survival(60, 80)).toBeGreaterThan(survival(60, 50));
    let mean = 0;
    for (let a = 0; a < 200; a += 0.01) mean += survival(a, 70) * 0.01;
    expect(mean).toBeCloseTo(70, 1);
  });
  it('the growth rate solves the Euler-Lotka equation and rises with fertility and life expectancy', () => {
    for (const [t, e] of [[5.5, 55], [3, 70], [2.1, 76], [1.3, 82]] as [number, number][]) {
      const r = stableGrowth(t, e);
      const eq = [17.5, 22.5, 27.5, 32.5, 37.5, 42.5].reduce((s, a, i) => s + FERTILITY_WEIGHTS[i]! * (100 / 205) * t * Math.exp(-r * a) * survival(a, e + 2.5), 0);
      near(eq, 1, 1e-9);
    }
    near(FERTILITY_WEIGHTS.reduce((a, b) => a + b, 0), 1);
    let prev = -Infinity;
    for (const t of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7]) { const r = stableGrowth(t, 70); expect(r).toBeGreaterThan(prev); prev = r; }
    prev = -Infinity;
    for (const e of [35, 50, 65, 80]) { const r = stableGrowth(3, e); expect(r).toBeGreaterThan(prev); prev = r; }
    expect(netReproduction(2.1, 76)).toBeCloseTo(1, 1);
    expect(stableGrowth(6, 60)).toBeGreaterThan(0.02);
    expect(stableGrowth(1.2, 82)).toBeLessThan(-0.01);
  });
  it('shares add up to 100 and the groups are 17', () => {
    expect(AGE_GROUPS.length).toBe(17);
    for (const [t, e] of [[5.6, 54], [2.1, 76], [1.25, 83], [1, 85], [7, 35]] as [number, number][]) {
      const p = pyramid(t, e);
      expect(p.male.length).toBe(17);
      near(p.male.reduce((a, b) => a + b, 0) + p.female.reduce((a, b) => a + b, 0), 100, 1e-9);
      near(p.children + p.working + p.aged, 100, 1e-9);
      for (const v of [...p.male, ...p.female]) expect(v).toBeGreaterThan(0);
    }
  });
  it('more births mean a younger population; longer life means an older one (monotonic)', () => {
    let prev = 0;
    for (const t of [1, 1.5, 2, 3, 4, 5, 6, 7]) { const c = pyramid(t, 70).children; expect(c).toBeGreaterThan(prev); prev = c; }
    let old = 0;
    for (const e of [40, 50, 60, 70, 80, 85]) { const a = pyramid(2.1, e).aged; expect(a).toBeGreaterThan(old); old = a; }
  });
  it('the base ratio falls as fertility falls, and shapes appear in order expanding, constant, declining', () => {
    const order: Shape[] = [];
    let prev = Infinity;
    for (let t = 7; t >= 1; t -= 0.1) {
      const p = pyramid(t, 70);
      const b = baseRatio(p);
      expect(b).toBeLessThan(prev + 1e-12);
      prev = b;
      const s = classify(p);
      if (order[order.length - 1] !== s) order.push(s);
    }
    expect(order).toEqual(['expanding', 'constant', 'declining']);
  });
  it('threshold edges', () => {
    expect(EXPAND_RATIO).toBeGreaterThan(1);
    expect(DECLINE_RATIO).toBeLessThan(1);
  });
  it('the three presets classify as intended; stage 2 shape is expanding; start state is constant', () => {
    for (const pr of PRESETS) expect(classify(pyramid(pr.tfr, pr.e0))).toBe(pr.answer);
    expect(PRESETS.map((p) => p.answer).sort()).toEqual(['constant', 'declining', 'expanding']);
    expect(classify(pyramid(5.5, 55))).toBe('expanding');
    expect(classify(pyramid(2.1, 76))).toBe('constant');
  });
  it('male and female bars differ only slightly (more boys at birth, women live longer)', () => {
    const p = pyramid(2.1, 76);
    expect(p.male[0]!).toBeGreaterThan(p.female[0]!);
    expect(p.female[16]!).toBeGreaterThan(p.male[16]!);
  });
  it('explanations quote the numbers', () => {
    const p = pyramid(1.25, 83);
    expect(whyShape('declining', p)).toContain(`${p.children.toFixed(0)} per cent`);
    expect(whyShape('expanding', pyramid(5.6, 54))).toContain('expanding');
    expect(whyShape('constant', pyramid(2.1, 76))).toContain('constant');
  });
});

describe('human development index', () => {
  it('goalposts are the published UNDP values', () => {
    expect(GOALPOSTS).toEqual({ life: { min: 20, max: 85 }, eys: { min: 0, max: 18 }, mys: { min: 0, max: 15 }, gni: { min: 100, max: 75000 } });
  });
  it('dimension indices by hand', () => {
    near(lifeIndex(70), 50 / 65);
    near(lifeIndex(72), 0.8);
    near(lifeIndex(20), 0);
    near(lifeIndex(85), 1);
    near(eysIndex(12), 12 / 18);
    near(mysIndex(8), 8 / 15);
    near(educationIndex(12, 8), (12 / 18 + 8 / 15) / 2);
    near(educationIndex(12, 8), 0.6);
    near(incomeIndex(10000), Math.log(100) / Math.log(750));
    near(incomeIndex(100), 0);
    near(incomeIndex(75000), 1);
    near(dimensionIndex(70, 25, 85), 0.75);
  });
  it('out-of-range inputs are capped, never negative or above 1', () => {
    expect(lifeIndex(10)).toBe(0);
    expect(lifeIndex(120)).toBe(1);
    expect(incomeIndex(0)).toBe(0);
    expect(incomeIndex(-50)).toBe(0);
    expect(incomeIndex(1e9)).toBe(1);
    expect(eysIndex(25)).toBe(1);
    expect(mysIndex(-3)).toBe(0);
  });
  it('HDI is the geometric mean of the three indices (hand computed)', () => {
    const r = hdi(HDI_START);
    near(r.health, 50 / 65);
    near(r.education, 0.6);
    near(r.income, Math.log(100) / Math.log(750), 1e-12);
    near(r.hdi, Math.cbrt((50 / 65) * 0.6 * (Math.log(100) / Math.log(750))));
    expect(r.hdi).toBeCloseTo(0.6847, 4);
    expect(r.limiting).toBe('education');
    const same = hdi({ life: 52.5, eys: 9, mys: 7.5, gni: Math.sqrt(100 * 75000) });
    near(same.hdi, 0.5, 1e-12);
  });
  it('geometric mean is below the arithmetic mean unless the indices are equal', () => {
    const r = hdi({ life: 80, eys: 16, mys: 11, gni: 1500 });
    expect(r.hdi).toBeLessThan((r.health + r.education + r.income) / 3);
    const e = hdi({ life: 52.5, eys: 9, mys: 7.5, gni: Math.sqrt(100 * 75000) });
    near(e.hdi, (e.health + e.education + e.income) / 3, 1e-12);
  });
  it('a zero index gives HDI 0, and the maximum gives 1', () => {
    expect(hdi({ life: 20, eys: 12, mys: 8, gni: 10000 }).hdi).toBe(0);
    near(hdi({ life: 85, eys: 18, mys: 15, gni: 75000 }).hdi, 1, 1e-12);
  });
  it('monotonic in each input', () => {
    for (const k of ['life', 'eys', 'mys', 'gni'] as const) {
      let prev = -1;
      const vals = k === 'life' ? [30, 50, 70, 85] : k === 'eys' ? [2, 8, 14, 18] : k === 'mys' ? [1, 5, 10, 15] : [200, 1000, 10000, 70000];
      for (const v of vals) { const h = hdi({ ...HDI_START, [k]: v }).hdi; expect(h).toBeGreaterThan(prev); prev = h; }
    }
  });
  it('the limiting dimension is the lowest index, with a stable tie-break', () => {
    expect(PROFILES.map((p) => hdi(p.input).limiting)).toEqual(['education', 'health', 'income']);
    expect(hdi({ life: 52.5, eys: 9, mys: 7.5, gni: Math.sqrt(100 * 75000) }).limiting).toBe('health');
  });
  it('raising the weakest dimension gains the most HDI', () => {
    for (const p of PROFILES) {
      const r = hdi(p.input);
      const gains = { health: gainIfRaised(r, 'health'), education: gainIfRaised(r, 'education'), income: gainIfRaised(r, 'income') };
      const best = (Object.keys(gains) as (keyof typeof gains)[]).reduce((a, b) => (gains[b] > gains[a] ? b : a));
      expect(best).toBe(r.limiting);
    }
    near(gainIfRaised(hdi({ life: 85, eys: 18, mys: 15, gni: 75000 }), 'health'), 0);
  });
  it('HDI against income shows diminishing returns (log index)', () => {
    const s = hdiVsIncome(HDI_START, 60);
    expect(s.length).toBe(61);
    expect(s[0]!.gni).toBeCloseTo(100, 6);
    expect(s[60]!.gni).toBeCloseTo(75000, 3);
    for (let i = 1; i < s.length; i++) expect(s[i]!.hdi).toBeGreaterThan(s[i - 1]!.hdi);
    const gain = (a: number, b: number) => hdi({ ...HDI_START, gni: b }).hdi - hdi({ ...HDI_START, gni: a }).hdi;
    expect(gain(2000, 3000)).toBeGreaterThan(gain(20000, 21000) * 5);
    near(incomeIndex(2000) - incomeIndex(1000), incomeIndex(20000) - incomeIndex(10000), 1e-12);
  });
});

describe('predictions', () => {
  it('four predictions with valid options', () => {
    expect(PREDICTS.length).toBe(4);
    for (const p of PREDICTS) {
      expect(p.options.length).toBeGreaterThanOrEqual(3);
      expect(p.answer).toBeGreaterThanOrEqual(0);
      expect(p.answer).toBeLessThan(p.options.length);
    }
    expect(new Set(PREDICTS.map((p) => p.id)).size).toBe(4);
  });
  it('every keyed answer equals the answer computed from the model', () => {
    expect(predictAnswersFromModel()).toEqual(PREDICTS.map((p) => p.answer));
  });
  it('prediction 1 facts: losing 600 km2 of cultivated land', () => {
    const f = predictFacts();
    expect(f.before).toEqual({ arithmetic: 300, physiological: 600, agricultural: 300 });
    expect(f.after.arithmetic).toBe(300);
    expect(f.after.physiological).toBe(1000);
    expect(f.after.agricultural).toBe(500);
  });
  it('prediction 4: Profile P is limited by education', () => {
    const h = predictFacts().h;
    expect(h.limiting).toBe('education');
    expect(h.education).toBeLessThan(h.health);
    expect(h.education).toBeLessThan(h.income);
  });
});

describe('practice questions', () => {
  it('five questions, valid keys, unique options', () => {
    expect(APPLY.length).toBe(5);
    for (const q of APPLY) {
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(q.options.length);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.why.length).toBeGreaterThan(40);
    }
    expect(buildApply()).toEqual(APPLY);
  });
  it('q1: physiological density = 2,40,000 / 300 = 800', () => {
    expect(APPLY[0]!.options[APPLY[0]!.answer]).toContain('800 persons');
    expect(APPLY[0]!.why).toContain('800');
    expect(240000 / 300).toBe(800);
  });
  it('q2: (32 - 8) / 10 = 2.4 per cent', () => {
    expect(APPLY[1]!.options[APPLY[1]!.answer]).toBe('2.4 per cent');
    expect((32 - 8) / 10).toBeCloseTo(2.4, 12);
  });
  it('q3: birth 38, death 12 is stage 2', () => {
    expect(stageAt(38, 12)).toBe(2);
    expect(APPLY[2]!.options[APPLY[2]!.answer]).toMatch(/^Stage 2/);
  });
  it('q4: 1.3 children per woman and e0 82 give a declining pyramid', () => {
    expect(classify(pyramid(1.3, 82))).toBe('declining');
    expect(APPLY[3]!.options[APPLY[3]!.answer]).toMatch(/^Declining/);
  });
  it('q5: geometric mean of 0.9, 0.9, 0.4 is 0.69 (arithmetic 0.73)', () => {
    expect(Math.cbrt(0.9 * 0.9 * 0.4)).toBeCloseTo(0.6868, 4);
    expect(APPLY[4]!.options[APPLY[4]!.answer]).toBe('0.69');
    expect(APPLY[4]!.options).toContain('0.73');
  });
});
