/**
 * Server-side reader for a university's CUET subject requirement, as printed.
 *
 * Input: the text of a required-subjects or eligibility fact. Output: the combinations a student could satisfy, built only from what the
 * text says, plus a list of everything the reader could not be sure about. It adds nothing: when the text is not in a shape it knows, it
 * says so and returns what it did understand, never a guess.
 *
 * The backend is the source of truth for eligibility. The browser has its own reader (`frontend/src/subject-rule.ts`) that only lays text out
 * for display; it must never be used for a decision. `backend/test/admission-requirements.test.ts` checks that both read the Delhi-style
 * wording the same way.
 *
 * Pure code: no database, no network. Nothing here is stored.
 *
 * Shapes understood (each seen in the 109 programmes held on 20 Nov 2026):
 *  - DU_COMBINATIONS: "Combination I: Any one Language from List A + Any three subjects from List B OR Combination II: ..."
 *  - NUMBERED_PAPERS: "1. Language Test - English (101) or Hindi (102) 2. General Aptitude Test (501)", sets separated by OR
 *  - OPT_FOR: "... are required to opt for English Test (Paper Code 101) and General Aptitude Test (Paper Code 501) ..."
 *
 * Not understood: prose conditions ("Physics and Chemistry are compulsory ... any one of Biology or Mathematics"). The papers named in such
 * text are listed, the rule is marked PARTIAL and a person must read it.
 */
import { resolveSubject, type GroupId, type SubjectRef } from './admission-subjects';

export type Requirement =
  /** This named subject must be taken. `group` is the list the university printed it under, if any. */
  | { kind: 'SUBJECT'; subject: SubjectRef; group: GroupId | null }
  /** Any N subjects from a named list. Which subjects are in the list comes from the university's bulletin, not from this text. */
  | { kind: 'ANY_N_OF_GROUP'; n: number; group: GroupId; otherThanNamed: boolean }
  /** Any N of these listed subjects (for example "English (101) or Hindi (102)"). */
  | { kind: 'ANY_N_OF_SET'; n: number; of: SubjectRef[] }
  /** Text the reader could not turn into a requirement. Kept so nothing is lost. */
  | { kind: 'UNRESOLVED'; text: string };

export interface ExtraTest { kind: 'PRACTICAL_TEST' | 'PERFORMANCE_TEST'; text: string }

export interface Combination {
  label: string;
  /** What the combination says in its own words. */
  requirements: Requirement[];
  /** `requirements` plus any sentence that applies to every combination (for example "must also appear in any one language from List A"). */
  effective: Requirement[];
  extraTests: ExtraTest[];
}

export type Family = 'DU_COMBINATIONS' | 'NUMBERED_PAPERS' | 'OPT_FOR' | 'UNKNOWN';
export type Status = 'PARSED' | 'PARTIAL' | 'UNPARSED';

export type IssueCode =
  | 'UNKNOWN_SUBJECT' | 'AMBIGUOUS_SUBJECT' | 'SUBJECT_CODE_CONFLICT' | 'UNRESOLVED_TEXT' | 'UNSUPPORTED_CLAUSE'
  | 'SLASH_READ_AS_CHOICE' | 'ALL_OR_ANY_NOT_STATED' | 'MERIT_FORMULA_NOT_INTERPRETED' | 'NO_SUBJECT_RULE' | 'EMPTY_COMBINATION' | 'GROUP_MEMBERSHIP_NOT_IN_TEXT' | 'PART_NAME_MAPPING' | 'VARIANT_NAME_MAPPING';

export interface Issue { code: IssueCode; severity: 'BLOCKING' | 'REVIEW' | 'INFO'; message: string; text?: string }

export interface ParsedRule {
  family: Family;
  status: Status;
  combinations: Combination[];
  /** Tests the university sets itself that are not CUET papers. They apply to the whole rule. */
  extraTests: ExtraTest[];
  /** Lists the rule refers to whose members are not given in the text. Needed before the rule can be evaluated. */
  groupsNeeded: GroupId[];
  issues: Issue[];
  /** True when a student's papers could be checked against this rule with nothing else: every subject mapped, no list needed, nothing blocking. */
  evaluable: boolean;
}

const WORD_NUMBER: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
const clean = (s: string) => s.replace(/[ï¿½�•‣●·]/g, ' ').replace(/\s+/g, ' ').trim();

