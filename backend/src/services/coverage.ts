/**
 * Source-driven curriculum coverage. Every number comes from D1 rows:
 * - the denominator for papers is the official paper list registered from NTA pages;
 * - the denominator for topics is the curriculum nodes imported from each paper's latest syllabus version.
 * No expected totals are hard-coded. Papers whose syllabus is not yet imported have UNKNOWN topic counts
 * and make the report provisional.
 */

const LEAF = "('TOPIC','SUBTOPIC','ITEM')";
const STAGES = ['DISCOVERED', 'DOWNLOADED', 'STORED', 'EXTRACTED', 'VALIDATED', 'IMPORTED', 'VERIFIED'] as const;

export interface PaperCoverage {
  testPaperId: string;
  code: string;
  name: string;
  categoryCode: string | null;
  categoryName: string | null;
  officialSyllabusUrl: string | null;
  pipeline: { stage: string | null; status: string | null; blockerReason: string | null; attempts: number | null };
  syllabus: null | {
    versionId: string;
    versionNumber: number;
    status: string;
    verification: string;
    sectionsImported: number;
    unitsImported: number;
    topicsImported: number;
    subtopicsImported: number;
    learningPoints: number;
    awaitingVerification: number;
    machineVerified: number;
    verified: number;
    approved: number;
    rejected: number;
    withLearningContent: number;
    withPublishedLearningContent: number;
    withQuestions: number;
    withVisuals: number;
    missingLearningContent: number;
    missingQuestions: number;
    figuresExtracted: number;
    tablesExtracted: number;
  };
  questionsLinkedToPaper: number;
  resourcesLinkedToPaper: number;
}

type RawRow = Record<string, string | number | null>;

