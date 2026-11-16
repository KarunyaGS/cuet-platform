/**
 * Admissions information: what a student can read about a university's admission, from official sources only.
 *
 * Three rules hold everywhere in this file:
 *  1. No source, no fact. A fact must cite a source that a member of staff has APPROVED, the page it came from and the day it
 *     was checked. A source starts as PROPOSED and is never used until approved.
 *  2. A fact is shown to students only after a member of staff PUBLISHES it, and only while its source is still approved.
 *  3. Personal data is never stored. Nothing here has a column for a name or a roll number, and text that looks like one is
 *     refused. Lists of candidates are linked to, never copied.
 * Text is stored as the source prints it. Nothing is worked out or predicted: a cut-off is a published figure with its basis.
 */
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId, slugify } from '../lib/hash';
import { nowIso } from '../lib/sql';

export const SOURCE_KINDS = ['NTA_LIST', 'UNIVERSITY_ADMISSION', 'CUTOFF_PAGE', 'BULLETIN', 'COUNSELLING_PORTAL'] as const;
export const FACT_KINDS = ['EVENT', 'ELIGIBILITY', 'CUTOFF'] as const;
/** What a cut-off figure is. Two figures are comparable only when their basis is the same. */
export const CUTOFF_BASES = ['ALLOCATION_SCORE', 'NORMALISED_SCORE', 'PERCENTILE', 'MARKS', 'RANK'] as const;
const EXAMS = ['CUET_UG', 'CUET_PG'] as const;
const RECOMMENDATIONS = ['USE', 'USE_WITH_CARE', 'NOT_VERIFIED', 'DO_NOT_USE'] as const;

export const universitySlug = (name: string) => slugify(name);

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => Number.isFinite(Date.parse(`${d}T00:00:00Z`)) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d, 'Not a real date');
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- the source review (16 November 2026)

/**
 * The sources reviewed on 16 November 2026, with what the review found. Loading them makes PROPOSED rows only: nothing is used
 * until a member of staff approves it. The review was made by reading the pages; the notes say what was and was not checked.
 */