function unknownRule(issues: Issue[]): ParsedRule {
  return { family: 'UNKNOWN', status: 'UNPARSED', combinations: [], extraTests: [], groupsNeeded: [], issues, evaluable: false };
}

/** Papers named anywhere in the text with a printed code, used to report what a prose rule mentions without interpreting it. */
function codedMentions(text: string): SubjectRef[] {
  const out: SubjectRef[] = [];
  for (const m of text.matchAll(/([A-Z][A-Za-z/ ]+?)\s*\(\s*(?:Paper Code\s*)?(\d{3})\s*\)/g)) out.push(resolveSubject(m[1]!.trim(), { code: m[2]! }));
  return out;
}

export function issuesFromRef(ref: SubjectRef, where: string): Issue[] {
  switch (ref.status) {
    case 'UNKNOWN': return [{ code: 'UNKNOWN_SUBJECT', severity: 'BLOCKING', message: `"${ref.text}" is not a known CUET (UG) subject name (${where})`, text: ref.text }];
    case 'AMBIGUOUS': return [{ code: 'AMBIGUOUS_SUBJECT', severity: 'BLOCKING', message: `"${ref.text}": ${ref.reason} (${where})`, text: ref.text }];
    case 'CONFLICT': return [{ code: 'SUBJECT_CODE_CONFLICT', severity: 'BLOCKING', message: `"${ref.text}": ${ref.reason} (${where})`, text: ref.text }];
    case 'MAPPED':
      if (ref.basis === 'PART_OF_COMBINED_PAPER') return [{ code: 'PART_NAME_MAPPING', severity: 'REVIEW', message: `"${ref.text}" mapped to paper ${ref.paperCode}: ${ref.note ?? ''}`, text: ref.text }];
      if (ref.basis === 'ALIAS') return [{ code: 'VARIANT_NAME_MAPPING', severity: 'INFO', message: `"${ref.text}" read as paper ${ref.paperCode} (wording differs from NTA's name)`, text: ref.text }];
      return [];
  }
}

// ---------------------------------------------------------------- Delhi-style combinations

function parseDuItem(raw: string, where: string, issues: Issue[]): Requirement[] {
  const x = clean(raw).replace(/[.\s]+$/, '');
  if (!x) return [];
  let m = /^Any (one|two|three|four) Languages?(?: from List A)?$/i.exec(x);
  if (m) return [{ kind: 'ANY_N_OF_GROUP', n: WORD_NUMBER[m[1]!.toLowerCase()]!, group: 'LIST_A', otherThanNamed: false }];
  m = /^Any (one|two|three|four) subjects? from List B$/i.exec(x);
  if (m) return [{ kind: 'ANY_N_OF_GROUP', n: WORD_NUMBER[m[1]!.toLowerCase()]!, group: 'LIST_B', otherThanNamed: false }];
  m = /^(.+?) and one Language from List A$/i.exec(x);
  if (m) {
    const ref = resolveSubject(m[1]!, { group: 'LIST_A' });
    issues.push(...issuesFromRef(ref, where));
    return [{ kind: 'SUBJECT', subject: ref, group: 'LIST_A' }, { kind: 'ANY_N_OF_GROUP', n: 1, group: 'LIST_A', otherThanNamed: true }];
  }
  m = /^(.+?) from List ([AB])$/i.exec(x);
  if (m) {
    const group: GroupId = m[2]!.toUpperCase() === 'A' ? 'LIST_A' : 'LIST_B';
    const ref = resolveSubject(m[1]!, { group });
    issues.push(...issuesFromRef(ref, where));
    return [{ kind: 'SUBJECT', subject: ref, group }];
  }
  if (/^Any\b/i.test(x)) {
    issues.push({ code: 'UNRESOLVED_TEXT', severity: 'BLOCKING', message: `Not understood: "${x}" (${where})`, text: x });
    return [{ kind: 'UNRESOLVED', text: x }];
  }
  const ref = resolveSubject(x, {});
  issues.push(...issuesFromRef(ref, where));
  return [{ kind: 'SUBJECT', subject: ref, group: null }];
}

