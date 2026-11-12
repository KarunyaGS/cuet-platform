import { z } from 'zod';
import type { PrismaClient } from '@cuet/database';
import { conflict, invalid, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { insertRows, nowIso } from '../lib/sql';

const BLOCK_TYPES = ['HEADING', 'SOLVED_PROBLEM', 'TEXT', 'OFFICIAL_TEXT', 'DEFINITION', 'CONCEPT', 'IMPORTANT_FACT', 'KEY_POINT', 'EXAMPLE', 'FORMULA', 'TABLE', 'DIAGRAM', 'IMAGE', 'VIDEO', 'CALLOUT'] as const;

export const resourceInputSchema = z
  .object({
    curriculumNodeId: z.string().max(100).nullable().optional(),
    testPaperId: z.string().max(100).nullable().optional(),
    type: z.enum(['LESSON', 'NOTE', 'READING', 'VIDEO']),
    title: z.string().min(2).max(300),
    language: z.string().min(2).max(10).default('en'),
    origin: z.enum(['OFFICIAL_SOURCE', 'OFFICIAL_SAMPLE', 'AUTHORED', 'LICENSED', 'PAST_PAPER', 'AI_ASSISTED', 'DEMONSTRATION']),
    usagePermissionId: z.string().max(100),
    isDemonstration: z.boolean().default(false),
    blocks: z
      .array(z.object({ type: z.enum(BLOCK_TYPES), body: z.string().max(50000), mediaAssetId: z.string().max(100).nullable().optional() }))
      .min(1)
      .max(200),
  })
  .superRefine((r, ctx) => {
    if (!r.curriculumNodeId && !r.testPaperId) ctx.addIssue({ code: 'custom', message: 'Link the resource to a topic or a paper' });
    if (r.isDemonstration !== (r.origin === 'DEMONSTRATION')) ctx.addIssue({ code: 'custom', message: 'Demonstration records must use origin DEMONSTRATION, and only they may' });
    if (r.isDemonstration && r.usagePermissionId !== 'perm_demo') ctx.addIssue({ code: 'custom', message: 'Demonstration records must use the DEMONSTRATION_ONLY permission' });
    for (const b of r.blocks) {
      if ((b.type === 'DIAGRAM' || b.type === 'IMAGE' || b.type === 'VIDEO') && !b.mediaAssetId && !/^https:\/\//.test(b.body)) {
        ctx.addIssue({ code: 'custom', message: `${b.type} blocks need a media asset or an https URL` });
      }
      if (b.type === 'TABLE') {
        try {
          // Either [[header...], [row...]] or { caption?, columns: [...], rows: [[...]] } with equal-width rows.
          const t = JSON.parse(b.body) as unknown;
          const ok = Array.isArray(t)
            ? t.every(Array.isArray)
            : typeof t === 'object' && t !== null && Array.isArray((t as { columns?: unknown }).columns) && Array.isArray((t as { rows?: unknown }).rows) &&
              (t as { rows: unknown[] }).rows.every((r) => Array.isArray(r) && r.length === (t as { columns: unknown[] }).columns.length);
          if (!ok) throw new Error();
        } catch {
          ctx.addIssue({ code: 'custom', message: 'TABLE blocks must be JSON: an array of rows, or { columns, rows } with every row as wide as the columns' });
        }
      }
    }
  });
export type ResourceInput = z.infer<typeof resourceInputSchema>;

const hashOf = (r: ResourceInput) => sha256Hex([r.type, r.language, normaliseText(r.title), r.curriculumNodeId ?? '', ...r.blocks.map((b) => `${b.type}:${normaliseText(b.body)}`)].join('|'));

async function checkLinks(db: D1Database, r: ResourceInput) {
  if (r.curriculumNodeId && !(await db.prepare('SELECT 1 FROM curriculum_nodes WHERE id = ?').bind(r.curriculumNodeId).first())) throw invalid('Topic not found');
  if (r.testPaperId && !(await db.prepare('SELECT 1 FROM test_papers WHERE id = ?').bind(r.testPaperId).first())) throw invalid('Paper not found');
  const media = r.blocks.map((b) => b.mediaAssetId).filter((m): m is string => Boolean(m));
  if (media.length) {
    const { results } = await db.prepare(`SELECT id FROM media_assets WHERE id IN (${media.map(() => '?').join(',')})`).bind(...media).all();
    if (results.length !== new Set(media).size) throw invalid('A media asset does not exist');
  }
}

const blockRows = (resourceId: string, r: ResourceInput, now: string) =>
  r.blocks.map((b, i) => ({ id: newId('blk'), resource_id: resourceId, position: i + 1, type: b.type, body: b.body, media_asset_id: b.mediaAssetId ?? null, created_at: now, updated_at: now }));

export async function createResource(db: D1Database, r: ResourceInput, actor: string) {
  await checkLinks(db, r);
  const hash = await hashOf(r);
  const dup = await db.prepare('SELECT id FROM learning_resources WHERE content_hash = ?').bind(hash).first<{ id: string }>();
  if (dup) throw conflict('An identical learning resource already exists', { existingId: dup.id });
  const id = newId('res');
  const now = nowIso();
  await db.batch([
    ...insertRows(db, 'learning_resources', [{
      id, curriculum_node_id: r.curriculumNodeId ?? null, test_paper_id: r.testPaperId ?? null, type: r.type, title: r.title, language: r.language,
      origin: r.origin, usage_permission_id: r.usagePermissionId, status: 'DRAFT', verification: 'UNVERIFIED', is_demonstration: r.isDemonstration,
      content_hash: hash, version: 1, created_at: now, updated_at: now,
    }]),
    ...insertRows(db, 'content_blocks', blockRows(id, r, now)),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'CREATE_RESOURCE', 'LEARNING_RESOURCE', id, now),
  ]);
  return { id };
}

