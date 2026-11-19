import { describe, expect, it } from 'vitest';
import {
  allStatements, analyse, APPLY, checkDiagram, simplestSituation, situationOf, enumerate, evaluate, FORMS, generateProblem, gradePick, hintFor, holds, inSet, isSituation, isUniversal, LESSON_RULES, MENU_WORDS, negate, occupied,
  occupiedMasks, PICK_LABEL, pickFeedback, PREDICTS, predictionAnswer, predictionVerdicts, PRESETS, problemSignature, problemStats, regionMasks, regionName, S, sampleBands, shortestProof,
  specAnswer, statementRegions, stmtKey, stmtText, VERDICTS_BY_OPTION, verdictOf, WORDS, type ApplySpec, type Form, type Level, type Stmt, type Verdict,
} from './syllogism';

const L3 = ['A', 'B', 'C'];
const L2 = ['A', 'B'];
const v = (labels: string[], statements: Stmt[], c: Stmt, existential = true): Verdict => verdictOf(analyse(labels, statements, existential), c);
const permutations = <T,>(a: T[]): T[][] => (a.length <= 1 ? [a] : a.flatMap((x, i) => permutations([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));

describe('regions and situations', () => {
  it('three sets have 7 regions and 128 situations; two sets have 3 regions and 8 situations', () => {
    expect(regionMasks(3)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(regionMasks(2)).toEqual([1, 2, 3]);
    expect(analyse(L3, []).space).toBe(128);
    expect(analyse(L2, []).space).toBe(8);
  });
  it('without statements and without existential import every situation fits', () => {
    expect(enumerate(3, [], false)).toHaveLength(128);
    expect(enumerate(2, [], false)).toHaveLength(8);
    expect(enumerate(3, [], true)).toHaveLength(128); // no set is named, so nothing is imported
  });
  it('each statement form is translated to exactly the right regions', () => {
    // masks: A=1, B=2, C=4
    expect(statementRegions(S('all', 0, 1), 3)).toEqual([1, 5]); // A only, A and C not B
    expect(statementRegions(S('no', 0, 1), 3)).toEqual([3, 7]);
    expect(statementRegions(S('some', 0, 1), 3)).toEqual([3, 7]);
    expect(statementRegions(S('somenot', 0, 1), 3)).toEqual([1, 5]);
    expect(statementRegions(S('all', 1, 0), 2)).toEqual([2]);
    expect(statementRegions(S('some', 0, 1), 2)).toEqual([3]);
  });
  it('holds() agrees with the direct meaning of each form on every situation', () => {
    for (let m = 0; m < 128; m++) {
      const has = (pred: (r: number) => boolean) => regionMasks(3).some((r) => occupied(m, r) && pred(r));
      expect(holds(m, S('all', 0, 2), 3)).toBe(!has((r) => inSet(r, 0) && !inSet(r, 2)));
      expect(holds(m, S('no', 1, 2), 3)).toBe(!has((r) => inSet(r, 1) && inSet(r, 2)));
      expect(holds(m, S('some', 0, 1), 3)).toBe(has((r) => inSet(r, 0) && inSet(r, 1)));
      expect(holds(m, S('somenot', 2, 1), 3)).toBe(has((r) => inSet(r, 2) && !inSet(r, 1)));
    }
  });
  it('region names read naturally', () => {
    expect(regionName(1, ['dogs', 'pets', 'animals'], 3)).toBe('dogs only');
    expect(regionName(3, ['dogs', 'pets', 'animals'], 3)).toBe('dogs and pets, not animals');
    expect(regionName(7, ['dogs', 'pets', 'animals'], 3)).toBe('dogs, pets and animals');
    expect(regionName(3, ['A', 'B'], 2)).toBe('A and B');
  });
  it('statement text: letters take "is" after No, words take "are"', () => {
    expect(stmtText(S('no', 0, 1), ['A', 'B'])).toBe('No A is B');
    expect(stmtText(S('no', 0, 1), ['hills', 'rivers'])).toBe('No hills are rivers');
    expect(stmtText(S('somenot', 1, 0), ['A', 'B'])).toBe('Some B are not A');
    expect(stmtText(S('all', 0, 1), ['cats', 'animals'])).toBe('All cats are animals');
  });
});

describe('classical syllogisms, written in the A, B, C of the lesson (M = middle term)', () => {
  // S = 0, P = 1, M = 2.  Figure 1: M-P, S-M. Figure 2: P-M, S-M. Figure 3: M-P, M-S. Figure 4: P-M, M-S.
  const SS = 0, P = 1, M = 2;
  const valid: [string, Stmt[], Stmt][] = [
    ['Barbara', [S('all', M, P), S('all', SS, M)], S('all', SS, P)],
    ['Celarent', [S('no', M, P), S('all', SS, M)], S('no', SS, P)],
    ['Darii', [S('all', M, P), S('some', SS, M)], S('some', SS, P)],
    ['Ferio', [S('no', M, P), S('some', SS, M)], S('somenot', SS, P)],
    ['Cesare', [S('no', P, M), S('all', SS, M)], S('no', SS, P)],
    ['Camestres', [S('all', P, M), S('no', SS, M)], S('no', SS, P)],
    ['Festino', [S('no', P, M), S('some', SS, M)], S('somenot', SS, P)],
    ['Baroco', [S('all', P, M), S('somenot', SS, M)], S('somenot', SS, P)],
    ['Datisi', [S('all', M, P), S('some', M, SS)], S('some', SS, P)],
    ['Disamis', [S('some', M, P), S('all', M, SS)], S('some', SS, P)],
    ['Ferison', [S('no', M, P), S('some', M, SS)], S('somenot', SS, P)],
    ['Bocardo', [S('somenot', M, P), S('all', M, SS)], S('somenot', SS, P)],
    ['Camenes', [S('all', P, M), S('no', M, SS)], S('no', SS, P)],
    ['Dimaris', [S('some', P, M), S('all', M, SS)], S('some', SS, P)],
    ['Fresison', [S('no', P, M), S('some', M, SS)], S('somenot', SS, P)],
  ];
  for (const [name, prem, concl] of valid) {
    it(`${name} is valid: the conclusion follows`, () => {
      expect(v(L3, prem, concl)).toBe('follows');
      // the same without existential import (the classical valid forms do not need it)
      expect(v(L3, prem, concl, false)).toBe('follows');
    });
  }
  // forms that need the lesson's convention that a circle is not empty (valid with import only)
  const needImport: [string, Stmt[], Stmt][] = [
    ['Darapti', [S('all', M, P), S('all', M, SS)], S('some', SS, P)],
    ['Felapton', [S('no', M, P), S('all', M, SS)], S('somenot', SS, P)],
    ['Barbari (weakened Barbara)', [S('all', M, P), S('all', SS, M)], S('some', SS, P)],
    ['Celaront (weakened Celarent)', [S('no', M, P), S('all', SS, M)], S('somenot', SS, P)],
    ['Bamalip', [S('all', P, M), S('all', M, SS)], S('some', SS, P)],
    ['Fesapo', [S('no', P, M), S('all', M, SS)], S('somenot', SS, P)],
  ];
  for (const [name, prem, concl] of needImport) {
    it(`${name} follows with the lesson's convention but not when a circle may be empty`, () => {
      expect(v(L3, prem, concl, true)).toBe('follows');
      expect(v(L3, prem, concl, false)).not.toBe('follows');
    });
  }
  const invalid: [string, Stmt[], Stmt][] = [
    ['undistributed middle (All P are M, All S are M)', [S('all', P, M), S('all', SS, M)], S('all', SS, P)],
    ['undistributed middle, particular conclusion', [S('all', P, M), S('all', SS, M)], S('some', SS, P)],
    ['undistributed middle (Some M are P, Some M are S)', [S('some', M, P), S('some', M, SS)], S('some', SS, P)],
    ['illicit major (All M are P, No S is M therefore No S is P)', [S('all', M, P), S('no', SS, M)], S('no', SS, P)],
    ['illicit major (All M are P, No S is M therefore Some S are not P)', [S('all', M, P), S('no', SS, M)], S('somenot', SS, P)],
    ['illicit minor (All M are P, All M are S therefore All S are P)', [S('all', M, P), S('all', M, SS)], S('all', SS, P)],
    ['illicit minor (All P are M, All M are S therefore All S are P)', [S('all', P, M), S('all', M, SS)], S('all', SS, P)],
    ['affirming the consequent shape (All P are M, Some S are M therefore Some S are P)', [S('all', P, M), S('some', SS, M)], S('some', SS, P)],
    ['two negatives (No M is P, No S is M therefore No S is P)', [S('no', M, P), S('no', SS, M)], S('no', SS, P)],
    ['two negatives, particular conclusion', [S('no', M, P), S('no', SS, M)], S('somenot', SS, P)],
    ['Some M are P, All S are M therefore Some S are P (particular major, wrong direction)', [S('some', M, P), S('all', SS, M)], S('some', SS, P)],
    ['All M are P, Some M are not S therefore Some S are not P', [S('all', M, P), S('somenot', M, SS)], S('somenot', SS, P)],
  ];
  for (const [name, prem, concl] of invalid) {
    it(`fallacy: ${name} does not follow`, () => {
      expect(v(L3, prem, concl, true)).not.toBe('follows');
      expect(v(L3, prem, concl, false)).not.toBe('follows');
    });
  }
  it('exhaustive: with the lesson convention, every pair of premises over S, M, P agrees with a hand rule set', () => {
    // A premise pair has a valid universal/particular conclusion only if the middle term appears in both premises,
    // at least one premise is universal, and a negative premise gives a negative conclusion. Check those three necessary rules.
    const stmts = [S('all', 0, 2), S('all', 2, 0), S('no', 0, 2), S('some', 0, 2), S('somenot', 0, 2), S('somenot', 2, 0), S('all', 1, 2), S('all', 2, 1), S('no', 1, 2), S('some', 1, 2), S('somenot', 1, 2), S('somenot', 2, 1)];
    for (const p1 of stmts) for (const p2 of stmts) {
      const prem = [p1, p2];
      const an = analyse(L3, prem);
      if (!an.consistent) continue;
      for (const c of allStatements(3)) {
        if (!((c.a === 0 && c.b === 1) || (c.a === 1 && c.b === 0))) continue;
        if (verdictOf(an, c) !== 'follows') continue;
        const bothParticular = !isUniversal(p1) && !isUniversal(p2);
        expect(bothParticular).toBe(false);
        const anyNegative = prem.some((p) => p.form === 'no' || p.form === 'somenot');
        if (anyNegative) expect(c.form === 'no' || c.form === 'somenot').toBe(true);
        else expect(c.form === 'all' || c.form === 'some').toBe(true);
      }
    }
  });
});

describe('"Some" means at least one, and possibly all', () => {
  it('Some A are B does not say that some A are not B, nor that all are', () => {
    expect(v(L2, [S('some', 0, 1)], S('somenot', 0, 1))).toBe('possible');
    expect(v(L2, [S('some', 0, 1)], S('all', 0, 1))).toBe('possible');
    expect(v(L2, [S('some', 0, 1)], S('no', 0, 1))).toBe('impossible');
    expect(v(L2, [S('some', 0, 1)], S('some', 1, 0))).toBe('follows');
  });
  it('Some A are B and Some A are not B can both hold; they are not opposites', () => {
    const an = analyse(L2, [S('some', 0, 1), S('somenot', 0, 1)]);
    expect(an.consistent).toBe(true);
    expect(an.models.every((m) => occupied(m, 3) && occupied(m, 1))).toBe(true);
  });
  it('All A are B does not exclude some B being outside A, and with the lesson convention gives Some B are A', () => {
    expect(v(L2, [S('all', 0, 1)], S('some', 1, 0))).toBe('follows');
    expect(v(L2, [S('all', 0, 1)], S('somenot', 1, 0))).toBe('possible');
    expect(v(L2, [S('all', 0, 1)], S('all', 1, 0))).toBe('possible');
  });
  it('a statement and its negation are never both true, and exactly one is true in every situation', () => {
    for (const s of allStatements(3)) {
      const n = negate(s);
      for (let m = 0; m < 128; m++) expect(holds(m, s, 3)).toBe(!holds(m, n, 3));
    }
  });
});

describe('vacuous cases and existential import', () => {
  it('when a circle may be empty, All A are B gives no Some B are A (nothing forces A to have members)', () => {
    expect(v(L2, [S('all', 0, 1)], S('some', 1, 0), false)).toBe('possible');
    expect(v(L2, [S('all', 0, 1)], S('some', 1, 0), true)).toBe('follows');
  });
  it('All A are B and No A is B: consistent only when A is empty', () => {
    const modern = analyse(L2, [S('all', 0, 1), S('no', 0, 1)], false);
    expect(modern.consistent).toBe(true);
    expect(modern.models.every((m) => !occupied(m, 1) && !occupied(m, 3))).toBe(true); // A is empty in every one
    const lesson = analyse(L2, [S('all', 0, 1), S('no', 0, 1)], true);
    expect(lesson.consistent).toBe(false);
    expect(lesson.message).toMatch(/cannot all be true together/);
    expect(lesson.message).toMatch(/every circle named in a statement must have at least one member/);
  });
  it('when A may be empty, the vacuous truth makes "All A are C" follow from "No A is B, All A are B"', () => {
    expect(v(L3, [S('all', 0, 1), S('no', 0, 1)], S('all', 0, 2), false)).toBe('follows');
  });
  it('a statement that contradicts itself with existential import is reported alone', () => {
    // All A are B and Some A are not B
    const an = analyse(L2, [S('all', 0, 1), S('somenot', 0, 1)]);
    expect(an.consistent).toBe(false);
    expect(an.message).toMatch(/All A are B/);
    expect(an.message).toMatch(/Some A are not B/);
  });
  it('inconsistent statements are reported with the smallest clashing group, not the whole set', () => {
    const an = analyse(L3, [S('all', 0, 1), S('all', 1, 2), S('no', 0, 2)]);
    expect(an.consistent).toBe(false);
    expect(an.message).toMatch(/No A is C/);
    const two = analyse(L3, [S('all', 0, 1), S('some', 1, 2), S('no', 0, 1)]);
    expect(two.consistent).toBe(false);
    expect(two.message).toMatch(/All A are B/);
    expect(two.message).toMatch(/No A is B/);
    expect(two.message).not.toMatch(/Some B are C/);
  });
  it('verdictOf refuses to judge when the statements are inconsistent', () => {
    expect(() => verdictOf(analyse(L2, [S('all', 0, 1), S('no', 0, 1)]), S('some', 0, 1))).toThrow();
  });
  it('analyse rejects a statement about one set only or a missing set', () => {
    expect(() => analyse(L2, [S('all', 0, 0)])).toThrow();
    expect(() => analyse(L2, [S('all', 0, 2)])).toThrow();
  });
  it('a set that no statement names is not forced to have members (importing it would invent a conclusion)', () => {
    // All A are B; C is not named. "Some B are not A" must stay only possible.
    expect(v(L3, [S('all', 0, 1)], S('somenot', 1, 0))).toBe('possible');
  });
});

describe('"follows" means true in every enumerated situation', () => {
  const statementSets: Stmt[][] = [];
  const base = allStatements(3);
  for (let i = 0; i < base.length; i += 3) statementSets.push([base[i]!, base[(i + 5) % base.length]!]);
  statementSets.push([S('all', 0, 1), S('some', 1, 2)], [S('no', 0, 1), S('all', 2, 1)], [S('some', 0, 1), S('no', 1, 2), S('all', 2, 0)]);
  it('for every statement set and every conclusion, the verdict equals what the count over all models says', () => {
    for (const st of statementSets) {
      const an = analyse(L3, st);
      if (!an.consistent) continue;
      for (const c of allStatements(3)) {
        const r = evaluate(an, c);
        const t = an.models.filter((m) => holds(m, c, 3)).length;
        expect(r.trueIn).toBe(t);
        expect(r.total).toBe(an.models.length);
        if (r.verdict === 'follows') { expect(t).toBe(an.models.length); expect(r.counter).toBeNull(); }
        if (r.verdict === 'impossible') { expect(t).toBe(0); expect(r.witness).toBeNull(); }
        if (r.verdict === 'possible') { expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(an.models.length); }
        // counter-example and witness are genuine situations that fit, and behave as claimed
        if (r.counter !== null) { expect(isSituation(r.counter, 3, st)).toBe(true); expect(holds(r.counter, c, 3)).toBe(false); }
        if (r.witness !== null) { expect(isSituation(r.witness, 3, st)).toBe(true); expect(holds(r.witness, c, 3)).toBe(true); }
      }
    }
  });
  it('a conclusion that follows has an argument, and the statements it uses already force it', () => {
    for (const st of statementSets) {
      const an = analyse(L3, st);
      if (!an.consistent) continue;
      for (const c of allStatements(3)) {
        const r = evaluate(an, c);
        if (r.verdict !== 'follows') continue;
        expect(r.argument.length).toBeGreaterThan(0);
        const group = shortestProof(an, c)!;
        expect(group).not.toBeNull();
        const sub = group.map((i) => st[i]!);
        for (const m of enumerate(3, sub)) expect(holds(m, c, 3)).toBe(true);
        // and no smaller group does
        if (group.length > 1) for (const smaller of permutations(group).map((g) => g.slice(0, group.length - 1))) {
          const ms = enumerate(3, smaller.map((i) => st[i]!));
          expect(ms.length > 0 && ms.every((m) => holds(m, c, 3))).toBe(false);
        }
      }
    }
  });
  it('a conclusion that is impossible follows in its negated form', () => {
    for (const st of statementSets) {
      const an = analyse(L3, st);
      if (!an.consistent) continue;
      for (const c of allStatements(3)) {
        const vd = verdictOf(an, c), nv = verdictOf(an, negate(c));
        expect(vd === 'impossible').toBe(nv === 'follows');
        expect(vd === 'follows').toBe(nv === 'impossible');
        expect(vd === 'possible').toBe(nv === 'possible');
      }
    }
  });
  it('the counter-example drawn for the lesson example "Some pens are cups" is a real picture', () => {
    const p = PRESETS[0]!;
    const an = analyse(p.labels, p.statements);
    const r = evaluate(an, S('some', 0, 2));
    expect(r.verdict).toBe('possible');
    const marks = occupiedMasks(r.counter!, 3);
    expect(marks.length).toBeGreaterThan(0);
    // pens (A) and cups (C) share no occupied region in the counter-example
    expect(marks.some((m) => inSet(m, 0) && inSet(m, 2))).toBe(false);
  });
});

describe('results do not depend on the order of the statements', () => {
  const sets: Stmt[][] = [
    [S('all', 0, 1), S('some', 1, 2), S('no', 0, 2)],
    [S('all', 0, 1), S('all', 1, 2), S('somenot', 2, 0)],
    [S('no', 0, 1), S('some', 1, 2), S('all', 2, 0)],
  ];
  for (const [k, st] of sets.entries()) {
    it(`statement set ${k + 1}: same situations, same verdicts, same counts in every order`, () => {
      const ref = analyse(L3, st);
      for (const perm of permutations(st)) {
        const an = analyse(L3, perm);
        expect([...an.models].sort((a, b) => a - b)).toEqual([...ref.models].sort((a, b) => a - b));
        expect(an.consistent).toBe(ref.consistent);
        if (!an.consistent) continue;
        for (const c of allStatements(3)) {
          expect(verdictOf(an, c)).toBe(verdictOf(ref, c));
          expect(evaluate(an, c).trueIn).toBe(evaluate(ref, c).trueIn);
        }
      }
    });
  }
  it('inconsistency does not depend on the order either', () => {
    const st = [S('all', 0, 1), S('no', 0, 1), S('some', 1, 2)];
    for (const perm of permutations(st)) expect(analyse(L3, perm).consistent).toBe(false);
  });
});

describe('the lesson rule table', () => {
  it('has the five rules of the lesson plus two warnings, each with an id and text', () => {
    expect(LESSON_RULES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(LESSON_RULES.map((r) => r.id)).size).toBe(LESSON_RULES.length);
  });
  for (const rule of LESSON_RULES) {
    it(`${rule.id}: ${rule.rule}`, () => {
      expect(v(rule.labels, rule.statements, rule.conclusion)).toBe(rule.verdict);
    });
  }
  it('the lesson solved problem: only conclusion I follows', () => {
    const p = PRESETS[0]!;
    const an = analyse(p.labels, p.statements);
    expect(p.conclusions.map((c) => verdictOf(an, c))).toEqual(['follows', 'possible', 'possible']);
  });
  it('two particular statements never give a conclusion, whatever the forms and the conclusion', () => {
    const parts = [S('some', 0, 1), S('somenot', 0, 1), S('some', 1, 0), S('somenot', 1, 0), S('some', 1, 2), S('somenot', 1, 2), S('some', 2, 1), S('somenot', 2, 1), S('some', 0, 2), S('somenot', 0, 2)];
    for (const p1 of parts) for (const p2 of parts) {
      const an = analyse(L3, [p1, p2]);
      if (!an.consistent) continue;
      for (const c of allStatements(3)) {
        if (stmtKey(c) === stmtKey(p1) || stmtKey(c) === stmtKey(p2)) continue;
        const r = verdictOf(an, c);
        if (r !== 'follows') continue;
        // the only conclusions that can follow are the reversal of a given statement (or the import of a circle), never new facts about a different pair
        const same = [p1, p2].some((p) => stmtKey(p) === stmtKey(c));
        expect(same || (c.form === 'some')).toBe(true);
      }
    }
  });
});

describe('marking and hints', () => {
  it('gradePick: Follows only for follows; Does not follow for possible and impossible; Possible only for possible', () => {
    expect(gradePick('follows', 'follows')).toBe(true);
    expect(gradePick('follows', 'notfollow')).toBe(false);
    expect(gradePick('follows', 'possible')).toBe(false);
    expect(gradePick('possible', 'notfollow')).toBe(true);
    expect(gradePick('possible', 'possible')).toBe(true);
    expect(gradePick('possible', 'follows')).toBe(false);
    expect(gradePick('impossible', 'notfollow')).toBe(true);
    expect(gradePick('impossible', 'possible')).toBe(false);
    expect(gradePick('impossible', 'follows')).toBe(false);
    expect(Object.keys(PICK_LABEL)).toHaveLength(3);
  });
  it('pickFeedback names the situation for every pick', () => {
    const an = analyse(L3, [S('all', 0, 1), S('some', 1, 2)]);
    for (const c of allStatements(3)) {
      const r = evaluate(an, c);
      for (const pick of ['follows', 'notfollow', 'possible'] as const) expect(pickFeedback(r, pick).length).toBeGreaterThan(10);
    }
  });
  it('a hint points at the regions of the conclusion and does not state the verdict', () => {
    const p = PRESETS[0]!;
    const an = analyse(p.labels, p.statements);
    for (const c of p.conclusions) {
      const h = hintFor(an, c);
      expect(h.regions).toEqual(statementRegions(c, 3));
      expect(h.text).toContain(stmtText(c, p.labels));
      expect(h.text).not.toMatch(/does not follow|follows\.|is false|impossible/);
      for (const r of h.regions) expect(h.text).toContain(regionName(r, p.labels, 3));
    }
  });
});

describe('the seeded generator', () => {
  const levels: Level[] = [1, 2, 3];
  it('is reproducible: the same seed and level give the same problem, every time', () => {
    for (const level of levels) for (const seed of [1, 2, 7, 99, 12345]) {
      expect(generateProblem(seed, level)).toEqual(generateProblem(seed, level));
      expect(problemSignature(generateProblem(seed, level))).toBe(problemSignature(generateProblem(seed, level)));
    }
  });
  it('different seeds and levels give different problems (most of the time)', () => {
    for (const level of levels) {
      const sigs = new Set(Array.from({ length: 60 }, (_, k) => problemSignature(generateProblem(k + 1, level))));
      expect(sigs.size).toBeGreaterThan(45);
    }
    expect(problemSignature(generateProblem(5, 1))).not.toBe(problemSignature(generateProblem(5, 3)));
  });
  it('every generated problem is well formed and its statements fit together', () => {
    for (const level of levels) for (let seed = 1; seed <= 300; seed++) {
      const p = generateProblem(seed, level);
      expect(p.id).toBe(`p${level}-${seed}`);
      expect(p.labels).toHaveLength(3);
      expect(new Set(p.labels).size).toBe(3);
      p.labels.forEach((w) => expect(WORDS).toContain(w));
      expect(p.statements.length).toBeGreaterThanOrEqual(2);
      expect(p.statements.length).toBeLessThanOrEqual(3);
      if (level === 1) expect(p.statements).toHaveLength(2);
      if (level === 3) expect(p.statements).toHaveLength(3);
      expect(p.conclusions.length).toBeGreaterThanOrEqual(3);
      expect(p.conclusions.length).toBeLessThanOrEqual(4);
      const keys = p.conclusions.map(stmtKey);
      expect(new Set(keys).size).toBe(keys.length);
      p.statements.forEach((s) => expect(keys).not.toContain(stmtKey(s))); // never repeats a given statement
      for (const s of [...p.statements, ...p.conclusions]) { expect(s.a).not.toBe(s.b); expect(FORMS).toContain(s.form as Form); }
      const an = analyse(p.labels, p.statements);
      expect(an.consistent).toBe(true);
      expect(an.models.length).toBeGreaterThanOrEqual(2);
      const vs = p.conclusions.map((c) => verdictOf(an, c));
      expect(vs.some((x) => x !== 'follows')).toBe(true);
      if (level === 1) expect(vs).toContain('follows');
      if (level >= 2) expect(vs).toContain('possible');
      if (level === 3) expect(vs.filter((x) => x === 'follows').length).toBeLessThanOrEqual(2);
    }
  });
  it('uses every kind of statement and every verdict across the levels', () => {
    const forms = new Set<string>(), verdicts = new Set<string>();
    for (const level of levels) for (let seed = 1; seed <= 80; seed++) {
      const p = generateProblem(seed, level);
      const an = analyse(p.labels, p.statements);
      p.statements.forEach((s) => forms.add(s.form));
      p.conclusions.forEach((c) => { forms.add(c.form); verdicts.add(verdictOf(an, c)); });
    }
    expect([...forms].sort()).toEqual(['all', 'no', 'some', 'somenot']);
    expect([...verdicts].sort()).toEqual(['follows', 'impossible', 'possible']);
  });
  it('every generated answer is verified independently by brute force over the 128 situations', () => {
    for (const level of levels) for (let seed = 1; seed <= 60; seed++) {
      const p = generateProblem(seed, level);
      const fits: number[] = [];
      for (let m = 0; m < 128; m++) {
        const okStmts = p.statements.every((s) => {
          const rs = regionMasks(3).filter((r) => {
            const a = ((r >> s.a) & 1) === 1, b = ((r >> s.b) & 1) === 1;
            return s.form === 'all' || s.form === 'somenot' ? a && !b : a && b;
          });
          const any = rs.some((r) => (m >> (r - 1)) & 1);
          return s.form === 'all' || s.form === 'no' ? !any : any;
        });
        const okImport = [...new Set(p.statements.flatMap((s) => [s.a, s.b]))].every((k) => regionMasks(3).some((r) => ((r >> k) & 1) === 1 && ((m >> (r - 1)) & 1) === 1));
        if (okStmts && okImport) fits.push(m);
      }
      const an = analyse(p.labels, p.statements);
      expect([...an.models].sort((a, b) => a - b)).toEqual(fits);
    }
  });
  it('problemStats adds up', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const st = problemStats(generateProblem(seed, 2));
      expect(st.follows + st.possible + st.impossible).toBe(st.conclusions);
      expect(st.situations).toBeGreaterThanOrEqual(2);
    }
  });
  it('more fitting situations mean a larger share of conclusions that are only possible (the Analyse claim)', () => {
    const bands = sampleBands(150);
    const filled = bands.filter((b) => b.problems >= 20);
    expect(filled.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < filled.length; i++) {
      expect(filled[i]!.avgSituations).toBeGreaterThan(filled[i - 1]!.avgSituations);
      expect(filled[i]!.possibleShare).toBeGreaterThan(filled[i - 1]!.possibleShare);
      expect(filled[i]!.followsShare).toBeLessThan(filled[i - 1]!.followsShare);
    }
  });
});

describe('the solver presets and the Venn builder word menu', () => {
  it('each preset has two or three statements and three or four conclusions, all consistent', () => {
    for (const p of PRESETS) {
      expect(p.statements.length).toBeGreaterThanOrEqual(2);
      expect(p.statements.length).toBeLessThanOrEqual(3);
      expect(p.conclusions.length).toBeGreaterThanOrEqual(3);
      expect(p.conclusions.length).toBeLessThanOrEqual(4);
      expect(analyse(p.labels, p.statements).consistent).toBe(true);
    }
  });
  it('the presets show all three verdicts and use two and three sets', () => {
    const vs = new Set<string>();
    for (const p of PRESETS) { const an = analyse(p.labels, p.statements); p.conclusions.forEach((c) => vs.add(verdictOf(an, c))); }
    expect([...vs].sort()).toEqual(['follows', 'impossible', 'possible']);
    expect(PRESETS.some((p) => p.labels.length === 2)).toBe(true);
    expect(PRESETS.some((p) => p.labels.length === 3)).toBe(true);
  });
  it('the menu words are all different and the lesson example words are in the generator list', () => {
    expect(new Set(MENU_WORDS).size).toBe(MENU_WORDS.length);
    expect(MENU_WORDS).toEqual(expect.arrayContaining(['dogs', 'animals', 'pets']));
  });
});

describe('the four predictions are all verified by the engine', () => {
  it('there are four, with different titles and distinct options', () => {
    expect(PREDICTS).toHaveLength(4);
    expect(new Set(PREDICTS.map((p) => p.id)).size).toBe(4);
    for (const p of PREDICTS) { expect(new Set(p.options).size).toBe(p.options.length); expect(p.answer).toBeLessThan(p.options.length); }
  });
  for (const p of PREDICTS) {
    it(`${p.id} "${p.title}": the key equals the engine's answer`, () => {
      expect(predictionAnswer(p)).toBe(p.answer);
    });
  }
  it('s1: All C are A is only a possibility (true when A, B, C coincide)', () => {
    expect(v(L3, PREDICTS[0]!.statements, S('all', 2, 0))).toBe('possible');
    expect(VERDICTS_BY_OPTION[PREDICTS[0]!.answer]).toBe('possible');
  });
  it('s2: exactly one of the four conclusions follows and it is "Some A are not C"', () => {
    const vs = predictionVerdicts(PREDICTS[1]!);
    expect(vs.filter((x) => x === 'follows')).toHaveLength(1);
    expect(PREDICTS[1]!.options[PREDICTS[1]!.answer]).toBe('Some A are not C');
    expect(vs).toEqual(['possible', 'impossible', 'possible', 'follows']);
  });
  it('s3: Some A are not C is only a possibility when A lies inside B and some B are not C', () => {
    expect(predictionVerdicts(PREDICTS[2]!)).toEqual(['possible']);
  });
  it('s4: exactly one pair makes Some A are C a possibility; the others make it follow or impossible', () => {
    const vs = predictionVerdicts(PREDICTS[3]!);
    expect(vs).toEqual(['impossible', 'possible', 'follows', 'impossible']);
    expect(vs.filter((x) => x === 'possible')).toHaveLength(1);
  });
});

describe('the five practice questions are all verified by the exhaustive checker', () => {
  it('there are five, in the standard format, with distinct options and a worked explanation', () => {
    expect(APPLY).toHaveLength(5);
    expect(new Set(APPLY.map((q) => q.id)).size).toBe(5);
    for (const q of APPLY) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.why.length).toBeGreaterThan(60);
      expect(q.q).toMatch(/^Statements: /);
    }
  });
  for (const q of APPLY) {
    it(`${q.id}: the key is the option the engine finds`, () => {
      expect(specAnswer(q.spec)).toBe(q.answer);
      const an = analyse(q.spec.labels, q.spec.statements);
      expect(an.consistent).toBe(true);
      // exactly one option is right
      if (q.spec.mode === 'which') {
        const vs = q.spec.conclusions.map((c) => verdictOf(an, c));
        const following = vs.map((x, i) => (x === 'follows' ? i : -1)).filter((i) => i >= 0);
        const matching = q.spec.optionSets!.filter((s) => s.length === following.length && s.every((i) => following.includes(i)));
        expect(matching).toHaveLength(1);
      } else {
        const vs = q.spec.conclusions.map((c) => verdictOf(an, c));
        expect(vs.filter((x) => x === (q.spec.mode === 'follows' ? 'follows' : 'possible'))).toHaveLength(1);
        if (q.spec.mode === 'possible') expect(vs).not.toContain('follows');
        q.options.forEach((o, i) => expect(o).toBe(stmtText(q.spec.conclusions[i]!, q.spec.labels)));
      }
    });
  }
  it('the question text repeats exactly the statements and conclusions of the spec', () => {
    for (const q of APPLY) {
      for (const s of q.spec.statements) expect(q.q).toContain(stmtText(s, q.spec.labels));
      if (q.spec.mode === 'which') q.spec.conclusions.forEach((c) => expect(q.q).toContain(stmtText(c, q.spec.labels)));
    }
  });
  it('the keys are spread over the options (not always the same letter)', () => {
    expect(new Set(APPLY.map((q) => q.answer)).size).toBeGreaterThanOrEqual(4);
  });
  it('specAnswer rejects nothing silently: a wrong key would be caught', () => {
    const bad: ApplySpec = { ...APPLY[0]!.spec, optionSets: [[0], [1], [], [0]] };
    expect(specAnswer(bad)).not.toBe(2);
  });
});