const n = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export async function paperCoverage(db: D1Database, examCode: string, year: number): Promise<PaperCoverage[]> {
  const sql = `
    WITH latest AS (
      SELECT sv.* FROM syllabus_versions sv
      WHERE sv.version_number = (SELECT MAX(x.version_number) FROM syllabus_versions x WHERE x.test_paper_id = sv.test_paper_id)
    ),
    node_flags AS (
      SELECT n.id, n.kind, n.verification, l.id AS vid, l.status AS vstatus,
        EXISTS (SELECT 1 FROM learning_resources r WHERE r.curriculum_node_id = n.id) AS has_res,
        EXISTS (SELECT 1 FROM learning_resources r WHERE r.curriculum_node_id = n.id AND r.status = 'PUBLISHED') AS has_pub_res,
        EXISTS (SELECT 1 FROM question_topics qt WHERE qt.curriculum_node_id = n.id) AS has_q,
        (EXISTS (SELECT 1 FROM media_assets m WHERE m.curriculum_node_id = n.id)
          OR EXISTS (SELECT 1 FROM learning_resources r JOIN content_blocks b ON b.resource_id = r.id
                     WHERE r.curriculum_node_id = n.id AND b.type IN ('DIAGRAM','IMAGE'))) AS has_visual
      FROM curriculum_nodes n JOIN latest l ON l.id = n.syllabus_version_id
    ),
    node_stats AS (
      SELECT vid,
        SUM(kind IN ('PART','SECTION','COURSE')) AS sections,
        SUM(kind IN ('UNIT','CHAPTER')) AS units,
        SUM(kind = 'TOPIC') AS topics,
        SUM(kind IN ('SUBTOPIC','ITEM')) AS subtopics,
        SUM(kind IN ${LEAF}) AS points,
        SUM(kind IN ${LEAF} AND verification IN ('UNVERIFIED','NEEDS_CHANGES')) AS awaiting,
        SUM(kind IN ${LEAF} AND verification = 'VERIFIED') AS verified,
        SUM(kind IN ${LEAF} AND verification = 'MACHINE_VERIFIED') AS machine_verified,
        SUM(kind IN ${LEAF} AND verification = 'VERIFIED' AND vstatus IN ('APPROVED','PUBLISHED')) AS approved,
        SUM(kind IN ${LEAF} AND verification = 'REJECTED') AS rejected,
        SUM(kind IN ${LEAF} AND has_res) AS with_res,
        SUM(kind IN ${LEAF} AND has_pub_res) AS with_pub_res,
        SUM(kind IN ${LEAF} AND has_q) AS with_q,
        SUM(kind IN ${LEAF} AND has_visual) AS with_visual
      FROM node_flags GROUP BY vid
    )
    SELECT tp.id, tp.code, tp.name, tp.official_syllabus_url, cat.code AS category_code, cat.name AS category_name,
      j.stage AS job_stage, j.status AS job_status, j.blocker_reason, j.attempts,
      l.id AS version_id, l.version_number, l.status AS version_status, l.verification AS version_verification,
      ns.sections, ns.units, ns.topics, ns.subtopics, ns.points, ns.awaiting, ns.verified, ns.machine_verified, ns.approved, ns.rejected,
      ns.with_res, ns.with_pub_res, ns.with_q, ns.with_visual,
      (SELECT COUNT(*) FROM media_assets m WHERE m.source_document_id = l.source_document_id) AS figures,
      (SELECT COUNT(*) FROM source_tables t WHERE t.source_document_id = l.source_document_id) AS tables,
      (SELECT COUNT(*) FROM questions q WHERE q.test_paper_id = tp.id) AS paper_questions,
      (SELECT COUNT(*) FROM learning_resources r WHERE r.test_paper_id = tp.id) AS paper_resources
    FROM test_papers tp
    JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id
    JOIN exams e ON e.id = ec.exam_id
    JOIN subjects s ON s.id = tp.subject_id
    LEFT JOIN subject_categories cat ON cat.id = s.category_id
    LEFT JOIN extraction_jobs j ON j.source_url = tp.official_syllabus_url
    LEFT JOIN latest l ON l.test_paper_id = tp.id
    LEFT JOIN node_stats ns ON ns.vid = l.id
    WHERE e.code = ? AND ec.year = ?
    ORDER BY cat.code, tp.code`;
  const { results } = await db.prepare(sql).bind(examCode, year).all<RawRow>();
  return results.map((r) => ({
    testPaperId: String(r.id),
    code: String(r.code),
    name: String(r.name),
    categoryCode: (r.category_code as string) ?? null,
    categoryName: (r.category_name as string) ?? null,
    officialSyllabusUrl: (r.official_syllabus_url as string) ?? null,
    pipeline: {
      stage: (r.job_stage as string) ?? null,
      status: (r.job_status as string) ?? null,
      blockerReason: (r.blocker_reason as string) ?? null,
      attempts: r.attempts === null ? null : n(r.attempts),
    },
    syllabus: r.version_id
      ? {
          versionId: String(r.version_id),
          versionNumber: n(r.version_number),
          status: String(r.version_status),
          verification: String(r.version_verification),
          sectionsImported: n(r.sections),
          unitsImported: n(r.units),
          topicsImported: n(r.topics),
          subtopicsImported: n(r.subtopics),
          learningPoints: n(r.points),
          awaitingVerification: n(r.awaiting),
          machineVerified: n(r.machine_verified),
          verified: n(r.verified),
          approved: n(r.approved),
          rejected: n(r.rejected),
          withLearningContent: n(r.with_res),
          withPublishedLearningContent: n(r.with_pub_res),
          withQuestions: n(r.with_q),
          withVisuals: n(r.with_visual),
          missingLearningContent: n(r.points) - n(r.with_res),
          missingQuestions: n(r.points) - n(r.with_q),
          figuresExtracted: n(r.figures),
          tablesExtracted: n(r.tables),
        }
      : null,
    questionsLinkedToPaper: n(r.paper_questions),
    resourcesLinkedToPaper: n(r.paper_resources),
  }));
}

