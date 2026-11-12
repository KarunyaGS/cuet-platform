import { z } from 'zod';
import type { PrismaClient } from '@cuet/database';
import { conflict, invalid, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { insertRows, nowIso } from '../lib/sql';
import { evaluateResponse, markingFromRules, type QuestionType } from './scoring';

const TYPES = ['MCQ_SINGLE', 'MCQ_MULTI', 'ASSERTION_REASON', 'MATCH_THE_FOLLOWING', 'STATEMENT_BASED', 'PASSAGE_BASED', 'DIAGRAM_BASED', 'NUMERICAL'] as const;
const ORIGINS = ['OFFICIAL_SOURCE', 'OFFICIAL_SAMPLE', 'AUTHORED', 'LICENSED', 'PAST_PAPER', 'AI_ASSISTED', 'DEMONSTRATION'] as const;

export const questionInputSchema = z
  .object({
    testPaperId: z.string().max(100).nullable().optional(),
    type: z.enum(TYPES),
    stem: z.string().min(3).max(10000),
    language: z.string().min(2).max(10).default('en'),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
    learningObjective: z.string().max(1000).nullable().optional(),
    passageId: z.string().max(100).nullable().optional(),
    structureJson: z.string().max(20000).nullable().optional(),
    origin: z.enum(ORIGINS),
    usagePermissionId: z.string().max(100),
    sourceDocumentId: z.string().max(100).nullable().optional(),
    sourceLocator: z.string().max(300).nullable().optional(),
    isDemonstration: z.boolean().default(false),
    options: z.array(z.object({ label: z.string().min(1).max(10), text: z.string().min(1).max(4000), mediaAssetId: z.string().max(100).nullable().optional() })).max(10),
    answer: z.object({
      correctOptionPositions: z.array(z.number().int().min(1)).nullable().optional(),
      numericAnswer: z.number().nullable().optional(),
      numericTolerance: z.number().min(0).nullable().optional(),
    }),
    explanation: z.object({ body: z.string().min(10).max(20000), optionRationale: z.record(z.string(), z.string().max(4000)).optional() }),
    topicNodeIds: z.array(z.string().max(100)).max(20).default([]),
  })
  .superRefine((q, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (q.type === 'NUMERICAL') {
      if (q.answer.numericAnswer === null || q.answer.numericAnswer === undefined) issue('Numerical questions need numericAnswer');
    } else {
      if (q.options.length < 2) issue('Choice questions need at least two options');
      const keys = q.answer.correctOptionPositions ?? [];
      if (!keys.length) issue('Give the correct option position(s)');
      if (keys.some((p) => p > q.options.length)) issue('A correct option position is beyond the number of options');
      if (q.type !== 'MCQ_MULTI' && keys.length !== 1) issue('This question type has exactly one correct option');
    }
    if (q.origin === 'PAST_PAPER' && (!q.sourceDocumentId || !q.sourceLocator)) issue('Previous-year questions must cite the source document and its question number/page');
    if (q.origin === 'DEMONSTRATION' && !q.isDemonstration) issue('DEMONSTRATION origin requires isDemonstration = true');
    if (q.isDemonstration && q.usagePermissionId !== 'perm_demo') issue('Demonstration records must use the DEMONSTRATION_ONLY permission');
    if (q.type === 'PASSAGE_BASED' && !q.passageId) issue('Passage-based questions need a passage');
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

async function questionHash(q: QuestionInput): Promise<string> {
  return sha256Hex([q.type, q.language, normaliseText(q.stem), ...q.options.map((o) => normaliseText(o.text))].join('|'));
}

async function checkTopics(db: D1Database, ids: string[]) {
  if (!ids.length) return;
  const { results } = await db.prepare(`SELECT id FROM curriculum_nodes WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ id: string }>();
  if (results.length !== new Set(ids).size) throw invalid('One or more topic ids do not exist');
}

function childRows(db: D1Database, questionId: string, q: QuestionInput, now: string): D1PreparedStatement[] {
  return [
    ...insertRows(db, 'question_options', q.options.map((o, i) => ({
      id: newId('opt'), question_id: questionId, position: i + 1, label: o.label, text: o.text, media_asset_id: o.mediaAssetId ?? null, created_at: now, updated_at: now,
    }))),
    ...insertRows(db, 'answer_keys', [{
      id: newId('ans'), question_id: questionId,
      correct_option_positions: q.type === 'NUMERICAL' ? null : JSON.stringify(q.answer.correctOptionPositions ?? []),
      numeric_answer: q.answer.numericAnswer ?? null, numeric_tolerance: q.answer.numericTolerance ?? null,
      verified_by: null, verified_at: null, created_at: now, updated_at: now,
    }]),
    ...insertRows(db, 'explanations', [{
      id: newId('exp'), question_id: questionId, language: q.language, body: q.explanation.body,
      option_rationale_json: q.explanation.optionRationale ? JSON.stringify(q.explanation.optionRationale) : null,
      status: 'DRAFT', verification: 'UNVERIFIED', created_at: now, updated_at: now,
    }]),
    ...insertRows(db, 'question_topics', [...new Set(q.topicNodeIds)].map((t, i) => ({ question_id: questionId, curriculum_node_id: t, is_primary: i === 0 }))),
  ];
}

export async function createQuestion(db: D1Database, q: QuestionInput, actor: string) {
  await checkTopics(db, q.topicNodeIds);
  const hash = await questionHash(q);
  const dup = await db.prepare('SELECT id FROM questions WHERE content_hash = ?').bind(hash).first<{ id: string }>();
  if (dup) throw conflict('An identical question already exists', { existingId: dup.id });
  const id = newId('q');
  const now = nowIso();
  await db.batch([
    ...insertRows(db, 'questions', [{
      id, test_paper_id: q.testPaperId ?? null, type: q.type, stem: q.stem, language: q.language, translation_group_id: null,
      passage_id: q.passageId ?? null, difficulty: q.difficulty, learning_objective: q.learningObjective ?? null,
      structure_json: q.structureJson ?? null, origin: q.origin, usage_permission_id: q.usagePermissionId,
      source_document_id: q.sourceDocumentId ?? null, source_locator: q.sourceLocator ?? null, status: 'DRAFT', verification: 'UNVERIFIED',
      is_demonstration: q.isDemonstration, content_hash: hash, version: 1, created_at: now, updated_at: now,
    }]),
    ...childRows(db, id, q, now),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'CREATE_QUESTION', 'QUESTION', id, null, now),
  ]);
  return { id };
}

export async function updateQuestion(db: D1Database, id: string, q: QuestionInput, actor: string) {
  const cur = await db.prepare('SELECT id, status, version FROM questions WHERE id = ?').bind(id).first<{ id: string; status: string; version: number }>();
  if (!cur) throw notFound('Question');
  await checkTopics(db, q.topicNodeIds);
  const hash = await questionHash(q);
  const dup = await db.prepare('SELECT id FROM questions WHERE content_hash = ? AND id != ?').bind(hash, id).first<{ id: string }>();
  if (dup) throw conflict('An identical question already exists', { existingId: dup.id });
  const now = nowIso();
  // Any edit sends the question back through review.
  await db.batch([
    db
      .prepare(
        `UPDATE questions SET test_paper_id = ?, type = ?, stem = ?, language = ?, passage_id = ?, difficulty = ?, learning_objective = ?,
          structure_json = ?, origin = ?, usage_permission_id = ?, source_document_id = ?, source_locator = ?, is_demonstration = ?,
          content_hash = ?, version = version + 1, status = 'DRAFT', verification = 'UNVERIFIED', updated_at = ? WHERE id = ? AND version = ?`,
      )
      .bind(
        q.testPaperId ?? null, q.type, q.stem, q.language, q.passageId ?? null, q.difficulty, q.learningObjective ?? null, q.structureJson ?? null,
        q.origin, q.usagePermissionId, q.sourceDocumentId ?? null, q.sourceLocator ?? null, q.isDemonstration ? 1 : 0, hash, now, id, cur.version,
      ),
    db.prepare('DELETE FROM question_options WHERE question_id = ?').bind(id),
    db.prepare('DELETE FROM answer_keys WHERE question_id = ?').bind(id),
    db.prepare('DELETE FROM explanations WHERE question_id = ?').bind(id),
    db.prepare('DELETE FROM question_topics WHERE question_id = ?').bind(id),
    ...childRows(db, id, q, now),
    db.prepare(`INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, created_at) VALUES (?, 'QUESTION', ?, 'EDITED', ?, 'DRAFT/UNVERIFIED', ?, ?, ?)`)
      .bind(newId('rev'), id, cur.status, actor, `Edited to version ${cur.version + 1}`, now),
  ]);
  return { id, version: cur.version + 1 };
}

export async function deleteQuestion(db: D1Database, id: string, actor: string) {
  const cur = await db.prepare('SELECT status FROM questions WHERE id = ?').bind(id).first<{ status: string }>();
  if (!cur) throw notFound('Question');
  if (cur.status === 'PUBLISHED') throw conflict('Unpublish or archive a published question instead of deleting it');
  await db.batch([
    db.prepare('DELETE FROM questions WHERE id = ?').bind(id),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'DELETE_QUESTION', 'QUESTION', id, nowIso()),
  ]);
  return { deleted: true };
}

/** Full record for staff, including the answer key. */
export async function getQuestionAdmin(prisma: PrismaClient, id: string) {
  const q = await prisma.question.findUnique({
    where: { id },
    include: {
      options: { orderBy: { position: 'asc' } },
      answerKey: true,
      explanations: true,
      topics: { include: { curriculumNode: { select: { id: true, title: true, kind: true, label: true, syllabusVersionId: true } } } },
      passage: true,
      testPaper: { select: { id: true, code: true, name: true } },
      usagePermission: { select: { code: true, name: true } },
      sourceDocument: { select: { id: true, title: true, url: true } },
    },
  });
  if (!q) throw notFound('Question');
  return q;
}

export async function listQuestions(
  prisma: PrismaClient,
  f: { testPaperId?: string; nodeId?: string; status?: string; verification?: string; q?: string; exam?: string },
  page: { skip: number; pageSize: number },
) {
  const where = {
    ...(f.testPaperId ? { testPaperId: f.testPaperId } : {}),
    ...(f.nodeId ? { topics: { some: { curriculumNodeId: f.nodeId } } } : {}),
    ...(f.status ? { status: f.status as never } : {}),
    ...(f.verification ? { verification: f.verification as never } : {}),
    ...(f.q ? { stem: { contains: f.q } } : {}),
    ...(f.exam ? { testPaper: { examCycle: { exam: { code: f.exam } } } } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where, orderBy: { updatedAt: 'desc' }, skip: page.skip, take: page.pageSize,
      select: { id: true, type: true, stem: true, difficulty: true, status: true, verification: true, origin: true, isDemonstration: true, version: true, updatedAt: true, testPaper: { select: { code: true, name: true } } },
    }),
  ]);
  return { total, items };
}

/** Student-facing: published, non-demonstration questions only, and never the answer key. */
export async function getQuestionPublic(prisma: PrismaClient, id: string) {
  const q = await prisma.question.findFirst({
    where: { id, status: 'PUBLISHED', isDemonstration: false },
    select: {
      id: true, type: true, stem: true, language: true, difficulty: true, structureJson: true,
      passage: { select: { id: true, title: true, body: true } },
      options: { orderBy: { position: 'asc' }, select: { position: true, label: true, text: true, mediaAssetId: true } },
    },
  });
  if (!q) throw notFound('Question');
  return q;
}

export const evaluateSchema = z.object({
  selectedPositions: z.array(z.number().int().min(1)).max(10).optional(),
  numericAnswer: z.number().nullable().optional(),
});

/**
 * Evaluate a student's answer from stored records only: answer key, explanation and the cycle's
 * marking scheme. No external service is involved.
 */
export async function evaluateQuestion(prisma: PrismaClient, id: string, response: z.infer<typeof evaluateSchema>, opts: { allowUnpublished?: boolean } = {}) {
  const q = await prisma.question.findFirst({
    where: opts.allowUnpublished ? { id } : { id, status: 'PUBLISHED', isDemonstration: false },
    include: {
      answerKey: true,
      explanations: { where: opts.allowUnpublished ? {} : { status: 'PUBLISHED' } },
      testPaper: { include: { examCycle: true } },
      topics: { select: { curriculumNodeId: true } },
    },
  });
  if (!q) throw notFound('Question');
  if (!q.answerKey) throw conflict('This question has no answer key yet');
  const key = {
    correctOptionPositions: q.answerKey.correctOptionPositions ? (JSON.parse(q.answerKey.correctOptionPositions) as number[]) : null,
    numericAnswer: q.answerKey.numericAnswer,
    numericTolerance: q.answerKey.numericTolerance,
  };
  const marking = markingFromRules(q.testPaper?.examCycle.rulesJson ?? null);
  const result = evaluateResponse(q.type as QuestionType, key, response, marking);
  const explanation = q.explanations.find((e) => e.language === q.language) ?? q.explanations[0] ?? null;
  return {
    questionId: q.id,
    outcome: result.outcome,
    score: result.score,
    marking,
    correctOptionPositions: key.correctOptionPositions,
    correctNumericAnswer: key.numericAnswer,
    explanation: explanation ? { body: explanation.body, optionRationale: explanation.optionRationaleJson ? JSON.parse(explanation.optionRationaleJson) : null } : null,
    relatedTopicIds: q.topics.map((t) => t.curriculumNodeId),
    answeredBy: 'stored-answer-key',
  };
}
