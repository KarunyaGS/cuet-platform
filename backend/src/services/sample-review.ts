/**
 * Subject-expert SAMPLE review of questions.
 *
 * What this is: a repeatable, representative sample of questions is drawn (spread over the syllabus units in proportion to how many
 * questions each has), and a subject expert checks each one in the sample: is the answer key right, is the explanation accurate, does
 * the question belong to its topic. What the expert found is recorded, with who they are, and turned into plain numbers.
 *
 * What this is not: verification. A sample review never changes any question's verification status, and it is never described as
 * individual verification of the questions that were not in the sample. The numbers say how far the sample lets us trust the rest.
 */
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { auditQuestion, loadAuditRows } from './question-audit';
import type { Reviewer } from './syllabus-review';

export const SAMPLE_METHOD = 'SAMPLE_REVIEW_STRATIFIED_BY_UNIT_v1';
const actorOf = (u: Reviewer) => `user:${u.id}`;
const CHUNK = 40;

const need = (u: Reviewer, what: string) => {
  if (!u.permissions.includes('content:review')) throw new ApiError(403, 'FORBIDDEN', `Your account cannot ${what} (needs content:review)`);
};

export const createSchema = z.object({
  /** Limit to one subject paper. Omit for every question that can be approved. */
  testPaperId: z.string().min(1).max(100).optional(),
  /** How many questions the expert will check. */
  size: z.number().int().min(10).max(200).default(60),
  /** Makes the draw repeatable. Left out, a random one is made and recorded. */
  seed: z.string().min(1).max(64).optional(),
});

export const recordSchema = z.object({
  answerCorrect: z.boolean(),
  explanationAccurate: z.boolean(),
  topicFits: z.boolean(),
  comment: z.string().trim().max(2000).optional(),
});

export const completeSchema = z.object({
  expertName: z.string().trim().min(2).max(120),
  expertCredentials: z.string().trim().min(5).max(300),
  /** The expert (or the person recording for them) confirms the findings are theirs. */
  confirm: z.literal(true),
});

export const cancelSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

// ---------------------------------------------------------------- the draw

/**
 * How many questions to take from each group so the sample mirrors the whole: proportional, rounded by largest remainder, and at
 * least one from every group when there is room for that. Never more than a group holds.
 */
