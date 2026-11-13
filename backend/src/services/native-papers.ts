/**
 * Native CUET Prep documents: PDFs we generate ourselves and keep in our own storage, shown in the platform's viewer.
 *
 * Rights come first. A document may be generated only from content we are allowed to reproduce:
 *  - our own questions (usage permission OWNED_ORIGINAL), or
 *  - third-party content with a permission on record, quoted in full when the document is registered.
 * A previous-year paper found on another website has neither, so it cannot be turned into a native document; it keeps
 * its link to the source. Nothing here reads or copies a third-party paper.
 *
 * A practice paper made from our own questions is never called a previous-year paper. While any of its questions is
 * still unreviewed it is marked UNREVIEWED and shown only where draft content is shown (local preview). No AI calls.
 */
import { z } from 'zod';
import { ApiError, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { apportion } from './practice-centre';

const CHOICE_TYPES = `'MCQ_SINGLE','ASSERTION_REASON','STATEMENT_BASED','MATCH_THE_FOLLOWING','DIAGRAM_BASED'`;
export const draftQuery = z.object({ paperId: z.string().min(1).max(100), count: z.coerce.number().int().min(10).max(100).default(50), set: z.coerce.number().int().min(1).max(20).default(1) });

interface QRow {
  id: string;
  type: string;
  stem: string;
  structure_json: string | null;
  verification: string;
  unit_id: string | null;
  unit_title: string | null;
  unit_position: number | null;
  passage_title: string | null;
  passage_body: string | null;
}

/**
 * The content of one practice paper, made only from questions we own. Questions are spread over the syllabus units in
 * proportion to what the bank holds, and each set takes different questions, so two sets never share one.
 */
export async function draftPracticePaper(db: D1Database, q: z.infer<typeof draftQuery>) {
  const paper = await db
    .prepare('SELECT tp.id, tp.code, tp.name, tp.question_count, tp.duration_minutes, tp.marks_correct, tp.marks_incorrect, e.code AS exam FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE tp.id = ?')
    .bind(q.paperId)
    .first<{ id: string; code: string; name: string; question_count: number | null; duration_minutes: number | null; marks_correct: number | null; marks_incorrect: number | null; exam: string }>();
  if (!paper) throw notFound('Subject');
  // Only our own questions, with four options and an answer key; never demonstration, rejected or archived ones.
  const { results } = await db
    .prepare(
      `WITH RECURSIVE up(qid, node, parent) AS (
         SELECT qt.question_id, n.id, n.parent_id FROM question_topics qt JOIN curriculum_nodes n ON n.id = qt.curriculum_node_id
         UNION ALL SELECT up.qid, n.id, n.parent_id FROM up JOIN curriculum_nodes n ON n.id = up.parent)
       SELECT q.id, q.type, q.stem, q.structure_json, q.verification, u.id AS unit_id, u.title AS unit_title, u.position AS unit_position, p.title AS passage_title, p.body AS passage_body
       FROM questions q JOIN usage_permissions perm ON perm.id = q.usage_permission_id
       LEFT JOIN passages p ON p.id = q.passage_id
       LEFT JOIN curriculum_nodes u ON u.id = (SELECT node FROM up WHERE up.qid = q.id AND up.parent IS NULL LIMIT 1)
       WHERE q.test_paper_id = ?1 AND perm.code = 'OWNED_ORIGINAL' AND q.is_demonstration = 0 AND q.status != 'ARCHIVED' AND q.verification NOT IN ('REJECTED','NEEDS_CHANGES')
         AND q.type IN (${CHOICE_TYPES}) AND (SELECT COUNT(*) FROM question_options o WHERE o.question_id = q.id) = 4 AND EXISTS (SELECT 1 FROM answer_keys a WHERE a.question_id = q.id AND a.correct_option_positions IS NOT NULL)
       ORDER BY u.position, q.id`,
    )
    .bind(q.paperId)
    .all<QRow>();
  if (results.length < q.count * q.set) throw new ApiError(409, 'NOT_ENOUGH_QUESTIONS', `Set ${q.set} of ${q.count} questions needs ${q.count * q.set} of our own questions for this subject; ${results.length} are available`);
  const units: { id: string | null; title: string; rows: QRow[] }[] = [];
  for (const r of results) {
    let u = units.find((x) => x.id === r.unit_id);
    if (!u) units.push((u = { id: r.unit_id, title: r.unit_title ?? 'General', rows: [] }));
    u.rows.push(r);
  }
  const quota = apportion(q.count, units.map((u) => u.rows.length));
  const picked: (QRow & { unit: string })[] = [];
  units.forEach((u, i) => {
    // Set n starts where set n-1 stopped, wrapping round inside the unit only when it is too small.
    const start = ((q.set - 1) * quota[i]!) % Math.max(1, u.rows.length);
    for (let k = 0; k < quota[i]!; k++) picked.push({ ...u.rows[(start + k) % u.rows.length]!, unit: u.title });
  });
  const ids = picked.map((p) => p.id);
  const options = new Map<string, { position: number; label: string; text: string }[]>();
  const keys = new Map<string, number[]>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const marks = part.map(() => '?').join(',');
    const [o, k] = await Promise.all([
      db.prepare(`SELECT question_id, position, label, text FROM question_options WHERE question_id IN (${marks}) ORDER BY position`).bind(...part).all<{ question_id: string; position: number; label: string; text: string }>(),
      db.prepare(`SELECT question_id, correct_option_positions FROM answer_keys WHERE question_id IN (${marks})`).bind(...part).all<{ question_id: string; correct_option_positions: string }>(),
    ]);
    for (const r of o.results) options.set(r.question_id, [...(options.get(r.question_id) ?? []), { position: r.position, label: r.label, text: r.text }]);
    for (const r of k.results) keys.set(r.question_id, JSON.parse(r.correct_option_positions) as number[]);
  }
  const reviewed = picked.every((p) => p.verification === 'VERIFIED');
  return {
    schema: 'cuet-native-paper/1' as const,
    key: `cuetprep:practice:${paper.exam}:${paper.code}:set-${q.set}`,
    kind: 'PRACTICE_PAPER' as const,
    exam: paper.exam,
    paperId: paper.id,
    subjectCode: paper.code,
    subjectName: paper.name,
    set: q.set,
    title: `CUET Prep practice paper: ${paper.name}, set ${q.set}`,
    language: 'English',
    rights: { basis: 'OWNED_ORIGINAL' as const, statement: 'Every question in this paper was written for CUET Prep and is owned by it. It is not a previous-year paper and contains no question from any examination paper.' },
    reviewState: reviewed ? ('REVIEWED' as const) : ('UNREVIEWED' as const),
    reviewedQuestions: picked.filter((p) => p.verification === 'VERIFIED').length,
    pattern: { questions: picked.length, durationMinutes: paper.duration_minutes, marksCorrect: paper.marks_correct, marksIncorrect: paper.marks_incorrect, officialQuestionCount: paper.question_count },
    units: units.map((u, i) => ({ title: u.title, questions: quota[i]! })).filter((u) => u.questions > 0),
    questions: picked.map((p, i) => ({
      number: i + 1, id: p.id, type: p.type, unit: p.unit, stem: p.stem, structure: p.structure_json ? (JSON.parse(p.structure_json) as Record<string, unknown>) : null,
      passage: p.passage_body ? { title: p.passage_title, body: p.passage_body } : null, options: options.get(p.id) ?? [],
    })),
    // Kept apart from the questions; printed on its own page at the end.
    answerKey: picked.map((p, i) => ({ number: i + 1, correct: (keys.get(p.id) ?? []).map((pos) => options.get(p.id)?.find((o) => o.position === pos)?.label ?? String(pos)) })),
  };
}

