/**
 * Bulk management approval of questions.
 *
 * What this is: ONE signed-in approver, with reviewer permission, decides that a set of questions may be treated as
 * verified, on the strength of automated format checks and a management decision. It is recorded as exactly that.
 *
 * What this is not: individual review. No question approved here is described as individually reviewed, and the
 * answer key's own `verified_by` / `verified_at` are never written, because nobody checked each answer.
 *
 * Every bulk approval keeps a batch (approver, roles, date, scope, method, check results, the statement confirmed)
 * and one item per question (what it was before), so a question can be flagged, corrected or withdrawn later.
 */
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { auditQuestion, loadAuditRows, type AuditRow } from './question-audit';
import type { Reviewer } from './syllabus-review';

const actorOf = (u: Reviewer) => `user:${u.id}`;

export const BULK_METHOD = 'BULK_MANAGEMENT_APPROVAL_AFTER_AUTOMATED_FORMAT_CHECKS_v1';
const CHUNK = 40; // 4 statements per question, and D1 allows 100 bound values per statement

/** The sentence the approver confirms. Stored word for word with the batch. */
export function approvalStatement(count: number): string {
  return (
    `I approve ${count} questions as a bulk management decision. ` +
    `This is not an individual review of each question or answer. ` +
    `The approval rests on automated format checks (four options, one answer, an explanation, a topic) and on management's decision. ` +
    `I understand that any question can later be flagged, corrected or withdrawn, and that each of these questions will be recorded as bulk-approved.`
  );
}

export const scopeSchema = z.object({
  /** Limit to one subject paper. Omit for every unverified question. */
  testPaperId: z.string().min(1).max(100).optional(),
});
export type Scope = z.infer<typeof scopeSchema>;

export const confirmSchema = z.object({
  scope: scopeSchema,
  /** The list the approver was shown. If anything changed since, the approval is refused. */
  snapshotHash: z.string().length(64),
  /** The exact phrase `APPROVE <count>`. */
  typed: z.string().max(40),
  /** The statement shown, repeated back. */
  statement: z.string().max(2000),
});

const need = (u: Reviewer, what: string) => {
  if (!u.permissions.includes('content:review')) throw new ApiError(403, 'FORBIDDEN', `Your account cannot ${what} (needs content:review)`);
};

export interface Exclusion { id: string; reasons: string[]; stem: string }

