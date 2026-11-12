/**
 * Human syllabus review: the paper queue, the per-paper workspace (source PDF + extracted rows + checks),
 * corrections (edit, move, add, manual transcription), per-row decisions and paper sign-off.
 *
 * Rules enforced here (and tested):
 *  - Only a signed-in person with `content:review` can set VERIFIED. Imports and the admin token never can.
 *  - A person cannot verify a row they typed themselves (manual transcription needs a second reviewer).
 *  - Nothing is deleted: wrong rows are REJECTED with a reason. Every change keeps its before-values in
 *    review_records, and the source page reference stays on the row.
 *  - Any correction makes the row UNVERIFIED again and re-opens a signed-off paper.
 */
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { applyReview } from './review';

const KINDS = ['PART', 'SECTION', 'COURSE', 'UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC', 'ITEM', 'NOTE'] as const;
const MAX_DEPTH = 12;

export interface Reviewer {
  id: string;
  displayName: string;
  permissions: string[];
}
export const actorOf = (u: Reviewer) => `user:${u.id}`;
const need = (u: Reviewer, perm: string, what: string) => {
  if (!u.permissions.includes(perm)) throw new ApiError(403, 'FORBIDDEN', `Your account cannot ${what} (needs ${perm})`);
};

interface NodeRow {
  id: string;
  syllabus_version_id: string;
  parent_id: string | null;
  kind: string;
  label: string | null;
  title: string;
  body: string | null;
  position: number;
  depth: number;
  source_page: number | null;
  verification: string;
  authored_by: string | null;
  version_status: string;
  version_verification: string;
  page_count: number | null;
}

async function loadNode(db: D1Database, id: string): Promise<NodeRow> {
  const n = await db
    .prepare(
      `SELECT n.id, n.syllabus_version_id, n.parent_id, n.kind, n.label, n.title, n.body, n.position, n.depth, n.source_page, n.verification, n.authored_by,
         v.status AS version_status, v.verification AS version_verification, d.page_count
       FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id LEFT JOIN source_documents d ON d.id = v.source_document_id
       WHERE n.id = ?`,
    )
    .bind(id)
    .first<NodeRow>();
  if (!n) throw notFound('Syllabus row');
  if (n.version_status === 'PUBLISHED') throw conflict('This syllabus version is published; corrections go into a new version');
  return n;
}

