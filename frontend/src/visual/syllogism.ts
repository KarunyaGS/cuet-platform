/**
 * Pure logic of the Venn Diagram and Syllogism Lab (CUET-UG General Aptitude Test, paper 501,
 * lesson "Logical and analytical reasoning", section "Syllogisms and Venn diagrams").
 *
 * The model: up to three sets A, B, C cut the page into 2^n - 1 regions (7 for three sets, 3 for two sets).
 * A "situation" (a model) says which regions have at least one member. Every statement is a constraint on regions:
 *   All A are B        the regions inside A but outside B are empty
 *   No A is B          the regions inside both A and B are empty
 *   Some A are B       at least one region inside both A and B has a member
 *   Some A are not B   at least one region inside A but outside B has a member
 * A conclusion FOLLOWS when it is true in EVERY situation that fits all the statements (the lesson's rule);
 * it is only POSSIBLE when true in some and false in others; it is IMPOSSIBLE when false in every one.
 *
 * Conventions (the usual Indian-exam ones, and the lesson's own):
 *  - "Some" means at least one, and possibly all.
 *  - Every circle named in a statement is taken to have at least one member ("existential import").
 *    This is why the lesson can say that "All A are B" reverses to "Some B are A". It can be switched off
 *    (existential = false) to see the modern reading in which a circle may be empty; the tests cover both.
 *  - Real-world knowledge is set aside: only the statements count.
 * Nothing here uses a network or an AI service. Status of all lab content: Draft - unverified.
 */
import { rng } from './algo';

export type Form = 'all' | 'no' | 'some' | 'somenot';
export interface Stmt { form: Form; a: number; b: number }
export type Verdict = 'follows' | 'possible' | 'impossible';
export type Pick = 'follows' | 'notfollow' | 'possible';
export type Level = 1 | 2 | 3;

export const FORMS: Form[] = ['all', 'no', 'some', 'somenot'];
export const MAX_SETS = 3;

// ---------------------------------------------------------------- statements and text

export const S = (form: Form, a: number, b: number): Stmt => ({ form, a, b });
export const isUniversal = (s: Stmt) => s.form === 'all' || s.form === 'no';
const isLetter = (t: string) => /^[A-Z]$/.test(t);

export function stmtText(s: Stmt, labels: string[]): string {
  const a = labels[s.a] ?? '?', b = labels[s.b] ?? '?';
  switch (s.form) {
    case 'all': return `All ${a} are ${b}`;
    case 'no': return `No ${a} ${isLetter(a) ? 'is' : 'are'} ${b}`;
    case 'some': return `Some ${a} are ${b}`;
    default: return `Some ${a} are not ${b}`;
  }
}
/** The statement that is true in exactly the situations where s is false. */
export const negate = (s: Stmt): Stmt => S(s.form === 'all' ? 'somenot' : s.form === 'somenot' ? 'all' : s.form === 'no' ? 'some' : 'no', s.a, s.b);
/** Key that is the same for a statement and its plain reversal ("Some A are B" = "Some B are A", "No A is B" = "No B is A"). */
export const stmtKey = (s: Stmt) => (s.form === 'some' || s.form === 'no' ? `${s.form}:${Math.min(s.a, s.b)}:${Math.max(s.a, s.b)}` : `${s.form}:${s.a}:${s.b}`);

// ---------------------------------------------------------------- regions and situations

const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k);
/** Region masks 1 .. 2^n - 1. Bit k of a mask says "inside set k". Mask 0 (outside every circle) is never constrained. */
export const regionMasks = (n: number): number[] => range(1, 1 << n);
export const inSet = (mask: number, k: number) => ((mask >> k) & 1) === 1;
const bitOf = (mask: number) => 1 << (mask - 1);
/** A situation is a number whose bit (mask - 1) is 1 when that region has a member. */
export const occupied = (situation: number, mask: number) => (situation & bitOf(mask)) !== 0;
export const situationOf = (masks: Iterable<number>): number => { let s = 0; for (const m of masks) s |= bitOf(m); return s; };
export const occupiedMasks = (situation: number, n: number): number[] => regionMasks(n).filter((m) => occupied(situation, m));
const popcount = (x: number) => { let c = 0; for (let v = x; v; v &= v - 1) c++; return c; };

/** Words for a region, e.g. "A only", "A and B, not C", "A, B and C". */
export function regionName(mask: number, labels: string[], n: number): string {
  const ins = range(0, n).filter((k) => inSet(mask, k)).map((k) => labels[k] ?? '?');
  const outs = range(0, n).filter((k) => !inSet(mask, k)).map((k) => labels[k] ?? '?');
  if (ins.length === n) return n === 1 ? ins[0]! : `${ins.slice(0, -1).join(', ')} and ${ins.at(-1)}`;
  if (ins.length === 1) return `${ins[0]} only`;
  return `${ins.join(' and ')}, not ${outs.join(' or ')}`;
}

