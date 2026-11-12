/**
 * Student-facing reads: exams -> subjects (papers) -> units -> topics -> subtopics, learning resources and
 * media. Only verified syllabus (machine- or human-verified) is shown. Outside local preview, only PUBLISHED
 * syllabus versions, resources and questions are visible; demonstration and rejected records never are.
 */
import { notFound } from '../lib/errors';

export const VISIBLE_SYLLABUS = (alias: string) => `${alias}.verification IN ('MACHINE_VERIFIED','VERIFIED') AND ${alias}.status != 'ARCHIVED' AND (${alias}.status = 'PUBLISHED' OR ?1 = 1)`;
export const VISIBLE_CONTENT = (alias: string) =>
  `${alias}.is_demonstration = 0 AND ${alias}.verification NOT IN ('REJECTED','NEEDS_CHANGES') AND (${alias}.status = 'PUBLISHED' OR (?1 = 1 AND ${alias}.status != 'ARCHIVED'))`;

const LATEST_VISIBLE_VERSION = `
  SELECT sv.* FROM syllabus_versions sv
  WHERE ${VISIBLE_SYLLABUS('sv')}
    AND sv.version_number = (SELECT MAX(x.version_number) FROM syllabus_versions x WHERE x.test_paper_id = sv.test_paper_id AND ${VISIBLE_SYLLABUS('x')})`;

export async function listExams(db: D1Database) {
  const { results } = await db
    .prepare(`SELECT e.code, e.name, e.level, c.year, c.label, c.rules_json FROM exams e JOIN exam_cycles c ON c.exam_id = e.id WHERE c.status = 'ACTIVE' ORDER BY e.code, c.year DESC`)
    .all<{ code: string; name: string; level: string; year: number; label: string; rules_json: string | null }>();
  return results.map((r) => ({ code: r.code, name: r.name, level: r.level, year: r.year, label: r.label, rules: JSON.parse(r.rules_json ?? '{}') as Record<string, unknown> }));
}

export async function listSubjects(db: D1Database, preview: boolean, exam: string, year: number) {
  const { results } = await db
    .prepare(
      `WITH RECURSIVE v AS (${LATEST_VISIBLE_VERSION}),
       -- Rows inside a "Note" box (question-paper instructions such as "75 questions") are not syllabus content.
       note_rows(id) AS (SELECT id FROM curriculum_nodes WHERE kind = 'NOTE' UNION ALL SELECT c.id FROM curriculum_nodes c JOIN note_rows ON c.parent_id = note_rows.id)
       SELECT tp.id, tp.code, tp.name, cat.code AS category_code, cat.name AS category_name, v.id AS version_id, v.verification, v.status AS version_status,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.kind IN ('UNIT','CHAPTER') AND n.id NOT IN (SELECT id FROM note_rows)) AS units,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.kind IN ('PART','SECTION','COURSE') AND n.id NOT IN (SELECT id FROM note_rows)) AS sections,
         (SELECT COUNT(*) FROM curriculum_nodes n WHERE n.syllabus_version_id = v.id AND n.kind IN ('TOPIC','SUBTOPIC','ITEM') AND n.id NOT IN (SELECT id FROM note_rows)) AS topics,
         (SELECT COUNT(DISTINCT qt.question_id) FROM question_topics qt JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id JOIN questions q ON q.id = qt.question_id
            WHERE n.syllabus_version_id = v.id AND ${VISIBLE_CONTENT('q')}) AS questions
       FROM test_papers tp
       JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id
       JOIN subjects s ON s.id = tp.subject_id LEFT JOIN subject_categories cat ON cat.id = s.category_id
       LEFT JOIN v ON v.test_paper_id = tp.id
       WHERE e.code = ?2 AND ec.year = ?3
       ORDER BY (v.id IS NULL), cat.code, tp.name`,
    )
    .bind(preview ? 1 : 0, exam, year)
    .all<Record<string, string | number | null>>();
  return results.map((r) => ({
    paperId: r.id, code: r.code, name: r.name, category: { code: r.category_code, name: r.category_name },
    available: Boolean(r.version_id), versionId: r.version_id, verification: r.verification, preview: r.version_status !== 'PUBLISHED' && Boolean(r.version_id),
    units: Number(r.units ?? 0), sections: Number(r.sections ?? 0), topics: Number(r.topics ?? 0), questions: Number(r.questions ?? 0),
  }));
}

export async function paperOutline(db: D1Database, preview: boolean, paperId: string) {
  const paper = await db
    .prepare(
      `WITH v AS (${LATEST_VISIBLE_VERSION})
       SELECT tp.id, tp.code, tp.name, tp.question_count, tp.duration_minutes, tp.marks_correct, tp.marks_incorrect, e.code AS exam, ec.year,
         v.id AS version_id, v.verification, v.status AS version_status, d.title AS source_title, d.url AS source_url, d.sha256 AS source_sha256, d.page_count
       FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id
       LEFT JOIN v ON v.test_paper_id = tp.id LEFT JOIN source_documents d ON d.id = v.source_document_id
       WHERE tp.id = ?2`,
    )
    .bind(preview ? 1 : 0, paperId)
    .first<Record<string, string | number | null>>();
  if (!paper) throw notFound('Subject');
  if (!paper.version_id) return { paper, nodes: [] };
  const { results } = await db
    .prepare(
      `SELECT n.id, n.parent_id, n.kind, n.label, n.title, n.depth, n.position, n.source_page,
         (SELECT COUNT(*) FROM learning_resources r WHERE r.curriculum_node_id = n.id AND ${VISIBLE_CONTENT('r')}) AS resources,
         (SELECT COUNT(*) FROM question_topics qt JOIN questions q ON q.id = qt.question_id WHERE qt.curriculum_node_id = n.id AND ${VISIBLE_CONTENT('q')}) AS questions
       FROM curriculum_nodes n WHERE n.syllabus_version_id = ?2 AND n.verification IN ('MACHINE_VERIFIED','VERIFIED')
       ORDER BY n.depth, n.position`,
    )
    .bind(preview ? 1 : 0, paper.version_id)
    .all();
  return { paper, nodes: results };
}