const reviewRecord = (db: D1Database, entityType: string, entityId: string, action: string, from: string | null, to: string | null, actor: string, comment: string | null, detail: unknown, now: string) =>
  db
    .prepare(
      `INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(newId('rev'), entityType, entityId, action, from, to, actor, comment, detail === undefined ? null : JSON.stringify(detail), now);

/** A correction re-opens a signed-off (or approved) paper: it must be signed off again. */
function reopenVersion(db: D1Database, versionId: string, actor: string, now: string): D1PreparedStatement[] {
  return [
    db
      .prepare(`UPDATE syllabus_versions SET verification = 'UNVERIFIED', status = CASE WHEN status IN ('IN_REVIEW','APPROVED') THEN 'DRAFT' ELSE status END, updated_at = ?
                WHERE id = ? AND verification = 'VERIFIED' AND status != 'PUBLISHED'`)
      .bind(now, versionId),
    db
      .prepare(
        `INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at)
         SELECT ?, 'SYLLABUS_VERSION', ?, 'CHANGES_REQUESTED', 'VERIFIED', 'UNVERIFIED', ?, 'A row was corrected after sign-off; the paper must be signed off again', NULL, ? WHERE changes() = 1`,
      )
      .bind(newId('rev'), versionId, actor, now),
  ];
}

// ---------------------------------------------------------------- queue

export async function reviewQueue(db: D1Database, exam: string, year: number) {
  const { results } = await db
    .prepare(
      `WITH latest AS (
         SELECT sv.* FROM syllabus_versions sv
         WHERE sv.version_number = (SELECT MAX(x.version_number) FROM syllabus_versions x WHERE x.test_paper_id = sv.test_paper_id))
       SELECT tp.id, tp.code, tp.name, cat.name AS category,
         v.id AS version_id, v.version_number, v.status AS version_status, v.verification AS version_verification,
         j.status AS job_status, j.blocker_reason,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id) AS rows_total,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.verification = 'VERIFIED') AS rows_verified,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.verification = 'MACHINE_VERIFIED') AS rows_machine,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.verification = 'UNVERIFIED') AS rows_pending,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.verification = 'NEEDS_CHANGES') AS rows_flagged,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.verification = 'REJECTED') AS rows_rejected,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.extraction_flags LIKE '%heading_inferred%') AS rows_guessed,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND json_extract(n.check_json, '$.ok') = 0) AS rows_failing_check,
         (SELECT COUNT(*) FROM source_page_checks pc WHERE pc.source_document_id = v.source_document_id AND pc.status = 'CHECK') AS pages_to_check,
         (SELECT MAX(r.created_at) FROM review_records r JOIN curriculum_nodes n ON n.id = r.entity_id WHERE r.entity_type = 'CURRICULUM_NODE' AND n.syllabus_version_id = v.id) AS last_activity
       FROM test_papers tp
       JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id
       JOIN subjects s ON s.id = tp.subject_id LEFT JOIN subject_categories cat ON cat.id = s.category_id
       LEFT JOIN latest v ON v.test_paper_id = tp.id
       LEFT JOIN extraction_jobs j ON j.test_paper_id = tp.id
       WHERE e.code = ? AND ec.year = ?
       ORDER BY tp.code`,
    )
    .bind(exam, year)
    .all<Record<string, string | number | null>>();
  return results.map((r) => {
    const total = Number(r.rows_total ?? 0);
    const state = !r.version_id
      ? 'NOT_IMPORTED'
      : r.version_verification === 'VERIFIED'
        ? 'HUMAN_VERIFIED'
        : r.job_status === 'BLOCKED' && Number(r.rows_total) === 0
          ? 'NEEDS_TRANSCRIPTION'
          : r.job_status === 'BLOCKED'
            ? 'TRANSCRIPTION_IN_REVIEW'
            : r.version_verification === 'MACHINE_VERIFIED'
              ? 'MACHINE_VERIFIED'
              : 'NEEDS_REVIEW';
    return {
      paperId: r.id, code: r.code, name: r.name, category: r.category, state,
      versionId: r.version_id, versionNumber: r.version_number, versionStatus: r.version_status, versionVerification: r.version_verification,
      reason: r.blocker_reason,
      rows: {
        total, verified: Number(r.rows_verified), machine: Number(r.rows_machine), pending: Number(r.rows_pending),
        flagged: Number(r.rows_flagged), rejected: Number(r.rows_rejected), guessedHeadings: Number(r.rows_guessed), failingCheck: Number(r.rows_failing_check),
      },
      pagesToCheck: Number(r.pages_to_check ?? 0),
      lastActivity: r.last_activity,
    };
  });
}

// ---------------------------------------------------------------- workspace

export async function paperWorkspace(db: D1Database, paperId: string) {
  const paper = await db
    .prepare(
      `SELECT tp.id, tp.code, tp.name, e.code AS exam, ec.year, j.status AS job_status, j.blocker_reason, j.source_url
       FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id
       LEFT JOIN extraction_jobs j ON j.test_paper_id = tp.id WHERE tp.id = ?`,
    )
    .bind(paperId)
    .first<Record<string, string | number | null>>();
  if (!paper) throw notFound('Paper');
  const { results: versions } = await db
    .prepare(
      `SELECT v.id, v.version_number, v.status, v.verification, v.notes, v.created_at, d.id AS source_id, d.title AS source_title, d.url AS source_url,
         d.sha256 AS source_sha256, d.page_count, d.r2_key
       FROM syllabus_versions v LEFT JOIN source_documents d ON d.id = v.source_document_id WHERE v.test_paper_id = ? ORDER BY v.version_number DESC`,
    )
    .bind(paperId)
    .all<Record<string, string | number | null>>();
  const version = versions[0] ?? null;
  if (!version) return { paper, version: null, versions, nodes: [], pageChecks: [], people: {} };
  const [nodes, pageChecks] = await Promise.all([
    db
      .prepare(
        `SELECT n.id, n.parent_id, n.kind, n.label, n.title, n.body, n.position, n.depth, n.source_page, n.extraction_flags, n.check_json, n.verification,
           n.authored_by, n.edited_by, n.updated_at,
           (SELECT r.action || '|' || COALESCE(r.comment, '') || '|' || r.actor || '|' || r.created_at FROM review_records r
              WHERE r.entity_type = 'CURRICULUM_NODE' AND r.entity_id = n.id ORDER BY r.created_at DESC LIMIT 1) AS last_review,
           (SELECT COUNT(*) FROM review_records r WHERE r.entity_type = 'CURRICULUM_NODE' AND r.entity_id = n.id) AS review_count
         FROM curriculum_nodes n WHERE n.syllabus_version_id = ? ORDER BY n.depth, n.position`,
      )
      .bind(version.id)
      .all<Record<string, string | number | null>>(),
    version.source_id
      ? db.prepare('SELECT page, method, status, ocr_words, found_words, found_pct, missing_sample FROM source_page_checks WHERE source_document_id = ? ORDER BY page').bind(version.source_id).all()
      : Promise.resolve({ results: [] }),
  ]);
  const ids = new Set<string>();
  for (const n of nodes.results) {
    if (n.authored_by) ids.add(String(n.authored_by));
    if (n.edited_by) ids.add(String(n.edited_by));
    const actor = String(n.last_review ?? '').split('|')[2];
    if (actor?.startsWith('user:')) ids.add(actor.slice(5));
  }
  return { paper, version, versions, nodes: nodes.results, pageChecks: pageChecks.results, people: await peopleNames(db, [...ids]) };
}

async function peopleNames(db: D1Database, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    if (!chunk.length) continue;
    const { results } = await db.prepare(`SELECT id, display_name FROM users WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all<{ id: string; display_name: string }>();
    for (const r of results) out[r.id] = r.display_name;
  }
  return out;
}