/** Everything the approver is shown: who is covered, who is left out and why, and the facts behind the approval. */
export async function previewBulk(db: D1Database, scope: Scope) {
  const where = [`q.verification = 'UNVERIFIED'`, 'q.is_demonstration = 0'];
  const params: string[] = [];
  if (scope.testPaperId) (where.push('q.test_paper_id = ?'), params.push(scope.testPaperId));
  // The same rules as the question bank audit and the rules applied when a question is saved.
  const [{ rows, media }, already, total] = await Promise.all([
    loadAuditRows(db, where, params),
    db.prepare(`SELECT verification, COUNT(*) AS n FROM questions ${scope.testPaperId ? 'WHERE test_paper_id = ?' : ''} GROUP BY verification`).bind(...params).all<{ verification: string; n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM questions ${scope.testPaperId ? 'WHERE test_paper_id = ?' : ''}`).bind(...params).first<{ n: number }>(),
  ]);
  const eligible: AuditRow[] = [];
  const excluded: Exclusion[] = [];
  for (const q of rows) {
    const { problems } = auditQuestion(q, media);
    if (problems.length) excluded.push({ id: q.id, reasons: problems, stem: q.stem.slice(0, 140) });
    else eligible.push(q);
  }

  // Not reasons to exclude: things a person should look at.
  const sameStem = new Map<string, string[]>();
  for (const q of eligible) {
    const key = normaliseText(q.stem);
    (sameStem.get(key) ?? sameStem.set(key, []).get(key)!).push(q.id);
  }
  const sameOpening = [...sameStem.values()].filter((v) => v.length > 1);
  const spread: Record<string, number> = {};
  for (const q of eligible) {
    const keys = JSON.parse(q.keys[0] ?? 'null') as number[] | null; // a numerical question has no option key
    if (!Array.isArray(keys) || keys.length !== 1) continue;
    const label = q.options.find((x) => x.position === keys[0])?.label;
    if (label) spread[label] = (spread[label] ?? 0) + 1;
  }
  const byType: Record<string, number> = {};
  for (const q of eligible) byType[q.type] = (byType[q.type] ?? 0) + 1;

  const ids = eligible.map((q) => q.id);
  const snapshotHash = await sha256Hex(`${BULK_METHOD}\n${ids.join('\n')}`);
  const states = Object.fromEntries(already.results.map((r) => [r.verification, r.n]));
  const bulkActive = await db
    .prepare(`SELECT COUNT(DISTINCT i.question_id) AS n FROM bulk_approval_items i JOIN questions q ON q.id = i.question_id WHERE i.state = 'ACTIVE' AND q.verification = 'VERIFIED' ${scope.testPaperId ? 'AND q.test_paper_id = ?' : ''}`)
    .bind(...params)
    .first<{ n: number }>();
  const count = eligible.length;
  return {
    method: BULK_METHOD,
    scope,
    totalQuestions: total?.n ?? 0,
    currentlyByVerification: states,
    eligibleCount: count,
    eligibleByType: byType,
    correctAnswerSpread: spread,
    excluded,
    needsAPersonsEyes: sameOpening.map((v) => ({ note: 'Same question text on more than one question (the options differ). Read them before approving.', ids: v })),
    alreadyIndividuallyVerified: Math.max(0, (states['VERIFIED'] ?? 0) - (bulkActive?.n ?? 0)),
    alreadyBulkApproved: bulkActive?.n ?? 0,
    checks: [
      'Exactly four options labelled A, B, C, D',
      'Exactly one correct answer, pointing at an existing option',
      'An explanation of at least 40 characters, with notes on each wrong option that match the answer key',
      'Where the explanation states the answer plainly (option number, match pairing, assertion and reason), it agrees with the answer key',
      'Linked to a topic',
      'Question text present, formulas balanced',
      'Figure present for figure-based questions',
      'Not a demonstration record, and allowed to be shown to students',
    ],
    notChecked: ['Whether each answer is scientifically correct', 'Whether each explanation is accurate', 'Whether each question matches the syllabus topic'],
    statement: approvalStatement(count),
    phraseToType: `APPROVE ${count}`,
    snapshotHash,
    ids,
  };
}

/** The approval itself. Refused unless the person is signed in, confirms the exact statement and types the phrase. */
export async function confirmBulk(db: D1Database, input: z.infer<typeof confirmSchema>, user: Reviewer) {
  need(user, 'approve questions in bulk');
  const p = await previewBulk(db, input.scope);
  if (!p.eligibleCount) throw conflict('There are no eligible questions to approve');
  if (input.snapshotHash !== p.snapshotHash) throw new ApiError(409, 'LIST_CHANGED', 'The list of questions changed since you looked at it. Load the preview again and re-confirm.');
  if (input.statement !== p.statement) throw invalid('The statement you confirmed does not match the one shown');
  if (input.typed.trim() !== p.phraseToType) throw invalid(`Type ${p.phraseToType} to confirm`);

  const batchId = newId('bulk');
  const now = nowIso();
  const roles = await db
    .prepare('SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? ORDER BY r.name')
    .bind(user.id)
    .all<{ name: string }>();
  const actor = actorOf(user);
  await db
    .prepare(
      `INSERT INTO bulk_approval_batches (id, approver_id, approver_name, approver_roles, method, scope_json, question_count, snapshot_hash, checks_json, statement, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    )
    .bind(batchId, user.id, user.displayName, roles.results.map((r) => r.name).join(', ') || 'Reviewer', BULK_METHOD, JSON.stringify(input.scope), p.eligibleCount, p.snapshotHash,
      JSON.stringify({ checks: p.checks, notChecked: p.notChecked, byType: p.eligibleByType, excludedCount: p.excluded.length, needsAPersonsEyes: p.needsAPersonsEyes.length }), p.statement, now)
    .run();
  const comment = `BULK MANAGEMENT APPROVAL (batch ${batchId}). Not an individual review of this question.`;
  const checklist = JSON.stringify({ bulkApproval: true, individuallyReviewed: false, batchId, automatedFormatChecks: true });
  let applied = 0;
  for (let i = 0; i < p.ids.length; i += CHUNK) {
    const stmts: D1PreparedStatement[] = [];
    for (const id of p.ids.slice(i, i + CHUNK)) {
      // Each step runs only if the one before changed a row, so a question that changed meanwhile is skipped whole.
      stmts.push(db.prepare(`UPDATE questions SET verification = 'VERIFIED', updated_at = ? WHERE id = ? AND verification = 'UNVERIFIED'`).bind(now, id));
      stmts.push(db.prepare(`INSERT INTO bulk_approval_items (id, batch_id, question_id, from_verification, state, created_at) SELECT ?, ?, ?, 'UNVERIFIED', 'ACTIVE', ? WHERE changes() = 1`).bind(newId('bai'), batchId, id, now));
      stmts.push(
        db
          .prepare(`INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at) SELECT ?, 'QUESTION', ?, 'VERIFIED', 'UNVERIFIED', 'VERIFIED', ?, ?, ?, ? WHERE changes() = 1`)
          .bind(newId('rev'), id, actor, comment, checklist, now),
      );
    }
    const out = await db.batch(stmts);
    applied += out.filter((_, k) => k % 3 === 0).filter((r) => (r.meta.changes ?? 0) > 0).length;
  }
  await db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), actor, 'BULK_APPROVAL', 'BULK_APPROVAL_BATCH', batchId, JSON.stringify({ requested: p.eligibleCount, applied, method: BULK_METHOD }), now)
    .run();
  return { batchId, requested: p.eligibleCount, applied, skippedBecauseChanged: p.eligibleCount - applied, method: BULK_METHOD, approver: user.displayName, at: now };
}

export const withdrawSchema = z.object({
  /** Question ids, or a whole batch. */
  questionIds: z.array(z.string().min(1).max(100)).min(1).max(200).optional(),
  batchId: z.string().min(1).max(100).optional(),
  /** FLAG: needs changes. REJECT: wrong, hidden from students. WITHDRAW: back to unverified, no judgement. */
  action: z.enum(['FLAG', 'REJECT', 'WITHDRAW']),
  reason: z.string().trim().min(5).max(2000),
}).refine((v) => Boolean(v.questionIds?.length) !== Boolean(v.batchId), { message: 'Give either questionIds or batchId' });

const TO = { FLAG: 'NEEDS_CHANGES', REJECT: 'REJECTED', WITHDRAW: 'UNVERIFIED' } as const;
const ACTION = { FLAG: 'CHANGES_REQUESTED', REJECT: 'REJECTED', WITHDRAW: 'EDITED' } as const;
const WORD = { FLAG: 'flagged', REJECT: 'rejected', WITHDRAW: 'withdrawn' } as const;

/** Withdraw bulk approval from questions that are still bulk-approved. Individually verified questions are never touched here. */
export async function withdrawBulk(db: D1Database, input: z.infer<typeof withdrawSchema>, user: Reviewer) {
  need(user, 'flag, correct or withdraw approvals');
  const rows = input.batchId
    ? await db.prepare(`SELECT i.id, i.question_id, i.batch_id FROM bulk_approval_items i WHERE i.batch_id = ? AND i.state = 'ACTIVE'`).bind(input.batchId).all<{ id: string; question_id: string; batch_id: string }>()
    : await db.prepare(`SELECT i.id, i.question_id, i.batch_id FROM bulk_approval_items i WHERE i.state = 'ACTIVE' AND i.question_id IN (${input.questionIds!.map(() => '?').join(',')})`).bind(...input.questionIds!).all<{ id: string; question_id: string; batch_id: string }>();
  if (input.batchId) {
    const exists = await db.prepare('SELECT 1 FROM bulk_approval_batches WHERE id = ?').bind(input.batchId).first();
    if (!exists) throw notFound('Approval batch');
  }
  const found = new Set(rows.results.map((r) => r.question_id));
  const notBulk = (input.questionIds ?? []).filter((id) => !found.has(id));
  const now = nowIso();
  const actor = actorOf(user);
  const to = TO[input.action];
  let applied = 0;
  for (let i = 0; i < rows.results.length; i += CHUNK) {
    const stmts: D1PreparedStatement[] = [];
    for (const r of rows.results.slice(i, i + CHUNK)) {
      // A withdrawn question also leaves any published state, so students stop seeing it as approved content.
      stmts.push(db.prepare(`UPDATE questions SET verification = ?, status = CASE WHEN status IN ('APPROVED','PUBLISHED') THEN 'DRAFT' ELSE status END, updated_at = ? WHERE id = ? AND verification = 'VERIFIED'`).bind(to, now, r.question_id));
      stmts.push(db.prepare(`UPDATE bulk_approval_items SET state = 'REVOKED', ended_at = ?, ended_by = ?, ended_reason = ? WHERE id = ? AND state = 'ACTIVE' AND changes() = 1`).bind(now, actor, `${input.action}: ${input.reason}`, r.id));
      stmts.push(
        db
          .prepare(`INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at) SELECT ?, 'QUESTION', ?, ?, 'VERIFIED', ?, ?, ?, ?, ? WHERE changes() = 1`)
          .bind(newId('rev'), r.question_id, ACTION[input.action], to, actor, `Bulk approval ${WORD[input.action]} (batch ${r.batch_id}): ${input.reason}`, JSON.stringify({ bulkApproval: true, batchId: r.batch_id, individuallyReviewed: false }), now),
      );
    }
    const out = await db.batch(stmts);
    applied += out.filter((_, k) => k % 3 === 0).filter((x) => (x.meta.changes ?? 0) > 0).length;
  }
  await db
    .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), actor, `BULK_APPROVAL_${input.action}`, 'BULK_APPROVAL_BATCH', input.batchId ?? null, JSON.stringify({ count: applied, reason: input.reason }), now)
    .run();
  if (input.batchId) {
    const left = await db.prepare(`SELECT COUNT(*) AS n FROM bulk_approval_items WHERE batch_id = ? AND state = 'ACTIVE'`).bind(input.batchId).first<{ n: number }>();
    if (!left?.n) await db.prepare(`UPDATE bulk_approval_batches SET status = 'REVOKED' WHERE id = ?`).bind(input.batchId).run();
  }
  return { applied, to, notBulkApproved: notBulk };
}