export const registerSchema = z
  .object({
    key: z.string().regex(/^cuetprep:[a-z0-9:._-]{3,150}$/i),
    exam: z.enum(['CUET_UG', 'CUET_PG']),
    subjectCode: z.string().max(20),
    subjectName: z.string().min(2).max(200),
    title: z.string().min(5).max(300),
    language: z.literal('English'),
    r2Key: z.string().regex(/^media\/[0-9a-f]{64}\.pdf$/),
    pages: z.number().int().positive(),
    reviewState: z.enum(['REVIEWED', 'UNREVIEWED']),
    rights: z.object({ basis: z.enum(['OWNED_ORIGINAL', 'PERMISSION_ON_RECORD']), statement: z.string().min(20).max(1000), permissionReference: z.string().max(500).optional() }),
    questionIds: z.array(z.string().max(100)).min(1).max(200),
  })
  .refine((v) => v.rights.basis !== 'PERMISSION_ON_RECORD' || (v.rights.permissionReference ?? '').trim().length >= 10, { message: 'Reproducing third-party content needs the permission reference on record' });

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Records a generated PDF that is already in our storage, so students can open it. The rights basis is stored with it. */
export async function registerNativeDocument(db: D1Database, bucket: R2Bucket, body: unknown, actor: string) {
  const input = registerSchema.parse(body);
  const stored = await bucket.head(input.r2Key);
  if (!stored) throw invalid('The generated PDF is not in storage. Upload it first.');
  if (stored.httpMetadata?.contentType !== 'application/pdf') throw invalid('The stored file is not a PDF');
  if (input.rights.basis === 'OWNED_ORIGINAL') {
    // "Our own" is checked, not taken on trust: every question must carry the owned-original permission.
    let owned = 0;
    for (let i = 0; i < input.questionIds.length; i += 80) {
      const part = input.questionIds.slice(i, i + 80);
      const r = await db
        .prepare(`SELECT COUNT(*) AS n FROM questions q JOIN usage_permissions p ON p.id = q.usage_permission_id WHERE p.code = 'OWNED_ORIGINAL' AND q.is_demonstration = 0 AND q.id IN (${part.map(() => '?').join(',')})`)
        .bind(...part)
        .first<{ n: number }>();
      owned += r?.n ?? 0;
    }
    if (owned !== new Set(input.questionIds).size) throw new ApiError(409, 'RIGHTS_NOT_CONFIRMED', 'Not every question in this document is our own original content, so it cannot be published as a CUET Prep document');
  }
  const section = input.subjectCode.startsWith('1') ? 'LANGUAGE' : /general/i.test(input.subjectName) ? 'GENERAL' : 'DOMAIN';
  // The subject is filed under the same name the papers index uses, so the document appears with that subject's papers.
  const known = await db.prepare(`SELECT subject_slug, subject_name FROM pyq_documents WHERE exam_code = ? AND subject_code = ? AND subject_slug IS NOT NULL AND r2_key IS NULL ORDER BY year DESC LIMIT 1`).bind(input.exam, input.subjectCode).first<{ subject_slug: string; subject_name: string }>();
  const now = nowIso();
  const rights = input.rights.basis === 'OWNED_ORIGINAL' ? `Own content. ${input.rights.statement}` : `Permission on record: ${input.rights.permissionReference}. ${input.rights.statement}`;
  const existing = await db.prepare('SELECT id FROM pyq_documents WHERE key = ?').bind(input.key).first<{ id: string }>();
  const id = existing?.id ?? newId('pyq');
  const values = [
    input.exam, null, 'PRACTICE_PAPER', 'CUET_PREP_ORIGINAL', 0, section, input.subjectCode, known?.subject_name ?? input.subjectName, known?.subject_slug ?? slug(input.subjectName), `Set generated on ${now.slice(0, 10)}`, input.title, null, null, input.language,
    'CUET Prep', 'https://cuet-prep.invalid/practice-centre', null, `r2:${input.r2Key}`, 'cuet-prep', input.pages, stored.size, 1, 200, 1, null,
    'A practice paper written by CUET Prep. It is not a previous-year paper.', '[]', null, null, now.slice(0, 10), now, input.r2Key, input.reviewState, rights,
  ];
  if (existing) {
    await db
      .prepare(
        `UPDATE pyq_documents SET exam_code = ?, year = ?, kind = ?, classification = ?, official = ?, section = ?, subject_code = ?, subject_name = ?, subject_slug = ?, listed_as = ?, title = ?, exam_date = ?, shift = ?, language = ?,
           source_site = ?, source_page_url = ?, document_page_url = ?, file_url = ?, file_host = ?, pages = ?, bytes = ?, working = ?, http_status = ?, embeddable = ?, source_claim = ?, note = ?, alternatives_json = ?, sessions_json = ?,
           replaced_by_key = ?, checked_on = ?, updated_at = ?, r2_key = ?, review_state = ?, rights_basis = ? WHERE id = ?`,
      )
      .bind(...values, id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO pyq_documents (exam_code, year, kind, classification, official, section, subject_code, subject_name, subject_slug, listed_as, title, exam_date, shift, language,
           source_site, source_page_url, document_page_url, file_url, file_host, pages, bytes, working, http_status, embeddable, source_claim, note, alternatives_json, sessions_json,
           replaced_by_key, checked_on, updated_at, r2_key, review_state, rights_basis, id, key, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(...values, id, input.key, now)
      .run();
  }
  await db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, existing ? 'UPDATE_NATIVE_DOCUMENT' : 'CREATE_NATIVE_DOCUMENT', 'PYQ_DOCUMENT', id, now).run();
  return { id, key: input.key, created: !existing, bytes: stored.size, pages: input.pages, reviewState: input.reviewState };
}

/** Streams a native document from our storage, with byte ranges so the viewer can load a page at a time. */
export async function nativeFile(bucket: R2Bucket, r2Key: string, title: string, range: string | undefined, download: boolean): Promise<Response> {
  const m = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
  const head = await bucket.head(r2Key);
  if (!head) throw notFound('Document file');
  const size = head.size;
  const offset = m ? Math.min(Number(m[1]), size - 1) : 0;
  const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  const obj = await bucket.get(r2Key, m ? { range: { offset, length: end - offset + 1 } } : undefined);
  if (!obj) throw notFound('Document file');
  const name = `${title.replace(/[^A-Za-z0-9 ,.-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'cuet-prep-paper'}.pdf`;
  const headers = new Headers({
    'content-type': 'application/pdf', 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=300', 'content-length': String(end - offset + 1),
    'content-disposition': `${download ? 'attachment' : 'inline'}; filename="${name}"`,
  });
  if (m) headers.set('content-range', `bytes ${offset}-${end}/${size}`);
  return new Response(obj.body, { status: m ? 206 : 200, headers });
}