const hasLanguageRequirement = (reqs: Requirement[]) =>
  reqs.some((r) => (r.kind === 'ANY_N_OF_GROUP' && r.group === 'LIST_A') || (r.kind === 'SUBJECT' && r.group === 'LIST_A') || (r.kind === 'ANY_N_OF_SET' && r.of.every((s) => s.status === 'MAPPED' && s.paperCode < '200')));

function testFrom(text: string): ExtraTest | null {
  if (/Practical[- ]?based test/i.test(text)) return { kind: 'PRACTICAL_TEST', text: clean(text) };
  if (/Performance[- ]?based test/i.test(text)) return { kind: 'PERFORMANCE_TEST', text: clean(text) };
  return null;
}

function parseDu(text: string): ParsedRule {
  const issues: Issue[] = [];
  const marks = [...text.matchAll(/Combination\s+([IVX]+)\s*:/gi)];
  const stop = /\s+(?:Merit will|Candidates? must appear|Note:)/i;
  const combos: Combination[] = [];
  const tests: ExtraTest[] = [];
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i]!;
    const start = m.index! + m[0].length;
    const end = i + 1 < marks.length ? marks[i + 1]!.index! : text.length;
    let seg = text.slice(start, end);
    const cut = seg.search(stop);
    if (cut >= 0) seg = seg.slice(0, cut);
    seg = seg.replace(/\s+(?:OR|AND)\s*$/i, '');
    const label = `Combination ${m[1]}`;
    const extra: ExtraTest[] = [];
    // "... AND Performance-Based Test" after a combination is a test the university sets for the whole programme, not for that combination alone
    // (the same text says so in its opening sentence), so it is kept at rule level.
    const andTest = /\s+AND\s+((?:Practical|Performance)[- ]?[Bb]ased [Tt]est.*)$/i.exec(seg);
    if (andTest) {
      const t = testFrom(andTest[1]!);
      if (t) extra.push(t);
      seg = seg.slice(0, andTest.index);
    }
    const requirements = seg.split('+').flatMap((part) => parseDuItem(part, label, issues));
    if (!requirements.length) issues.push({ code: 'EMPTY_COMBINATION', severity: 'BLOCKING', message: `${label} has no readable requirement` });
    combos.push({ label, requirements, effective: requirements, extraTests: [] });
    for (const t of extra) if (!tests.some((r) => r.kind === t.kind)) tests.push(t);
  }
  // A sentence outside the combinations that applies to all of them.
  const common: Requirement[] = [];
  if (/Candidates? must appear in any one language from List A in CUET/i.test(text)) common.push({ kind: 'ANY_N_OF_GROUP', n: 1, group: 'LIST_A', otherThanNamed: false });
  for (const c of combos) c.effective = hasLanguageRequirement(c.requirements) ? c.requirements : [...c.requirements, ...common];
  const both = /Candidates? must appear in both CUET and ([A-Za-z-]+ test)/i.exec(text);
  if (both) {
    const t = testFrom(both[1]!);
    if (t && !tests.some((r) => r.kind === t.kind)) tests.push(t);
  }
  if (/weightage/i.test(text)) issues.push({ code: 'MERIT_FORMULA_NOT_INTERPRETED', severity: 'INFO', message: 'The text gives a merit formula (weightage of CUET and a university test). It is not read here; it matters for competitiveness, not for minimum eligibility.' });
  return buildRule('DU_COMBINATIONS', combos, tests, issues);
}

// ---------------------------------------------------------------- numbered papers (BHU style)