export function allocate(sizes: number[], total: number): number[] {
  const all = sizes.reduce((a, b) => a + b, 0);
  const want = Math.min(total, all);
  if (!all || want <= 0) return sizes.map(() => 0);
  const quota = sizes.map((s) => (want * s) / all);
  const out = quota.map((q) => Math.floor(q));
  let left = want - out.reduce((a, b) => a + b, 0);
  const order = quota.map((q, i) => ({ i, frac: q - Math.floor(q) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (out[i]! < sizes[i]!) (out[i]!++, left--);
  }
  // Every group with questions is represented, if the sample is big enough for that.
  if (want >= sizes.filter((s) => s > 0).length) {
    for (let i = 0; i < out.length; i++) {
      if (sizes[i]! > 0 && out[i] === 0) {
        let donor = -1;
        for (let j = 0; j < out.length; j++) if (out[j]! > 1 && (donor < 0 || out[j]! > out[donor]!)) donor = j;
        if (donor >= 0) (out[donor]!--, out[i]!++);
      }
    }
  }
  return out;
}

interface Candidate { id: string; stratum: string }

/** Every question that a bulk approval could cover, with the syllabus unit it belongs to. */
export async function sampleablePopulation(db: D1Database, testPaperId?: string): Promise<Candidate[]> {
  // The same questions a bulk approval looks at: not yet verified, or verified only by a bulk approval. Not demonstrations.
  const where = [
    `q.is_demonstration = 0`,
    `(q.verification = 'UNVERIFIED' OR EXISTS (SELECT 1 FROM bulk_approval_items i WHERE i.question_id = q.id AND i.state = 'ACTIVE'))`,
  ];
  const params: string[] = [];
  if (testPaperId) (where.push('q.test_paper_id = ?'), params.push(testPaperId));
  const [{ rows, media }, topics] = await Promise.all([
    loadAuditRows(db, where, params),
    db
      .prepare(
        `SELECT qt.question_id, qt.is_primary, n.title AS topic, p.title AS unit
           FROM question_topics qt JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id LEFT JOIN curriculum_nodes p ON p.id = n.parent_id
          ORDER BY qt.question_id, qt.is_primary DESC, n.position`,
      )
      .all<{ question_id: string; topic: string; unit: string | null }>(),
  ]);
  const unitOf = new Map<string, string>();
  for (const t of topics.results) if (!unitOf.has(t.question_id)) unitOf.set(t.question_id, (t.unit ?? t.topic).slice(0, 200));
  // A question that fails the format checks would not be approved, so it is not part of what the sample speaks for.
  return rows.filter((q) => auditQuestion(q, media).problems.length === 0).map((q) => ({ id: q.id, stratum: unitOf.get(q.id) ?? 'No topic' }));
}

/** The draw itself. The same seed over the same questions gives the same sample. */
export async function drawSample(pop: Candidate[], size: number, seed: string): Promise<{ id: string; stratum: string }[]> {
  const groups = new Map<string, Candidate[]>();
  for (const c of pop) (groups.get(c.stratum) ?? groups.set(c.stratum, []).get(c.stratum)!).push(c);
  const names = [...groups.keys()].sort();
  const take = allocate(names.map((n) => groups.get(n)!.length), size);
  const out: { id: string; stratum: string }[] = [];
  for (let g = 0; g < names.length; g++) {
    const ranked = await Promise.all(groups.get(names[g]!)!.map(async (c) => ({ c, h: await sha256Hex(`${seed}|${c.id}`) })));
    ranked.sort((a, b) => (a.h < b.h ? -1 : a.h > b.h ? 1 : 0));
    for (const r of ranked.slice(0, take[g]!)) out.push({ id: r.c.id, stratum: names[g]! });
  }
  return out; // grouped by unit, so the expert works through one part of the syllabus at a time
}

const scopeJson = (testPaperId?: string) => JSON.stringify(testPaperId ? { testPaperId } : {});

export async function createSample(db: D1Database, input: z.infer<typeof createSchema>, user: Reviewer) {
  need(user, 'start a sample review');
  const open = await db.prepare(`SELECT id FROM sample_reviews WHERE status = 'IN_PROGRESS' AND scope_json = ?`).bind(scopeJson(input.testPaperId)).first<{ id: string }>();
  if (open) throw conflict(`A sample review for this scope is already in progress (${open.id}). Finish or cancel it first.`);
  const pop = await sampleablePopulation(db, input.testPaperId);
  if (!pop.length) throw conflict('There are no questions to sample');
  const seed = input.seed ?? [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const picked = await drawSample(pop, input.size, seed);
  const id = newId('smp');
  const now = nowIso();
  await db
    .prepare(`INSERT INTO sample_reviews (id, scope_json, method, seed, target_size, population_count, sample_count, status, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?)`)
    .bind(id, scopeJson(input.testPaperId), SAMPLE_METHOD, seed, input.size, pop.length, picked.length, user.id, user.displayName, now)
    .run();
  for (let i = 0; i < picked.length; i += CHUNK) {
    await db.batch(
      picked.slice(i, i + CHUNK).map((p, k) =>
        db.prepare(`INSERT INTO sample_review_items (id, sample_id, question_id, position, stratum, outcome) VALUES (?, ?, ?, ?, ?, 'PENDING')`).bind(newId('smi'), id, p.id, i + k + 1, p.stratum),
      ),
    );
  }
  await db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), actorOf(user), 'SAMPLE_REVIEW_STARTED', 'SAMPLE_REVIEW', id, JSON.stringify({ population: pop.length, sample: picked.length, seed, method: SAMPLE_METHOD }), now)
    .run();
  return { id, population: pop.length, sampleCount: picked.length, seed, method: SAMPLE_METHOD };
}

// ---------------------------------------------------------------- the numbers

/** The highest true share of problems that is still consistent (at 95% confidence, one-sided) with `k` problems found in `n` questions. */
export function upperBound95(k: number, n: number): number {
  if (n <= 0) return 1;
  if (k >= n) return 1;
  const cdf = (p: number) => {
    // P(X <= k) for X ~ Binomial(n, p), summed in logs so n up to a few hundred is safe.
    let sum = 0;
    let logC = 0;
    for (let i = 0; i <= k; i++) {
      if (i > 0) logC += Math.log(n - i + 1) - Math.log(i);
      sum += Math.exp(logC + i * Math.log(p) + (n - i) * Math.log(1 - p));
    }
    return sum;
  };
  let lo = k / n;
  let hi = 1 - 1e-12;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) > 0.05) lo = mid;
    else hi = mid;
  }
  return hi;
}

