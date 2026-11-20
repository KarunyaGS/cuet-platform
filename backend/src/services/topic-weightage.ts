import { z } from 'zod';
import { ApiError, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';

const LEAF_KINDS = "'TOPIC','SUBTOPIC','ITEM'";

export const weightageQueueQuery = z.object({
  paperId: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(50),
});

export const weightageDecisionSchema = z.object({
  action: z.enum(['SUGGEST', 'VERIFY', 'UNRESOLVED', 'REJECT']),
  curriculumNodeId: z.string().trim().min(1).max(100).nullable().optional(),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).nullable().optional(),
  method: z.enum(['MANUAL', 'AI_ASSISTED']).default('MANUAL'),
  evidenceNote: z.string().trim().max(1000).nullable().optional(),
  sourceChecked: z.boolean().default(false),
});

type QueueRow = Record<string, string | number | null>;
const num = (v: unknown) => Number(v ?? 0) || 0;

/** Review queue only contains actual questions stored as official past-paper entries. */
export async function listTopicMappingQueue(db: D1Database, input: z.infer<typeof weightageQueueQuery>) {
  const offset = (input.page - 1) * input.pageSize;
  const filterSql = input.paperId ? 'AND pp.id = ?' : '';
  const args = input.paperId ? [input.paperId] : [];
  const [total, raw] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM past_paper_questions pq JOIN past_papers pp ON pp.id = pq.past_paper_id WHERE pq.dropped = 0 AND pq.question_id IS NOT NULL ${filterSql}`)
      .bind(...args).first<{ n: number }>(),
    db.prepare(
      `SELECT pq.id AS entry_id, pq.position, pq.official_question_id, pq.source_page, pp.id AS paper_id,
          pp.exam_code, pp.year, pp.subject_code, pp.subject_name, pp.title AS paper_title, pp.status AS paper_status,
          pp.key_version, pp.questions_in_paper, pp.question_paper_source_id, paper_source.url AS paper_source_url,
          ep.official_syllabus_url,
          q.id AS question_id, q.stem, q.origin, q.verification AS question_verification, q.source_locator,
          ep.id AS exact_test_paper_id, sv.id AS syllabus_version_id, sv.version_number AS syllabus_version_number,
          sv.status AS syllabus_status, sv.verification AS syllabus_verification,
          m.id AS mapping_id, m.curriculum_node_id, m.status AS mapping_status, m.confidence, m.method, m.evidence_note,
          mapped.title AS mapped_title, mapped.kind AS mapped_kind,
          (SELECT COUNT(*) FROM paper_topic_mapping_events h WHERE h.mapping_id = m.id) AS has_history
       FROM past_paper_questions pq
       JOIN past_papers pp ON pp.id = pq.past_paper_id
       JOIN questions q ON q.id = pq.question_id
       JOIN source_documents paper_source ON paper_source.id = pp.question_paper_source_id
       LEFT JOIN test_papers ep ON ep.code = pp.subject_code
         AND ep.exam_cycle_id IN (SELECT ec.id FROM exam_cycles ec JOIN exams ex ON ex.id = ec.exam_id WHERE ex.code = pp.exam_code AND ec.year = pp.year)
       LEFT JOIN syllabus_versions sv ON sv.test_paper_id = ep.id
         AND sv.version_number = (SELECT MAX(sv2.version_number) FROM syllabus_versions sv2 WHERE sv2.test_paper_id = ep.id)
       LEFT JOIN paper_topic_mappings m ON m.past_paper_question_id = pq.id AND m.syllabus_version_id = sv.id
       LEFT JOIN curriculum_nodes mapped ON mapped.id = m.curriculum_node_id
       WHERE pq.dropped = 0 AND pq.question_id IS NOT NULL ${filterSql}
       ORDER BY pp.year DESC, pp.subject_name, pp.exam_date, pp.shift, pq.position
       LIMIT ? OFFSET ?`,
    ).bind(...args, input.pageSize, offset).all<QueueRow>(),
  ]);

  const versionIds = [...new Set(raw.results.map((r) => r.syllabus_version_id).filter((x): x is string => typeof x === 'string'))];
  const topicMap = new Map<string, { id: string; title: string; kind: string; depth: number; path: string; sourcePage: number | null }[]>();
  if (versionIds.length) {
    const marks = versionIds.map(() => '?').join(',');
    const { results } = await db.prepare(
      `WITH RECURSIVE tree(id, syllabus_version_id, parent_id, kind, title, position, depth, path) AS (
         SELECT id, syllabus_version_id, parent_id, kind, title, position, depth, printf('%04d', position) || ' ' || title
         FROM curriculum_nodes WHERE syllabus_version_id IN (${marks}) AND parent_id IS NULL
         UNION ALL
         SELECT n.id, n.syllabus_version_id, n.parent_id, n.kind, n.title, n.position, n.depth, tree.path || ' / ' || printf('%04d', n.position) || ' ' || n.title
         FROM curriculum_nodes n JOIN tree ON n.parent_id = tree.id WHERE n.syllabus_version_id IN (${marks})
       )
       SELECT tree.id, tree.syllabus_version_id, tree.kind, tree.title, tree.depth, tree.path, n.source_page FROM tree JOIN curriculum_nodes n ON n.id = tree.id WHERE tree.kind IN (${LEAF_KINDS}) ORDER BY tree.syllabus_version_id, tree.path`,
    ).bind(...versionIds, ...versionIds).all<QueueRow>();
    for (const r of results) {
      const versionId = String(r.syllabus_version_id);
      const items = topicMap.get(versionId) ?? [];
      items.push({ id: String(r.id), title: String(r.title), kind: String(r.kind), depth: num(r.depth), path: String(r.path).replace(/\d{4} /g, ''), sourcePage: r.source_page === null ? null : num(r.source_page) });
      topicMap.set(versionId, items);
    }
  }

  return {
    page: input.page,
    pageSize: input.pageSize,
    total: num(total?.n),
    pages: Math.ceil(num(total?.n) / input.pageSize),
    items: raw.results.map((r) => {
      const versionId = typeof r.syllabus_version_id === 'string' ? r.syllabus_version_id : null;
      return {
        entryId: String(r.entry_id), position: num(r.position), officialQuestionId: r.official_question_id,
        sourcePage: r.source_page === null ? null : num(r.source_page), paperId: String(r.paper_id),
        exam: String(r.exam_code), year: num(r.year), subjectCode: String(r.subject_code), subjectName: String(r.subject_name),
        paperTitle: String(r.paper_title), paperStatus: String(r.paper_status), keyVersion: String(r.key_version),
        sourceUrl: r.paper_source_url, questionId: String(r.question_id), stem: String(r.stem), origin: String(r.origin),
        questionVerification: String(r.question_verification), sourceLocator: r.source_locator,
        exactTestPaperId: r.exact_test_paper_id, syllabusVersionId: versionId,
        syllabusUrl: r.official_syllabus_url,
        syllabusVersionNumber: r.syllabus_version_number === null ? null : num(r.syllabus_version_number),
        syllabusStatus: r.syllabus_status, syllabusVerification: r.syllabus_verification,
        mapping: r.mapping_id ? { id: String(r.mapping_id), nodeId: r.curriculum_node_id, status: String(r.mapping_status), confidence: r.confidence, method: String(r.method), evidenceNote: r.evidence_note, title: r.mapped_title, kind: r.mapped_kind } : null,
        topics: versionId ? topicMap.get(versionId) ?? [] : [],
        historyCount: num(r.has_history),
      };
    }),
  };
}

export async function saveTopicMapping(db: D1Database, entryId: string, input: z.infer<typeof weightageDecisionSchema>, actor: string) {
  if (!actor.startsWith('user:')) throw new ApiError(403, 'HUMAN_REVIEW_REQUIRED', 'A signed-in staff reviewer must record the mapping decision');
  const row = await db.prepare(
    `SELECT pq.id AS entry_id, pq.source_page, pq.dropped, pp.id AS paper_id, pp.exam_code, pp.year, pp.subject_code,
        pp.key_version, pp.answer_key_source_id, pp.question_paper_source_id, paper_source.url AS paper_source_url,
        q.id AS question_id, q.origin, q.source_document_id AS question_source_document_id,
        q.verification AS question_verification, paper_source.page_count AS source_page_count,
        ep.id AS exact_test_paper_id, sv.id AS syllabus_version_id, sv.status AS syllabus_status, sv.verification AS syllabus_verification
     FROM past_paper_questions pq JOIN past_papers pp ON pp.id = pq.past_paper_id
     JOIN questions q ON q.id = pq.question_id
     JOIN source_documents paper_source ON paper_source.id = pp.question_paper_source_id
     LEFT JOIN test_papers ep ON ep.code = pp.subject_code
       AND ep.exam_cycle_id IN (SELECT ec.id FROM exam_cycles ec JOIN exams ex ON ex.id = ec.exam_id WHERE ex.code = pp.exam_code AND ec.year = pp.year)
     LEFT JOIN syllabus_versions sv ON sv.test_paper_id = ep.id
       AND sv.version_number = (SELECT MAX(sv2.version_number) FROM syllabus_versions sv2 WHERE sv2.test_paper_id = ep.id)
     WHERE pq.id = ?`,
  ).bind(entryId).first<QueueRow>();
  if (!row || row.dropped || row.origin !== 'PAST_PAPER') throw notFound('Official past-paper question');
  const versionId = typeof row.syllabus_version_id === 'string' ? row.syllabus_version_id : null;
  if (!versionId) throw new ApiError(409, 'YEAR_SYLLABUS_MISSING', `There is no syllabus version for ${String(row.exam_code)} ${String(row.subject_code)} ${String(row.year)}. This question cannot be mapped to another year's syllabus.`);

  const nodeId = input.curriculumNodeId ?? null;
  if (input.action === 'VERIFY') {
    if (!nodeId) throw new ApiError(422, 'TOPIC_REQUIRED', 'Choose the syllabus topic that matches this question.');
    if (input.confidence !== 'HIGH') throw new ApiError(422, 'HIGH_CONFIDENCE_REQUIRED', 'Only a high-confidence mapping checked against the original paper can be verified.');
    if (!input.sourceChecked || !input.evidenceNote || input.evidenceNote.length < 12) throw new ApiError(422, 'SOURCE_CHECK_REQUIRED', 'Open the cited question-paper page and record evidence explaining the match before verifying.');
    if (!row.paper_source_url || !row.source_page || num(row.source_page) < 1 || (row.source_page_count !== null && num(row.source_page) > num(row.source_page_count))) {
      throw new ApiError(409, 'SOURCE_PAGE_UNVERIFIABLE', 'A valid original-paper URL and question page are required before this mapping can be verified.');
    }
    if (row.question_verification !== 'VERIFIED' || row.question_source_document_id !== row.question_paper_source_id || row.key_version !== 'FINAL' || !row.answer_key_source_id || !row.paper_source_url) {
      throw new ApiError(409, 'PAPER_NOT_VERIFIED', 'The question, final answer key, and source paper must be verified before this mapping can count.');
    }
    if (row.syllabus_verification !== 'VERIFIED' || !['APPROVED', 'PUBLISHED', 'ARCHIVED'].includes(String(row.syllabus_status))) {
      throw new ApiError(409, 'SYLLABUS_NOT_VERIFIED', 'The exact year’s syllabus must be verified and approved before this mapping can count.');
    }
    const node = await db.prepare(`SELECT id FROM curriculum_nodes WHERE id = ? AND syllabus_version_id = ? AND kind IN (${LEAF_KINDS}) AND verification = 'VERIFIED'`).bind(nodeId, versionId).first<{ id: string }>();
    if (!node) throw new ApiError(422, 'TOPIC_VERSION_MISMATCH', 'Choose a verified topic from this paper year’s syllabus version.');
  } else if (input.action === 'SUGGEST' && !nodeId) {
    throw new ApiError(422, 'TOPIC_REQUIRED', 'Choose a candidate topic for the suggestion.');
  }

  const status = input.action === 'VERIFY' ? 'VERIFIED' : input.action === 'SUGGEST' ? 'SUGGESTED' : input.action === 'REJECT' ? 'REJECTED' : 'UNRESOLVED';
  const evidence = input.evidenceNote?.trim() || null;
  if ((input.action === 'UNRESOLVED' || input.action === 'REJECT') && !evidence) throw new ApiError(422, 'REVIEW_NOTE_REQUIRED', 'Add a short note explaining the unresolved or rejected mapping.');
  const existing = await db.prepare('SELECT * FROM paper_topic_mappings WHERE past_paper_question_id = ? AND syllabus_version_id = ?').bind(entryId, versionId).first<QueueRow>();
  const now = nowIso();
  const mappingId = existing ? String(existing.id) : newId('ptm');
  const next = { curriculumNodeId: nodeId, status, confidence: input.confidence ?? null, method: input.method, evidenceNote: evidence, verifiedBy: status === 'VERIFIED' ? actor : null, verifiedAt: status === 'VERIFIED' ? now : null };
  const previous = existing ? {
    curriculumNodeId: existing.curriculum_node_id, status: existing.status, confidence: existing.confidence,
    method: existing.method, evidenceNote: existing.evidence_note, verifiedBy: existing.verified_by, verifiedAt: existing.verified_at,
  } : null;
  await db.batch([
    existing
      ? db.prepare(`UPDATE paper_topic_mappings SET curriculum_node_id = ?, status = ?, confidence = ?, method = ?, evidence_note = ?, verified_by = ?, verified_at = ?, updated_at = ? WHERE id = ?`)
          .bind(nodeId, status, next.confidence, input.method, evidence, next.verifiedBy, next.verifiedAt, now, mappingId)
      : db.prepare(`INSERT INTO paper_topic_mappings (id, past_paper_question_id, syllabus_version_id, curriculum_node_id, status, confidence, method, evidence_note, verified_by, verified_at, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(mappingId, entryId, versionId, nodeId, status, next.confidence, input.method, evidence, next.verifiedBy, next.verifiedAt, actor, now, now),
    db.prepare(`INSERT INTO paper_topic_mapping_events (id, mapping_id, action, previous_json, next_json, note, actor, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(newId('ptme'), mappingId, input.action, previous ? JSON.stringify(previous) : null, JSON.stringify(next), evidence, actor, now),
  ]);
  return { id: mappingId, entryId, syllabusVersionId: versionId, ...next, updatedAt: now };
}

/** Official-paper frequencies, grouped by exact syllabus version. No cross-version joins or authored questions. */
export async function verifiedWeightageReport(db: D1Database, filter: { exam?: string; paperId?: string } = {}) {
  const examFilter = filter.exam ? 'AND pp.exam_code = ?' : '';
  const paperFilter = filter.paperId ? 'AND pp.id = ?' : '';
  const args = [...(filter.exam ? [filter.exam] : []), ...(filter.paperId ? [filter.paperId] : [])];
  const [reportRows, paperSources] = await Promise.all([
    db.prepare(
    `WITH eligible AS (
       SELECT pp.id AS paper_id, pp.exam_code, pp.year, pp.subject_code, pp.subject_name, ep.id AS test_paper_id,
         sv.id AS syllabus_version_id, sv.version_number, ep.name AS test_paper_name
       FROM past_papers pp
       JOIN usage_permissions perm ON perm.id = pp.usage_permission_id AND perm.public_display = 1
       JOIN test_papers ep ON ep.code = pp.subject_code
         AND ep.exam_cycle_id IN (SELECT ec.id FROM exam_cycles ec JOIN exams ex ON ex.id = ec.exam_id WHERE ex.code = pp.exam_code AND ec.year = pp.year)
       JOIN syllabus_versions sv ON sv.test_paper_id = ep.id
         AND sv.version_number = (SELECT MAX(sv2.version_number) FROM syllabus_versions sv2 WHERE sv2.test_paper_id = ep.id)
       WHERE pp.status = 'PUBLISHED' AND pp.key_version = 'FINAL' ${examFilter} ${paperFilter}
         AND sv.verification = 'VERIFIED' AND sv.status IN ('APPROVED','PUBLISHED','ARCHIVED')
     ), slots AS (
       SELECT e.*, pq.id AS entry_id, m.curriculum_node_id, m.status AS mapping_status
       FROM eligible e JOIN past_paper_questions pq ON pq.past_paper_id = e.paper_id AND pq.dropped = 0 AND pq.question_id IS NOT NULL
       JOIN questions q ON q.id = pq.question_id AND q.origin = 'PAST_PAPER' AND q.source_document_id = (SELECT question_paper_source_id FROM past_papers WHERE id = pq.past_paper_id) AND q.verification = 'VERIFIED'
       LEFT JOIN paper_topic_mappings m ON m.past_paper_question_id = pq.id AND m.syllabus_version_id = e.syllabus_version_id
     ), cohort AS (
       SELECT syllabus_version_id, test_paper_id, exam_code, year, subject_code, subject_name, test_paper_name,
         COUNT(DISTINCT paper_id) AS paper_count, COUNT(DISTINCT entry_id) AS sample_size,
         COUNT(DISTINCT CASE WHEN mapping_status = 'VERIFIED' THEN entry_id END) AS mapped_count
       FROM slots GROUP BY syllabus_version_id, test_paper_id, exam_code, year, subject_code, subject_name, test_paper_name
     )
     SELECT c.*, n.id AS topic_id, n.title AS topic_title, n.kind AS topic_kind,
       COUNT(DISTINCT CASE WHEN s.mapping_status = 'VERIFIED' AND s.curriculum_node_id = n.id THEN s.entry_id END) AS frequency
     FROM cohort c JOIN slots s ON s.syllabus_version_id = c.syllabus_version_id
     JOIN curriculum_nodes n ON n.syllabus_version_id = c.syllabus_version_id AND n.kind IN (${LEAF_KINDS})
     GROUP BY c.syllabus_version_id, n.id
     ORDER BY c.exam_code, c.year DESC, c.subject_name, n.depth, n.position`,
    ).bind(...args).all<QueueRow>(),
    db.prepare(
      `SELECT pp.id, pp.title, pp.year, pp.exam_date, pp.shift, pp.subject_code, pp.exam_code, pp.question_paper_source_id,
          sd.url AS source_url, sv.id AS syllabus_version_id
       FROM past_papers pp JOIN usage_permissions perm ON perm.id = pp.usage_permission_id AND perm.public_display = 1
       JOIN source_documents sd ON sd.id = pp.question_paper_source_id
       JOIN test_papers ep ON ep.code = pp.subject_code AND ep.exam_cycle_id IN
         (SELECT ec.id FROM exam_cycles ec JOIN exams ex ON ex.id = ec.exam_id WHERE ex.code = pp.exam_code AND ec.year = pp.year)
       JOIN syllabus_versions sv ON sv.test_paper_id = ep.id AND sv.version_number = (SELECT MAX(sv2.version_number) FROM syllabus_versions sv2 WHERE sv2.test_paper_id = ep.id)
       WHERE pp.status = 'PUBLISHED' AND pp.key_version = 'FINAL' AND sv.verification = 'VERIFIED' AND sv.status IN ('APPROVED','PUBLISHED','ARCHIVED') ${examFilter} ${paperFilter}
       ORDER BY pp.year DESC, pp.subject_name, pp.exam_date, pp.shift`,
    ).bind(...args).all<QueueRow>(),
  ]);
  const groups = new Map<string, { exam: string; year: number; subjectCode: string; subjectName: string; testPaperId: string; syllabusVersionId: string; syllabusVersionNumber: number; sampleSize: number; mappedCount: number; paperCount: number; topics: unknown[] }>();
  const sourcesByVersion = new Map<string, { title: string; year: number; examDate: string | null; shift: string | null; subjectCode: string; sourceUrl: string }[]>();
  for (const r of paperSources.results) {
    const versionId = String(r.syllabus_version_id);
    const sources = sourcesByVersion.get(versionId) ?? [];
    sources.push({ title: String(r.title), year: num(r.year), examDate: r.exam_date === null ? null : String(r.exam_date), shift: r.shift === null ? null : String(r.shift), subjectCode: String(r.subject_code), sourceUrl: String(r.source_url) });
    sourcesByVersion.set(versionId, sources);
  }
  for (const r of reportRows.results) {
    const versionId = String(r.syllabus_version_id);
    let group = groups.get(versionId);
    if (!group) {
      group = { exam: String(r.exam_code), year: num(r.year), subjectCode: String(r.subject_code), subjectName: String(r.subject_name), testPaperId: String(r.test_paper_id), syllabusVersionId: versionId, syllabusVersionNumber: num(r.version_number), sampleSize: num(r.sample_size), mappedCount: num(r.mapped_count), paperCount: num(r.paper_count), topics: [] };
      groups.set(versionId, group);
    }
    const frequency = num(r.frequency);
    group.topics.push({ id: String(r.topic_id), title: String(r.topic_title), kind: String(r.topic_kind), questionCount: frequency, percentOfPaperSample: group.sampleSize ? Math.round((10000 * frequency) / group.sampleSize) / 100 : null });
  }
  return [...groups.values()].map((g) => ({ ...g, yearCoverage: [g.year], sourcePapers: sourcesByVersion.get(g.syllabusVersionId) ?? [], mappingCoveragePercent: g.sampleSize ? Math.round((10000 * g.mappedCount) / g.sampleSize) / 100 : 0, topics: g.topics }));
}

/** Student-facing result for one current syllabus topic; never merges another year/version. */
export async function topicWeightage(db: D1Database, nodeId: string) {
  const node = await db.prepare(`SELECT n.id, n.title, n.kind, n.syllabus_version_id, v.version_number, tp.code, tp.name, e.code AS exam, ec.year
    FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id JOIN test_papers tp ON tp.id = v.test_paper_id
    JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE n.id = ? AND n.kind IN (${LEAF_KINDS})`).bind(nodeId)
    .first<QueueRow>();
  if (!node) throw notFound('Syllabus topic');
  const exact = await db.prepare(
    `SELECT pp.year, COUNT(DISTINCT pq.id) AS sample_size, COUNT(DISTINCT pp.id) AS paper_count,
       COUNT(DISTINCT CASE WHEN m.status = 'VERIFIED' THEN pq.id END) AS mapped_count,
       COUNT(DISTINCT CASE WHEN m.status = 'VERIFIED' AND m.curriculum_node_id = ? THEN pq.id END) AS frequency
     FROM past_papers pp JOIN usage_permissions perm ON perm.id = pp.usage_permission_id AND perm.public_display = 1
     JOIN test_papers ep ON ep.code = pp.subject_code AND ep.exam_cycle_id IN
       (SELECT ec.id FROM exam_cycles ec JOIN exams e ON e.id = ec.exam_id WHERE e.code = pp.exam_code AND ec.year = pp.year)
     JOIN syllabus_versions sv ON sv.test_paper_id = ep.id AND sv.id = ? AND sv.verification = 'VERIFIED' AND sv.status IN ('APPROVED','PUBLISHED','ARCHIVED')
     JOIN past_paper_questions pq ON pq.past_paper_id = pp.id AND pq.dropped = 0 AND pq.question_id IS NOT NULL
     JOIN questions q ON q.id = pq.question_id AND q.origin = 'PAST_PAPER' AND q.source_document_id = pp.question_paper_source_id AND q.verification = 'VERIFIED'
     LEFT JOIN paper_topic_mappings m ON m.past_paper_question_id = pq.id AND m.syllabus_version_id = sv.id
     WHERE pp.status = 'PUBLISHED' AND pp.key_version = 'FINAL' AND pp.exam_code = ? AND pp.year = ? AND pp.subject_code = ?`,
  ).bind(node.id, node.syllabus_version_id, node.exam, node.year, node.code).first<QueueRow>();
  return {
    topicId: String(node.id), title: String(node.title), exam: String(node.exam), year: num(node.year), subjectCode: String(node.code),
    syllabusVersionId: String(node.syllabus_version_id), syllabusVersionNumber: num(node.version_number),
    sampleSize: num(exact?.sample_size), paperCount: num(exact?.paper_count), mappedCount: num(exact?.mapped_count), frequency: num(exact?.frequency),
    mappingCoveragePercent: num(exact?.sample_size) ? Math.round((10000 * num(exact?.mapped_count)) / num(exact?.sample_size)) / 100 : 0,
    yearCoverage: num(exact?.sample_size) ? [num(node.year)] : [],
    method: 'VERIFIED_OFFICIAL_PAST_PAPERS',
    note: 'Frequency uses only verified questions from published official past papers mapped to this exact syllabus version. It is not a prediction of future marks.',
  };
}
