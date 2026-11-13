/**
 * Previous-year question papers.
 *
 * Rules this module enforces, whatever tool calls it:
 *  - A paper is stored only with its source document (URL, SHA-256, retrieval date) and a usage permission.
 *  - Every question number of the paper is accounted for: either stored, or marked as dropped by the exam body.
 *  - When an official answer key is given, each stored key must equal the official one, or the import is refused.
 *  - Students see a paper only when it is PUBLISHED and its usage permission allows public display. The local
 *    "preview" setting, which shows draft lessons, never applies to previous-year papers.
 *  - Publishing needs: a permission that allows display, a FINAL official key, and every question verified by a
 *    signed-in reviewer against the paper.
 *  - Until a paper is published its questions belong to no subject, so they cannot appear in ordinary practice.
 */
import { z } from 'zod';
import { ApiError, conflict, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { insertRows, nowIso, type Row } from '../lib/sql';
import { createSession } from './practice';

const CHOICE_TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'ASSERTION_REASON', 'MATCH_THE_FOLLOWING', 'STATEMENT_BASED'] as const;

const sourceSchema = z.object({
  title: z.string().trim().min(3).max(300),
  publisher: z.string().trim().min(2).max(120),
  url: z.url().max(1000).refine((u) => u.startsWith('https://'), 'The source address must start with https://'),
  listedOnUrl: z.url().max(1000).optional(),
  retrievedAt: z.iso.datetime(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  byteSize: z.number().int().positive(),
  mimeType: z.string().max(100),
  pageCount: z.number().int().positive().max(2000),
  r2Key: z.string().max(300).optional(),
});

const storedQuestion = z.object({
  position: z.number().int().min(1).max(500),
  dropped: z.literal(false).optional(),
  type: z.enum([...CHOICE_TYPES, 'NUMERICAL']),
  stem: z.string().min(3).max(10000),
  options: z.array(z.object({ label: z.string().min(1).max(10), text: z.string().min(1).max(4000) })).max(10).default([]),
  correctOptionPositions: z.array(z.number().int().min(1)).max(10).optional(),
  numericAnswer: z.number().nullable().optional(),
  numericTolerance: z.number().min(0).nullable().optional(),
  /** Correct option position(s) exactly as the official key gives them. Required when the pack names an answer-key source. */
  officialKey: z.array(z.number().int().min(1)).max(10).optional(),
  officialQuestionId: z.string().trim().max(40).optional(),
  sourcePage: z.number().int().min(1),
  /** Our own explanation, if one has been written. The official papers carry none. */
  explanation: z.string().min(10).max(20000).optional(),
});
const droppedQuestion = z.object({ position: z.number().int().min(1).max(500), dropped: z.literal(true), officialQuestionId: z.string().trim().max(40).optional(), sourcePage: z.number().int().min(1).optional() });

export const pastPaperPackSchema = z.object({
  schema: z.literal('cuet-past-paper/1'),
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  year: z.number().int().min(2022).max(2100),
  subjectCode: z.string().trim().min(1).max(20),
  subjectName: z.string().trim().min(2).max(200),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  shift: z.string().trim().max(40).optional(),
  language: z.string().min(2).max(10).default('en'),
  title: z.string().trim().min(3).max(200),
  rules: z.object({ questionsInPaper: z.number().int().min(1).max(500), durationMinutes: z.number().int().min(1).max(600), marksCorrect: z.number().int().min(1).max(20), marksIncorrect: z.number().int().min(-20).max(0) }),
  /** Code of a row in usage_permissions, e.g. a licence or a written permission recorded there. */
  usagePermission: z.string().trim().min(2).max(60),
  questionPaperSource: sourceSchema,
  answerKeySource: sourceSchema.optional(),
  keyVersion: z.enum(['FINAL', 'PROVISIONAL']).default('FINAL'),
  notes: z.string().max(2000).optional(),
  questions: z.array(z.union([droppedQuestion, storedQuestion])).min(1).max(500),
});
export type PastPaperPack = z.infer<typeof pastPaperPackSchema>;
type Stored = z.infer<typeof storedQuestion>;

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

/** Checks a pack beyond its shape. Returns every problem found, so a pack author can fix them in one pass. */
export function checkPack(pack: PastPaperPack): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<number>();
  for (const q of pack.questions) {
    if (seen.has(q.position)) errors.push(`Question ${q.position} appears twice`);
    seen.add(q.position);
    if (q.position > pack.rules.questionsInPaper) errors.push(`Question ${q.position} is beyond the paper's ${pack.rules.questionsInPaper} questions`);
    if (q.sourcePage !== undefined && q.sourcePage > pack.questionPaperSource.pageCount) errors.push(`Question ${q.position} cites page ${q.sourcePage}, but the paper has ${pack.questionPaperSource.pageCount} pages`);
    if (q.dropped) continue;
    const s = q as Stored;
    if (s.type === 'NUMERICAL') {
      if (s.numericAnswer === null || s.numericAnswer === undefined) errors.push(`Question ${s.position}: a numerical question needs its answer`);
    } else {
      const key = s.correctOptionPositions ?? [];
      if (s.options.length < 2) errors.push(`Question ${s.position}: needs at least two options`);
      if (!key.length) errors.push(`Question ${s.position}: no answer key`);
      if (key.some((p) => p > s.options.length)) errors.push(`Question ${s.position}: the answer key points beyond the options`);
      if (new Set(s.options.map((o) => normaliseText(o.text))).size !== s.options.length) errors.push(`Question ${s.position}: two options have the same text`);
      if (pack.answerKeySource) {
        if (!s.officialKey?.length) errors.push(`Question ${s.position}: the official key is missing (the pack names an answer-key source)`);
        else if (!sameSet(s.officialKey, key)) errors.push(`Question ${s.position}: the stored key (${key.join(',')}) differs from the official key (${s.officialKey.join(',')})`);
      }
      if (key.length > 1 && s.type !== 'MCQ_MULTI') warnings.push(`Question ${s.position}: more than one option is accepted as correct (allowed when the official key says so)`);
    }
  }
  const missing = [];
  for (let i = 1; i <= pack.rules.questionsInPaper; i++) if (!seen.has(i)) missing.push(i);
  if (missing.length) errors.push(`Not every question is accounted for. Missing: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''} (store it, or mark it dropped)`);
  if (!pack.answerKeySource) warnings.push('No answer-key source: the paper can be stored as a draft but cannot be published');
  if (pack.keyVersion !== 'FINAL') warnings.push('The key is provisional: the paper cannot be published until the final key is used');
  if (pack.questions.some((q) => !q.dropped && !(q as Stored).explanation)) warnings.push('Some questions have no explanation; students will see the correct answer without one');
  return { errors, warnings };
}