/** For "All" and "No": the regions that must be empty. For "Some": the regions where at least one must have a member. */
export function statementRegions(s: Stmt, n: number): number[] {
  return regionMasks(n).filter((r) => {
    const a = inSet(r, s.a), b = inSet(r, s.b);
    switch (s.form) {
      case 'all': return a && !b;
      case 'no': return a && b;
      case 'some': return a && b;
      default: return a && !b;
    }
  });
}
export function holds(situation: number, s: Stmt, n: number): boolean {
  const rs = statementRegions(s, n);
  return isUniversal(s) ? rs.every((r) => !occupied(situation, r)) : rs.some((r) => occupied(situation, r));
}
export const usedSets = (statements: Stmt[]): number[] => [...new Set(statements.flatMap((s) => [s.a, s.b]))].sort();
const importRegions = (k: number, n: number) => regionMasks(n).filter((r) => inSet(r, k));

/** True when the situation satisfies every statement (and, with existential import, every named circle has a member). */
export function isSituation(situation: number, n: number, statements: Stmt[], existential = true): boolean {
  if (!statements.every((s) => holds(situation, s, n))) return false;
  if (existential && !usedSets(statements).every((k) => importRegions(k, n).some((r) => occupied(situation, r)))) return false;
  return true;
}
/** Every situation (assignment of "has members / empty" to the regions) that fits all the statements. */
export function enumerate(n: number, statements: Stmt[], existential = true): number[] {
  const out: number[] = [];
  const total = 1 << ((1 << n) - 1);
  for (let m = 0; m < total; m++) if (isSituation(m, n, statements, existential)) out.push(m);
  return out;
}

// ---------------------------------------------------------------- analysis

export interface Analysis {
  n: number;
  labels: string[];
  statements: Stmt[];
  existential: boolean;
  /** Every situation that fits. */
  models: number[];
  /** How many assignments were checked: 2^(2^n - 1). */
  space: number;
  consistent: boolean;
  /** Plain-words message when the statements cannot all be true. */
  message: string;
}

export function analyse(labels: string[], statements: Stmt[], existential = true): Analysis {
  const n = labels.length;
  if (n < 1 || n > MAX_SETS) throw new Error('Between one and three sets are supported');
  for (const s of statements) if (s.a === s.b || s.a < 0 || s.b < 0 || s.a >= n || s.b >= n) throw new Error('A statement needs two different sets of the problem');
  const models = enumerate(n, statements, existential);
  const space = 1 << ((1 << n) - 1);
  let message = '';
  if (models.length === 0) message = contradiction(labels, statements, existential);
  return { n, labels, statements, existential, models, space, consistent: models.length > 0, message };
}

function subsets<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  const go = (start: number, cur: T[]) => {
    if (cur.length === size) { out.push([...cur]); return; }
    for (let i = start; i < items.length; i++) { cur.push(items[i]!); go(i + 1, cur); cur.pop(); }
  };
  go(0, []);
  return out;
}

/** A plain-words explanation of why no diagram fits: the smallest group of statements that already clash. */
function contradiction(labels: string[], statements: Stmt[], existential: boolean): string {
  const n = labels.length;
  for (let k = 1; k <= statements.length; k++) {
    for (const group of subsets(statements.map((s, i) => i), k)) {
      if (enumerate(n, group.map((i) => statements[i]!), existential).length === 0) {
        const names = group.map((i) => `“${stmtText(statements[i]!, labels)}”`);
        const who = k === 1 ? `The statement ${names[0]} cannot be true on its own` : `These statements cannot all be true together: ${names.join(' and ')}`;
        return `${who}. No Venn diagram fits them${existential ? ' (every circle named in a statement must have at least one member)' : ''}, so there is nothing to draw conclusions from. Change a statement.`;
      }
    }
  }
  return 'No Venn diagram fits all the statements. Change a statement.';
}

export interface ConclusionResult {
  conclusion: Stmt;
  verdict: Verdict;
  /** In how many of the fitting situations the conclusion is true, and how many there are. */
  trueIn: number;
  total: number;
  /** A fitting situation where the conclusion is false (the simplest one), or null when it follows. */
  counter: number | null;
  /** A fitting situation where the conclusion is true (the simplest one), or null when it is impossible. */
  witness: number | null;
  /** The shortest argument in words: for "follows", why; for "impossible", why the opposite follows; for "possible", the two pictures. */
  argument: string[];
}

const simplest = (situations: number[]) => situations.reduce<number | null>((best, m) => (best === null || popcount(m) < popcount(best) || (popcount(m) === popcount(best) && m < best) ? m : best), null);