function parseNumbered(text: string): ParsedRule {
  const issues: Issue[] = [];
  const sets = text.split(/\s+OR\s+(?=\d+\.\s)/i);
  const combos: Combination[] = sets.map((set, i) => {
    const label = sets.length > 1 ? `Option ${i + 1}` : 'Papers';
    const items = set.split(/(?:^|\s)\d+\.\s+/).map(clean).filter(Boolean);
    const requirements: Requirement[] = [];
    for (const item of items) {
      const stripped = item.replace(/^(?:Language Test|Subject Test)\s*-?\s*/i, '');
      const parts = [...stripped.matchAll(/(.+?)\s*\(\s*(\d{3})\s*\)(?:\s+or\s+|$)/gi)];
      if (!parts.length) {
        const ref = resolveSubject(stripped, {});
        issues.push(...issuesFromRef(ref, label));
        if (ref.status === 'UNKNOWN') requirements.push({ kind: 'UNRESOLVED', text: item });
        else requirements.push({ kind: 'SUBJECT', subject: ref, group: null });
        continue;
      }
      const refs = parts.map((p) => resolveSubject(p[1]!.trim(), { code: p[2]! }));
      for (const r of refs) issues.push(...issuesFromRef(r, label));
      requirements.push(refs.length === 1 ? { kind: 'SUBJECT', subject: refs[0]!, group: null } : { kind: 'ANY_N_OF_SET', n: 1, of: refs });
    }
    if (!requirements.length) issues.push({ code: 'EMPTY_COMBINATION', severity: 'BLOCKING', message: `${label} has no readable requirement` });
    return { label, requirements, effective: requirements, extraTests: [] };
  });
  // A numbered list of papers does not say whether every paper is needed or any of them. BHU's documents are silent on it, so the reader
  // does not choose: it reports the lists and leaves the rule for a person (or the university) to settle.
  if (!/(all of|both|each|every|compulsory|mandatory)/i.test(text)) {
    issues.push({ code: 'ALL_OR_ANY_NOT_STATED', severity: 'REVIEW', message: 'The text lists papers without saying whether all of them or any of them are required. Not decided here.' });
  }
  return buildRule('NUMBERED_PAPERS', combos, [], issues);
}

// ---------------------------------------------------------------- "required to opt for ..." (JNU style)

const PROSE_CONDITIONS = /\b(compulsory|mandatory|either|in case|higher marks|whichever|best of|any one subject|any two subjects)\b/i;

function parseOptFor(text: string, optFor: string): ParsedRule {
  const issues: Issue[] = [];
  const rest = text.replace(optFor, ' ');
  const requirements: Requirement[] = [];
  // Items are separated by commas and "and"; an item may offer two coded papers with a slash.
  const items = optFor.split(/\s*,\s*|\s+and\s+/i).map(clean).filter(Boolean);
  for (const item of items) {
    const coded = [...item.matchAll(/(.+?)\s*\(\s*Paper Code\s*(\d{3})\s*\)/gi)];
    const refs = coded.length
      ? coded.map((c) => resolveSubject(c[1]!.replace(/^[\s/]+/, '').replace(/\s*\/\s*$/, '').trim(), { code: c[2]! }))
      : [resolveSubject(item, {})];
    for (const r of refs) issues.push(...issuesFromRef(r, 'required papers'));
    if (refs.length > 1) {
      issues.push({ code: 'SLASH_READ_AS_CHOICE', severity: 'REVIEW', message: `"${item}" offers two papers with a slash; read as a choice of one. The text must be checked.`, text: item });
      requirements.push({ kind: 'ANY_N_OF_SET', n: 1, of: refs });
    } else if (refs[0]!.status === 'UNKNOWN') {
      requirements.push({ kind: 'UNRESOLVED', text: item });
    } else {
      requirements.push({ kind: 'SUBJECT', subject: refs[0]!, group: null });
    }
  }
  if (PROSE_CONDITIONS.test(rest)) {
    issues.push({ code: 'UNSUPPORTED_CLAUSE', severity: 'BLOCKING', message: 'The text adds conditions in prose (compulsory papers, choices, tie-breaks) that the reader does not interpret.', text: clean(rest).slice(0, 300) });
  }
  const combos: Combination[] = [{ label: 'Papers', requirements, effective: requirements, extraTests: [] }];
  return buildRule('OPT_FOR', combos, [], issues);
}

// ---------------------------------------------------------------- result

export function buildRule(family: Family, combinations: Combination[], extraTests: ExtraTest[], issues: Issue[]): ParsedRule {
  const groups = new Set<GroupId>();
  for (const c of combinations) for (const r of c.effective) {
    if (r.kind === 'ANY_N_OF_GROUP') groups.add(r.group);
  }
  if (groups.size) issues.push({ code: 'GROUP_MEMBERSHIP_NOT_IN_TEXT', severity: 'REVIEW', message: `The text refers to ${[...groups].map((g) => g.replace('_', ' ')).join(' and ')} but does not list their subjects. They must come from the university's bulletin before this rule can be checked.` });
  const blocking = issues.some((i) => i.severity === 'BLOCKING');
  const readable = combinations.length > 0 && combinations.every((c) => c.requirements.length > 0);
  const status: Status = !readable ? 'UNPARSED' : blocking ? 'PARTIAL' : 'PARSED';
  // Evaluable only when nothing is left for a person to decide: no blocking issue, no review issue (an unmapped list, a part-name mapping, a slash read as a choice, an unstated all/any).
  return { family, status, combinations, extraTests, groupsNeeded: [...groups], issues, evaluable: status === 'PARSED' && !issues.some((i) => i.severity === 'BLOCKING' || i.severity === 'REVIEW') };
}