export const PROPOSED_SOURCES = [
  { url: 'https://cuet.nta.nic.in/participating-universities/', slug: null, name: null, title: 'NTA: participating universities, CUET (UG)', kind: 'NTA_LIST', covers: 'The official list of participating universities by type (central, state, deemed, private, other government), and links to the information bulletins.', format: 'HTML', freq: 'Updated October 2026', note: 'Government domain (nic.in). The page itself gives only the five type links, no university names; the category pages were not opened. No programmes, eligibility or dates here.', risk: 'NONE_SEEN', rec: 'USE' },
  { url: 'https://exams.nta.nic.in/cuet-pg/', slug: null, name: null, title: 'NTA: CUET (PG) site', kind: 'NTA_LIST', covers: 'The official PG list and notices.', format: 'MIXED', freq: null, note: 'Government domain, but the server refused automated reading (403), so nothing could be checked. Open it in a browser before approving.', risk: 'UNKNOWN', rec: 'NOT_VERIFIED' },
  { url: 'https://admission.uod.ac.in', slug: 'university-of-delhi', name: 'University of Delhi', title: 'University of Delhi: admissions', kind: 'UNIVERSITY_ADMISSION', covers: 'Admissions 2026-27: seat matrices, CSAS round schedules, spot-round cut-offs, PG minimum scores, registration links.', format: 'PDF', freq: 'Active, July to November 2026', note: 'Official (ac.in, DU branding). Almost all substance is in PDF files. Merit and tentative lists are PDFs that may name candidates: link to them, never store them.', risk: 'LISTS_LINKED', rec: 'USE_WITH_CARE' },
  { url: 'https://admission.bhu.ac.in', slug: 'banaras-hindu-university', name: 'Banaras Hindu University', title: 'Banaras Hindu University: admissions', kind: 'UNIVERSITY_ADMISSION', covers: 'Session 2026-27: programme table, notices to October 2026, CAP UG and PG round schedules; eligibility only in the PDF bulletins.', format: 'MIXED', freq: 'Active', note: 'Official (ac.in). Allotment lists and a list of non-reported applicants are PDFs likely to carry names or roll numbers: never store them. Use the programme table only.', risk: 'LISTS_LINKED', rec: 'USE_WITH_CARE' },
  { url: 'https://jnuee.jnu.ac.in', slug: 'jawaharlal-nehru-university', name: 'Jawaharlal Nehru University', title: 'JNU: entrance and admissions', kind: 'CUTOFF_PAGE', covers: '2026 deadlines; cut-off pages for 2024, 2025 and 2026; prospectus (PDF).', format: 'MIXED', freq: 'Active, latest item 28 October 2026', note: 'Official (ac.in). Cut-off HTML pages are useful. Merit-list results are on separate portals and must not be stored. Mixes old and new items: check the year on every row.', risk: 'NONE_SEEN', rec: 'USE_WITH_CARE' },
  { url: 'https://acad.uohyd.ac.in', slug: 'university-of-hyderabad', name: 'University of Hyderabad', title: 'University of Hyderabad: academic section', kind: 'UNIVERSITY_ADMISSION', covers: 'A hub linking the UG-2026, PG-2026, MCA, MBA, PhD and M.Tech pages and the Prospectus-2026 (PDF).', format: 'MIXED', freq: 'Unclear', note: 'Official (ac.in). The hub carries no dates or eligibility; read the linked programme pages, not this page. A PhD interview shortlist PDF is linked.', risk: 'LISTS_LINKED', rec: 'USE_WITH_CARE' },
  { url: 'https://admission.jmi.ac.in', slug: 'jamia-millia-islamia', name: 'Jamia Millia Islamia', title: 'Jamia Millia Islamia: admissions', kind: 'UNIVERSITY_ADMISSION', covers: 'Selection lists per programme (PDF).', format: 'PDF', freq: null, note: 'Not verified: two automated reads returned nothing. Earlier notes say the selection lists contain candidate names, so they must not be stored.', risk: 'LISTS_LINKED', rec: 'NOT_VERIFIED' },
  { url: 'https://allduniv.ac.in/admission', slug: 'university-of-allahabad', name: 'University of Allahabad', title: 'University of Allahabad: admissions', kind: 'UNIVERSITY_ADMISSION', covers: 'UG Admissions 2026, PG 2026-27 and PhD 2026-27 pages, CUET-UG notices.', format: 'MIXED', freq: 'Daily or weekly, dated to 16 November 2026', note: 'Official (ac.in). The three admission pages were not opened. Hostel and scholarship lists are linked and probably name students.', risk: 'LISTS_LINKED', rec: 'USE_WITH_CARE' },
  { url: 'https://amucontrollerexams.com', slug: 'aligarh-muslim-university', name: 'Aligarh Muslim University', title: 'AMU: Controller of Examinations (third-party domain)', kind: 'UNIVERSITY_ADMISSION', covers: 'Admissions 2026-27 forms and guides.', format: 'UNKNOWN', freq: null, note: 'Not an ac.in domain. It describes itself as AMU\'s Controller of Exams, but branding is not proof, and it links to a roll list on a third domain. Do not use until amu.ac.in itself links to it.', risk: 'LISTS_LINKED', rec: 'DO_NOT_USE' },
] as const;

// ---------------------------------------------------------------- personal data