export function verdictOf(an: Analysis, c: Stmt): Verdict {
  if (!an.consistent) throw new Error('The statements are inconsistent');
  const t = an.models.filter((m) => holds(m, c, an.n)).length;
  return t === an.models.length ? 'follows' : t === 0 ? 'impossible' : 'possible';
}

export function evaluate(an: Analysis, c: Stmt): ConclusionResult {
  const trues = an.models.filter((m) => holds(m, c, an.n));
  const falses = an.models.filter((m) => !holds(m, c, an.n));
  const verdict = verdictOf(an, c);
  return {
    conclusion: c, verdict, trueIn: trues.length, total: an.models.length,
    counter: simplest(falses), witness: simplest(trues),
    argument: explain(an, c, verdict),
  };
}

/** The fewest statements that already force the conclusion (null when no group of them does). */
export function shortestProof(an: Analysis, c: Stmt): number[] | null {
  const idx = an.statements.map((_, i) => i);
  for (let k = 1; k <= idx.length; k++) {
    for (const group of subsets(idx, k)) {
      const sub = group.map((i) => an.statements[i]!);
      const ms = enumerate(an.n, sub, an.existential);
      if (ms.length > 0 && ms.every((m) => holds(m, c, an.n))) return group;
    }
  }
  return null;
}

function explain(an: Analysis, c: Stmt, verdict: Verdict): string[] {
  const { labels } = an;
  if (verdict === 'follows') return proof(an, c);
  if (verdict === 'impossible') return [`“${stmtText(c, labels)}” is false in all ${an.models.length} situations that fit, because the opposite, “${stmtText(negate(c), labels)}”, follows.`, ...proof(an, negate(c))];
  return [`“${stmtText(c, labels)}” is true in ${trueIn(an, c)} of the ${an.models.length} situations that fit and false in the rest. So it may be true, but it does not follow.`];
}
const trueIn = (an: Analysis, c: Stmt) => an.models.filter((m) => holds(m, c, an.n)).length;

/** The argument that "c follows", using the fewest statements. Falls back to the plain count when it is not a single-step argument. */
function proof(an: Analysis, c: Stmt): string[] {
  const { n, labels } = an;
  const nm = (r: number) => `“${regionName(r, labels, n)}”`;
  const list = (rs: number[]) => rs.map(nm).join(', ');
  const group = shortestProof(an, c);
  const fallback = [`“${stmtText(c, labels)}” is true in all ${an.models.length} situations that fit, so it follows.`];
  if (!group) return fallback;
  const sub = group.map((i) => an.statements[i]!);
  const lines: string[] = [];
  const emptied = new Set<number>();
  for (const s of sub) {
    if (isUniversal(s)) {
      const rs = statementRegions(s, n);
      rs.forEach((r) => emptied.add(r));
      lines.push(`“${stmtText(s, labels)}” makes ${rs.length === 1 ? 'this region' : 'these regions'} empty: ${list(rs)}.`);
    }
  }
  const target = statementRegions(c, n);
  if (isUniversal(c)) {
    if (target.every((r) => emptied.has(r))) {
      lines.push(`“${stmtText(c, labels)}” needs ${target.length === 1 ? 'this region' : 'these regions'} empty: ${list(target)}. ${target.length === 1 ? 'It is' : 'They are'} already empty, so it follows.`);
      return lines;
    }
    return fallback;
  }
  // a particular conclusion: one "at least one member" clause that is squeezed into the target
  const clauses: { why: string; regions: number[] }[] = [
    ...sub.filter((s) => !isUniversal(s)).map((s) => ({ why: `“${stmtText(s, labels)}” puts a member in one of these regions: ${list(statementRegions(s, n))}`, regions: statementRegions(s, n) })),
    ...(an.existential ? usedSets(sub).map((k) => ({ why: `The circle for ${labels[k]} has at least one member, in one of these regions: ${list(importRegions(k, n))}`, regions: importRegions(k, n) })) : []),
  ];
  for (const cl of clauses) {
    const left = cl.regions.filter((r) => !emptied.has(r));
    if (left.length > 0 && left.every((r) => target.includes(r))) {
      const cut = cl.regions.filter((r) => emptied.has(r));
      lines.push(`${cl.why}.`);
      if (cut.length > 0) lines.push(`The empty regions rule out ${list(cut)}.`);
      lines.push(`Only ${list(left)} ${left.length === 1 ? 'is' : 'are'} left, and ${left.length === 1 ? 'it lies' : 'they lie'} inside “${stmtText(c, labels)}”. So it follows.`);
      return lines;
    }
  }
  return fallback;
}

// ---------------------------------------------------------------- the student's own diagram

export interface DiagramCheck { ok: boolean; problems: string[] }
/**
 * Is a diagram with X marks in the given regions consistent with the statements? A marked region has a member, an
 * unmarked region is taken as empty, so the diagram is one situation. It is consistent when that situation fits.
 */
