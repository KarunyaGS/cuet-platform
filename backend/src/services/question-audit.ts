/**
 * One set of rules for what a CUET choice question must look like, used everywhere:
 *   - when a question is created or edited (shape rules, via `shapeProblems`),
 *   - when questions are approved in bulk (`auditQuestion`),
 *   - and for an audit of the whole bank (`auditBank`).
 *
 * CUET questions have four options labelled A to D. Nothing here adds a fifth option or rewrites a question.
 * The cross-checks (answer key against the explanation) only report when the explanation states the answer in a form
 * that can be read reliably. When it cannot be read, nothing is claimed either way.
 */
import { normaliseText } from '../lib/hash';

export const OPTION_COUNT = 4;
export const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;

export interface ShapeInput {
  type: string;
  options: { label: string; text?: string | null; mediaAssetId?: string | null }[];
  keys: number[] | null | undefined;
}

/** Shape rules for a choice question. Numerical questions have no options and are not checked here. */
/** `allowMultipleKeys`: an official past-paper key may list more than one accepted answer on a single-answer question. */
export function shapeProblems(q: ShapeInput, opts: { allowMultipleKeys?: boolean } = {}): string[] {
  if (q.type === 'NUMERICAL') return [];
  const out: string[] = [];
  const n = q.options.length;
  if (n !== OPTION_COUNT) out.push(`has ${n} option${n === 1 ? '' : 's'}, not four`);
  else if (q.options.map((o) => o.label).join('') !== OPTION_LABELS.join('')) out.push('options are not labelled A, B, C, D in order');
  const keys = q.keys ?? [];
  if (!keys.length) out.push('no correct option is given');
  else {
    if (new Set(keys).size !== keys.length) out.push('the same option is marked correct twice');
    if (keys.some((p) => !Number.isInteger(p) || p < 1 || p > OPTION_COUNT)) out.push('the answer key points to an option that does not exist');
    if (q.type !== 'MCQ_MULTI' && keys.length !== 1 && !opts.allowMultipleKeys) out.push('the answer key does not name exactly one correct option');
  }
  return out;
}

// ------------------------------------------------------------------ reading the explanation

const ROMAN = '(IV|I{1,3}|V)';

/** "A-II, B-I, C-III, D-IV" (in the option) or "... (A-II) ... (B-I) ..." (in the explanation): the last pairing stated for each letter. */
export function readPairs(text: string): Record<string, string> | null {
  const found: Record<string, string> = {};
  for (const m of text.matchAll(new RegExp(`\\b([A-D])\\s*[-–—]\\s*${ROMAN}\\b`, 'g'))) found[m[1]!] = m[2]!;
  return ['A', 'B', 'C', 'D'].every((l) => found[l]) ? found : null;
}

type ArKind = 'TT_EXPLAINS' | 'TT_NOT_EXPLAINS' | 'TF' | 'FT';

function arKindOfOption(text: string): ArKind | null {
  const t = normaliseText(text).replace(/[()]/g, '');
  if (/^both a and r are true/.test(t)) return /not the correct explanation/.test(t) ? 'TT_NOT_EXPLAINS' : /is the correct explanation/.test(t) ? 'TT_EXPLAINS' : null;
  if (/^a is true but r is false/.test(t)) return 'TF';
  if (/^a is false but r is true/.test(t)) return 'FT';
  return null;
}