/** Text that looks like a candidate's name list, roll number or contact detail is refused. */
const PERSONAL = [
  [/\b(roll|application|registration|enrol(l)?ment)\s*(no\.?|number|#)/i, 'a roll or application number'],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, 'an email address'],
  [/(\+91[\s-]?)?\b[6-9]\d{9}\b/, 'a phone number'],
  [/\b\d{9,}\b/, 'a long number that may be a roll number'],
  [/\b(candidate|applicant|student)\s*name\b/i, 'a candidate\'s name'],
] as const;
export function personalDataProblem(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) {
    if (!t) continue;
    const hit = PERSONAL.find(([re]) => re.test(t));
    if (hit) return `contains ${hit[1]}. Candidate details are never stored; link to the official list instead`;
  }
  return null;
}

// ---------------------------------------------------------------- sources

export const sourceInputSchema = z.object({
  url: z.url().max(500).refine((u) => u.startsWith('https://'), 'The address must start with https://'),
  title: z.string().trim().min(5).max(200),
  universityName: z.string().trim().min(3).max(200).nullable().optional(),
  kind: z.enum(SOURCE_KINDS),
  covers: z.string().trim().min(10).max(1000),
  format: z.enum(['HTML', 'PDF', 'MIXED', 'UNKNOWN']),
  updateFrequency: z.string().trim().max(200).nullable().optional(),
  reliabilityNote: z.string().trim().max(1000).nullable().optional(),
  personalDataRisk: z.enum(['NONE_SEEN', 'LISTS_LINKED', 'UNKNOWN']).default('UNKNOWN'),
  recommendation: z.enum(RECOMMENDATIONS).default('NOT_VERIFIED'),
});

export async function createSource(db: D1Database, input: z.infer<typeof sourceInputSchema>, actor: string) {
  const now = nowIso();
  const id = newId('asrc');
  try {
    await db
      .prepare(
        `INSERT INTO admission_sources (id, university_slug, university_name, url, title, kind, covers, format, update_frequency, reliability_note, personal_data_risk, recommendation, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROPOSED', ?, ?, ?)`,
      )
      .bind(id, input.universityName ? universitySlug(input.universityName) : null, input.universityName ?? null, input.url, input.title, input.kind, input.covers, input.format, input.updateFrequency ?? null, input.reliabilityNote ?? null, input.personalDataRisk, input.recommendation, actor, now, now)
      .run();
  } catch (e) {
    if (/UNIQUE/i.test(String((e as Error).message))) throw conflict('This address is already in the register');
    throw e;
  }
  return { id, status: 'PROPOSED' };
}

/** Puts the sources of the 16 November 2026 review into the register as PROPOSED. Existing rows are left as they are. */
export async function loadProposedSources(db: D1Database, actor: string) {
  const now = nowIso();
  let added = 0;
  for (const s of PROPOSED_SOURCES) {
    const res = await db
      .prepare(
        `INSERT INTO admission_sources (id, university_slug, university_name, url, title, kind, covers, format, update_frequency, reliability_note, personal_data_risk, recommendation, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PROPOSED', ?, ?, ?) ON CONFLICT (url) DO NOTHING`,
      )
      .bind(newId('asrc'), s.slug, s.name, s.url, s.title, s.kind, s.covers, s.format, s.freq, s.note, s.risk, s.rec, actor, now, now)
      .run();
    added += res.meta.changes ?? 0;
  }
  return { added, total: PROPOSED_SOURCES.length };
}

export const sourceDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'RETIRE']),
  /** The day a person opened the page to check it is the official page and says what the register says. Required to approve. */
  checkedOn: day.optional(),
  note: z.string().trim().max(500).optional(),
});

