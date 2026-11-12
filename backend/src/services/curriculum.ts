import { z } from 'zod';
import type { PrismaClient } from '@cuet/database';
import { conflict, notFound } from '../lib/errors';
import { newId, normaliseText, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';

export async function listExams(prisma: PrismaClient) {
  return prisma.exam.findMany({
    orderBy: { code: 'asc' },
    include: { cycles: { orderBy: { year: 'desc' }, select: { id: true, year: true, label: true, status: true, rulesJson: true } }, categories: { orderBy: { code: 'asc' } } },
  });
}

export async function listPapers(prisma: PrismaClient, exam: string, year: number, q: string | undefined, page: { skip: number; pageSize: number }) {
  const where = {
    examCycle: { year, exam: { code: exam } },
    ...(q ? { OR: [{ name: { contains: q } }, { code: { contains: q } }] } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.testPaper.count({ where }),
    prisma.testPaper.findMany({
      where, orderBy: { code: 'asc' }, skip: page.skip, take: page.pageSize,
      include: {
        subject: { select: { name: true, category: { select: { code: true, name: true } } } },
        syllabusVersions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { id: true, versionNumber: true, status: true, verification: true, _count: { select: { nodes: true } } } },
      },
    }),
  ]);
  return { total, items };
}

export async function paperDetail(prisma: PrismaClient, id: string) {
  const paper = await prisma.testPaper.findUnique({
    where: { id },
    include: {
      subject: { include: { category: true } },
      examCycle: { include: { exam: true } },
      syllabusVersions: { orderBy: { versionNumber: 'desc' }, include: { sourceDocument: true, _count: { select: { nodes: true } } } },
      extractionJobs: true,
    },
  });
  if (!paper) throw notFound('Paper');
  return paper;
}

export async function versionNodes(prisma: PrismaClient, versionId: string) {
  const version = await prisma.syllabusVersion.findUnique({ where: { id: versionId }, include: { sourceDocument: { select: { id: true, title: true, url: true, pageCount: true } }, testPaper: { select: { id: true, code: true, name: true } } } });
  if (!version) throw notFound('Syllabus version');
  const nodes = await prisma.curriculumNode.findMany({
    where: { syllabusVersionId: versionId },
    orderBy: [{ depth: 'asc' }, { position: 'asc' }],
    select: { id: true, parentId: true, kind: true, label: true, title: true, body: true, position: true, depth: true, sourcePage: true, extractionFlags: true, verification: true, _count: { select: { learningResources: true, questionTopics: true, mediaAssets: true } } },
  });
  return { version, nodes };
}

export const nodeEditSchema = z.object({
  title: z.string().min(1).max(1000).optional(),
  body: z.string().max(20000).nullable().optional(),
  label: z.string().max(40).nullable().optional(),
  kind: z.enum(['PART', 'SECTION', 'COURSE', 'UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC', 'ITEM', 'NOTE']).optional(),
  reason: z.string().min(3).max(1000),
});

/** Manual correction of an extracted row. The old values are kept in the review history. */
export async function editNode(db: D1Database, id: string, edit: z.infer<typeof nodeEditSchema>, actor: string) {
  const cur = await db
    .prepare(`SELECT n.*, v.status AS version_status FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = ?`)
    .bind(id)
    .first<{ id: string; title: string; body: string | null; label: string | null; kind: string; parent_id: string | null; syllabus_version_id: string; verification: string; version_status: string }>();
  if (!cur) throw notFound('Curriculum row');
  if (cur.version_status === 'PUBLISHED') throw conflict('This syllabus version is published; create a new version to change it');
  const next = { title: edit.title ?? cur.title, body: edit.body === undefined ? cur.body : edit.body, label: edit.label === undefined ? cur.label : edit.label, kind: edit.kind ?? cur.kind };
  const hash = await sha256Hex(`${cur.parent_id ?? ''}/${next.kind}:${normaliseText(next.label)}:${normaliseText(next.title)}|${normaliseText(next.body)}|edited`);
  const now = nowIso();
  await db.batch([
    db
      .prepare(`UPDATE curriculum_nodes SET title = ?, body = ?, label = ?, kind = ?, content_hash = ?, verification = 'UNVERIFIED',
        extraction_flags = TRIM(COALESCE(extraction_flags, '') || ',manually_corrected', ','), updated_at = ? WHERE id = ?`)
      .bind(next.title, next.body, next.label, next.kind, hash, now, id),
    db
      .prepare(`INSERT INTO review_records (id, entity_type, entity_id, action, from_status, to_status, actor, comment, checklist_json, created_at)
        VALUES (?, 'CURRICULUM_NODE', ?, 'EDITED', ?, 'UNVERIFIED', ?, ?, ?, ?)`)
      .bind(newId('rev'), id, cur.verification, actor, edit.reason, JSON.stringify({ before: { title: cur.title, body: cur.body, label: cur.label, kind: cur.kind } }), now),
  ]);
  return { id, ...next, verification: 'UNVERIFIED' };
}

export async function overview(db: D1Database) {
  const row = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM test_papers) AS papers,
        (SELECT COUNT(*) FROM syllabus_versions) AS syllabus_versions,
        (SELECT COUNT(*) FROM curriculum_nodes) AS curriculum_rows,
        (SELECT COUNT(*) FROM curriculum_nodes WHERE verification = 'VERIFIED') AS curriculum_rows_verified,
        (SELECT COUNT(*) FROM source_documents) AS source_documents,
        (SELECT COUNT(*) FROM media_assets) AS media_assets,
        (SELECT COUNT(*) FROM source_tables) AS source_tables,
        (SELECT COUNT(*) FROM learning_resources) AS learning_resources,
        (SELECT COUNT(*) FROM questions) AS questions,
        (SELECT COUNT(*) FROM questions WHERE status = 'PUBLISHED') AS questions_published,
        (SELECT COUNT(*) FROM extraction_jobs WHERE status = 'BLOCKED') AS blocked_documents`,
    )
    .first();
  return row;
}