/**
 * Called after a person decides on questions one by one.
 * A question later flagged or rejected leaves the bulk approval; one later verified individually becomes individually reviewed.
 */
export async function noteIndividualDecision(db: D1Database, questionIds: string[], action: 'VERIFIED' | 'CHANGES_REQUESTED' | 'REJECTED', user: Reviewer) {
  if (!questionIds.length) return;
  const now = nowIso();
  const state = action === 'VERIFIED' ? 'SUPERSEDED' : 'REVOKED';
  const reason = action === 'VERIFIED' ? 'Verified individually by a reviewer' : `Decided individually: ${action}`;
  for (let i = 0; i < questionIds.length; i += 80) {
    const part = questionIds.slice(i, i + 80);
    await db
      .prepare(`UPDATE bulk_approval_items SET state = ?, ended_at = ?, ended_by = ?, ended_reason = ? WHERE state = 'ACTIVE' AND question_id IN (${part.map(() => '?').join(',')})`)
      .bind(state, now, actorOf(user), reason, ...part)
      .run();
  }
}

/** Question ids that are verified only through a bulk approval (so a person may still confirm them one by one). */
export async function bulkActiveAmong(db: D1Database, ids: string[]): Promise<string[]> {
  const out: string[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { results } = await db.prepare(`SELECT DISTINCT question_id FROM bulk_approval_items WHERE state = 'ACTIVE' AND question_id IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ question_id: string }>();
    out.push(...results.map((r) => r.question_id));
  }
  return out;
}

/** The honest count: how many questions each kind of approval stands behind. */
export async function approvalSummary(db: D1Database) {
  const [counts, batches] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(verification = 'UNVERIFIED') AS unverified,
           SUM(verification = 'VERIFIED' AND EXISTS (SELECT 1 FROM bulk_approval_items i WHERE i.question_id = q.id AND i.state = 'ACTIVE')) AS bulk_approved,
           SUM(verification = 'VERIFIED' AND NOT EXISTS (SELECT 1 FROM bulk_approval_items i WHERE i.question_id = q.id AND i.state = 'ACTIVE')) AS individually_verified,
           SUM(verification = 'NEEDS_CHANGES') AS flagged,
           SUM(verification = 'REJECTED') AS rejected
         FROM questions q`,
      )
      .first<Record<string, number | null>>(),
    db
      .prepare(
        `SELECT b.id, b.approver_name, b.approver_roles, b.method, b.scope_json, b.question_count, b.status, b.created_at,
           (SELECT COUNT(*) FROM bulk_approval_items i WHERE i.batch_id = b.id AND i.state = 'ACTIVE') AS active,
           (SELECT COUNT(*) FROM bulk_approval_items i WHERE i.batch_id = b.id AND i.state = 'REVOKED') AS revoked,
           (SELECT COUNT(*) FROM bulk_approval_items i WHERE i.batch_id = b.id AND i.state = 'SUPERSEDED') AS superseded
         FROM bulk_approval_batches b ORDER BY b.created_at DESC LIMIT 50`,
      )
      .all<Record<string, string | number | null>>(),
  ]);
  const n = (k: string) => Number(counts?.[k] ?? 0);
  return {
    questions: { total: n('total'), unverified: n('unverified'), bulkApproved: n('bulk_approved'), individuallyVerified: n('individually_verified'), flagged: n('flagged'), rejected: n('rejected') },
    batches: batches.results.map((b) => ({
      id: b['id'], approver: b['approver_name'], approverRoles: b['approver_roles'], method: b['method'], scope: JSON.parse(String(b['scope_json'])), approved: Number(b['question_count']),
      stillBulkApproved: Number(b['active']), withdrawnOrFlagged: Number(b['revoked']), laterVerifiedIndividually: Number(b['superseded']), status: b['status'], at: b['created_at'],
    })),
  };
}

export async function batchDetail(db: D1Database, id: string) {
  const b = await db.prepare('SELECT * FROM bulk_approval_batches WHERE id = ?').bind(id).first<Record<string, string | number>>();
  if (!b) throw notFound('Approval batch');
  const items = await db.prepare(`SELECT i.question_id, i.state, i.ended_at, i.ended_by, i.ended_reason, SUBSTR(q.stem, 1, 140) AS stem, q.verification FROM bulk_approval_items i JOIN questions q ON q.id = i.question_id WHERE i.batch_id = ? AND i.state != 'ACTIVE' ORDER BY i.ended_at DESC LIMIT 500`).bind(id).all();
  return { batch: { ...b, scope: JSON.parse(String(b['scope_json'])), checks: JSON.parse(String(b['checks_json'])) }, endedItems: items.results };
}