export async function sourceFile(db: D1Database, bucket: R2Bucket, sourceId: string) {
  const d = await db.prepare('SELECT r2_key, mime_type FROM source_documents WHERE id = ?').bind(sourceId).first<{ r2_key: string | null; mime_type: string }>();
  if (!d?.r2_key) throw notFound('Source file');
  const obj = await bucket.get(d.r2_key);
  if (!obj) throw notFound('Source file in storage');
  return new Response(obj.body, { headers: { 'content-type': d.mime_type, 'cache-control': 'private, max-age=3600' } });
}

export async function history(db: D1Database, entityType: string, entityId: string) {
  const { results } = await db
    .prepare('SELECT id, action, from_status, to_status, actor, comment, checklist_json, created_at FROM review_records WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC, id DESC LIMIT 200')
    .bind(entityType, entityId)
    .all<{ actor: string } & Record<string, unknown>>();
  const people = await peopleNames(db, [...new Set(results.filter((r) => r.actor.startsWith('user:')).map((r) => r.actor.slice(5)))]);
  return results.map((r) => ({ ...r, actorName: r.actor.startsWith('user:') ? (people[r.actor.slice(5)] ?? r.actor) : r.actor }));
}

// ---------------------------------------------------------------- corrections

export const editSchema = z.object({
  kind: z.enum(KINDS).optional(),
  label: z.string().trim().max(40).nullable().optional(),
  title: z.string().trim().min(1).max(1000).optional(),
  body: z.string().max(20000).nullable().optional(),
  sourcePage: z.number().int().min(1).optional(),
  reason: z.string().trim().min(3).max(1000),
});