export const packKey = (p: PastPaperPack) => `${p.exam}:${p.year}:${p.subjectCode}:${p.examDate ?? 'nodate'}:${(p.shift ?? 'noshift').replace(/\s+/g, '-')}:${p.language}`.toLowerCase();

async function ensureSource(db: D1Database, src: z.infer<typeof sourceSchema>, kind: 'PAST_PAPER' | 'OFFICIAL_NOTICE', permissionId: string, now: string): Promise<{ id: string; statements: D1PreparedStatement[] }> {
  const cur = await db.prepare('SELECT id FROM source_documents WHERE sha256 = ?').bind(src.sha256).first<{ id: string }>();
  if (cur) return { id: cur.id, statements: [] };
  const id = newId('src');
  return {
    id,
    statements: insertRows(db, 'source_documents', [{
      id, kind, title: src.title, publisher: src.publisher, url: src.url, listed_on_url: src.listedOnUrl ?? null, retrieved_at: src.retrievedAt, sha256: src.sha256, byte_size: src.byteSize,
      mime_type: src.mimeType, page_count: src.pageCount, r2_key: src.r2Key ?? null, usage_permission_id: permissionId, verification: 'UNVERIFIED',
      notes: 'Previous-year paper source. Reference copy kept privately; shown to students only as the permission allows.', created_at: now, updated_at: now,
    }]),
  };
}