export function checkDiagram(labels: string[], statements: Stmt[], marks: number[], existential = true): DiagramCheck {
  const n = labels.length;
  const name = (r: number) => `“${regionName(r, labels, n)}”`;
  const problems: string[] = [];
  if (statements.length === 0) return { ok: false, problems: ['Add at least one statement first.'] };
  if (marks.length === 0) return { ok: false, problems: ['Place at least one X in a region first.'] };
  for (const s of statements) {
    const rs = statementRegions(s, n);
    if (isUniversal(s)) {
      for (const r of rs.filter((x) => marks.includes(x))) problems.push(`There is an X in ${name(r)}, but “${stmtText(s, labels)}” makes that region empty.`);
    } else if (!rs.some((r) => marks.includes(r))) {
      problems.push(`“${stmtText(s, labels)}” still needs an X in ${rs.length === 1 ? 'the region' : 'one of the regions'} ${rs.map(name).join(' or ')}.`);
    }
  }
  if (existential) for (const k of usedSets(statements)) {
    if (!importRegions(k, n).some((r) => marks.includes(r))) problems.push(`The circle for ${labels[k]} has no X yet. In the lesson every circle named in a statement has at least one member.`);
  }
  return { ok: problems.length === 0, problems };
}
/** The simplest situation that fits (fewest regions with members), optionally limited to the regions that can be drawn. */
export function simplestSituation(an: Analysis, drawable?: number[]): number | null {
  return simplest(drawable ? an.models.filter((m) => occupiedMasks(m, an.n).every((r) => drawable.includes(r))) : an.models);
}

// ---------------------------------------------------------------- verdicts, grading, hints

export const VERDICT_LABEL: Record<Verdict, string> = { follows: 'Follows', possible: 'Possible', impossible: 'Does not follow (false in every picture)' };
export const PICK_LABEL: Record<Pick, string> = { follows: 'Follows', notfollow: 'Does not follow', possible: 'Possible' };
/**
 * Marking rule: "Follows" is right only when the conclusion is true in every picture. "Does not follow" is right whenever
 * it is false in at least one picture (so it is right for possible and for impossible conclusions). "Possible" is right
 * only when it is true in some pictures and false in others.
 */
export function gradePick(verdict: Verdict, pick: Pick): boolean {
  if (pick === 'follows') return verdict === 'follows';
  if (pick === 'notfollow') return verdict !== 'follows';
  return verdict === 'possible';
}
/** Feedback sentence for a student's pick. */
export function pickFeedback(r: ConclusionResult, pick: Pick): string {
  const ok = gradePick(r.verdict, pick);
  if (r.verdict === 'follows') return ok ? 'Correct: it is true in every situation that fits.' : 'It does follow: it is true in every one of the situations that fit.';
  if (r.verdict === 'possible') {
    if (pick === 'possible') return 'Correct: true in some situations and false in others.';
    if (pick === 'notfollow') return 'Correct, it does not follow. It is more exactly a possibility: true in some situations, false in others.';
    return 'It does not follow: there is a picture where it is false. It is only a possibility.';
  }
  if (pick === 'notfollow') return 'Correct: it is false in every situation that fits.';
  return pick === 'possible' ? 'It is not even possible: it is false in every situation that fits.' : 'It does not follow: it is false in every situation that fits.';
}

export interface Hint { regions: number[]; text: string }
/** Points at the region(s) to check, without giving the answer away. */
export function hintFor(an: Analysis, c: Stmt): Hint {
  const regions = statementRegions(c, an.n);
  const names = regions.map((r) => `“${regionName(r, an.labels, an.n)}”`).join(' and ');
  const word = regions.length === 1 ? 'the region' : 'the regions';
  const text = isUniversal(c)
    ? `Look at ${word} ${names}. For “${stmtText(c, an.labels)}” to follow, ${regions.length === 1 ? 'it' : 'every one of them'} must be empty in every picture. Do the statements empty ${regions.length === 1 ? 'it' : 'them'}?`
    : `Look at ${word} ${names}. For “${stmtText(c, an.labels)}” to follow, a member must be forced into ${regions.length === 1 ? 'it' : 'one of them'} in every picture. Which statement does that?`;
  return { regions, text };
}

// ---------------------------------------------------------------- the lesson's rule table