export function parseRequirementText(input: string | null | undefined): ParsedRule {
  const text = clean(input ?? '');
  if (!text) return unknownRule([{ code: 'NO_SUBJECT_RULE', severity: 'BLOCKING', message: 'There is no text to read' }]);
  if (/Combination\s+[IVX]+\s*:/i.test(text)) return parseDu(text);
  if (/(?:^|\s)1\.\s*(?:Language Test|Subject Test|General Aptitude Test)/i.test(text)) return parseNumbered(text);
  const opt = /required to opt for\s+(.+?)(?:\s+for the admission|\.\s|$)/i.exec(text);
  if (opt) return parseOptFor(text, opt[1]!);
  const mentions = codedMentions(text);
  const issues: Issue[] = [{ code: 'NO_SUBJECT_RULE', severity: 'BLOCKING', message: 'The text is not a subject rule the reader knows' }];
  if (mentions.length) issues.push({ code: 'UNSUPPORTED_CLAUSE', severity: 'BLOCKING', message: `Papers named with codes: ${mentions.map((m) => (m.status === 'MAPPED' ? m.paperCode : m.text)).join(', ')}; the conditions around them are not interpreted` });
  return unknownRule(issues);
}

/**
 * Issues that follow from the structure itself (not from the printed text): an unmapped subject, a leftover unresolved piece, an empty
 * combination, a list that is named but not given. Recomputed whenever a person edits a reading, so an edit can never hide one.
 */
export function structuralIssues(rule: Pick<ParsedRule, 'combinations'>): Issue[] {
  const out: Issue[] = [];
  const groups = new Set<GroupId>();
  if (!rule.combinations.length) out.push({ code: 'EMPTY_COMBINATION', severity: 'BLOCKING', message: 'The rule has no combination' });
  for (const c of rule.combinations) {
    if (!c.effective.length) out.push({ code: 'EMPTY_COMBINATION', severity: 'BLOCKING', message: `${c.label} has no requirement` });
    for (const r of c.effective) {
      if (r.kind === 'SUBJECT') out.push(...issuesFromRef(r.subject, c.label));
      else if (r.kind === 'ANY_N_OF_SET') for (const s of r.of) out.push(...issuesFromRef(s, c.label));
      else if (r.kind === 'ANY_N_OF_GROUP') groups.add(r.group);
      else out.push({ code: 'UNRESOLVED_TEXT', severity: 'BLOCKING', message: `Not understood: "${r.text}" (${c.label})`, text: r.text });
    }
  }
  if (groups.size) out.push({ code: 'GROUP_MEMBERSHIP_NOT_IN_TEXT', severity: 'REVIEW', message: `The rule refers to ${[...groups].map((g) => g.replace('_', ' ')).join(' and ')}; their subjects come from the university's published lists.` });
  return out;
}

/** One line per combination, for reports and tests. */
export function describeRequirement(r: Requirement): string {
  switch (r.kind) {
    case 'SUBJECT': return r.subject.status === 'MAPPED' ? `${r.subject.subjectId}(${r.subject.paperCode})` : `?${r.subject.text}?`;
    case 'ANY_N_OF_GROUP': return `any ${r.n} from ${r.group}${r.otherThanNamed ? ' (other than the named)' : ''}`;
    case 'ANY_N_OF_SET': return `any ${r.n} of [${r.of.map((s) => (s.status === 'MAPPED' ? s.paperCode : `?${s.text}?`)).join(', ')}]`;
    case 'UNRESOLVED': return `!${r.text}!`;
  }
}
export const describeRule = (p: ParsedRule) => [
  ...p.combinations.map((c) => `${c.label}: ${c.effective.map(describeRequirement).join(' + ')}`),
  ...(p.extraTests.length ? [`Also required for the programme: ${p.extraTests.map((t) => t.kind).join(', ')}`] : []),
];