export async function examCoverage(db: D1Database, examCode: string, year: number) {
  const papers = await paperCoverage(db, examCode, year);
  const { results: jobs } = await db
    .prepare('SELECT stage, status, paper_code, paper_name, blocker_reason, last_error FROM extraction_jobs WHERE exam_code = ? AND cycle_year = ?')
    .bind(examCode, year)
    .all<{ stage: string; status: string; paper_code: string | null; paper_name: string | null; blocker_reason: string | null; last_error: string | null }>();
  const reached = (stage: (typeof STAGES)[number]) =>
    jobs.filter((j) => STAGES.indexOf(j.stage as (typeof STAGES)[number]) >= STAGES.indexOf(stage) && j.status !== 'FAILED' && !(j.stage === stage && j.status === 'BLOCKED')).length;
  const imported = papers.filter((p) => p.syllabus);
  const sum = (f: (s: NonNullable<PaperCoverage['syllabus']>) => number) => imported.reduce((acc, p) => acc + f(p.syllabus!), 0);
  const notImported = papers.filter((p) => !p.syllabus);
  return {
    exam: examCode,
    year,
    provisional: papers.length === 0 || notImported.length > 0,
    basis:
      'Paper totals come from the official NTA paper list registered in D1. Topic totals cover imported syllabus versions only; ' +
      'papers not yet imported have unknown topic counts and are listed under pendingPapers.',
    documents: {
      discovered: jobs.length,
      downloaded: reached('DOWNLOADED'),
      stored: reached('STORED'),
      extracted: reached('EXTRACTED'),
      imported: jobs.filter((j) => j.stage === 'IMPORTED' || j.stage === 'VERIFIED').length,
      blocked: jobs.filter((j) => j.status === 'BLOCKED').length,
      failed: jobs.filter((j) => j.status === 'FAILED').length,
    },
    papers: {
      officialPapersRegistered: papers.length,
      papersWithImportedSyllabus: imported.length,
      papersPendingImport: notImported.length,
    },
    curriculum: {
      sectionsImported: sum((s) => s.sectionsImported),
      unitsImported: sum((s) => s.unitsImported),
      topicsImported: sum((s) => s.topicsImported),
      subtopicsImported: sum((s) => s.subtopicsImported),
      learningPointsImported: sum((s) => s.learningPoints),
      awaitingVerification: sum((s) => s.awaitingVerification),
      machineVerified: sum((s) => s.machineVerified),
      humanVerified: sum((s) => s.verified),
      approved: sum((s) => s.approved),
      rejected: sum((s) => s.rejected),
      withLearningContent: sum((s) => s.withLearningContent),
      withQuestions: sum((s) => s.withQuestions),
      withVisuals: sum((s) => s.withVisuals),
      missingLearningContent: sum((s) => s.missingLearningContent),
      missingQuestions: sum((s) => s.missingQuestions),
      figuresExtracted: sum((s) => s.figuresExtracted),
      tablesExtracted: sum((s) => s.tablesExtracted),
    },
    pendingPapers: notImported.map((p) => ({ code: p.code, name: p.name, stage: p.pipeline.stage, status: p.pipeline.status, reason: p.pipeline.blockerReason })),
    blockedOrFailed: jobs
      .filter((j) => j.status === 'BLOCKED' || j.status === 'FAILED')
      .map((j) => ({ code: j.paper_code, name: j.paper_name, stage: j.stage, status: j.status, reason: j.blocker_reason ?? j.last_error })),
    perPaper: papers,
  };
}

/** Topic-level detail for one paper's latest syllabus version. */
export async function topicCoverage(db: D1Database, testPaperId: string) {
  const { results } = await db
    .prepare(
      `WITH latest AS (SELECT id FROM syllabus_versions WHERE test_paper_id = ? ORDER BY version_number DESC LIMIT 1)
       SELECT n.id, n.parent_id, n.kind, n.label, n.title, n.depth, n.position, n.source_page, n.verification, n.extraction_flags,
         (SELECT COUNT(*) FROM learning_resources r WHERE r.curriculum_node_id = n.id) AS resources,
         (SELECT COUNT(*) FROM question_topics qt WHERE qt.curriculum_node_id = n.id) AS questions,
         (SELECT COUNT(*) FROM media_assets m WHERE m.curriculum_node_id = n.id) AS figures
       FROM curriculum_nodes n JOIN latest ON latest.id = n.syllabus_version_id
       ORDER BY n.depth, n.parent_id, n.position`,
    )
    .bind(testPaperId)
    .all();
  return results;
}