const pct = (x: number) => `${(Math.round(x * 1000) / 10).toString()}%`;

interface Counted { answerCorrect: number | null; explanationAccurate: number | null; topicFits: number | null }
export function summarise(items: Counted[], population: number, expert: { name: string; credentials: string }, at: string) {
  const n = items.length;
  const wrongAnswer = items.filter((i) => i.answerCorrect === 0).length;
  const weakExplanation = items.filter((i) => i.explanationAccurate === 0).length;
  const wrongTopic = items.filter((i) => i.topicFits === 0).length;
  const withProblem = items.filter((i) => i.answerCorrect === 0 || i.explanationAccurate === 0 || i.topicFits === 0).length;
  const upperAny = upperBound95(withProblem, n);
  const upperWrong = upperBound95(wrongAnswer, n);
  const statement =
    `SAMPLE REVIEW, not individual verification of every question. ${expert.name} (${expert.credentials}) checked ${n} of ${population} questions (${pct(n / population)}) one by one on ${at.slice(0, 10)}. ` +
    `${n - withProblem} had no problem. ${withProblem} had a problem (${wrongAnswer} with a wrong answer key, ${weakExplanation} with an inaccurate explanation, ${wrongTopic} placed under the wrong topic). ` +
    `If the sample is a fair draw, no more than about ${pct(upperAny)} of all ${population} questions have a problem of some kind, and no more than about ${pct(upperWrong)} have a wrong answer key (95% confidence). ` +
    `The other ${population - n} questions were not checked individually.`;
  return { checked: n, population, ok: n - withProblem, withProblem, wrongAnswer, weakExplanation, wrongTopic, upperBoundAnyProblem: upperAny, upperBoundWrongAnswer: upperWrong, statement };
}

// ---------------------------------------------------------------- reading

/** Everything the expert needs to judge one question: the question, the key, the explanation and where it sits in the syllabus. */
async function loadQuestions(db: D1Database, ids: string[]) {
  const out = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const marks = part.map(() => '?').join(',');
    const [qs, opts, keys, exps, topics] = await Promise.all([
      db.prepare(`SELECT id, type, stem, structure_json, difficulty, verification FROM questions WHERE id IN (${marks})`).bind(...part).all<{ id: string; type: string; stem: string; structure_json: string | null; difficulty: string | null; verification: string }>(),
      db.prepare(`SELECT question_id, position, label, text, media_asset_id FROM question_options WHERE question_id IN (${marks}) ORDER BY question_id, position`).bind(...part).all<{ question_id: string; position: number; label: string; text: string | null; media_asset_id: string | null }>(),
      db.prepare(`SELECT question_id, correct_option_positions, numeric_answer FROM answer_keys WHERE question_id IN (${marks})`).bind(...part).all<{ question_id: string; correct_option_positions: string | null; numeric_answer: number | null }>(),
      db.prepare(`SELECT question_id, body, option_rationale_json FROM explanations WHERE question_id IN (${marks})`).bind(...part).all<{ question_id: string; body: string | null; option_rationale_json: string | null }>(),
      db.prepare(`SELECT qt.question_id, n.title FROM question_topics qt JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id WHERE qt.question_id IN (${marks}) ORDER BY qt.is_primary DESC`).bind(...part).all<{ question_id: string; title: string }>(),
    ]);
    const parse = <T>(s: string | null): T | null => {
      try {
        return s ? (JSON.parse(s) as T) : null;
      } catch {
        return null;
      }
    };
    for (const q of qs.results) {
      const key = keys.results.find((k) => k.question_id === q.id);
      const exp = exps.results.find((e) => e.question_id === q.id);
      out.set(q.id, {
        id: q.id,
        type: q.type,
        stem: q.stem,
        structure: parse(q.structure_json),
        difficulty: q.difficulty,
        verification: q.verification,
        options: opts.results.filter((o) => o.question_id === q.id).map((o) => ({ position: o.position, label: o.label, text: o.text, mediaAssetId: o.media_asset_id })),
        correctPositions: parse<number[]>(key?.correct_option_positions ?? null),
        numericAnswer: key?.numeric_answer ?? null,
        explanation: exp?.body ?? null,
        optionRationale: parse<Record<string, string>>(exp?.option_rationale_json ?? null),
        topic: topics.results.find((t) => t.question_id === q.id)?.title ?? null,
      });
    }
  }
  return out;
}

const bool = (v: number | null) => (v === null ? null : v === 1);

