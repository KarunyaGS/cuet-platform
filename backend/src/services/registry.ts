import { z } from 'zod';
import type { PrismaClient } from '@cuet/database';
import { invalid, notFound } from '../lib/errors';
import { newId, slugify } from '../lib/hash';
import { nowIso } from '../lib/sql';

/** The official list of papers for one exam cycle, as discovered on the NTA syllabus pages. */
export const paperRegistrySchema = z.object({
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  year: z.number().int().min(2020).max(2100),
  papers: z
    .array(
      z.object({
        code: z.string().min(1).max(20),
        name: z.string().min(1).max(200),
        categoryCode: z.string().min(1).max(20),
        officialSyllabusUrl: z.url().max(1000),
        listedOnUrl: z.url().max(1000),
      }),
    )
    .min(1)
    .max(500),
});
export type PaperRegistry = z.infer<typeof paperRegistrySchema>;

interface CycleRules {
  questionsPerPaper?: number;
  durationMinutes?: number;
  marksCorrect?: number;
  marksIncorrect?: number;
  mediumNote?: string;
}

/**
 * Register (or refresh) the official paper list: subjects, test papers and one DISCOVERED
 * pipeline job per official syllabus document. Idempotent; never deletes or renames existing rows.
 */
export async function registerPapers(prisma: PrismaClient, db: D1Database, input: PaperRegistry, actor: string) {
  const cycle = await prisma.examCycle.findFirst({ where: { year: input.year, exam: { code: input.exam } }, include: { exam: true } });
  if (!cycle) throw notFound(`Exam cycle ${input.exam} ${input.year}`);
  const categories = await prisma.subjectCategory.findMany({ where: { examId: cycle.examId } });
  const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));
  const codes = new Set<string>();
  for (const p of input.papers) {
    if (!categoryByCode.has(p.categoryCode)) throw invalid(`Unknown category ${p.categoryCode} for ${input.exam}`);
    if (codes.has(p.code)) throw invalid(`Paper code ${p.code} appears twice`);
    codes.add(p.code);
  }
  const rules = JSON.parse(cycle.rulesJson ?? '{}') as CycleRules;
  const now = nowIso();
  const level = cycle.exam.level.toLowerCase();
  const statements: D1PreparedStatement[] = [];
  for (const p of input.papers) {
    const slug = slugify(p.name) || slugify(p.code);
    const subjectId = `subj_${level}_${slug}`.slice(0, 120);
    const paperId = `paper_${input.exam.toLowerCase()}_${input.year}_${p.code.toLowerCase()}`;
    statements.push(
      db
        .prepare(
          `INSERT INTO subjects (id, exam_id, category_id, slug, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(exam_id, slug) DO NOTHING`,
        )
        .bind(subjectId, cycle.examId, categoryByCode.get(p.categoryCode)!, slug, p.name, now, now),
      db
        .prepare(
          `INSERT INTO test_papers (id, exam_cycle_id, subject_id, code, name, question_count, duration_minutes, marks_correct,
             marks_incorrect, medium_note, official_syllabus_url, status, created_at, updated_at)
           VALUES (?, ?, (SELECT id FROM subjects WHERE exam_id = ? AND slug = ?), ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)
           ON CONFLICT(exam_cycle_id, code) DO UPDATE SET official_syllabus_url = excluded.official_syllabus_url, updated_at = excluded.updated_at`,
        )
        .bind(
          paperId, cycle.id, cycle.examId, slug, p.code, p.name, rules.questionsPerPaper ?? null, rules.durationMinutes ?? null,
          rules.marksCorrect ?? null, rules.marksIncorrect ?? null, rules.mediumNote ?? null, p.officialSyllabusUrl, now, now,
        ),
      db
        .prepare(
          `INSERT INTO extraction_jobs (id, exam_code, cycle_year, paper_code, paper_name, document_title, source_url, listed_on_url,
             test_paper_id, stage, status, attempts, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, (SELECT id FROM test_papers WHERE exam_cycle_id = ? AND code = ?), 'DISCOVERED', 'PENDING', 0, ?, ?)
           ON CONFLICT(source_url) DO NOTHING`,
        )
        .bind(
          newId('job'), input.exam, input.year, p.code, p.name, `${input.exam.replace('_', '-')} ${input.year} syllabus: ${p.name} (${p.code})`,
          p.officialSyllabusUrl, p.listedOnUrl, cycle.id, p.code, now, now,
        ),
    );
  }
  statements.push(
    db
      .prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(newId('aud'), actor, 'REGISTER_PAPERS', 'EXAM_CYCLE', cycle.id, JSON.stringify({ papers: input.papers.length }), now),
  );
  await db.batch(statements);
  const registered = await prisma.testPaper.count({ where: { examCycleId: cycle.id } });
  return { examCycleId: cycle.id, papersInRequest: input.papers.length, papersRegisteredInCycle: registered };
}

export const jobReportSchema = z.object({
  sourceUrl: z.url().max(1000),
  stage: z.enum(['DISCOVERED', 'DOWNLOADED', 'STORED', 'EXTRACTED', 'VALIDATED', 'IMPORTED', 'VERIFIED']),
  status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'BLOCKED']),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  blockerReason: z.string().max(500).optional(),
  error: z.string().max(2000).optional(),
  stats: z.record(z.string(), z.unknown()).optional(),
});

/** Record progress of one document through the pipeline. Failures increase the attempt count. */
export async function reportJob(db: D1Database, input: z.infer<typeof jobReportSchema>) {
  const res = await db
    .prepare(
      `UPDATE extraction_jobs SET stage = ?, status = ?, sha256 = COALESCE(?, sha256), blocker_reason = ?,
         last_error = ?, stats_json = COALESCE(?, stats_json),
         attempts = attempts + CASE WHEN ? IN ('FAILED', 'BLOCKED') OR ? = 'DOWNLOADED' THEN 1 ELSE 0 END, updated_at = ?
       WHERE source_url = ?`,
    )
    .bind(
      input.stage, input.status, input.sha256 ?? null, input.blockerReason ?? null, input.error ?? null,
      input.stats ? JSON.stringify(input.stats) : null, input.status, input.stage, nowIso(), input.sourceUrl,
    )
    .run();
  if (!res.meta.changes) throw notFound(`Pipeline job for ${input.sourceUrl}`);
  return { updated: true };
}