export interface LessonRule { id: string; rule: string; labels: string[]; statements: Stmt[]; conclusion: Stmt; verdict: Verdict }
/** The rules stated in the lesson "Logical and analytical reasoning", each as a checkable case. */
export const LESSON_RULES: LessonRule[] = [
  { id: 'r1', rule: '“Some A are B” can be reversed to “Some B are A”.', labels: ['A', 'B'], statements: [S('some', 0, 1)], conclusion: S('some', 1, 0), verdict: 'follows' },
  { id: 'r2', rule: '“No A is B” can be reversed to “No B is A”.', labels: ['A', 'B'], statements: [S('no', 0, 1)], conclusion: S('no', 1, 0), verdict: 'follows' },
  { id: 'r3', rule: '“All A are B” can only be reversed to “Some B are A”.', labels: ['A', 'B'], statements: [S('all', 0, 1)], conclusion: S('some', 1, 0), verdict: 'follows' },
  { id: 'r4', rule: '“All A are B” is never reversed to “All B are A”: that is only a possibility.', labels: ['A', 'B'], statements: [S('all', 0, 1)], conclusion: S('all', 1, 0), verdict: 'possible' },
  { id: 'r5', rule: 'Two particular statements (some, some) give no conclusion about A and C.', labels: ['A', 'B', 'C'], statements: [S('some', 0, 1), S('some', 1, 2)], conclusion: S('some', 0, 2), verdict: 'possible' },
  { id: 'r6', rule: 'From “All A are B” and “All B are C” we conclude “All A are C”.', labels: ['A', 'B', 'C'], statements: [S('all', 0, 1), S('all', 1, 2)], conclusion: S('all', 0, 2), verdict: 'follows' },
  { id: 'r7', rule: 'Possible is not the same as follows: A and C may overlap, but nothing forces it.', labels: ['A', 'B', 'C'], statements: [S('all', 0, 1), S('some', 1, 2)], conclusion: S('some', 0, 2), verdict: 'possible' },
];

// ---------------------------------------------------------------- the seeded generator

/** Everyday nouns with no real-world links between them, so only the statements count. */
export const WORDS = ['pens', 'books', 'cups', 'tables', 'chairs', 'lamps', 'clocks', 'bags', 'boxes', 'keys', 'coins', 'flags', 'hills', 'rivers', 'lakes', 'kites', 'drums', 'bells', 'plates', 'shoes', 'caps', 'maps', 'ropes', 'stones'];
/** The menu offered in the Venn builder: letters and words with natural overlaps, as in the lesson's examples. */
export const MENU_WORDS = ['dogs', 'cats', 'animals', 'pets', 'birds', 'mammals', 'fish', 'flowers', 'roses', 'plants', 'trees', 'books', 'pens', 'cups', 'doctors', 'teachers', 'students', 'singers'];

export interface Problem { id: string; seed: number; level: Level; labels: string[]; statements: Stmt[]; conclusions: Stmt[] }
export const LEVEL_NAME: Record<Level, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };

/** Every statement over the sets, once (a statement and its plain reversal count as one). */
export function allStatements(n: number): Stmt[] {
  const seen = new Set<string>();
  const out: Stmt[] = [];
  for (const form of FORMS) for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    if (a === b) continue;
    const s = S(form, a, b);
    if (!seen.has(stmtKey(s))) { seen.add(stmtKey(s)); out.push(s); }
  }
  return out;
}

const shuffle = <T,>(items: T[], r: () => number): T[] => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
const pickOne = <T,>(items: T[], r: () => number): T => items[Math.floor(r() * items.length)]!;

/** A well-formed problem for the seed and level. The same seed and level always give the same problem. */
export function generateProblem(seed: number, level: Level): Problem {
  const r = rng(((seed >>> 0) * 2654435761 + level * 104729 + 17) >>> 0);
  for (let attempt = 0; attempt < 600; attempt++) {
    const labels = shuffle(WORDS, r).slice(0, 3);
    const count = level === 1 ? 2 : level === 2 ? (r() < 0.5 ? 2 : 3) : 3;
    const forms: Form[] = level === 1 ? ['all', 'all', 'no', 'some'] : ['all', 'no', 'some', 'somenot'];
    const order = shuffle([0, 1, 2], r);
    const [x, m, y] = order as [number, number, number];
    const pairs: [number, number][] = [[x, m], [m, y]];
    if (count === 3) pairs.push(r() < 0.5 ? [x, y] : [y, x]);
    const statements = pairs.map(([p, q]) => (r() < 0.5 ? S(pickOne(forms, r), p, q) : S(pickOne(forms, r), q, p)));
    if (new Set(statements.map(stmtKey)).size !== statements.length) continue;
    if (level === 1 && statements.every((s) => !isUniversal(s))) continue;
    if (level === 1 && statements.filter((s) => !isUniversal(s)).length > 1) continue;
    const an = analyse(labels, statements);
    if (!an.consistent || an.models.length < 2) continue;
    const given = new Set(statements.map(stmtKey));
    const pool = allStatements(3).filter((c) => !given.has(stmtKey(c)));
    const rated = shuffle(pool, r).map((c) => ({ c, v: verdictOf(an, c) }));
    const of = (v: Verdict) => rated.filter((x) => x.v === v);
    const want = level === 1 ? 3 : level === 2 ? (r() < 0.5 ? 3 : 4) : 4;
    const chosen: { c: Stmt; v: Verdict }[] = [];
    const take = (list: { c: Stmt; v: Verdict }[]) => { const f = list.find((x) => !chosen.includes(x)); if (f) chosen.push(f); return !!f; };
    // level 1: a conclusion that follows and one that does not; level 2 and 3: also a "possible" one (and, on hard, one that cannot hold)
    if (level === 1) { if (!take(of('follows')) || !take(of('possible').concat(of('impossible')))) continue; }
    else if (level === 2) { if (!take(of('possible')) || !take(of('follows').concat(of('impossible')))) continue; }
    else { if (!take(of('possible')) || !take(of('impossible')) || !take(rated)) continue; }
    while (chosen.length < want) if (!take(rated)) break;
    if (chosen.length < 3) continue;
    if (level === 3 && chosen.filter((x) => x.v === 'follows').length > 2) continue;
    return { id: `p${level}-${seed}`, seed, level, labels, statements, conclusions: shuffle(chosen, r).map((x) => x.c) };
  }
  throw new Error(`No problem could be generated for seed ${seed}, level ${level}`);
}
export const problemSignature = (p: Problem) => `${p.labels.join('|')}#${p.statements.map(stmtKey).join(',')}#${p.conclusions.map(stmtKey).join(',')}`;