export async function editRow(db: D1Database, id: string, input: z.infer<typeof editSchema>, user: Reviewer) {
  need(user, 'curriculum:write', 'correct syllabus rows');
  const cur = await loadNode(db, id);
  if (input.sourcePage !== undefined && cur.page_count && input.sourcePage > cur.page_count) throw invalid(`The source document has ${cur.page_count} pages`);
  const next = {
    kind: input.kind ?? cur.kind,
    label: input.label === undefined ? cur.label : input.label || null,
    title: input.title ?? cur.title,
    body: input.body === undefined ? cur.body : input.body?.trim() ? input.body : null,
    sourcePage: input.sourcePage ?? cur.source_page,
  };
  const before = { kind: cur.kind, label: cur.label, title: cur.title, body: cur.body, sourcePage: cur.source_page };
  const changed = (Object.keys(before) as (keyof typeof before)[]).filter((k) => before[k] !== next[k]);
  if (!changed.length) return { id, changed: [], verification: cur.verification };
  const now = nowIso();
  const actor = actorOf(user);
  const hash = await sha256Hex(`edited:${id}:${next.kind}:${normaliseText(next.label)}:${normaliseText(next.title)}|${normaliseText(next.body)}`);
  const res = await db.batch([
    db
      .prepare(
        `UPDATE curriculum_nodes SET kind = ?, label = ?, title = ?, body = ?, source_page = ?, content_hash = ?, verification = 'UNVERIFIED', edited_by = ?,
           extraction_flags = CASE WHEN COALESCE(extraction_flags, '') LIKE '%manually_corrected%' THEN extraction_flags ELSE TRIM(COALESCE(extraction_flags, '') || ',manually_corrected', ',') END,
           updated_at = ? WHERE id = ? AND verification = ? AND title = ?`,
      )
      .bind(next.kind, next.label, next.title, next.body, next.sourcePage, hash, user.id, now, id, cur.verification, cur.title),
    db
      .prepare(
        `INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at)
         SELECT ?, 'CURRICULUM_NODE', ?, 'EDITED', ?, 'UNVERIFIED', ?, ?, ?, ? WHERE changes() = 1`,
      )
      .bind(newId('rev'), id, cur.verification, actor, input.reason, JSON.stringify({ before, after: next, changed }), now),
    ...reopenVersion(db, cur.syllabus_version_id, actor, now),
  ]);
  if ((res[0]!.meta.changes ?? 0) !== 1) throw new ApiError(409, 'CONCURRENT_CHANGE', 'This row changed while you were editing it; reload and try again');
  return { id, changed, verification: 'UNVERIFIED' };
}

export const moveSchema = z.object({
  direction: z.enum(['up', 'down', 'indent', 'outdent']),
  reason: z.string().trim().max(1000).optional(),
});