export async function listSamples(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.scope_json, s.status, s.population_count, s.sample_count, s.created_by_name, s.created_at, s.expert_name, s.completed_at,
              (SELECT COUNT(*) FROM sample_review_items i WHERE i.sample_id = s.id AND i.outcome != 'PENDING') AS done,
              s.result_json
         FROM sample_reviews s ORDER BY s.created_at DESC LIMIT 50`,
    )
    .all<Record<string, string | number | null>>();
  return {
    samples: results.map((r) => ({
      id: r.id as string,
      scope: JSON.parse(String(r.scope_json)) as { testPaperId?: string },
      status: r.status as string,
      population: Number(r.population_count),
      sampleCount: Number(r.sample_count),
      done: Number(r.done),
      startedBy: r.created_by_name as string,
      startedAt: r.created_at as string,
      expertName: r.expert_name as string | null,
      completedAt: r.completed_at as string | null,
      result: r.result_json ? (JSON.parse(String(r.result_json)) as ReturnType<typeof summarise>) : null,
    })),
  };
}

export async function sampleDetail(db: D1Database, id: string) {
  const s = await db.prepare('SELECT * FROM sample_reviews WHERE id = ?').bind(id).first<Record<string, string | number | null>>();
  if (!s) throw notFound('Sample review');
  const rows = await db
    .prepare('SELECT question_id, position, stratum, answer_correct, explanation_accurate, topic_fits, outcome, comment, reviewed_at FROM sample_review_items WHERE sample_id = ? ORDER BY position')
    .bind(id)
    .all<Record<string, string | number | null>>();
  const content = await loadQuestions(db, rows.results.map((r) => String(r.question_id)));
  return {
    id,
    scope: JSON.parse(String(s.scope_json)) as { testPaperId?: string },
    method: s.method as string,
    seed: s.seed as string,
    status: s.status as string,
    population: Number(s.population_count),
    sampleCount: Number(s.sample_count),
    startedBy: s.created_by_name as string,
    startedAt: s.created_at as string,
    expertName: s.expert_name as string | null,
    expertCredentials: s.expert_credentials as string | null,
    completedBy: s.completed_by_name as string | null,
    completedAt: s.completed_at as string | null,
    cancelReason: s.cancel_reason as string | null,
    result: s.result_json ? (JSON.parse(String(s.result_json)) as ReturnType<typeof summarise>) : null,
    items: rows.results.map((r) => ({
      position: Number(r.position),
      unit: r.stratum as string,
      outcome: r.outcome as 'PENDING' | 'CORRECT' | 'NEEDS_CHANGES',
      answerCorrect: bool(r.answer_correct as number | null),
      explanationAccurate: bool(r.explanation_accurate as number | null),
      topicFits: bool(r.topic_fits as number | null),
      comment: r.comment as string | null,
      reviewedAt: r.reviewed_at as string | null,
      question: content.get(String(r.question_id)) ?? { id: r.question_id },
    })),
  };
}

// ---------------------------------------------------------------- the expert's findings

export async function recordFinding(db: D1Database, sampleId: string, questionId: string, input: z.infer<typeof recordSchema>, user: Reviewer) {
  need(user, 'record sample review findings');
  const s = await db.prepare('SELECT status FROM sample_reviews WHERE id = ?').bind(sampleId).first<{ status: string }>();
  if (!s) throw notFound('Sample review');
  if (s.status !== 'IN_PROGRESS') throw conflict(`This sample review is ${s.status.toLowerCase().replace('_', ' ')}, so findings can no longer be changed`);
  const clean = input.answerCorrect && input.explanationAccurate && input.topicFits;
  if (!clean && (input.comment ?? '').length < 5) throw invalid('Say what is wrong (at least a few words) when anything is marked as a problem');
  const res = await db
    .prepare(
      `UPDATE sample_review_items SET answer_correct = ?, explanation_accurate = ?, topic_fits = ?, outcome = ?, comment = ?, reviewed_by = ?, reviewed_at = ? WHERE sample_id = ? AND question_id = ?`,
    )
    .bind(input.answerCorrect ? 1 : 0, input.explanationAccurate ? 1 : 0, input.topicFits ? 1 : 0, clean ? 'CORRECT' : 'NEEDS_CHANGES', input.comment?.trim() || null, actorOf(user), nowIso(), sampleId, questionId)
    .run();
  if (!res.meta.changes) throw notFound('Question in this sample');
  const left = await db.prepare(`SELECT COUNT(*) AS n FROM sample_review_items WHERE sample_id = ? AND outcome = 'PENDING'`).bind(sampleId).first<{ n: number }>();
  return { outcome: clean ? 'CORRECT' : 'NEEDS_CHANGES', pending: left?.n ?? 0 };
}

export async function completeSample(db: D1Database, sampleId: string, input: z.infer<typeof completeSchema>, user: Reviewer) {
  need(user, 'complete a sample review');
  const s = await db.prepare('SELECT status, population_count FROM sample_reviews WHERE id = ?').bind(sampleId).first<{ status: string; population_count: number }>();
  if (!s) throw notFound('Sample review');
  if (s.status !== 'IN_PROGRESS') throw conflict(`This sample review is already ${s.status.toLowerCase().replace('_', ' ')}`);
  const items = await db.prepare('SELECT answer_correct, explanation_accurate, topic_fits, outcome FROM sample_review_items WHERE sample_id = ?').bind(sampleId).all<{ answer_correct: number | null; explanation_accurate: number | null; topic_fits: number | null; outcome: string }>();
  const pending = items.results.filter((i) => i.outcome === 'PENDING').length;
  if (pending) throw conflict(`${pending} question${pending === 1 ? ' has' : 's have'} not been checked yet. Every question in the sample must be checked before it can be completed.`);
  const now = nowIso();
  const result = summarise(
    items.results.map((i) => ({ answerCorrect: i.answer_correct, explanationAccurate: i.explanation_accurate, topicFits: i.topic_fits })),
    s.population_count,
    { name: input.expertName, credentials: input.expertCredentials },
    now,
  );
  await db
    .prepare(`UPDATE sample_reviews SET status = 'COMPLETED', expert_name = ?, expert_credentials = ?, completed_by = ?, completed_by_name = ?, completed_at = ?, result_json = ? WHERE id = ? AND status = 'IN_PROGRESS'`)
    .bind(input.expertName, input.expertCredentials, user.id, user.displayName, now, JSON.stringify(result), sampleId)
    .run();
  await db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), actorOf(user), 'SAMPLE_REVIEW_COMPLETED', 'SAMPLE_REVIEW', sampleId, JSON.stringify({ checked: result.checked, withProblem: result.withProblem, wrongAnswer: result.wrongAnswer, expert: input.expertName }), now)
    .run();
  return result;
}

export async function cancelSample(db: D1Database, sampleId: string, input: z.infer<typeof cancelSchema>, user: Reviewer) {
  need(user, 'cancel a sample review');
  const res = await db.prepare(`UPDATE sample_reviews SET status = 'CANCELLED', cancel_reason = ? WHERE id = ? AND status = 'IN_PROGRESS'`).bind(input.reason, sampleId).run();
  if (!res.meta.changes) throw conflict('Only a sample review that is in progress can be cancelled');
  await db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), actorOf(user), 'SAMPLE_REVIEW_CANCELLED', 'SAMPLE_REVIEW', sampleId, JSON.stringify({ reason: input.reason }), nowIso())
    .run();
  return { cancelled: true };
}

// ---------------------------------------------------------------- what the bulk approval screen shows

/** The latest completed sample review for a scope, in the words shown next to a bulk approval. Null when none was done. */
export async function latestSampleFor(db: D1Database, scope: { testPaperId?: string }, currentCount?: () => Promise<number>) {
  const row = await db
    .prepare(`SELECT id, expert_name, expert_credentials, completed_at, population_count, result_json FROM sample_reviews WHERE status = 'COMPLETED' AND scope_json = ? ORDER BY completed_at DESC LIMIT 1`)
    .bind(scopeJson(scope.testPaperId))
    .first<{ id: string; expert_name: string; expert_credentials: string; completed_at: string; population_count: number; result_json: string }>();
  if (!row) return null;
  const r = JSON.parse(row.result_json) as ReturnType<typeof summarise>;
  return {
    id: row.id,
    expertName: row.expert_name,
    expertCredentials: row.expert_credentials,
    completedAt: row.completed_at,
    checked: r.checked,
    population: row.population_count,
    withProblem: r.withProblem,
    wrongAnswer: r.wrongAnswer,
    upperBoundAnyProblem: r.upperBoundAnyProblem,
    upperBoundWrongAnswer: r.upperBoundWrongAnswer,
    statement: r.statement,
    // The sample speaks for the questions that existed when it was drawn.
    questionsChangedSince: currentCount ? (await currentCount()) !== row.population_count : false,
  };
}