/** Per-problem numbers for the Analyse step: situations that fit, and how many conclusions are only possible. */
export interface ProblemStats { situations: number; follows: number; possible: number; impossible: number; conclusions: number }
export function problemStats(p: Problem): ProblemStats {
  const an = analyse(p.labels, p.statements);
  const vs = p.conclusions.map((c) => verdictOf(an, c));
  return { situations: an.models.length, follows: vs.filter((v) => v === 'follows').length, possible: vs.filter((v) => v === 'possible').length, impossible: vs.filter((v) => v === 'impossible').length, conclusions: vs.length };
}
/** Over many generated problems: does a larger number of fitting situations mean more conclusions that are only possible? */
export function sampleBands(seeds = 150): { label: string; problems: number; avgSituations: number; possibleShare: number; followsShare: number }[] {
  const rows: ProblemStats[] = [];
  for (let seed = 1; seed <= seeds; seed++) for (const level of [1, 2, 3] as Level[]) rows.push(problemStats(generateProblem(seed, level)));
  const bands: [string, (s: number) => boolean][] = [['2 to 6 situations', (s) => s <= 6], ['7 to 15 situations', (s) => s > 6 && s <= 15], ['16 or more situations', (s) => s > 15]];
  return bands.map(([label, f]) => {
    const g = rows.filter((x) => f(x.situations));
    const concl = g.reduce((t, x) => t + x.conclusions, 0) || 1;
    return {
      label, problems: g.length,
      avgSituations: g.length ? g.reduce((t, x) => t + x.situations, 0) / g.length : 0,
      possibleShare: g.reduce((t, x) => t + x.possible, 0) / concl,
      followsShare: g.reduce((t, x) => t + x.follows, 0) / concl,
    };
  });
}

// ---------------------------------------------------------------- the solver's worked sets

export interface Preset { id: string; title: string; note: string; labels: string[]; statements: Stmt[]; conclusions: Stmt[] }
export const PRESETS: Preset[] = [
  { id: 'lesson', title: 'The lesson’s example', note: 'The solved problem in the lesson: pens, books and cups.', labels: ['pens', 'books', 'cups'], statements: [S('all', 0, 1), S('some', 1, 2)], conclusions: [S('some', 2, 1), S('some', 0, 2), S('all', 0, 2)] },
  { id: 'chain', title: 'A chain of “All”', note: 'Two universal statements in a chain.', labels: ['tables', 'chairs', 'lamps'], statements: [S('all', 0, 1), S('all', 1, 2)], conclusions: [S('all', 0, 2), S('all', 2, 0), S('some', 2, 0), S('no', 0, 2)] },
  { id: 'negative', title: 'A negative statement', note: 'An “All” and a “No” together.', labels: ['hills', 'rivers', 'lakes'], statements: [S('all', 0, 1), S('no', 1, 2)], conclusions: [S('no', 0, 2), S('some', 0, 2), S('somenot', 2, 0), S('all', 2, 0)] },
  { id: 'twosome', title: 'Two particular statements', note: 'Some, some: the lesson says nothing about A and C follows.', labels: ['drums', 'bells', 'plates'], statements: [S('some', 0, 1), S('some', 1, 2)], conclusions: [S('some', 0, 2), S('all', 0, 2), S('no', 0, 2), S('somenot', 0, 2)] },
  { id: 'someall', title: 'Some means at least one', note: 'Only two circles: “Some” may be all.', labels: ['dogs', 'pets'], statements: [S('some', 0, 1), S('somenot', 1, 0)], conclusions: [S('all', 0, 1), S('somenot', 0, 1), S('some', 1, 0), S('no', 0, 1)] },
  { id: 'three', title: 'Three statements', note: 'A universal, a particular and a negative statement.', labels: ['keys', 'coins', 'flags'], statements: [S('all', 0, 1), S('some', 1, 2), S('no', 0, 2)], conclusions: [S('somenot', 1, 0), S('some', 2, 0), S('all', 2, 1), S('no', 1, 2)] },
];