/** A member of staff approves a source (after opening it) or retires it. Retiring a source hides every fact that cites it. */
export async function decideSource(db: D1Database, id: string, input: z.infer<typeof sourceDecisionSchema>, actor: string) {
  const cur = await db.prepare('SELECT id, status, recommendation FROM admission_sources WHERE id = ?').bind(id).first<{ id: string; status: string; recommendation: string }>();
  if (!cur) throw notFound('Source');
  const now = nowIso();
  if (input.action === 'RETIRE') {
    await db.prepare(`UPDATE admission_sources SET status = 'RETIRED', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(actor, now, now, id).run();
    return { id, status: 'RETIRED' };
  }
  if (!input.checkedOn) throw invalid('Say the day you opened this page and checked it (checkedOn)');
  if (input.checkedOn > today()) throw invalid('checkedOn cannot be in the future');
  if (cur.recommendation === 'DO_NOT_USE' && !input.note) throw invalid('The review recommends not using this source. Say why you are approving it (note).');
  await db
    .prepare(`UPDATE admission_sources SET status = 'APPROVED', reviewed_by = ?, reviewed_at = ?, last_checked_on = ?, reliability_note = COALESCE(reliability_note, '') || ?, updated_at = ? WHERE id = ?`)
    .bind(actor, now, input.checkedOn, input.note ? `\nApproved by ${actor}: ${input.note}` : '', now, id)
    .run();
  return { id, status: 'APPROVED' };
}

export async function listSources(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM admission_facts f WHERE f.source_id = s.id AND f.status = 'PUBLISHED') AS published_facts,
         (SELECT COUNT(*) FROM admission_facts f WHERE f.source_id = s.id AND f.status = 'DRAFT') AS draft_facts
       FROM admission_sources s ORDER BY CASE s.status WHEN 'APPROVED' THEN 0 WHEN 'PROPOSED' THEN 1 ELSE 2 END, s.university_name, s.url`,
    )
    .all<Record<string, string | number | null>>();
  return results.map((r) => ({
    id: r.id, universitySlug: r.university_slug, universityName: r.university_name, url: r.url, title: r.title, kind: r.kind, covers: r.covers, format: r.format,
    updateFrequency: r.update_frequency, reliabilityNote: r.reliability_note, personalDataRisk: r.personal_data_risk, recommendation: r.recommendation, status: r.status,
    reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, lastCheckedOn: r.last_checked_on, publishedFacts: Number(r.published_facts), draftFacts: Number(r.draft_facts),
  }));
}

// ---------------------------------------------------------------- facts

export const factInputSchema = z.object({
  universityName: z.string().trim().min(3).max(200),
  sourceId: z.string().min(1).max(100),
  kind: z.enum(FACT_KINDS),
  exam: z.enum(EXAMS),
  year: z.number().int().min(2024).max(2035),
  programme: z.string().trim().max(200).nullable().optional(),
  label: z.string().trim().min(3).max(300),
  /** As printed by the source. */
  valueText: z.string().trim().max(4000).nullable().optional(),
  valueNumber: z.number().finite().nullable().optional(),
  basis: z.enum(CUTOFF_BASES).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  round: z.string().trim().max(60).nullable().optional(),
  eventDate: day.nullable().optional(),
  sourcePage: z.number().int().min(1).max(5000).nullable().optional(),
  sourceLocator: z.string().trim().max(300).nullable().optional(),
  checkedOn: day,
});
export type FactInput = z.infer<typeof factInputSchema>;

/** The rules a fact must meet before it is even saved as a draft. Returns the reasons it does not. */
export function factProblems(f: FactInput): string[] {
  const out: string[] = [];
  if (f.sourcePage == null && !f.sourceLocator) out.push('Cite where in the source it comes from: a page number, or a locator such as a table or heading');
  if (f.checkedOn > today()) out.push('checkedOn cannot be in the future');
  if (f.kind === 'EVENT') {
    if (!f.eventDate) out.push('A dated step needs its date (eventDate)');
  } else if (f.eventDate) out.push('Only a dated step has an eventDate');
  if (f.kind === 'ELIGIBILITY') {
    if (!f.valueText) out.push('Eligibility is quoted exactly as printed: give valueText');
    if (f.valueNumber != null || f.basis) out.push('Eligibility has no number or basis');
  }
  if (f.kind === 'CUTOFF') {
    if (!f.basis) out.push('Every cut-off needs its basis (what the number is), because figures on different bases cannot be compared');
    if (f.valueNumber == null) out.push('A cut-off needs its figure (valueNumber)');
    if (!f.category) out.push('A cut-off needs its category (for example General, OBC, SC)');
    if (!f.round) out.push('A cut-off needs its round or list (for example Round 1)');
    if (!f.programme) out.push('A cut-off needs its programme');
    if (f.valueNumber != null && f.basis) {
      const v = f.valueNumber;
      if (f.basis === 'PERCENTILE' && (v < 0 || v > 100)) out.push('A percentile must be between 0 and 100');
      if (f.basis === 'RANK' && (!Number.isInteger(v) || v < 1)) out.push('A rank must be a whole number of 1 or more');
      if (['ALLOCATION_SCORE', 'NORMALISED_SCORE', 'MARKS'].includes(f.basis) && (v < 0 || v > 2000)) out.push('A score must be between 0 and 2000');
    }
  }
  const pd = personalDataProblem(f.label, f.valueText, f.programme, f.category, f.round, f.sourceLocator);
  if (pd) out.push(`The text ${pd}`);
  return out;
}

async function approvedSource(db: D1Database, id: string) {
  const s = await db.prepare('SELECT id, status, university_slug FROM admission_sources WHERE id = ?').bind(id).first<{ id: string; status: string; university_slug: string | null }>();
  if (!s) throw notFound('Source');
  if (s.status !== 'APPROVED') throw new ApiError(409, 'SOURCE_NOT_APPROVED', 'A fact can only cite a source that has been approved. Approve the source first, after opening its page.');
  return s;
}

function insertFact(db: D1Database, f: FactInput, actor: string, now: string) {
  const id = newId('afact');
  return {
    id,
    stmt: db
      .prepare(
        `INSERT INTO admission_facts (id, university_slug, university_name, source_id, kind, exam_code, cycle_year, programme, label, value_text, value_number, basis, category, round, event_date,
           source_page, source_locator, checked_on, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      )
      .bind(id, universitySlug(f.universityName), f.universityName, f.sourceId, f.kind, f.exam, f.year, f.programme ?? null, f.label, f.valueText ?? null, f.valueNumber ?? null, f.basis ?? null, f.category ?? null, f.round ?? null, f.eventDate ?? null, f.sourcePage ?? null, f.sourceLocator ?? null, f.checkedOn, actor, now, now),
  };
}

export async function createFact(db: D1Database, input: FactInput, actor: string) {
  const problems = factProblems(input);
  if (problems.length) throw new ApiError(422, 'FACT_REFUSED', problems[0]!, problems);
  const src = await approvedSource(db, input.sourceId);
  if (src.university_slug && src.university_slug !== universitySlug(input.universityName)) throw invalid(`This source belongs to a different university (${src.university_slug})`);
  const { id, stmt } = insertFact(db, input, actor, nowIso());
  await stmt.run();
  return { id, status: 'DRAFT' };
}

export const importSchema = z.object({ facts: z.array(factInputSchema).min(1).max(200) });

/** A pack of facts, all or nothing: every row is checked first, and none is saved if any fails. Rows arrive as drafts. */
export async function importFacts(db: D1Database, input: z.infer<typeof importSchema>, actor: string, dryRun: boolean) {
  const errors: { row: number; problems: string[] }[] = [];
  const sources = new Map<string, { status: string; university_slug: string | null }>();
  for (const [i, f] of input.facts.entries()) {
    const problems = factProblems(f);
    if (!sources.has(f.sourceId)) {
      const s = await db.prepare('SELECT status, university_slug FROM admission_sources WHERE id = ?').bind(f.sourceId).first<{ status: string; university_slug: string | null }>();
      if (s) sources.set(f.sourceId, s);
    }
    const s = sources.get(f.sourceId);
    if (!s) problems.push('The source is not in the register');
    else if (s.status !== 'APPROVED') problems.push('The source has not been approved');
    else if (s.university_slug && s.university_slug !== universitySlug(f.universityName)) problems.push('The source belongs to a different university');
    if (problems.length) errors.push({ row: i + 1, problems });
  }
  if (errors.length) throw new ApiError(422, 'PACK_REFUSED', `${errors.length} of ${input.facts.length} rows were refused and nothing was saved`, errors);
  if (dryRun) return { outcome: 'VALID', facts: input.facts.length };
  const now = nowIso();
  const stmts = input.facts.map((f) => insertFact(db, f, actor, now).stmt);
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  return { outcome: 'CREATED', facts: input.facts.length };
}

export const factDecisionSchema = z.object({ action: z.enum(['PUBLISH', 'REJECT']), reason: z.string().trim().min(5).max(500).optional() });

export async function decideFact(db: D1Database, id: string, input: z.infer<typeof factDecisionSchema>, actor: string) {
  const f = await db.prepare('SELECT id, status, source_id FROM admission_facts WHERE id = ?').bind(id).first<{ id: string; status: string; source_id: string }>();
  if (!f) throw notFound('Fact');
  if (f.status !== 'DRAFT') throw conflict('This fact has already been settled');
  const now = nowIso();
  if (input.action === 'REJECT') {
    if (!input.reason) throw invalid('Say why it is rejected (reason)');
    await db.prepare(`UPDATE admission_facts SET status = 'REJECTED', reject_reason = ?, updated_at = ? WHERE id = ?`).bind(input.reason, now, id).run();
    return { id, status: 'REJECTED' };
  }
  await approvedSource(db, f.source_id);
  await db.prepare(`UPDATE admission_facts SET status = 'PUBLISHED', published_by = ?, published_at = ?, updated_at = ? WHERE id = ?`).bind(actor, now, now, id).run();
  return { id, status: 'PUBLISHED' };
}

export async function listFacts(db: D1Database, f: { status?: string; slug?: string }) {
  const where: string[] = [];
  const binds: string[] = [];
  if (f.status) (where.push('f.status = ?'), binds.push(f.status));
  if (f.slug) (where.push('f.university_slug = ?'), binds.push(f.slug));
  const { results } = await db
    .prepare(`SELECT f.*, s.url AS source_url, s.title AS source_title, s.status AS source_status FROM admission_facts f JOIN admission_sources s ON s.id = f.source_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY f.created_at DESC LIMIT 300`)
    .bind(...binds)
    .all<Record<string, string | number | null>>();
  return results.map(factOut);
}

const factOut = (r: Record<string, string | number | null>) => ({
  id: r.id as string, universitySlug: r.university_slug as string, universityName: r.university_name as string, kind: r.kind as string, exam: r.exam_code as string, year: r.cycle_year as number,
  programme: r.programme as string | null, label: r.label as string, valueText: r.value_text as string | null, valueNumber: r.value_number as number | null, basis: r.basis as string | null,
  category: r.category as string | null, round: r.round as string | null, eventDate: r.event_date as string | null, sourcePage: r.source_page as number | null, sourceLocator: r.source_locator as string | null,
  checkedOn: r.checked_on as string, status: r.status as string, sourceUrl: r.source_url as string, sourceTitle: r.source_title as string, sourceStatus: r.source_status as string,
  rejectReason: r.reject_reason as string | null,
});

export async function admissionsOverview(db: D1Database) {
  const [s, f] = await Promise.all([
    db.prepare(`SELECT status, COUNT(*) AS n FROM admission_sources GROUP BY status`).all<{ status: string; n: number }>(),
    db.prepare(`SELECT status, COUNT(*) AS n FROM admission_facts GROUP BY status`).all<{ status: string; n: number }>(),
  ]);
  const of = (rows: { status: string; n: number }[], k: string) => rows.find((r) => r.status === k)?.n ?? 0;
  return {
    sources: { proposed: of(s.results, 'PROPOSED'), approved: of(s.results, 'APPROVED'), retired: of(s.results, 'RETIRED') },
    facts: { draft: of(f.results, 'DRAFT'), published: of(f.results, 'PUBLISHED'), rejected: of(f.results, 'REJECTED') },
  };
}

// ---------------------------------------------------------------- students

/** Which universities (by slug) have anything to show: an approved official page, or a published fact. */
export async function universitiesWithInfo(db: D1Database): Promise<Set<string>> {
  const { results } = await db
    .prepare(
      `SELECT university_slug AS slug FROM admission_sources WHERE status = 'APPROVED' AND university_slug IS NOT NULL
       UNION SELECT f.university_slug FROM admission_facts f JOIN admission_sources s ON s.id = f.source_id WHERE f.status = 'PUBLISHED' AND s.status = 'APPROVED'`,
    )
    .all<{ slug: string }>();
  return new Set(results.map((r) => r.slug));
}

/** One university's page: its official admission pages, and every published fact with its source, page and the day it was checked. */
export async function universityPage(db: D1Database, slug: string) {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) throw notFound('University');
  const [listed, sources, facts] = await Promise.all([
    db.prepare('SELECT exam_code, cycle, name, type, source_url FROM participating_universities ORDER BY cycle DESC').all<{ exam_code: string; cycle: string; name: string; type: string; source_url: string }>(),
    db.prepare(`SELECT id, university_slug, url, title, kind, covers, format, update_frequency, last_checked_on FROM admission_sources WHERE status = 'APPROVED' AND (university_slug = ? OR university_slug IS NULL) ORDER BY university_slug IS NULL, title`).bind(slug).all<Record<string, string | null>>(),
    db
      .prepare(
        `SELECT f.*, s.url AS source_url, s.title AS source_title, s.status AS source_status FROM admission_facts f JOIN admission_sources s ON s.id = f.source_id
         WHERE f.university_slug = ? AND f.status = 'PUBLISHED' AND s.status = 'APPROVED' ORDER BY f.cycle_year DESC, f.kind, f.event_date, f.programme, f.round, f.category`,
      )
      .bind(slug)
      .all<Record<string, string | number | null>>(),
  ]);
  const entries = listed.results.filter((r) => universitySlug(r.name) === slug);
  const name = entries[0]?.name ?? facts.results[0]?.university_name ?? null;
  if (!name && !facts.results.length && !sources.results.some((s) => s.university_slug === slug)) throw notFound('University');
  const out = facts.results.map(factOut);
  return {
    slug,
    name: name as string,
    listedBy: [...new Map(entries.map((e) => [e.exam_code, { exam: e.exam_code, cycle: e.cycle, type: e.type, sourceUrl: e.source_url }])).values()],
    officialPages: sources.results.map((s) => ({ url: s.url, title: s.title, kind: s.kind, covers: s.covers, format: s.format, updateFrequency: s.update_frequency, lastCheckedOn: s.last_checked_on })),
    dates: out.filter((f) => f.kind === 'EVENT'),
    eligibility: out.filter((f) => f.kind === 'ELIGIBILITY'),
    cutoffs: out.filter((f) => f.kind === 'CUTOFF'),
    note: 'Information here is copied from the university’s own pages as they were on the day shown against each item. Always confirm on the official page before you rely on it.',
  };
}