export async function updateResource(db: D1Database, id: string, r: ResourceInput, actor: string) {
  const cur = await db.prepare('SELECT status, version FROM learning_resources WHERE id = ?').bind(id).first<{ status: string; version: number }>();
  if (!cur) throw notFound('Learning resource');
  await checkLinks(db, r);
  const hash = await hashOf(r);
  const dup = await db.prepare('SELECT id FROM learning_resources WHERE content_hash = ? AND id != ?').bind(hash, id).first<{ id: string }>();
  if (dup) throw conflict('An identical learning resource already exists', { existingId: dup.id });
  const now = nowIso();
  await db.batch([
    db
      .prepare(`UPDATE learning_resources SET curriculum_node_id = ?, test_paper_id = ?, type = ?, title = ?, language = ?, origin = ?, usage_permission_id = ?,
        is_demonstration = ?, content_hash = ?, version = version + 1, status = 'DRAFT', verification = 'UNVERIFIED', updated_at = ? WHERE id = ? AND version = ?`)
      .bind(r.curriculumNodeId ?? null, r.testPaperId ?? null, r.type, r.title, r.language, r.origin, r.usagePermissionId, r.isDemonstration ? 1 : 0, hash, now, id, cur.version),
    db.prepare('DELETE FROM content_blocks WHERE resource_id = ?').bind(id),
    ...insertRows(db, 'content_blocks', blockRows(id, r, now)),
    db.prepare(`INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, created_at) VALUES (?, 'LEARNING_RESOURCE', ?, 'EDITED', ?, 'DRAFT/UNVERIFIED', ?, ?, ?)`)
      .bind(newId('rev'), id, cur.status, actor, `Edited to version ${cur.version + 1}`, now),
  ]);
  return { id, version: cur.version + 1 };
}

export async function deleteResource(db: D1Database, id: string, actor: string) {
  const cur = await db.prepare('SELECT status FROM learning_resources WHERE id = ?').bind(id).first<{ status: string }>();
  if (!cur) throw notFound('Learning resource');
  if (cur.status === 'PUBLISHED') throw conflict('Unpublish or archive a published resource instead of deleting it');
  await db.batch([
    db.prepare('DELETE FROM learning_resources WHERE id = ?').bind(id),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'DELETE_RESOURCE', 'LEARNING_RESOURCE', id, nowIso()),
  ]);
  return { deleted: true };
}

export async function getResource(prisma: PrismaClient, id: string, publicOnly = false) {
  const r = await prisma.learningResource.findFirst({
    where: publicOnly ? { id, status: 'PUBLISHED', isDemonstration: false } : { id },
    include: { blocks: { orderBy: { position: 'asc' }, include: { mediaAsset: { select: { id: true, kind: true, r2Key: true, externalUrl: true, altText: true, caption: true } } } }, curriculumNode: { select: { id: true, title: true } }, usagePermission: { select: { code: true, name: true } } },
  });
  if (!r) throw notFound('Learning resource');
  return r;
}

export async function listResources(prisma: PrismaClient, f: { nodeId?: string; testPaperId?: string; status?: string }, page: { skip: number; pageSize: number }) {
  const where = { ...(f.nodeId ? { curriculumNodeId: f.nodeId } : {}), ...(f.testPaperId ? { testPaperId: f.testPaperId } : {}), ...(f.status ? { status: f.status as never } : {}) };
  const [total, items] = await Promise.all([
    prisma.learningResource.count({ where }),
    prisma.learningResource.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: page.skip, take: page.pageSize, select: { id: true, type: true, title: true, status: true, verification: true, origin: true, isDemonstration: true, curriculumNodeId: true, version: true, updatedAt: true } }),
  ]);
  return { total, items };
}
