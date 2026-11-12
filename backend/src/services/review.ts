import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';

const ENTITIES = {
  CURRICULUM_NODE: { table: 'curriculum_nodes', hasStatus: false },
  SYLLABUS_VERSION: { table: 'syllabus_versions', hasStatus: true },
  SOURCE_DOCUMENT: { table: 'source_documents', hasStatus: false },
  LEARNING_RESOURCE: { table: 'learning_resources', hasStatus: true },
  MEDIA_ASSET: { table: 'media_assets', hasStatus: true },
  PASSAGE: { table: 'passages', hasStatus: true },
  QUESTION: { table: 'questions', hasStatus: true },
} as const;
type EntityType = keyof typeof ENTITIES;

export const reviewSchema = z.object({
  entityType: z.enum(Object.keys(ENTITIES) as [EntityType, ...EntityType[]]),
  entityIds: z.array(z.string().min(1).max(100)).min(1).max(200),
  action: z.enum(['VERIFIED', 'CHANGES_REQUESTED', 'REJECTED', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED']),
  comment: z.string().max(4000).optional(),
  checklist: z.record(z.string(), z.boolean()).optional(),
});
type ReviewInput = z.infer<typeof reviewSchema>;

interface Current {
  id: string;
  status?: string;
  verification: string;
  is_demonstration?: number;
  public_display?: number;
}

/** Where an action moves a record. `null` means the field is not changed by this action. */
function target(action: ReviewInput['action'], cur: Current, hasStatus: boolean): { status: string | null; verification: string | null } {
  switch (action) {
    case 'VERIFIED':
      return { status: null, verification: 'VERIFIED' };
    case 'CHANGES_REQUESTED':
      return { status: hasStatus && cur.status === 'IN_REVIEW' ? 'DRAFT' : null, verification: 'NEEDS_CHANGES' };
    case 'REJECTED':
      return { status: hasStatus && cur.status !== 'PUBLISHED' ? 'DRAFT' : null, verification: 'REJECTED' };
    case 'SUBMITTED':
      if (cur.status !== 'DRAFT') throw conflict(`${cur.id}: only drafts can be submitted (status ${cur.status})`);
      return { status: 'IN_REVIEW', verification: null };
    case 'APPROVED':
      if (cur.status !== 'IN_REVIEW') throw conflict(`${cur.id}: only items in review can be approved (status ${cur.status})`);
      if (cur.verification !== 'VERIFIED') throw conflict(`${cur.id}: verify the content before approving it`);
      return { status: 'APPROVED', verification: null };
    case 'PUBLISHED':
      if (cur.status !== 'APPROVED') throw conflict(`${cur.id}: only approved items can be published (status ${cur.status})`);
      if (cur.is_demonstration) throw conflict(`${cur.id}: demonstration records can never be published`);
      if (cur.public_display === 0) throw conflict(`${cur.id}: its usage permission does not allow showing it to students`);
      return { status: 'PUBLISHED', verification: null };
    case 'UNPUBLISHED':
      if (cur.status !== 'PUBLISHED') throw conflict(`${cur.id}: not published`);
      return { status: 'APPROVED', verification: null };
    case 'ARCHIVED':
      return { status: 'ARCHIVED', verification: null };
  }
}

export async function applyReview(db: D1Database, input: ReviewInput, actor: string) {
  const cfg = ENTITIES[input.entityType];
  // VERIFIED means a person checked it. Scripts, imports and the shared admin token can never set it.
  if (input.action === 'VERIFIED' && !actor.startsWith('user:')) {
    throw new ApiError(403, 'HUMAN_REVIEW_REQUIRED', 'Only a signed-in reviewer can mark content VERIFIED (use the reviewer screen)');
  }
  const statusActions = ['SUBMITTED', 'APPROVED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'];
  if (!cfg.hasStatus && statusActions.includes(input.action)) {
    throw invalid(`${input.entityType} has no publishing status; publish its syllabus version instead`);
  }
  if ((input.action === 'CHANGES_REQUESTED' || input.action === 'REJECTED') && !input.comment?.trim()) {
    throw invalid('Say what is wrong: a comment is required when requesting changes or rejecting');
  }
  const ids = [...new Set(input.entityIds)];
  const placeholders = ids.map(() => '?').join(',');
  const extra =
    input.entityType === 'SYLLABUS_VERSION'
      ? ', t.is_demonstration, NULL AS public_display'
      : ['LEARNING_RESOURCE', 'QUESTION'].includes(input.entityType)
        ? ', t.is_demonstration, p.public_display'
        : ['MEDIA_ASSET', 'PASSAGE'].includes(input.entityType)
          ? ', 0 AS is_demonstration, p.public_display'
          : '';
  const join = ['LEARNING_RESOURCE', 'QUESTION', 'MEDIA_ASSET', 'PASSAGE'].includes(input.entityType)
    ? 'LEFT JOIN usage_permissions p ON p.id = t.usage_permission_id'
    : '';
  const { results } = await db
    .prepare(`SELECT t.id, ${cfg.hasStatus ? 't.status,' : ''} t.verification ${extra} FROM ${cfg.table} t ${join} WHERE t.id IN (${placeholders})`)
    .bind(...ids)
    .all<Current>();
  if (results.length !== ids.length) throw notFound(`${ids.length - results.length} of the ${input.entityType} records`);

  // Extra gates before verification and approval.
  if ((input.action === 'APPROVED' || input.action === 'VERIFIED') && input.entityType === 'SYLLABUS_VERSION') {
    const pending = await db
      .prepare(`SELECT syllabus_version_id, COUNT(*) AS n FROM curriculum_nodes WHERE syllabus_version_id IN (${placeholders}) AND verification IN ('UNVERIFIED','NEEDS_CHANGES') GROUP BY syllabus_version_id`)
      .bind(...ids)
      .all<{ syllabus_version_id: string; n: number }>();
    if (pending.results.length) throw conflict('Every syllabus row must be verified (or rejected) before the version is approved', pending.results);
  }
  if (input.action === 'APPROVED' && input.entityType === 'QUESTION') {
    const missing = await db
      .prepare(`SELECT q.id FROM questions q WHERE q.id IN (${placeholders}) AND (NOT EXISTS (SELECT 1 FROM answer_keys a WHERE a.question_id = q.id) OR NOT EXISTS (SELECT 1 FROM explanations e WHERE e.question_id = q.id))`)
      .bind(...ids)
      .all<{ id: string }>();
    if (missing.results.length) throw conflict('Questions need an answer key and an explanation before approval', missing.results.map((r) => r.id));
  }

  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  const changes: { id: string; from: string; to: string }[] = [];
  for (const cur of results) {
    const t = target(input.action, cur, cfg.hasStatus);
    const sets: string[] = [];
    const vals: (string | null)[] = [];
    if (t.status) sets.push('status = ?'), vals.push(t.status);
    if (t.verification) sets.push('verification = ?'), vals.push(t.verification);
    if (input.entityType === 'SYLLABUS_VERSION' && t.status === 'PUBLISHED') sets.push('published_at = ?'), vals.push(now);
    sets.push('updated_at = ?'), vals.push(now);
    const guard = cfg.hasStatus ? 'AND status = ? AND verification = ?' : 'AND verification = ?';
    const guardVals = cfg.hasStatus ? [cur.status!, cur.verification] : [cur.verification];
    const from = `${cfg.hasStatus ? cur.status + '/' : ''}${cur.verification}`;
    const to = `${cfg.hasStatus ? (t.status ?? cur.status) + '/' : ''}${t.verification ?? cur.verification}`;
    statements.push(db.prepare(`UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE id = ? ${guard}`).bind(...vals, cur.id, ...guardVals));
    // Written only if the guarded update changed the row (no concurrent edit in between).
    statements.push(
      db
        .prepare(
          `INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`,
        )
        .bind(newId('rev'), input.entityType, cur.id, input.action, from, to, actor, input.comment ?? null, input.checklist ? JSON.stringify(input.checklist) : null, now),
    );
    changes.push({ id: cur.id, from, to });
  }
  statements.push(
    db
      .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), actor, `REVIEW_${input.action}`, input.entityType, ids.length === 1 ? ids[0]! : null, JSON.stringify({ count: ids.length }), now),
  );
  const out = await db.batch(statements);
  const applied = out.filter((_, i) => i % 2 === 0 && i < ids.length * 2).filter((r) => (r.meta.changes ?? 0) > 0).length;
  if (applied !== ids.length) throw new ApiError(409, 'CONCURRENT_CHANGE', `${ids.length - applied} record(s) changed while being reviewed; reload and try again`);
  return { applied, changes };
}

export async function reviewHistory(db: D1Database, entityType: string, entityId: string) {
  const { results } = await db
    .prepare('SELECT id, action, from_status, to_status, actor, comment, checklist_json, created_at FROM review_records WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(entityType, entityId)
    .all();
  return results;
}