export async function topicDetail(db: D1Database, preview: boolean, nodeId: string) {
  const node = await db
    .prepare(
      `SELECT n.*, v.test_paper_id, v.verification AS version_verification, v.status AS version_status, d.title AS source_title, d.url AS source_url, d.page_count
       FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id LEFT JOIN source_documents d ON d.id = v.source_document_id
       WHERE n.id = ?2 AND ${VISIBLE_SYLLABUS('v')} AND n.verification IN ('MACHINE_VERIFIED','VERIFIED')`,
    )
    .bind(preview ? 1 : 0, nodeId)
    .first<Record<string, string | number | null>>();
  if (!node) throw notFound('Topic');
  const [ancestors, children, resources, questions, paper] = await Promise.all([
    db.prepare(
      `WITH RECURSIVE up(id, parent_id, kind, label, title, depth) AS (
         SELECT id, parent_id, kind, label, title, depth FROM curriculum_nodes WHERE id = ?
         UNION ALL SELECT n.id, n.parent_id, n.kind, n.label, n.title, n.depth FROM curriculum_nodes n JOIN up ON n.id = up.parent_id)
       SELECT id, kind, label, title, depth FROM up WHERE id != ? ORDER BY depth`,
    ).bind(nodeId, nodeId).all(),
    db.prepare(`SELECT id, kind, label, title, body, source_page FROM curriculum_nodes WHERE parent_id = ? ORDER BY position`).bind(nodeId).all(),
    db.prepare(`SELECT r.id, r.type, r.title, r.language, r.origin, r.status, r.verification FROM learning_resources r WHERE r.curriculum_node_id = ?2 AND ${VISIBLE_CONTENT('r')} ORDER BY r.type, r.title`).bind(preview ? 1 : 0, nodeId).all(),
    db.prepare(
      `WITH RECURSIVE sub(id) AS (SELECT ?2 UNION ALL SELECT n.id FROM curriculum_nodes n JOIN sub ON n.parent_id = sub.id)
       SELECT COUNT(DISTINCT q.id) AS n FROM questions q JOIN question_topics qt ON qt.question_id = q.id WHERE qt.curriculum_node_id IN (SELECT id FROM sub) AND ${VISIBLE_CONTENT('q')}`,
    ).bind(preview ? 1 : 0, nodeId).first<{ n: number }>(),
    db.prepare(`SELECT tp.id, tp.code, tp.name, e.code AS exam FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE tp.id = ?`).bind(node.test_paper_id).first(),
  ]);
  return {
    topic: {
      id: node.id, kind: node.kind, label: node.label, title: node.title, body: node.body, sourcePage: node.source_page,
      verification: node.verification, preview: node.version_status !== 'PUBLISHED',
    },
    paper,
    source: { title: node.source_title, url: node.source_url, page: node.source_page, pageCount: node.page_count },
    breadcrumb: ancestors.results,
    children: children.results,
    resources: resources.results,
    questionCount: questions?.n ?? 0,
  };
}

export async function resourceDetail(db: D1Database, preview: boolean, id: string) {
  const r = await db.prepare(`SELECT r.* FROM learning_resources r WHERE r.id = ?2 AND ${VISIBLE_CONTENT('r')}`).bind(preview ? 1 : 0, id).first<Record<string, unknown>>();
  if (!r) throw notFound('Learning resource');
  const { results } = await db
    .prepare(`SELECT b.position, b.type, b.body, b.media_asset_id, m.alt_text, m.caption, m.kind AS media_kind FROM content_blocks b LEFT JOIN media_assets m ON m.id = b.media_asset_id WHERE b.resource_id = ? ORDER BY b.position`)
    .bind(id)
    .all();
  const node = r.curriculum_node_id
    ? await db.prepare('SELECT n.id, n.title, n.kind, n.label, v.test_paper_id AS paper_id FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = ?').bind(r.curriculum_node_id).first()
    : null;
  return {
    resource: { id: r.id, type: r.type, title: r.title, origin: r.origin, verification: r.verification, status: r.status, preview: r.status !== 'PUBLISHED', updatedAt: r.updated_at },
    topic: node,
    blocks: results,
  };
}

export async function mediaObject(db: D1Database, bucket: R2Bucket, preview: boolean, id: string) {
  const m = await db.prepare(`SELECT r2_key, mime_type, status, verification FROM media_assets WHERE id = ?`).bind(id).first<{ r2_key: string | null; mime_type: string; status: string; verification: string }>();
  if (!m || !m.r2_key || m.verification === 'REJECTED' || (m.status !== 'PUBLISHED' && !preview)) throw notFound('Media');
  const obj = await bucket.get(m.r2_key);
  if (!obj) throw notFound('Media file');
  return new Response(obj.body, {
    headers: { 'content-type': m.mime_type, 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
  });
}