/** Moves a row within the hierarchy. Its whole subtree moves with it; depths are recomputed. */
export async function moveRow(db: D1Database, id: string, input: z.infer<typeof moveSchema>, user: Reviewer) {
  need(user, 'curriculum:write', 'change the syllabus hierarchy');
  const cur = await loadNode(db, id);
  const siblingsOf = async (parentId: string | null) =>
    (
      await db
        .prepare(`SELECT id, position, depth, parent_id FROM curriculum_nodes WHERE syllabus_version_id = ? AND parent_id IS ? ORDER BY position, id`)
        .bind(cur.syllabus_version_id, parentId)
        .all<{ id: string; position: number; depth: number; parent_id: string | null }>()
    ).results;
  const sibs = await siblingsOf(cur.parent_id);
  const idx = sibs.findIndex((s) => s.id === id);
  const now = nowIso();
  const actor = actorOf(user);
  const stmts: D1PreparedStatement[] = [];
  let newParent = cur.parent_id;
  let newPosition = cur.position;
  let depthDelta = 0;

  // Re-number siblings 0..n first, so swaps and inserts never collide on equal positions.
  const renumber = (list: { id: string }[]) => list.map((s, i) => db.prepare('UPDATE curriculum_nodes SET position = ? WHERE id = ?').bind(i, s.id));
  if (input.direction === 'up' || input.direction === 'down') {
    const j = input.direction === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= sibs.length) throw invalid(`This row is already the ${input.direction === 'up' ? 'first' : 'last'} under its heading`);
    const order = [...sibs];
    [order[idx], order[j]] = [order[j]!, order[idx]!];
    stmts.push(...renumber(order));
    newPosition = j;
  } else if (input.direction === 'indent') {
    if (idx <= 0) throw invalid('There is no row above at the same level to move this under');
    const newParentRow = sibs[idx - 1]!;
    const kids = await siblingsOf(newParentRow.id);
    newParent = newParentRow.id;
    newPosition = kids.length;
    depthDelta = 1;
    stmts.push(...renumber(kids), ...renumber(sibs.filter((s) => s.id !== id)));
  } else {
    if (!cur.parent_id) throw invalid('This row is already at the top level');
    const parent = await db.prepare('SELECT id, parent_id FROM curriculum_nodes WHERE id = ?').bind(cur.parent_id).first<{ id: string; parent_id: string | null }>();
    const outer = await siblingsOf(parent!.parent_id);
    const at = outer.findIndex((s) => s.id === parent!.id);
    const order = [...outer.slice(0, at + 1), { id }, ...outer.slice(at + 1)];
    newParent = parent!.parent_id;
    newPosition = at + 1;
    depthDelta = -1;
    stmts.push(...renumber(order), ...renumber(sibs.filter((s) => s.id !== id)));
  }
  if (depthDelta) {
    const deepest = await db
      .prepare(`WITH RECURSIVE sub(id, depth) AS (SELECT id, depth FROM curriculum_nodes WHERE id = ? UNION ALL SELECT n.id, n.depth FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id) SELECT MAX(depth) AS d FROM sub`)
      .bind(id)
      .first<{ d: number }>();
    if ((deepest?.d ?? 0) + depthDelta > MAX_DEPTH) throw invalid(`The hierarchy cannot be deeper than ${MAX_DEPTH} levels`);
    stmts.push(
      db
        .prepare(`UPDATE curriculum_nodes SET depth = depth + ? WHERE id IN (WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id) SELECT id FROM sub)`)
        .bind(depthDelta, id),
    );
  }
  const hash = await sha256Hex(`moved:${id}:${newParent ?? ''}:${now}`);
  stmts.push(
    db
      .prepare(`UPDATE curriculum_nodes SET parent_id = ?, position = ?, content_hash = ?, verification = 'UNVERIFIED', edited_by = ?, updated_at = ? WHERE id = ?`)
      .bind(newParent, newPosition, hash, user.id, now, id),
    reviewRecord(db, 'CURRICULUM_NODE', id, 'EDITED', cur.verification, 'UNVERIFIED', actor, input.reason || `Moved ${input.direction}`, {
      move: input.direction, before: { parentId: cur.parent_id, position: cur.position, depth: cur.depth }, after: { parentId: newParent, position: newPosition, depth: cur.depth + depthDelta },
    }, now),
    ...reopenVersion(db, cur.syllabus_version_id, actor, now),
  );
  await db.batch(stmts);
  return { id, parentId: newParent, position: newPosition, depth: cur.depth + depthDelta, verification: 'UNVERIFIED' };
}

const newRowSchema = z.object({
  ref: z.string().min(1).max(40),
  parentRef: z.string().max(40).nullable(),
  kind: z.enum(KINDS),
  label: z.string().trim().max(40).nullable(),
  title: z.string().trim().min(1).max(1000),
  body: z.string().max(20000).nullable(),
});
export const addRowsSchema = z.object({
  /** Existing row the new top-level rows go under (null = top level). */
  parentId: z.string().max(100).nullable(),
  /** Existing sibling to insert after; omitted = at the end. */
  afterId: z.string().max(100).optional(),
  page: z.number().int().min(1),
  /** True when a person is typing the syllabus from the page image (no machine extraction exists). */
  transcription: z.boolean().default(false),
  reason: z.string().trim().min(3).max(1000),
  rows: z.array(newRowSchema).min(1).max(300),
});

