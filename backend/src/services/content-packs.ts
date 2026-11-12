/**
 * Upserts for authored content packs (lessons, questions, diagrams), keyed by a stable external key.
 *  - New key: created as DRAFT / UNVERIFIED.
 *  - Same key, same content: nothing written (UNCHANGED).
 *  - Same key, changed content, not yet reviewed: updated, and sent back to DRAFT / UNVERIFIED.
 *  - Same key, but a person has already verified/approved/published it: kept as is (KEPT_REVIEWED). A pack
 *    never silently overwrites reviewed content; the reviewer edits it in the review tools instead.
 */
import { z } from 'zod';
import { invalid } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { insertRows, nowIso } from '../lib/sql';
import { createQuestion, questionInputSchema, updateQuestion } from './questions';
import { createResource, resourceInputSchema, updateResource } from './resources';

const keySchema = z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,150}$/, 'Keys are lowercase letters, digits, . _ : -');
type Outcome = 'CREATED' | 'UNCHANGED' | 'UPDATED' | 'KEPT_REVIEWED';
const reviewed = (r: { status: string; verification: string }) => r.verification === 'VERIFIED' || ['APPROVED', 'PUBLISHED'].includes(r.status);

export async function upsertResource(db: D1Database, key: string, body: unknown, actor: string) {
  keySchema.parse(key);
  const input = resourceInputSchema.parse(body);
  const cur = await db.prepare('SELECT id, status, verification, content_hash FROM learning_resources WHERE external_key = ?').bind(key).first<{ id: string; status: string; verification: string; content_hash: string }>();
  const hash = await sha256Hex([input.type, input.language, normaliseText(input.title), input.curriculumNodeId ?? '', ...input.blocks.map((b) => `${b.type}:${normaliseText(b.body)}`)].join('|'));
  if (!cur) {
    const { id } = await createResource(db, input, actor);
    await db.prepare('UPDATE learning_resources SET external_key = ? WHERE id = ?').bind(key, id).run();
    return { id, outcome: 'CREATED' as Outcome };
  }
  if (cur.content_hash === hash) return { id: cur.id, outcome: 'UNCHANGED' as Outcome };
  if (reviewed(cur)) return { id: cur.id, outcome: 'KEPT_REVIEWED' as Outcome };
  await updateResource(db, cur.id, input, actor);
  return { id: cur.id, outcome: 'UPDATED' as Outcome };
}

/** Canonical form of everything a question pack item controls, read back from D1 for comparison. */
async function storedQuestion(db: D1Database, id: string) {
  const [q, opts, key, exp, topics] = await Promise.all([
    db.prepare('SELECT type, stem, difficulty, structure_json, learning_objective FROM questions WHERE id = ?').bind(id).first<Record<string, string | null>>(),
    db.prepare('SELECT label, text, media_asset_id FROM question_options WHERE question_id = ? ORDER BY position').bind(id).all<{ label: string; text: string; media_asset_id: string | null }>(),
    db.prepare('SELECT correct_option_positions, numeric_answer, numeric_tolerance FROM answer_keys WHERE question_id = ?').bind(id).first<{ correct_option_positions: string | null; numeric_answer: number | null; numeric_tolerance: number | null }>(),
    db.prepare('SELECT body, option_rationale_json FROM explanations WHERE question_id = ? ORDER BY created_at LIMIT 1').bind(id).first<{ body: string; option_rationale_json: string | null }>(),
    db.prepare('SELECT curriculum_node_id FROM question_topics WHERE question_id = ? ORDER BY is_primary DESC, curriculum_node_id').bind(id).all<{ curriculum_node_id: string }>(),
  ]);
  return JSON.stringify([
    q?.type, q?.stem, q?.difficulty, q?.structure_json ?? null, q?.learning_objective ?? null,
    opts.results.map((o) => [o.label, o.text, o.media_asset_id ?? null]),
    key?.correct_option_positions ? (JSON.parse(key.correct_option_positions) as number[]) : null, key?.numeric_answer ?? null, key?.numeric_tolerance ?? null,
    exp?.body ?? null, exp?.option_rationale_json ? (JSON.parse(exp.option_rationale_json) as unknown) : null,
    topics.results.map((t) => t.curriculum_node_id),
  ]);
}