/** What an assertion-reason explanation says, when it says it plainly. */
export function readAssertionReason(body: string): ArKind | null {
  const truth = (subject: RegExp) => {
    const m = body.match(new RegExp(`(?:${subject.source})\\s*(?:\\((?:A|R)\\))?\\s+is\\s+(true|false|correct|incorrect)\\b`, 'i'));
    return m ? ['true', 'correct'].includes(m[1]!.toLowerCase()) : null;
  };
  const a = truth(/assertion|\(A\)|\bA\b/);
  const r = truth(/reason|\(R\)|\bR\b/);
  if (a === null || r === null) return null;
  if (a && !r) return 'TF';
  if (!a && r) return 'FT';
  if (!a && !r) return null; // neither: none of the four standard options fits, so nothing to compare
  if (/not\s+(?:the\s+)?(?:a\s+)?(?:correct\s+)?explanation|does not explain|not explain|cannot explain|doesn['’]t explain/i.test(body)) return 'TT_NOT_EXPLAINS';
  if (/explain/i.test(body)) return 'TT_EXPLAINS';
  return null;
}

// ------------------------------------------------------------------ one question

export interface AuditRow {
  id: string;
  type: string;
  stem: string;
  structureJson: string | null;
  isDemonstration: boolean;
  publicDisplay: number | null;
  options: { position: number; label: string; text: string | null; mediaAssetId: string | null }[];
  keys: string[];
  /** The numeric answer(s) stored for a numerical question. */
  numericAnswers: (number | null)[];
  explanations: { body: string | null; optionRationaleJson: string | null }[];
  hasTopic: boolean;
}

/** Everything that makes a question unfit to approve. An empty list means the automated checks found nothing wrong. */
export function auditQuestion(q: AuditRow, mediaIds: Set<string>): { problems: string[]; crossChecked: string[] } {
  const problems: string[] = [];
  const crossChecked: string[] = [];
  if (q.publicDisplay === 0) problems.push('its usage permission does not allow showing it to students');
  const o = [...q.options].sort((a, b) => a.position - b.position);

  let keyPositions: number[] | null = null;
  if (q.type === 'NUMERICAL') {
    if (q.numericAnswers.length !== 1 || q.numericAnswers[0] === null) problems.push('a numerical question needs its numeric answer');
  } else {
    if (q.keys.length !== 1) problems.push(q.keys.length ? 'more than one answer key' : 'no answer key');
    else {
      try {
        const parsed = JSON.parse(q.keys[0] ?? 'null') as unknown;
        keyPositions = Array.isArray(parsed) ? (parsed as number[]) : null;
      } catch {
        keyPositions = null;
      }
      if (!keyPositions) problems.push('the answer key could not be read');
    }
    for (const p of shapeProblems({ type: q.type, options: o, keys: keyPositions })) problems.push(p);
    if (o.length === OPTION_COUNT) {
      if (o.some((x) => !(x.text ?? '').trim() && !x.mediaAssetId)) problems.push('an option is empty');
      else if (new Set(o.map((x) => normaliseText(x.text))).size !== o.length && o.every((x) => (x.text ?? '').trim())) problems.push('two options are identical');
      if (keyPositions && keyPositions.length && !keyPositions.every((p) => o.some((x) => x.position === p))) {
        if (!problems.includes('the answer key points to an option that does not exist')) problems.push('the answer key points to an option that does not exist');
      }
    }
  }

  const e = q.explanations;
  const body = (e[0]?.body ?? '').trim();
  if (!e.length || body.length < 40) problems.push('the explanation is missing or very short');
  if (!q.hasTopic) problems.push('it is not linked to a topic');
  if ((q.stem ?? '').trim().length < 15) problems.push('the question text is missing or very short');
  if (((q.stem ?? '').match(/\$/g) ?? []).length % 2) problems.push('unbalanced $ in the question text (formula may not display)');
  if (q.type === 'DIAGRAM_BASED') {
    let figure: string | undefined;
    try {
      figure = (JSON.parse(q.structureJson ?? '{}') as { mediaAssetId?: string }).mediaAssetId;
    } catch {
      /* reported below */
    }
    if (!figure || !mediaIds.has(figure)) problems.push('its figure is missing');
  }

  // Cross-checks between the answer key and what the explanation says.
  if (keyPositions && keyPositions.length && o.length === OPTION_COUNT && body) {
    // 1. The notes on wrong options must cover exactly the options that are not the answer.
    const raw = e[0]?.optionRationaleJson;
    if (raw && raw.trim() && raw.trim() !== '{}') {
      try {
        const rationale = Object.keys(JSON.parse(raw) as Record<string, unknown>).sort();
        const expected = o.map((x) => String(x.position)).filter((p) => !keyPositions!.includes(Number(p))).sort();
        crossChecked.push('rationale');
        if (rationale.join(',') !== expected.join(',')) problems.push('the explanation has notes on the wrong set of options: they do not match the answer key');
      } catch {
        problems.push('the notes on wrong options could not be read');
      }
    }
    // 2. "So option 2 is correct" must agree with the key.
    const said = body.match(/\boption\s*\(?([1-4])\)?\s+is\s+(?:the\s+)?correct/i);
    if (said) {
      crossChecked.push('option-number');
      if (!keyPositions.includes(Number(said[1]))) problems.push(`the explanation says option ${said[1]} is correct, but the answer key says otherwise`);
    }
    // 3. Match-the-following: the pairing the explanation states must be the pairing in the keyed option.
    if (q.type === 'MATCH_THE_FOLLOWING' && keyPositions.length === 1) {
      const stated = readPairs(body);
      const keyed = readPairs(o.find((x) => x.position === keyPositions![0])?.text ?? '');
      if (stated && keyed) {
        crossChecked.push('match-pairs');
        if (['A', 'B', 'C', 'D'].some((l) => stated[l] !== keyed[l])) problems.push('the explanation pairs the items differently from the option the answer key points to');
      }
    }
    // 4. Assertion-reason: what the explanation says about A and R must be the option the key points to.
    if (q.type === 'ASSERTION_REASON' && keyPositions.length === 1) {
      const said2 = readAssertionReason(body);
      const kinds = o.map((x) => arKindOfOption(x.text ?? ''));
      if (said2 && kinds.every((k) => k !== null)) {
        crossChecked.push('assertion-reason');
        const at = kinds.indexOf(said2);
        if (at >= 0 && o[at]!.position !== keyPositions[0]) problems.push('the explanation describes a different assertion-reason option from the one the answer key points to');
      }
    }
  }
  return { problems, crossChecked };
}

// ------------------------------------------------------------------ loading and the whole bank

interface Loaded {
  rows: AuditRow[];
  media: Set<string>;
}

/** Loads questions (with options, keys, explanations and topics) matching a WHERE clause on `questions q`. */
export async function loadAuditRows(db: D1Database, where: string[], params: unknown[]): Promise<Loaded> {
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [qs, opts, keys, exps, topics, media] = await Promise.all([
    db
      .prepare(`SELECT q.id, q.type, q.stem, q.structure_json, q.is_demonstration, p.public_display FROM questions q LEFT JOIN usage_permissions p ON p.id = q.usage_permission_id ${clause} ORDER BY q.id`)
      .bind(...params)
      .all<{ id: string; type: string; stem: string; structure_json: string | null; is_demonstration: number; public_display: number | null }>(),
    db.prepare('SELECT question_id, position, label, text, media_asset_id FROM question_options ORDER BY question_id, position').all<{ question_id: string; position: number; label: string; text: string | null; media_asset_id: string | null }>(),
    db.prepare('SELECT question_id, correct_option_positions, numeric_answer FROM answer_keys').all<{ question_id: string; correct_option_positions: string | null; numeric_answer: number | null }>(),
    db.prepare('SELECT question_id, body, option_rationale_json FROM explanations').all<{ question_id: string; body: string | null; option_rationale_json: string | null }>(),
    db.prepare('SELECT DISTINCT question_id FROM question_topics').all<{ question_id: string }>(),
    db.prepare('SELECT id FROM media_assets').all<{ id: string }>(),
  ]);
  const group = <T extends { question_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of list) (m.get(r.question_id) ?? m.set(r.question_id, []).get(r.question_id)!).push(r);
    return m;
  };
  const optsBy = group(opts.results);
  const keysBy = group(keys.results);
  const expsBy = group(exps.results);
  const topicSet = new Set(topics.results.map((r) => r.question_id));
  const rows: AuditRow[] = qs.results.map((q) => ({
    id: q.id,
    type: q.type,
    stem: q.stem,
    structureJson: q.structure_json,
    isDemonstration: Boolean(q.is_demonstration),
    publicDisplay: q.public_display,
    options: (optsBy.get(q.id) ?? []).map((o) => ({ position: o.position, label: o.label, text: o.text, mediaAssetId: o.media_asset_id })),
    // A numerical question's answer key holds no option positions; its numeric answer is what matters.
    keys: (keysBy.get(q.id) ?? []).map((k) => k.correct_option_positions ?? 'null'),
    numericAnswers: (keysBy.get(q.id) ?? []).map((k) => k.numeric_answer),
    explanations: (expsBy.get(q.id) ?? []).map((e) => ({ body: e.body, optionRationaleJson: e.option_rationale_json })),
    hasTopic: topicSet.has(q.id),
  }));
  return { rows, media: new Set(media.results.map((r) => r.id)) };
}

/** Audit of every question in the bank (or one paper): which fail which rule, and how much could be cross-checked. */
export async function auditBank(db: D1Database, f: { testPaperId?: string } = {}) {
  const { rows, media } = await loadAuditRows(db, f.testPaperId ? ['q.test_paper_id = ?'] : [], f.testPaperId ? [f.testPaperId] : []);
  const failing: { id: string; type: string; stem: string; problems: string[] }[] = [];
  const byRule: Record<string, number> = {};
  const coverage: Record<string, number> = { rationale: 0, 'option-number': 0, 'match-pairs': 0, 'assertion-reason': 0 };
  const optionCounts: Record<string, number> = {};
  const answerPositions: Record<string, number> = {};
  const types: Record<string, number> = {};
  const wherePairs = new Map<string, string[]>();
  for (const q of rows) {
    types[q.type] = (types[q.type] ?? 0) + 1;
    optionCounts[String(q.options.length)] = (optionCounts[String(q.options.length)] ?? 0) + 1;
    const { problems, crossChecked } = auditQuestion(q, media);
    for (const c of crossChecked) coverage[c] = (coverage[c] ?? 0) + 1;
    if (problems.length) {
      failing.push({ id: q.id, type: q.type, stem: q.stem.slice(0, 140), problems });
      for (const p of problems) byRule[p.replace(/\d/g, 'N')] = (byRule[p.replace(/\d/g, 'N')] ?? 0) + 1;
    }
    if (q.keys.length === 1) {
      try {
        const pos = (JSON.parse(q.keys[0]!) as number[])[0];
        const label = q.options.find((o) => o.position === pos)?.label;
        if (label) answerPositions[label] = (answerPositions[label] ?? 0) + 1;
      } catch {
        /* counted as a problem above */
      }
    }
    const k = normaliseText(q.stem);
    (wherePairs.get(k) ?? wherePairs.set(k, []).get(k)!).push(q.id);
  }
  return {
    total: rows.length,
    types,
    optionCounts,
    answerPositions,
    passing: rows.length - failing.length,
    failing: failing.length,
    byRule,
    crossCheckCoverage: coverage,
    sameQuestionText: [...wherePairs.values()].filter((v) => v.length > 1),
    firstFailures: failing.slice(0, 100),
  };
}