// ---------------------------------------------------------------- predictions

export interface SyllPredict { id: string; title: string; prompt: string; options: string[]; answer: number; labels: string[]; statements: Stmt[]; conclusions: Stmt[]; /** which option is checked: option i is the verdict VERDICT_OPTIONS[i], or the conclusion/statements it names */ kind: 'verdict' | 'conclusion' | 'statements' }
const VERDICT_OPTIONS = ['Follows in every picture', 'Possible: true in some pictures, false in others', 'Cannot be true in any picture'];
const VERDICTS_BY_OPTION: Verdict[] = ['follows', 'possible', 'impossible'];
export { VERDICTS_BY_OPTION };

export const PREDICTS: SyllPredict[] = [
  {
    id: 's1', title: 'Reversing “All”', kind: 'verdict',
    prompt: 'Statements: All A are B. All B are C. Does the conclusion “All C are A” follow?',
    options: VERDICT_OPTIONS, answer: 1,
    labels: ['A', 'B', 'C'], statements: [S('all', 0, 1), S('all', 1, 2)], conclusions: [S('all', 2, 0)],
  },
  {
    id: 's2', title: 'Some and No together', kind: 'conclusion',
    prompt: 'Statements: Some A are B. No B is C. Which conclusion about A and C follows?',
    options: ['Some A are C', 'All A are C', 'No A is C', 'Some A are not C'], answer: 3,
    labels: ['A', 'B', 'C'], statements: [S('some', 0, 1), S('no', 1, 2)], conclusions: [S('some', 0, 2), S('all', 0, 2), S('no', 0, 2), S('somenot', 0, 2)],
  },
  {
    id: 's3', title: 'A tempting “Some A are not C”', kind: 'verdict',
    prompt: 'Statements: All A are B. Some B are not C. Does the conclusion “Some A are not C” follow?',
    options: VERDICT_OPTIONS, answer: 1,
    labels: ['A', 'B', 'C'], statements: [S('all', 0, 1), S('somenot', 1, 2)], conclusions: [S('somenot', 0, 2)],
  },
  {
    id: 's4', title: 'When is “Some A are C” a possibility?', kind: 'statements',
    prompt: 'The conclusion “Some A are C” is true in some pictures and false in others (only a possibility) for which pair of statements?',
    options: ['All A are B and No B is C', 'Some A are B and Some B are C', 'All A are B and All B are C', 'No A is C and Some A are B'], answer: 1,
    labels: ['A', 'B', 'C'], statements: [], conclusions: [S('some', 0, 2)],
  },
];
/** The pairs of statements behind the options of prediction s4. */
export const S4_PAIRS: Stmt[][] = [[S('all', 0, 1), S('no', 1, 2)], [S('some', 0, 1), S('some', 1, 2)], [S('all', 0, 1), S('all', 1, 2)], [S('no', 0, 2), S('some', 0, 1)]];

/** The verdict each prediction option stands for, recomputed by the engine. Used by the page and by the tests. */
export function predictionVerdicts(p: SyllPredict): Verdict[] {
  if (p.kind === 'verdict') { const an = analyse(p.labels, p.statements); return [verdictOf(an, p.conclusions[0]!)]; }
  if (p.kind === 'conclusion') { const an = analyse(p.labels, p.statements); return p.conclusions.map((c) => verdictOf(an, c)); }
  return S4_PAIRS.map((pair) => verdictOf(analyse(p.labels, pair), p.conclusions[0]!));
}
/** The option index the engine says is right. */
export function predictionAnswer(p: SyllPredict): number {
  const v = predictionVerdicts(p);
  if (p.kind === 'verdict') return VERDICTS_BY_OPTION.indexOf(v[0]!);
  if (p.kind === 'conclusion') return v.indexOf('follows');
  return v.indexOf('possible');
}

// ---------------------------------------------------------------- practice questions (Apply)

export interface ApplySpec {
  labels: string[];
  statements: Stmt[];
  conclusions: Stmt[];
  /** 'which': options name groups of conclusions (optionSets); 'follows' and 'possible': option i is conclusion i. */
  mode: 'which' | 'follows' | 'possible';
  optionSets?: number[][];
}
export interface SyllMcq { id: string; q: string; options: string[]; answer: number; why: string; spec: ApplySpec }