export async function addRows(db: D1Database, versionId: string, input: z.infer<typeof addRowsSchema>, user: Reviewer) {
  need(user, 'curriculum:write', 'add syllabus rows');
  const v = await db
    .prepare('SELECT v.id, v.status, d.page_count FROM syllabus_versions v LEFT JOIN source_documents d ON d.id = v.source_document_id WHERE v.id = ?')
    .bind(versionId)
    .first<{ id: string; status: string; page_count: number | null }>();
  if (!v) throw notFound('Syllabus version');
  if (v.status === 'PUBLISHED') throw conflict('This syllabus version is published; corrections go into a new version');
  if (v.page_count && input.page > v.page_count) throw invalid(`The source document has ${v.page_count} pages`);
  let parentDepth = 0;
  if (input.parentId) {
    const p = await db.prepare('SELECT depth FROM curriculum_nodes WHERE id = ? AND syllabus_version_id = ?').bind(input.parentId, versionId).first<{ depth: number }>();
    if (!p) throw invalid('The parent row is not in this syllabus version');
    parentDepth = p.depth;
  }
  const siblings = (
    await db.prepare('SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND parent_id IS ? ORDER BY position, id').bind(versionId, input.parentId).all<{ id: string }>()
  ).results;
  let insertAt = siblings.length;
  if (input.afterId) {
    const i = siblings.findIndex((s) => s.id === input.afterId);
    if (i < 0) throw invalid('The row to insert after is not under the same heading');
    insertAt = i + 1;
  }

  const now = nowIso();
  const actor = actorOf(user);
  const flag = input.transcription ? 'manual_transcription' : 'manually_added';
  const idByRef = new Map<string, { id: string; depth: number; children: number }>();
  const top: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (const r of input.rows) {
    if (idByRef.has(r.ref)) throw invalid(`Duplicate ref ${r.ref}`);
    const parent = r.parentRef === null ? null : idByRef.get(r.parentRef);
    if (r.parentRef !== null && !parent) throw invalid(`Row ${r.ref} points at ${r.parentRef}, which is missing or comes later`);
    const depth = parent ? parent.depth + 1 : parentDepth + 1;
    if (depth > MAX_DEPTH) throw invalid(`The hierarchy cannot be deeper than ${MAX_DEPTH} levels`);
    const id = newId('cn');
    const position = parent ? parent.children++ : insertAt + top.length;
    if (!parent) top.push(id);
    idByRef.set(r.ref, { id, depth, children: 0 });
    const hash = await sha256Hex(`${flag}:${id}`);
    stmts.push(
      db
        .prepare(
          `INSERT INTO curriculum_nodes (id, syllabus_version_id, parent_id, kind, label, title, body, position, depth, source_page, extraction_flags, content_hash,
             verification, authored_by, edited_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNVERIFIED', ?, ?, ?, ?)`,
        )
        .bind(id, versionId, parent ? parent.id : input.parentId, r.kind, r.label || null, r.title, r.body?.trim() ? r.body : null, position, depth, input.page, flag, hash, user.id, user.id, now, now),
      reviewRecord(db, 'CURRICULUM_NODE', id, 'SUBMITTED', null, 'UNVERIFIED', actor, input.reason, { added: true, transcription: input.transcription, page: input.page }, now),
    );
  }
  // Make room among the existing siblings.
  const shifted = siblings.slice(insertAt);
  shifted.forEach((s, i) => stmts.push(db.prepare('UPDATE curriculum_nodes SET position = ? WHERE id = ?').bind(insertAt + top.length + i, s.id)));
  siblings.slice(0, insertAt).forEach((s, i) => stmts.push(db.prepare('UPDATE curriculum_nodes SET position = ? WHERE id = ?').bind(i, s.id)));
  stmts.push(
    db
      .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), actor, input.transcription ? 'SYLLABUS_TRANSCRIBED' : 'SYLLABUS_ROWS_ADDED', 'SYLLABUS_VERSION', versionId, JSON.stringify({ rows: input.rows.length, page: input.page }), now),
    ...reopenVersion(db, versionId, actor, now),
  );
  await db.batch(stmts);
  return { created: input.rows.map((r) => ({ ref: r.ref, id: idByRef.get(r.ref)!.id })) };
}

// ---------------------------------------------------------------- decisions

export const decideSchema = z.object({
  entityType: z.enum(['CURRICULUM_NODE', 'QUESTION', 'LEARNING_RESOURCE', 'MEDIA_ASSET']),
  entityIds: z.array(z.string().min(1).max(100)).min(1).max(200),
  action: z.enum(['VERIFIED', 'CHANGES_REQUESTED', 'REJECTED']),
  comment: z.string().trim().max(4000).optional(),
  /** What the reviewer confirmed, e.g. { matchesSourcePage: true }. Required for VERIFIED. */
  checklist: z.record(z.string(), z.boolean()).optional(),
});

