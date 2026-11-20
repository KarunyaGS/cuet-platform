/**
 * Minimum eligibility: do the CUET papers a student takes satisfy a university's published subject rule?
 *
 * This is ONLY about the papers named in the rule. It is not a cut-off comparison, not a prediction, and never an admission outcome.
 *
 * Pure code (no database). The caller decides which rules may be used (see `admission-review.ts`: only an APPROVED requirement whose printed
 * source is still published and unflagged, with its lists published, ever reaches this function). This function answers one of three things:
 *
 *   MEETS          some combination is satisfied by the student's papers
 *   DOES_NOT_MEET  every combination is fully known and none is satisfied
 *   CANNOT_TELL    anything else: a subject or list is unknown, the rule is unreadable, or the student's papers are not known
 *
 * It never says "does not meet" on incomplete information.
 */
import type { Combination, ParsedRule, Requirement } from './admission-requirements';
import { paperByCode, type GroupId } from './admission-subjects';

export type Verdict = 'MEETS' | 'DOES_NOT_MEET' | 'CANNOT_TELL';
/** Paper codes in each list, as the university published them. A list that is absent is not known. */
export type GroupMembers = Partial<Record<GroupId, string[]>>;

export interface ComboResult {
  label: string;
  state: 'SATISFIED' | 'NOT_SATISFIED' | 'UNKNOWN';
  /** What the student would still need, in words (only for NOT_SATISFIED). */
  missing: string[];
  /** Why the combination could not be judged (only for UNKNOWN). */
  unknownBecause: string[];
}

export interface EligibilityResult {
  verdict: Verdict;
  combinations: ComboResult[];
  matched: string | null;
  /** Tests the university sets itself. They are not CUET papers and are not judged here. */
  additionalRequirements: string[];
  reasons: string[];
}

const nameOf = (code: string) => {
  const p = paperByCode(code);
  return p ? `${p.name.split('/')[0]!.trim()} (${code})` : code;
};

interface Slot { label: string; candidates: Set<string> }

/** A largest assignment of different papers to slots (simple augmenting paths; slots are few). Returns the slots left without a paper. */
function unmatchedSlots(slots: Slot[], papers: string[]): Slot[] {
  const owner = new Map<string, number>();
  const tryAssign = (i: number, seen: Set<string>): boolean => {
    for (const p of papers) {
      if (!slots[i]!.candidates.has(p) || seen.has(p)) continue;
      seen.add(p);
      const o = owner.get(p);
      if (o === undefined || tryAssign(o, seen)) {
        owner.set(p, i);
        return true;
      }
    }
    return false;
  };
  const left: Slot[] = [];
  for (let i = 0; i < slots.length; i++) if (!tryAssign(i, new Set())) left.push(slots[i]!);
  return left;
}

function judge(c: Combination, papers: string[], groups: GroupMembers): ComboResult {
  const slots: Slot[] = [];
  const unknown: string[] = [];
  const impossible: string[] = [];
  for (const r of c.effective as Requirement[]) {
    switch (r.kind) {
      case 'SUBJECT': {
        if (r.subject.status !== 'MAPPED') { unknown.push(`"${r.subject.text}" is not matched to a CUET paper`); break; }
        const code = r.subject.paperCode;
        if (r.group) {
          const members = groups[r.group];
          if (!members) { unknown.push(`${r.group.replace('_', ' ')} is not published`); break; }
          if (!members.includes(code)) { impossible.push(`${nameOf(code)} is not in ${r.group.replace('_', ' ')}`); break; }
        }
        slots.push({ label: nameOf(code), candidates: new Set([code]) });
        break;
      }
      case 'ANY_N_OF_SET': {
        const codes = r.of.flatMap((s) => (s.status === 'MAPPED' ? [s.paperCode] : []));
        if (codes.length !== r.of.length) { unknown.push('a listed subject is not matched to a CUET paper'); break; }
        for (let i = 0; i < r.n; i++) slots.push({ label: `one of ${codes.map(nameOf).join(' or ')}`, candidates: new Set(codes) });
        break;
      }
      case 'ANY_N_OF_GROUP': {
        const members = groups[r.group];
        if (!members) { unknown.push(`${r.group.replace('_', ' ')} is not published`); break; }
        for (let i = 0; i < r.n; i++) slots.push({ label: `one more subject from ${r.group.replace('_', ' ')}`, candidates: new Set(members) });
        break;
      }
      case 'UNRESOLVED':
        unknown.push(`"${r.text}" is not understood`);
        break;
    }
  }
  if (impossible.length) return { label: c.label, state: 'NOT_SATISFIED', missing: impossible, unknownBecause: [] };
  // A combination that cannot be fully judged can still be shown satisfied if the part that is known already cannot fail... it cannot,
  // because every requirement must hold. So unknown parts make the combination unknown, never satisfied.
  if (unknown.length) return { label: c.label, state: 'UNKNOWN', missing: [], unknownBecause: unknown };
  const left = unmatchedSlots(slots, papers);
  if (left.length === 0) return { label: c.label, state: 'SATISFIED', missing: [], unknownBecause: [] };
  return { label: c.label, state: 'NOT_SATISFIED', missing: left.map((x) => x.label), unknownBecause: [] };
}

export function evaluateRule(rule: ParsedRule, studentPaperCodes: string[], groups: GroupMembers): EligibilityResult {
  const papers = [...new Set(studentPaperCodes)];
  const additionalRequirements = rule.extraTests.map((t) => (t.kind === 'PERFORMANCE_TEST' ? 'A performance-based test set by the university' : 'A practical test set by the university'));
  if (!rule.combinations.length) {
    return { verdict: 'CANNOT_TELL', combinations: [], matched: null, additionalRequirements, reasons: ['The rule could not be read'] };
  }
  const combinations = rule.combinations.map((c) => judge(c, papers, groups));
  const satisfied = combinations.find((c) => c.state === 'SATISFIED');
  if (satisfied) return { verdict: 'MEETS', combinations, matched: satisfied.label, additionalRequirements, reasons: [`The papers you take satisfy ${satisfied.label}`] };
  if (combinations.every((c) => c.state === 'NOT_SATISFIED')) {
    return { verdict: 'DOES_NOT_MEET', combinations, matched: null, additionalRequirements, reasons: ['None of the published combinations is satisfied by the papers you take'] };
  }
  const why = [...new Set(combinations.flatMap((c) => c.unknownBecause))];
  return { verdict: 'CANNOT_TELL', combinations, matched: null, additionalRequirements, reasons: why.length ? why : ['Part of the rule could not be judged'] };
}