/**
 * Stores (or replaces) a previous-year paper as a DRAFT. With `dryRun` it only validates. A paper that is published,
 * or that a reviewer has already started verifying, is never replaced.
 */
export async function importPastPaper(db: D1Database, body: unknown, actor: string, dryRun: boolean) {
  const pack = pastPaperPackSchema.parse(body);
  const { errors, warnings } = checkPack(pack);
  const permission = await db.prepare('SELECT id, code, name, public_display FROM usage_permissions WHERE code = ?').bind(pack.usagePermission).first<{ id: string; code: string; name: string; public_display: number }>();
  if (!permission) errors.push(`Usage permission "${pack.usagePermission}" is not registered`);
  else if (!permission.public_display) warnings.push(`The permission "${permission.name}" does not allow showing the paper to students; it can be stored for reference but not published`);
  const key = packKey(pack);
  const stored = pack.questions.filter((q) => !q.dropped) as Stored[];
  const summary = { key, questions: stored.length, dropped: pack.questions.length - stored.length, warnings };
  if (errors.length) throw new ApiError(422, 'INVALID_PACK', `${errors.length} problem(s) in the paper`, { errors, warnings });
  if (dryRun) return { ...summary, outcome: 'VALID' as const };

  const existing = await db.prepare('SELECT id, status FROM past_papers WHERE external_key = ?').bind(key).first<{ id: string; status: string }>();
  if (existing) {
    if (existing.status !== 'DRAFT') throw conflict(`This paper is ${existing.status.toLowerCase()}; unpublish it before importing it again`);
    const touched = await db
      .prepare(`SELECT 1 FROM past_paper_questions e JOIN questions q ON q.id = e.question_id WHERE e.past_paper_id = ? AND q.verification != 'UNVERIFIED' LIMIT 1`)
      .bind(existing.id)
      .first();
    if (touched) throw conflict('A reviewer has already worked on this paper; it cannot be replaced by an import');
  }
  const paperLink = await db
    .prepare(`SELECT tp.id FROM test_papers tp JOIN exam_cycles c ON c.id = tp.exam_cycle_id JOIN exams e ON e.id = c.exam_id WHERE e.code = ? AND tp.code = ? ORDER BY c.year DESC LIMIT 1`)
    .bind(pack.exam, pack.subjectCode)
    .first<{ id: string }>();
  const now = nowIso();
  const qp = await ensureSource(db, pack.questionPaperSource, 'PAST_PAPER', permission!.id, now);
  const ak = pack.answerKeySource ? (pack.answerKeySource.sha256 === pack.questionPaperSource.sha256 ? { id: qp.id, statements: [] } : await ensureSource(db, pack.answerKeySource, 'OFFICIAL_NOTICE', permission!.id, now)) : null;
  const paperId = existing?.id ?? newId('pp');

  const questionRows: Row[] = [];
  const optionRows: Row[] = [];
  const keyRows: Row[] = [];
  const explanationRows: Row[] = [];
  const entryRows: Row[] = [];
  for (const q of pack.questions) {
    if (q.dropped) {
      entryRows.push({ id: newId('ppq'), past_paper_id: paperId, position: q.position, question_id: null, official_question_id: q.officialQuestionId ?? null, source_page: q.sourcePage ?? null, dropped: 1, official_key_json: null, created_at: now });
      continue;
    }
    const s = q as Stored;
    const id = newId('q');
    questionRows.push({
      id, test_paper_id: null, type: s.type, stem: s.stem, language: pack.language, translation_group_id: null, passage_id: null, difficulty: 'MEDIUM', learning_objective: null, structure_json: null,
      origin: 'PAST_PAPER', usage_permission_id: permission!.id, source_document_id: qp.id, source_locator: `Question ${s.position}, page ${s.sourcePage}`, status: 'DRAFT', verification: 'UNVERIFIED',
      is_demonstration: 0, content_hash: await sha256Hex(`past-paper|${key}|${s.position}|${normaliseText(s.stem)}`), version: 1, external_key: `pyq:${key}:${s.position}`, created_at: now, updated_at: now,
    });
    s.options.forEach((o, i) => optionRows.push({ id: newId('opt'), question_id: id, position: i + 1, label: o.label, text: o.text, media_asset_id: null, created_at: now, updated_at: now }));
    keyRows.push({ id: newId('ans'), question_id: id, correct_option_positions: s.type === 'NUMERICAL' ? null : JSON.stringify(s.correctOptionPositions ?? []), numeric_answer: s.type === 'NUMERICAL' ? s.numericAnswer ?? null : null, numeric_tolerance: s.type === 'NUMERICAL' ? s.numericTolerance ?? 0 : null, verified_by: null, verified_at: null, created_at: now, updated_at: now });
    if (s.explanation) explanationRows.push({ id: newId('exp'), question_id: id, body: s.explanation, option_rationale_json: null, created_at: now, updated_at: now });
    entryRows.push({ id: newId('ppq'), past_paper_id: paperId, position: s.position, question_id: id, official_question_id: s.officialQuestionId ?? null, source_page: s.sourcePage, dropped: 0, official_key_json: s.officialKey ? JSON.stringify(s.officialKey) : null, created_at: now });
  }
  const paperRow: Row = {
    exam_code: pack.exam, year: pack.year, subject_code: pack.subjectCode, subject_name: pack.subjectName, test_paper_id: paperLink?.id ?? null, exam_date: pack.examDate ?? null, shift: pack.shift ?? null,
    language: pack.language, title: pack.title, question_paper_source_id: qp.id, answer_key_source_id: ak?.id ?? null, key_version: pack.keyVersion, usage_permission_id: permission!.id,
    questions_in_paper: pack.rules.questionsInPaper, duration_minutes: pack.rules.durationMinutes, marks_correct: pack.rules.marksCorrect, marks_incorrect: pack.rules.marksIncorrect, notes: pack.notes ?? null, updated_at: now,
  };
  await db.batch([
    ...qp.statements,
    ...(ak?.statements ?? []),
    ...(existing
      ? [
          // Replace: the old draft questions go (their options, keys and explanations cascade), then the paper row is refreshed.
          db.prepare('DELETE FROM questions WHERE id IN (SELECT question_id FROM past_paper_questions WHERE past_paper_id = ? AND question_id IS NOT NULL)').bind(paperId),
          db.prepare('DELETE FROM past_paper_questions WHERE past_paper_id = ?').bind(paperId),
          db.prepare(`UPDATE past_papers SET ${Object.keys(paperRow).map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).bind(...(Object.values(paperRow) as (string | number | null)[]), paperId),
        ]
      : insertRows(db, 'past_papers', [{ id: paperId, ...paperRow, status: 'DRAFT', external_key: key, created_by: actor, created_at: now, published_at: null, published_by: null }])),
    ...insertRows(db, 'questions', questionRows),
    ...insertRows(db, 'question_options', optionRows),
    ...insertRows(db, 'answer_keys', keyRows),
    ...insertRows(db, 'explanations', explanationRows),
    ...insertRows(db, 'past_paper_questions', entryRows),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, existing ? 'REPLACE_PAST_PAPER' : 'IMPORT_PAST_PAPER', 'PAST_PAPER', paperId, JSON.stringify({ key, questions: stored.length, dropped: summary.dropped }), now),
  ]);
  return { ...summary, id: paperId, outcome: existing ? ('REPLACED' as const) : ('CREATED' as const) };
}

// ---------------------------------------------------------------- what students see

/** Never widened by the preview setting: published, and the permission allows public display. */
const STUDENT_VISIBLE = `pp.status = 'PUBLISHED' AND perm.public_display = 1`;
const PAPER_COLUMNS = `pp.id, pp.exam_code, pp.year, pp.subject_code, pp.subject_name, pp.test_paper_id, pp.exam_date, pp.shift, pp.language, pp.title, pp.questions_in_paper, pp.duration_minutes, pp.marks_correct, pp.marks_incorrect, pp.key_version,
  (SELECT COUNT(*) FROM past_paper_questions e WHERE e.past_paper_id = pp.id AND e.dropped = 0) AS questions,
  (SELECT COUNT(*) FROM past_paper_questions e WHERE e.past_paper_id = pp.id AND e.dropped = 1) AS dropped`;
type PaperRow = Record<string, string | number | null>;
const paperOut = (r: PaperRow) => ({
  id: r['id'], exam: r['exam_code'], year: r['year'], subjectCode: r['subject_code'], subjectName: r['subject_name'], paperId: r['test_paper_id'], examDate: r['exam_date'], shift: r['shift'], language: r['language'],
  title: r['title'], questions: Number(r['questions']), dropped: Number(r['dropped']), questionsInPaper: r['questions_in_paper'], durationMinutes: r['duration_minutes'], marksCorrect: r['marks_correct'], marksIncorrect: r['marks_incorrect'],
});

export const pastPaperQuery = z.object({ exam: z.enum(['CUET_UG', 'CUET_PG']).optional(), year: z.coerce.number().int().min(2022).max(2100).optional(), subject: z.string().trim().max(20).optional(), paperId: z.string().max(100).optional() });

export async function listPastPapers(db: D1Database, f: z.infer<typeof pastPaperQuery>) {
  const where = [STUDENT_VISIBLE];
  const params: (string | number)[] = [];
  if (f.exam) (where.push('pp.exam_code = ?'), params.push(f.exam));
  if (f.year) (where.push('pp.year = ?'), params.push(f.year));
  if (f.subject) (where.push('pp.subject_code = ?'), params.push(f.subject));
  if (f.paperId) (where.push('pp.test_paper_id = ?'), params.push(f.paperId));
  const from = 'FROM past_papers pp JOIN usage_permissions perm ON perm.id = pp.usage_permission_id';
  const [papers, filters] = await Promise.all([
    db.prepare(`SELECT ${PAPER_COLUMNS} ${from} WHERE ${where.join(' AND ')} ORDER BY pp.year DESC, pp.subject_name, pp.exam_date, pp.shift LIMIT 500`).bind(...params).all<PaperRow>(),
    db.prepare(`SELECT pp.exam_code, pp.year, pp.subject_code, pp.subject_name, COUNT(*) AS n ${from} WHERE ${STUDENT_VISIBLE} GROUP BY pp.exam_code, pp.year, pp.subject_code, pp.subject_name ORDER BY pp.subject_name`).all<{ exam_code: string; year: number; subject_code: string; subject_name: string; n: number }>(),
  ]);
  const years = [...new Set(filters.results.filter((r) => !f.exam || r.exam_code === f.exam).map((r) => r.year))].sort((a, b) => b - a);
  const subjects = [...new Map(filters.results.filter((r) => !f.exam || r.exam_code === f.exam).map((r) => [r.subject_code, { code: r.subject_code, name: r.subject_name }])).values()];
  return { total: filters.results.reduce((a, r) => a + r.n, 0), years, subjects, papers: papers.results.map(paperOut) };
}

async function visiblePaper(db: D1Database, id: string) {
  const r = await db
    .prepare(
      `SELECT ${PAPER_COLUMNS}, perm.name AS permission, perm.requires_attribution, qs.title AS source_title, qs.publisher AS source_publisher, qs.url AS source_url, ks.title AS key_title, ks.url AS key_url
       FROM past_papers pp JOIN usage_permissions perm ON perm.id = pp.usage_permission_id JOIN source_documents qs ON qs.id = pp.question_paper_source_id LEFT JOIN source_documents ks ON ks.id = pp.answer_key_source_id
       WHERE pp.id = ? AND ${STUDENT_VISIBLE}`,
    )
    .bind(id)
    .first<PaperRow>();
  if (!r) throw notFound('Previous-year paper');
  return r;
}

export async function pastPaperDetail(db: D1Database, id: string) {
  const r = await visiblePaper(db, id);
  return {
    ...paperOut(r),
    source: { title: r['source_title'], publisher: r['source_publisher'], url: r['source_url'] },
    answerKey: r['key_url'] ? { title: r['key_title'], url: r['key_url'], version: r['key_version'] } : null,
    permission: r['permission'],
  };
}

export const startPastPaperSchema = z.object({ mode: z.enum(['PRACTICE', 'MOCK_TEST']) });

/** Starts the paper as it was set: its own questions in their own order, its own time and marking. Dropped questions are left out. */
export async function startPastPaper(db: D1Database, userId: string, id: string, input: z.infer<typeof startPastPaperSchema>) {
  const p = await visiblePaper(db, id);
  const { results } = await db.prepare('SELECT question_id FROM past_paper_questions WHERE past_paper_id = ? AND dropped = 0 AND question_id IS NOT NULL ORDER BY position').bind(id).all<{ question_id: string }>();
  if (!results.length) throw new ApiError(404, 'NO_QUESTIONS', 'This paper has no questions to attempt');
  const rules = { questionsPerPaper: Number(p['questions_in_paper']), durationMinutes: Number(p['duration_minutes']), marksCorrect: Number(p['marks_correct']), marksIncorrect: Number(p['marks_incorrect']) };
  return createSession(db, userId, { mode: input.mode, paperId: (p['test_paper_id'] as string | null) ?? null, nodeId: null, ids: results.map((r) => r.question_id) }, { rulesJson: JSON.stringify(rules), rules });
}

// ---------------------------------------------------------------- staff

export async function listPastPapersAdmin(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT ${PAPER_COLUMNS}, pp.status, pp.external_key, pp.answer_key_source_id, pp.published_at, perm.name AS permission, perm.public_display, qs.url AS source_url,
         (SELECT COUNT(*) FROM past_paper_questions e JOIN questions q ON q.id = e.question_id WHERE e.past_paper_id = pp.id AND q.verification = 'VERIFIED') AS verified,
         (SELECT COUNT(*) FROM past_paper_questions e JOIN questions q ON q.id = e.question_id WHERE e.past_paper_id = pp.id AND q.verification IN ('REJECTED','NEEDS_CHANGES')) AS flagged
       FROM past_papers pp JOIN usage_permissions perm ON perm.id = pp.usage_permission_id JOIN source_documents qs ON qs.id = pp.question_paper_source_id ORDER BY pp.year DESC, pp.subject_name, pp.exam_date, pp.shift`,
    )
    .all<PaperRow>();
  return results.map((r) => ({ ...paperOut(r), status: r['status'], key: r['external_key'], keyVersion: r['key_version'], hasOfficialKey: Boolean(r['answer_key_source_id']), permission: r['permission'], displayAllowed: Boolean(r['public_display']), sourceUrl: r['source_url'], verified: Number(r['verified']), flagged: Number(r['flagged']), publishedAt: r['published_at'], blockers: blockers(r) }));
}

function blockers(r: PaperRow): string[] {
  const out: string[] = [];
  if (!r['public_display']) out.push(`The permission "${r['permission']}" does not allow showing this paper to students`);
  if (!r['answer_key_source_id']) out.push('No official answer key is recorded');
  if (r['key_version'] !== 'FINAL') out.push('The answer key is provisional');
  const open = Number(r['questions']) - Number(r['verified']);
  if (open > 0) out.push(`${open} of ${r['questions']} questions are not yet verified by a reviewer`);
  if (Number(r['questions']) === 0) out.push('The paper has no questions');
  return out;
}

export const paperActionSchema = z.object({ action: z.enum(['PUBLISH', 'UNPUBLISH', 'ARCHIVE']) });

export async function setPastPaperStatus(db: D1Database, id: string, input: z.infer<typeof paperActionSchema>, actor: string) {
  if (!actor.startsWith('user:')) throw new ApiError(403, 'HUMAN_REVIEW_REQUIRED', 'Only a signed-in member of staff can publish a previous-year paper');
  const all = await listPastPapersAdmin(db);
  const p = all.find((x) => x.id === id);
  if (!p) throw notFound('Previous-year paper');
  const now = nowIso();
  const ids = 'SELECT question_id FROM past_paper_questions WHERE past_paper_id = ?1 AND question_id IS NOT NULL';
  const audit = (action: string) => db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, action, 'PAST_PAPER', id, JSON.stringify({ key: p.key }), now);
  if (input.action === 'PUBLISH') {
    if (p.status !== 'DRAFT') throw conflict(`Only a draft can be published (this paper is ${String(p.status).toLowerCase()})`);
    if (p.blockers.length) throw new ApiError(409, 'NOT_READY', 'This paper cannot be published yet', { blockers: p.blockers });
    await db.batch([
      db.prepare(`UPDATE past_papers SET status = 'PUBLISHED', published_at = ?2, published_by = ?3, updated_at = ?2 WHERE id = ?1 AND status = 'DRAFT'`).bind(id, now, actor),
      // From now on the questions belong to the subject, so they can also appear in ordinary practice.
      db.prepare(`UPDATE questions SET status = 'PUBLISHED', test_paper_id = (SELECT test_paper_id FROM past_papers WHERE id = ?1), updated_at = ?2 WHERE id IN (${ids})`).bind(id, now),
      audit('PUBLISH_PAST_PAPER'),
    ]);
  } else {
    if (input.action === 'UNPUBLISH' && p.status !== 'PUBLISHED') throw conflict('This paper is not published');
    await db.batch([
      db.prepare(`UPDATE past_papers SET status = ?2, updated_at = ?3 WHERE id = ?1`).bind(id, input.action === 'ARCHIVE' ? 'ARCHIVED' : 'DRAFT', now),
      db.prepare(`UPDATE questions SET status = ?3, test_paper_id = NULL, updated_at = ?2 WHERE id IN (${ids})`).bind(id, now, input.action === 'ARCHIVE' ? 'ARCHIVED' : 'DRAFT'),
      audit(input.action === 'ARCHIVE' ? 'ARCHIVE_PAST_PAPER' : 'UNPUBLISH_PAST_PAPER'),
    ]);
  }
  return (await listPastPapersAdmin(db)).find((x) => x.id === id)!;
}

/** The questions of one paper with their keys, for staff checking it against the source. */
export async function pastPaperQuestionsAdmin(db: D1Database, id: string) {
  const paper = (await listPastPapersAdmin(db)).find((x) => x.id === id);
  if (!paper) throw notFound('Previous-year paper');
  const { results } = await db
    .prepare(
      `SELECT e.position, e.dropped, e.official_question_id, e.source_page, e.official_key_json, q.id AS question_id, q.type, q.stem, q.verification, q.status, a.correct_option_positions, a.numeric_answer,
         (SELECT json_group_array(json_object('position', o.position, 'label', o.label, 'text', o.text)) FROM question_options o WHERE o.question_id = q.id ORDER BY o.position) AS options
       FROM past_paper_questions e LEFT JOIN questions q ON q.id = e.question_id LEFT JOIN answer_keys a ON a.question_id = q.id WHERE e.past_paper_id = ? ORDER BY e.position`,
    )
    .bind(id)
    .all<Record<string, string | number | null>>();
  return {
    paper,
    questions: results.map((r) => ({
      position: r['position'], dropped: Boolean(r['dropped']), officialQuestionId: r['official_question_id'], sourcePage: r['source_page'], questionId: r['question_id'], type: r['type'], stem: r['stem'], verification: r['verification'],
      options: r['options'] ? (JSON.parse(r['options'] as string) as { position: number; label: string; text: string }[]).sort((a, b) => a.position - b.position) : [],
      key: r['correct_option_positions'] ? JSON.parse(r['correct_option_positions'] as string) : null, numericAnswer: r['numeric_answer'], officialKey: r['official_key_json'] ? JSON.parse(r['official_key_json'] as string) : null,
    })),
  };
}