const TABLE: Record<z.infer<typeof decideSchema>['entityType'], string> = {
  CURRICULUM_NODE: 'curriculum_nodes', QUESTION: 'questions', LEARNING_RESOURCE: 'learning_resources', MEDIA_ASSET: 'media_assets',
};

/** A person's decision on rows or content items. This is the only way anything becomes VERIFIED. */
export async function decide(db: D1Database, input: z.infer<typeof decideSchema>, user: Reviewer) {
  need(user, 'content:review', 'verify, flag or reject content');
  if (input.action === 'VERIFIED' && !Object.values(input.checklist ?? {}).some(Boolean)) {
    throw invalid('Confirm what you checked (for example, that the row matches the source page) before verifying');
  }
  const ids = [...new Set(input.entityIds)];
  const ph = ids.map(() => '?').join(',');
  const authorCol = input.entityType === 'CURRICULUM_NODE' ? 'authored_by' : 'NULL';
  const { results } = await db
    .prepare(`SELECT id, verification, ${authorCol} AS authored_by FROM ${TABLE[input.entityType]} WHERE id IN (${ph})`)
    .bind(...ids)
    .all<{ id: string; verification: string; authored_by: string | null }>();
  if (results.length !== ids.length) throw notFound(`${ids.length - results.length} of the records`);
  const target = { VERIFIED: 'VERIFIED', CHANGES_REQUESTED: 'NEEDS_CHANGES', REJECTED: 'REJECTED' }[input.action];
  if (input.action === 'VERIFIED') {
    const own = results.filter((r) => r.authored_by === user.id);
    if (own.length) throw new ApiError(403, 'SECOND_REVIEWER_REQUIRED', `You typed ${own.length} of these row(s) yourself; another reviewer must verify them`, own.map((r) => r.id));
  }
  const todo = results.filter((r) => r.verification !== target).map((r) => r.id);
  if (!todo.length) return { applied: 0, changes: [], skipped: ids.length };
  const out = await applyReview(db, { entityType: input.entityType, entityIds: todo, action: input.action, comment: input.comment, checklist: input.checklist }, actorOf(user));
  if (input.entityType === 'CURRICULUM_NODE' && input.action !== 'VERIFIED') {
    const versions = await db.prepare(`SELECT DISTINCT syllabus_version_id AS v FROM curriculum_nodes WHERE id IN (${ph})`).bind(...ids).all<{ v: string }>();
    const now = nowIso();
    await db.batch(versions.results.flatMap((r) => reopenVersion(db, r.v, actorOf(user), now)));
  }
  return { ...out, skipped: ids.length - todo.length };
}

export const signOffSchema = z.object({
  comment: z.string().trim().max(4000).optional(),
  checklist: z.record(z.string(), z.boolean()),
});

/** Paper sign-off: every row has been decided by a person (VERIFIED or REJECTED). */
export async function signOff(db: D1Database, versionId: string, input: z.infer<typeof signOffSchema>, user: Reviewer) {
  need(user, 'content:review', 'sign off a syllabus');
  if (!Object.values(input.checklist).every(Boolean) || !Object.keys(input.checklist).length) throw invalid('Every item on the sign-off checklist must be confirmed');
  const counts = await db
    .prepare(`SELECT COUNT(*) AS total, SUM(verification = 'VERIFIED') AS verified, SUM(verification NOT IN ('VERIFIED','REJECTED')) AS open FROM curriculum_nodes WHERE syllabus_version_id = ?`)
    .bind(versionId)
    .first<{ total: number; verified: number | null; open: number | null }>();
  if (!counts?.total) throw conflict('This version has no rows to sign off');
  if (counts.open) throw conflict(`${counts.open} row(s) still need a decision (verify or reject each one)`);
  if (!counts.verified) throw conflict('At least one row must be verified');
  return applyReview(db, { entityType: 'SYLLABUS_VERSION', entityIds: [versionId], action: 'VERIFIED', comment: input.comment, checklist: input.checklist }, actorOf(user));
}