describe('checking the student own diagram', () => {
  it('a diagram is consistent exactly when its marked regions form a situation that fits', () => {
    const sets: Stmt[][] = [[S('all', 0, 1), S('some', 1, 2)], [S('no', 0, 1), S('some', 0, 2), S('all', 2, 1)], [S('some', 0, 1), S('somenot', 0, 2)], [S('all', 0, 1), S('all', 1, 2)]];
    for (const st of sets) for (let m = 1; m < 128; m++) {
      const marks = occupiedMasks(m, 3);
      expect(checkDiagram(L3, st, marks).ok).toBe(isSituation(m, 3, st));
      expect(checkDiagram(L3, st, marks, false).ok).toBe(isSituation(m, 3, st, false));
    }
  });
  it('explains each kind of mistake in plain words', () => {
    expect(checkDiagram(L3, [], []).problems[0]).toMatch(/Add at least one statement/);
    expect(checkDiagram(L3, [S('all', 0, 1)], []).problems[0]).toMatch(/Place at least one X/);
    const emptied = checkDiagram(L3, [S('all', 0, 1)], [1]);
    expect(emptied.ok).toBe(false);
    expect(emptied.problems.join(' ')).toMatch(/X in “A only”.*makes that region empty/);
    const need = checkDiagram(L3, [S('some', 0, 1)], [4]);
    expect(need.problems.join(' ')).toMatch(/Some A are B.*still needs an X/);
    expect(need.problems.join(' ')).toMatch(/circle for A has no X/);
    expect(checkDiagram(L3, [S('some', 0, 1)], [3]).ok).toBe(true);
  });
  it('the simplest valid diagram always passes the check, and respects the drawable regions', () => {
    for (const p of PRESETS) {
      const an = analyse(p.labels, p.statements);
      const m = simplestSituation(an)!;
      expect(checkDiagram(p.labels, p.statements, occupiedMasks(m, p.labels.length)).ok).toBe(true);
    }
    const an = analyse(L3, [S('some', 0, 1)]);
    const m = simplestSituation(an, [3, 1, 2])!;
    expect(occupiedMasks(m, 3).every((r) => [3, 1, 2].includes(r))).toBe(true);
    expect(simplestSituation(an, [1, 2])).toBeNull();
    expect(situationOf([3])).toBe(4);
  });
});
