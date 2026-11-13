/**
 * Previous-year papers found on public websites: an index of documents, each with a destination that was checked to
 * open (see research/cuet-pyq-2024-2026/build_index.py).
 *
 * Nothing is copied or hosted. A document is shown inside the platform's viewer only when the file's own host lets
 * other websites read it; then the student's browser loads it straight from that host. Otherwise the paper opens on
 * the source's own page. A third-party copy is always labelled as one, never as the exam body's original.
 * Dates, shifts and languages appear only where the source states them. No AI calls.
 */
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { nativeFile } from './native-papers';

const KINDS = ['QUESTION_PAPER', 'ANSWER_KEY', 'SAMPLE_PAPER'] as const;
const httpsUrl = z.string().max(600).refine((u) => /^https:\/\/[^\s/]+\//.test(u), 'Addresses must be https');
const documentSchema = z.object({
  key: z.string().min(3).max(200),
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  year: z.number().int().min(2015).max(2100).nullable(),
  kind: z.enum(KINDS),
  classification: z.enum(['OFFICIAL', 'THIRD_PARTY_COPY', 'MEMORY_BASED', 'SAMPLE']),
  official: z.boolean(),
  section: z.enum(['LANGUAGE', 'DOMAIN', 'GENERAL']).nullable(),
  subjectCode: z.string().max(20).nullable(),
  subjectName: z.string().max(200).nullable(),
  subjectSlug: z.string().max(200).nullable(),
  listedAs: z.string().max(300).nullable(),
  title: z.string().min(3).max(400),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  shift: z.string().max(60).nullable(),
  language: z.string().max(80).nullable(),
  sourceSite: z.string().min(2).max(80),
  sourcePageUrl: httpsUrl,
  documentPageUrl: httpsUrl.nullable(),
  fileUrl: httpsUrl,
  fileHost: z.string().max(200),
  pages: z.number().int().positive().nullable(),
  bytes: z.number().int().positive().nullable(),
  working: z.boolean(),
  httpStatus: z.number().int(),
  embeddable: z.boolean(),
  sourceClaim: z.string().max(300).nullable(),
  note: z.string().max(1000).nullable().optional(),
  alternatives: z.array(z.object({ site: z.string().max(80), url: httpsUrl.nullable(), title: z.string().max(400) })).max(20).default([]),
  sessions: z.record(z.string(), z.array(z.object({ date: z.string().nullable().optional(), shift: z.string().nullable().optional(), keyPage: z.number().int().nullable().optional() }))).optional(),
  replacedBy: z.string().max(200).optional(),
  checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const pyqIndexSchema = z.object({ schema: z.literal('cuet-pyq-index/1'), exam: z.enum(['CUET_UG', 'CUET_PG']), builtOn: z.string(), documents: z.array(documentSchema).max(5000) }).passthrough();

/** Replaces the index of one exam with a freshly built one. The index is a list of links, rebuilt from public pages. */
export async function importPyqIndex(db: D1Database, body: unknown, englishHindi = false) {
  const input = pyqIndexSchema.parse(body);
  const keys = new Set<string>();
  for (const d of input.documents) {
    if (d.exam !== input.exam) throw new Error(`Document ${d.key} belongs to another exam`);
    if (keys.has(d.key)) throw new Error(`Document ${d.key} is listed twice`);
    keys.add(d.key);
  }
  const now = nowIso();
  const statements: D1PreparedStatement[] = [db.prepare('DELETE FROM pyq_documents WHERE exam_code = ? AND r2_key IS NULL').bind(input.exam)];
  for (const d of input.documents)
    statements.push(
      db
        .prepare(
          `INSERT INTO pyq_documents (id, key, exam_code, year, kind, classification, official, section, subject_code, subject_name, subject_slug, listed_as, title, exam_date, shift, language,
             source_site, source_page_url, document_page_url, file_url, file_host, pages, bytes, working, http_status, embeddable, source_claim, note, alternatives_json, sessions_json, replaced_by_key, checked_on, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          newId('pyq'), d.key, d.exam, d.year, d.kind, d.classification, d.official ? 1 : 0, d.section, d.subjectCode, d.subjectName, d.subjectSlug, d.listedAs, d.title, d.examDate, d.shift, d.language,
          d.sourceSite, d.sourcePageUrl, d.documentPageUrl, d.fileUrl, d.fileHost, d.pages, d.bytes, d.working ? 1 : 0, d.httpStatus, d.embeddable ? 1 : 0, d.sourceClaim, d.note ?? null,
          JSON.stringify(d.alternatives), d.sessions ? JSON.stringify(d.sessions) : null, d.replacedBy ?? null, d.checkedOn, now, now,
        ),
    );
  for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40));
  const shown = input.documents.filter((d) => isShown(d, englishHindi));
  const reachable = input.documents.filter((d) => (d.working || d.httpStatus === -1) && !d.replacedBy);
  return {
    exam: input.exam, stored: input.documents.length, shown: shown.length, checkedWorking: shown.filter((d) => d.working).length, notMachineChecked: shown.filter((d) => d.httpStatus === -1).length,
    // Stored but not shown to students: not English-medium (another language, a regional bilingual booklet, or language not verified).
    hiddenNotEnglish: reachable.length - shown.length,
    notWorking: input.documents.filter((d) => !d.working && d.httpStatus !== -1).length, replacedByOfficial: input.documents.filter((d) => d.replacedBy).length,
  };
}

/**
 * What students see.
 * - Only documents whose destination opened when checked, plus links a site's robots rules did not let us check
 *   (http_status -1; marked as not checked). Never copies that the exam body's own file replaces.
 * - Only English-medium papers. A question paper or sample paper is shown when its language was verified and recorded
 *   as exactly "English". With `englishHindi` on, NTA's bilingual computer-based papers are shown as well: they print
 *   every question in English and again in Hindi, and are recorded and labelled "English + Hindi", never as English.
 *   Papers in another language, booklets paired with a regional language, and papers whose language could not be
 *   verified stay in the table and are not shown. Answer keys have no language.
 */
export const ENGLISH = 'English';
export const ENGLISH_HINDI = 'English + Hindi';
export interface Scope {
  /** Show the file inside the platform when its host allows it. */
  inApp: boolean;
  /** Also show bilingual English + Hindi papers. */
  englishHindi: boolean;
  /** Draft content is shown (local preview): include our own documents that are not yet fully reviewed. */
  preview?: boolean;
}
const languages = (englishHindi: boolean) => (englishHindi ? [ENGLISH, ENGLISH_HINDI] : [ENGLISH]);
const shownSql = (englishHindi: boolean, preview = false) =>
  `(working = 1 OR http_status = -1) AND replaced_by_key IS NULL AND (kind = 'ANSWER_KEY' OR language IN (${languages(englishHindi).map((l) => `'${l}'`).join(',')}))` +
  // Our own generated documents: fully reviewed ones always; unreviewed ones only where draft content is shown.
  ` AND (review_state IS NULL OR review_state = 'REVIEWED'${preview ? " OR review_state = 'UNREVIEWED'" : ''})`;
const isShown = (d: { working: boolean; httpStatus: number; replacedBy?: string; kind: string; language: string | null }, englishHindi: boolean) =>
  (d.working || d.httpStatus === -1) && !d.replacedBy && (d.kind === 'ANSWER_KEY' || (d.language !== null && languages(englishHindi).includes(d.language)));

type Row = Record<string, string | number | null>;

const out = (r: Row, inApp: boolean) => {
  // A document in our own storage is always shown here; one on another website only when its host allows it.
  const native = r.r2_key !== null && r.r2_key !== undefined;
  const embed = native || (inApp && Boolean(r.embeddable));
  const ownFile = `/api/learn/pyq/documents/${r.id}/file`;
  return {
    id: r.id as string,
    kind: r.kind as (typeof KINDS)[number] | 'PRACTICE_PAPER',
    classification: r.classification as string,
    official: Boolean(r.official),
    year: r.year as number | null,
    subjectCode: r.subject_code as string | null,
    subjectName: r.subject_name as string | null,
    subjectSlug: r.subject_slug as string | null,
    section: r.section as string | null,
    title: r.title as string,
    listedAs: r.listed_as as string | null,
    examDate: r.exam_date as string | null,
    shift: r.shift as string | null,
    language: r.language as string | null,
    pages: r.pages as number | null,
    sourceSite: r.source_site as string,
    sourcePageUrl: native ? '/practice-centre' : (r.source_page_url as string),
    note: r.note as string | null,
    checkedOn: r.checked_on as string,
    /** False when the source's robots rules did not allow the link to be checked automatically. */
    linkChecked: Number(r.http_status) !== -1,
    /** IN_APP: the file's host lets this site show it. SOURCE: it opens on the source's own page. Either way the click opens the paper. */
    viewer: embed ? ('IN_APP' as const) : ('SOURCE' as const),
    fileUrl: native ? ownFile : embed ? (r.file_url as string) : null,
    native,
    /** Native documents can be saved by the student. */
    downloadUrl: native ? `${ownFile}?download=1` : null,
    /** True while some of its questions are not yet approved by a reviewer. */
    unreviewed: r.review_state === 'UNREVIEWED',
    /** Where the paper itself opens: the source's page for it, or the file. */
    openUrl: native ? ownFile : ((r.document_page_url ?? r.file_url) as string),
    alternatives: JSON.parse(String(r.alternatives_json ?? '[]')) as { site: string; url: string | null; title: string }[],
  };
};

export const pyqExamSchema = z.enum(['CUET_UG', 'CUET_PG']);

/** Years and subjects that actually have a paper. Nothing is listed for a year or subject without one. */
export async function pyqTree(db: D1Database, exam: string, englishHindi = false, preview = false) {
  const SHOWN = shownSql(englishHindi, preview);
  const [subjects, keys, samples, checked] = await Promise.all([
    db
      .prepare(
        `SELECT year, subject_slug AS slug, MAX(subject_code) AS code, MAX(subject_name) AS name, MAX(section) AS section, COUNT(*) AS papers
         FROM pyq_documents WHERE exam_code = ? AND kind = 'QUESTION_PAPER' AND ${SHOWN} AND year IS NOT NULL AND subject_slug IS NOT NULL GROUP BY year, subject_slug`,
      )
      .bind(exam)
      .all<{ year: number; slug: string; code: string | null; name: string; section: string | null; papers: number }>(),
    db.prepare(`SELECT year, COUNT(*) AS n FROM pyq_documents WHERE exam_code = ? AND kind = 'ANSWER_KEY' AND ${SHOWN} GROUP BY year`).bind(exam).all<{ year: number; n: number }>(),
    db.prepare(`SELECT subject_slug AS slug, COUNT(*) AS n FROM pyq_documents WHERE exam_code = ? AND kind = 'SAMPLE_PAPER' AND ${SHOWN} GROUP BY subject_slug`).bind(exam).all<{ slug: string; n: number }>(),
    db.prepare(`SELECT MAX(checked_on) AS at, COUNT(*) AS total FROM pyq_documents WHERE exam_code = ? AND ${SHOWN}`).bind(exam).first<{ at: string | null; total: number }>(),
  ]);
  const sampleOf = new Map(samples.results.map((s) => [s.slug, s.n]));
  const order = { LANGUAGE: 0, DOMAIN: 1, GENERAL: 2 } as Record<string, number>;
  const years = [...new Set(subjects.results.map((s) => s.year))].sort((a, b) => b - a);
  return {
    exam,
    total: checked?.total ?? 0,
    checkedOn: checked?.at ?? null,
    years: years.map((year) => {
      const list = subjects.results.filter((s) => s.year === year).sort((a, b) => (order[a.section ?? ''] ?? 3) - (order[b.section ?? ''] ?? 3) || a.name.localeCompare(b.name));
      return {
        year,
        papers: list.reduce((n, s) => n + s.papers, 0),
        answerKeys: keys.results.find((k) => k.year === year)?.n ?? 0,
        subjects: list.map((s) => ({ slug: s.slug, code: s.code, name: s.name, section: s.section, papers: s.papers, samplePapers: sampleOf.get(s.slug) ?? 0 })),
      };
    }),
  };
}

/** Everything for one subject in one year: its question papers, the year's answer keys (with this subject's pages), and its sample papers. */
export async function pyqSubject(db: D1Database, exam: string, year: number, slug: string, scope: Scope) {
  const SHOWN = shownSql(scope.englishHindi, scope.preview);
  const inApp = scope.inApp;
  const { results } = await db
    .prepare(
      `SELECT * FROM pyq_documents WHERE exam_code = ?1 AND ${SHOWN} AND (
         (kind = 'QUESTION_PAPER' AND year = ?2 AND subject_slug = ?3) OR (kind = 'ANSWER_KEY' AND year = ?2) OR (kind IN ('SAMPLE_PAPER','PRACTICE_PAPER') AND subject_slug = ?3))
       ORDER BY exam_date, shift, language, official DESC, title`,
    )
    .bind(exam, year, slug)
    .all<Row>();
  const papers = results.filter((r) => r.kind === 'QUESTION_PAPER');
  if (!papers.length) throw notFound('Papers for this subject and year');
  const code = papers[0]!.subject_code as string | null;
  return {
    exam,
    year,
    subject: { slug, code, name: papers[0]!.subject_name as string, section: papers[0]!.section as string | null },
    papers: papers.map((r) => out(r, inApp)),
    answerKeys: results
      .filter((r) => r.kind === 'ANSWER_KEY')
      .map((r) => {
        const sessions = r.sessions_json && code ? ((JSON.parse(String(r.sessions_json)) as Record<string, { date?: string | null; shift?: string | null; keyPage?: number | null }[]>)[code] ?? []) : [];
        return { ...out(r, inApp), sessions: sessions.map((s) => ({ date: s.date ?? null, shift: s.shift ?? null, page: s.keyPage ?? null })) };
      }),
    samplePapers: results.filter((r) => r.kind === 'SAMPLE_PAPER').map((r) => out(r, inApp)),
    // Our own practice papers for this subject: generated by CUET Prep, kept in our storage, never previous-year papers.
    practicePapers: results.filter((r) => r.kind === 'PRACTICE_PAPER').map((r) => out(r, inApp)),
  };
}

export async function pyqDocument(db: D1Database, id: string, scope: Scope) {
  const inApp = scope.inApp;
  const r = await db.prepare(`SELECT * FROM pyq_documents WHERE id = ? AND ${shownSql(scope.englishHindi, scope.preview)}`).bind(id).first<Row>();
  if (!r) throw notFound('Paper');
  return { exam: r.exam_code as string, ...out(r, inApp) };
}

/** The file of a native document, from our own storage. Only for documents a student is allowed to see. */
export async function pyqDocumentFile(db: D1Database, bucket: R2Bucket, id: string, scope: Scope, range: string | undefined, download: boolean): Promise<Response> {
  const r = await db.prepare(`SELECT r2_key, title FROM pyq_documents WHERE id = ? AND r2_key IS NOT NULL AND ${shownSql(scope.englishHindi, scope.preview)}`).bind(id).first<{ r2_key: string; title: string }>();
  if (!r) throw notFound('Paper');
  return nativeFile(bucket, r.r2_key, r.title, range, download);
}