export async function upsertQuestion(db: D1Database, key: string, body: unknown, actor: string) {
  keySchema.parse(key);
  const input = questionInputSchema.parse(body);
  const cur = await db.prepare('SELECT id, status, verification FROM questions WHERE external_key = ?').bind(key).first<{ id: string; status: string; verification: string }>();
  if (!cur) {
    const { id } = await createQuestion(db, input, actor);
    await db.prepare('UPDATE questions SET external_key = ? WHERE id = ?').bind(key, id).run();
    return { id, outcome: 'CREATED' as Outcome };
  }
  const topics = [...new Set(input.topicNodeIds)];
  const wanted = JSON.stringify([
    input.type, input.stem, input.difficulty, input.structureJson ?? null, input.learningObjective ?? null,
    input.options.map((o) => [o.label, o.text, o.mediaAssetId ?? null]),
    input.type === 'NUMERICAL' ? null : (input.answer.correctOptionPositions ?? []), input.answer.numericAnswer ?? null, input.answer.numericTolerance ?? null,
    input.explanation.body, input.explanation.optionRationale ?? null,
    [topics[0], ...topics.slice(1).sort()].filter(Boolean),
  ]);
  if ((await storedQuestion(db, cur.id)) === wanted) return { id: cur.id, outcome: 'UNCHANGED' as Outcome };
  if (reviewed(cur)) return { id: cur.id, outcome: 'KEPT_REVIEWED' as Outcome };
  await updateQuestion(db, cur.id, input, actor);
  return { id: cur.id, outcome: 'UPDATED' as Outcome };
}

export const mediaInputSchema = z.object({
  kind: z.enum(['DIAGRAM', 'IMAGE']),
  r2Key: z.string().regex(/^media\/[0-9a-f]{64}\.(svg|png|jpg|webp)$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  mimeType: z.enum(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp']),
  byteSize: z.number().int().positive().max(5_000_000),
  width: z.number().int().positive().max(10000).nullable(),
  height: z.number().int().positive().max(10000).nullable(),
  altText: z.string().trim().min(10).max(1000),
  caption: z.string().trim().max(1000).nullable(),
  longDescription: z.string().trim().max(10000).nullable(),
  curriculumNodeId: z.string().max(100).nullable(),
  origin: z.enum(['AUTHORED', 'AI_ASSISTED', 'LICENSED']),
  usagePermissionId: z.string().max(100),
  attribution: z.string().max(500).nullable(),
});

export async function upsertMedia(db: D1Database, bucket: R2Bucket, key: string, body: unknown, actor: string) {
  keySchema.parse(key);
  const m = mediaInputSchema.parse(body);
  if (!(await bucket.head(m.r2Key))) throw invalid('Upload the file first (PUT /api/admin/files/media)');
  if (m.curriculumNodeId && !(await db.prepare('SELECT 1 FROM curriculum_nodes WHERE id = ?').bind(m.curriculumNodeId).first())) throw invalid('Topic not found');
  const cur = await db.prepare('SELECT id, status, verification, sha256, alt_text, caption, long_description FROM media_assets WHERE external_key = ?').bind(key).first<{
    id: string; status: string; verification: string; sha256: string | null; alt_text: string; caption: string | null; long_description: string | null;
  }>();
  const now = nowIso();
  if (!cur) {
    // The same file may already be stored under another key (identical diagram): reuse that record.
    const same = await db.prepare('SELECT id FROM media_assets WHERE sha256 = ?').bind(m.sha256).first<{ id: string }>();
    if (same) return { id: same.id, outcome: 'UNCHANGED' as Outcome };
    const id = newId('med');
    await db.batch([
      ...insertRows(db, 'media_assets', [{
        id, kind: m.kind, r2_key: m.r2Key, external_url: null, mime_type: m.mimeType, byte_size: m.byteSize, sha256: m.sha256, width: m.width, height: m.height,
        duration_seconds: null, alt_text: m.altText, caption: m.caption, long_description: m.longDescription, language: 'en', attribution: m.attribution,
        usage_permission_id: m.usagePermissionId, source_document_id: null, source_page: null, curriculum_node_id: m.curriculumNodeId, origin: m.origin,
        external_key: key, status: 'DRAFT', verification: 'UNVERIFIED', created_at: now, updated_at: now,
      }]),
      db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'CREATE_MEDIA', 'MEDIA_ASSET', id, now),
    ]);
    return { id, outcome: 'CREATED' as Outcome };
  }
  if (cur.sha256 === m.sha256 && cur.alt_text === m.altText && cur.caption === m.caption && cur.long_description === m.longDescription) return { id: cur.id, outcome: 'UNCHANGED' as Outcome };
  if (reviewed(cur)) return { id: cur.id, outcome: 'KEPT_REVIEWED' as Outcome };
  await db.batch([
    db
      .prepare(`UPDATE media_assets SET r2_key = ?, mime_type = ?, byte_size = ?, sha256 = ?, width = ?, height = ?, alt_text = ?, caption = ?, long_description = ?,
        curriculum_node_id = ?, status = 'DRAFT', verification = 'UNVERIFIED', updated_at = ? WHERE id = ?`)
      .bind(m.r2Key, m.mimeType, m.byteSize, m.sha256, m.width, m.height, m.altText, m.caption, m.longDescription, m.curriculumNodeId, now, cur.id),
    db.prepare(`INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, created_at) VALUES (?, 'MEDIA_ASSET', ?, 'EDITED', ?, 'DRAFT/UNVERIFIED', ?, 'Updated from content pack', ?)`)
      .bind(newId('rev'), cur.id, `${cur.status}/${cur.verification}`, actor, now),
  ]);
  return { id: cur.id, outcome: 'UPDATED' as Outcome };
}