const ROMAN = ['I', 'II', 'III', 'IV'];
const WHICH_OPTIONS = ['Only I follows', 'Only II follows', 'Both I and II follow', 'Neither I nor II follows'];
const WHICH_SETS = [[0], [1], [0, 1], []];
const stmtLines = (spec: ApplySpec) => spec.statements.map((s) => stmtText(s, spec.labels)).join('. ') + '.';
const conclLines = (spec: ApplySpec) => spec.conclusions.map((c, i) => `${ROMAN[i]}. ${stmtText(c, spec.labels)}.`).join(' ');

/** The option index the engine says is right for a question spec. */
export function specAnswer(spec: ApplySpec): number {
  const an = analyse(spec.labels, spec.statements);
  const vs = spec.conclusions.map((c) => verdictOf(an, c));
  if (spec.mode === 'follows') return vs.indexOf('follows');
  if (spec.mode === 'possible') return vs.indexOf('possible');
  const following = vs.map((v, i) => (v === 'follows' ? i : -1)).filter((i) => i >= 0);
  return spec.optionSets!.findIndex((s) => s.length === following.length && s.every((i) => following.includes(i)));
}

const mk = (id: string, spec: ApplySpec, intro: string, options: string[], answer: number, why: string): SyllMcq => ({
  id, spec, options, answer, why,
  q: spec.mode === 'which'
    ? `Statements: ${stmtLines(spec)} Conclusions: ${conclLines(spec)} ${intro}`
    : `Statements: ${stmtLines(spec)} ${intro}`,
});

/** Five CUET-style questions written for this lab. Every key is recomputed by the exhaustive checker in the tests. Draft - unverified. */
export const APPLY: SyllMcq[] = [
  mk('q1', { labels: ['hills', 'rivers', 'lakes'], statements: [S('no', 0, 1), S('all', 2, 1)], conclusions: [S('no', 2, 0), S('somenot', 0, 2)], mode: 'which', optionSets: WHICH_SETS },
    'Which of the conclusions follow?', WHICH_OPTIONS, 2,
    'Lakes lie inside rivers, and hills do not touch rivers, so hills do not touch lakes: I follows. Hills have at least one member and none of them can be a lake, so some hills are not lakes: II follows too. Both follow.'),
  mk('q2', { labels: ['drums', 'bells', 'plates'], statements: [S('some', 0, 1), S('some', 1, 2)], conclusions: [S('some', 0, 2), S('somenot', 2, 0)], mode: 'which', optionSets: WHICH_SETS },
    'Which of the conclusions follow?', WHICH_OPTIONS, 3,
    'Two particular statements give no conclusion. The drums that are bells may be different bells from the ones that are plates, so drums and plates may not meet (I fails), and plates may all be drums (II fails). Each is only a possibility. Neither follows.'),
  mk('q3', { labels: ['kites', 'drums', 'bells'], statements: [S('some', 0, 1), S('all', 1, 2), S('somenot', 2, 0)], conclusions: [S('all', 0, 2), S('some', 0, 2), S('no', 0, 2), S('all', 2, 0)], mode: 'follows' },
    'Which of the following conclusions definitely follows?', ['All kites are bells', 'Some kites are bells', 'No kites are bells', 'All bells are kites'], 1,
    'The kites that are drums are also bells, because all drums are bells. So at least one kite is a bell: “Some kites are bells” follows. The other kites may or may not be bells, so “All kites are bells” is only a possibility. “No kites are bells” is false and so is “All bells are kites”, since some bells are not kites.'),
  mk('q4', { labels: ['stones', 'maps', 'ropes'], statements: [S('all', 0, 1), S('no', 1, 2)], conclusions: [S('all', 1, 0), S('some', 0, 2), S('some', 2, 0), S('all', 0, 2)], mode: 'possible' },
    'Which conclusion is only a possibility (it may be true, but it does not have to be)?', ['All maps are stones', 'Some stones are ropes', 'Some ropes are stones', 'All stones are ropes'], 0,
    'Stones lie inside maps, and no map is a rope, so stones and ropes can never meet: the other three conclusions are false in every picture. Only “All maps are stones” can be true (when the circles of maps and stones coincide) and can also be false (when maps are larger). That is a possibility.'),
  mk('q5', { labels: ['caps', 'shoes'], statements: [S('some', 0, 1)], conclusions: [S('all', 0, 1), S('somenot', 0, 1), S('some', 1, 0)], mode: 'which', optionSets: [[0], [1], [2], [0, 1]] },
    'Which of the conclusions follow?', ['Only I follows', 'Only II follows', 'Only III follows', 'I and II follow'], 2,
    '“Some” means at least one and possibly all. Reversing is allowed, so III follows. I is possible (all caps may be shoes) and II is possible (some caps may not be shoes), but neither is forced, so neither follows. Only III follows.'),
];
