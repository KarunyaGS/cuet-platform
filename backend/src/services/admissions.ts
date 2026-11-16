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
/**
 * EVENT: a dated step. ELIGIBILITY: as printed. SUBJECTS: the CUET subjects a programme asks for, as printed and as a list.
 * PROCEDURE: how to apply. COUNSELLING: how seats are allotted. CUTOFF: a published closing figure from an earlier round or year.
 */
export const FACT_KINDS = ['EVENT', 'ELIGIBILITY', 'SUBJECTS', 'PROCEDURE', 'COUNSELLING', 'CUTOFF'] as const;
/** The type of a dated step, kept in `category` so students can filter deadlines. */
export const EVENT_TYPES = ['REGISTRATION_OPENS', 'APPLICATION_DEADLINE', 'COUNSELLING_ROUND', 'ALLOCATION_LIST', 'REPORTING', 'OTHER'] as const;
/** Information not checked for this long, or about an earlier admission year, is marked outdated. */
export const STALE_DAYS = 180;
/** The admission cycle students are preparing for. Information about an earlier cycle is kept for reference and is always labelled as such. */
export const CURRENT_ADMISSION_CYCLE = '2027-28';
const CURRENT_CYCLE_START = Number(CURRENT_ADMISSION_CYCLE.slice(0, 4));
export type CycleInfo = { status: 'PREVIOUS' | 'CURRENT' | 'FUTURE'; label: string | null };
/** `Previous admission cycle – 2026–27` for anything about a cycle before the current one; never shown as current eligibility or a deadline. */
export function cycleInfo(startYear: number | null): CycleInfo {
  if (startYear == null || !Number.isFinite(startYear)) return { status: 'CURRENT', label: null };
  if (startYear >= CURRENT_CYCLE_START) return { status: startYear === CURRENT_CYCLE_START ? 'CURRENT' : 'FUTURE', label: null };
  return { status: 'PREVIOUS', label: `Previous admission cycle – ${startYear}–${String((startYear + 1) % 100).padStart(2, '0')}` };
}
const LEVELS = ['UG', 'PG'] as const;
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
  /** The programme this fact is about. Required for required-subjects facts; optional for university-wide facts. */
  programmeId: z.string().min(1).max(100).nullable().optional(),
  /** Required-subjects facts: the subjects as a list, beside valueText as printed. */
  subjects: z.array(z.string().trim().min(2).max(80)).min(1).max(15).nullable().optional(),
  /** Something still to be checked against the official documents. A flagged fact cannot be published until a person says how it was resolved. */
  reviewFlag: z.string().trim().min(5).max(500).nullable().optional(),
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
    if (!f.programme && !f.programmeId) out.push('A cut-off needs its programme');
    if (f.valueNumber != null && f.basis) {
      const v = f.valueNumber;
      if (f.basis === 'PERCENTILE' && (v < 0 || v > 100)) out.push('A percentile must be between 0 and 100');
      if (f.basis === 'RANK' && (!Number.isInteger(v) || v < 1)) out.push('A rank must be a whole number of 1 or more');
      if (['ALLOCATION_SCORE', 'NORMALISED_SCORE', 'MARKS'].includes(f.basis) && (v < 0 || v > 2000)) out.push('A score must be between 0 and 2000');
    }
  }
  if (f.kind === 'SUBJECTS') {
    if (!f.valueText) out.push('Required subjects are quoted exactly as printed: give valueText');
    if (!f.subjects?.length) out.push('Give the subjects as a list (subjects), beside the text as printed');
    if (!f.programmeId) out.push('Required subjects belong to a programme (programmeId)');
  } else if (f.subjects?.length) out.push('Only a required-subjects fact has a subjects list');
  if ((f.kind === 'PROCEDURE' || f.kind === 'COUNSELLING') && !f.valueText) out.push(`${f.kind === 'PROCEDURE' ? 'The admission procedure' : 'The counselling procedure'} is quoted as printed: give valueText`);
  if (f.kind === 'EVENT' && f.category && !(EVENT_TYPES as readonly string[]).includes(f.category)) out.push(`The type of a dated step must be one of ${EVENT_TYPES.join(', ')}`);
  if (f.kind !== 'CUTOFF' && f.kind !== 'EVENT' && (f.valueNumber != null || f.basis)) out.push('Only a cut-off has a figure and a basis');
  const pd = personalDataProblem(f.label, f.valueText, f.programme, f.category, f.round, f.sourceLocator, f.reviewFlag, ...(f.subjects ?? []));
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
           source_page, source_locator, checked_on, status, created_by, created_at, updated_at, programme_id, subjects_json, review_flag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, universitySlug(f.universityName), f.universityName, f.sourceId, f.kind, f.exam, f.year, f.programme ?? null, f.label, f.valueText ?? null, f.valueNumber ?? null, f.basis ?? null, f.category ?? null, f.round ?? null, f.eventDate ?? null, f.sourcePage ?? null, f.sourceLocator ?? null, f.checkedOn, actor, now, now, f.programmeId ?? null, f.subjects ? JSON.stringify(f.subjects) : null, f.reviewFlag ?? null),
  };
}

export async function createFact(db: D1Database, input: FactInput, actor: string) {
  const problems = factProblems(input);
  if (problems.length) throw new ApiError(422, 'FACT_REFUSED', problems[0]!, problems);
  const src = await approvedSource(db, input.sourceId);
  if (src.university_slug && src.university_slug !== universitySlug(input.universityName)) throw invalid(`This source belongs to a different university (${src.university_slug})`);
  const named = await checkProgramme(db, input);
  const { id, stmt } = insertFact(db, named, actor, nowIso());
  await stmt.run();
  return { id, status: 'DRAFT' };
}

/** A fact about a programme must name a real one at the same university; the programme's name fills in the fact's programme. */
async function checkProgramme(db: D1Database, f: FactInput): Promise<FactInput> {
  if (!f.programmeId) return f;
  const p = await db.prepare('SELECT university_slug, programme_name, status FROM admission_programmes WHERE id = ?').bind(f.programmeId).first<{ university_slug: string; programme_name: string; status: string }>();
  if (!p) throw invalid('That programme does not exist');
  if (p.university_slug !== universitySlug(f.universityName)) throw invalid('That programme belongs to a different university');
  if (p.status === 'REJECTED') throw invalid('That programme was rejected');
  return { ...f, programme: f.programme ?? p.programme_name };
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
    if (f.programmeId) {
      try {
        await checkProgramme(db, f);
      } catch (e) {
        problems.push((e as Error).message);
      }
    }
    if (problems.length) errors.push({ row: i + 1, problems });
  }
  if (errors.length) throw new ApiError(422, 'PACK_REFUSED', `${errors.length} of ${input.facts.length} rows were refused and nothing was saved`, errors);
  if (dryRun) return { outcome: 'VALID', facts: input.facts.length };
  const now = nowIso();
  const named = await Promise.all(input.facts.map((f) => checkProgramme(db, f)));
  const stmts = named.map((f) => insertFact(db, f, actor, now).stmt);
  for (let i = 0; i < stmts.length; i += 40) await db.batch(stmts.slice(i, i + 40));
  return { outcome: 'CREATED', facts: input.facts.length };
}

export const factDecisionSchema = z.object({ action: z.enum(['PUBLISH', 'REJECT']), reason: z.string().trim().min(5).max(500).optional() });

export async function decideFact(db: D1Database, id: string, input: z.infer<typeof factDecisionSchema>, actor: string) {
  const f = await db.prepare('SELECT id, status, source_id, review_flag FROM admission_facts WHERE id = ?').bind(id).first<{ id: string; status: string; source_id: string; review_flag: string | null }>();
  if (!f) throw notFound('Fact');
  if (f.status !== 'DRAFT') throw conflict('This fact has already been settled');
  const now = nowIso();
  if (input.action === 'REJECT') {
    if (!input.reason) throw invalid('Say why it is rejected (reason)');
    await db.prepare(`UPDATE admission_facts SET status = 'REJECTED', reject_reason = ?, updated_at = ? WHERE id = ?`).bind(input.reason, now, id).run();
    return { id, status: 'REJECTED' };
  }
  await approvedSource(db, f.source_id);
  if (f.review_flag && !input.reason) throw invalid(`This fact is flagged for checking: ${f.review_flag} Say how it was resolved (reason) before publishing it.`);
  const resolved = f.review_flag ? `${f.review_flag} [Resolved by ${actor}: ${input.reason}]` : null;
  await db.prepare(`UPDATE admission_facts SET status = 'PUBLISHED', published_by = ?, published_at = ?, review_flag = COALESCE(?, review_flag), updated_at = ? WHERE id = ?`).bind(actor, now, resolved, now, id).run();
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
  reviewFlag: (r.review_flag as string | null) ?? null,
  cycle: cycleInfo(Number(r.cycle_year)),
  programmeId: (r.programme_id as string | null) ?? null,
  subjects: r.subjects_json ? (JSON.parse(String(r.subjects_json)) as string[]) : null,
  reliability: reliabilityOf({ status: String(r.status), checkedOn: String(r.checked_on), cycleYear: Number(r.cycle_year), kind: String(r.kind), sourceStatus: (r.source_status as string | null) ?? 'APPROVED' }),
});

// ---------------------------------------------------------------- reliability

export type Reliability = 'VERIFIED_OFFICIAL' | 'OUTDATED' | 'UNVERIFIED' | 'SOURCE_NOT_APPROVED';
const daysSince = (day: string, now = new Date()) => Math.floor((now.getTime() - Date.parse(`${day}T00:00:00Z`)) / 86_400_000);

/**
 * How far a record can be trusted, from what we know about it:
 *   UNVERIFIED          still a draft, not yet published by a person
 *   SOURCE_NOT_APPROVED the source it cites is not (or no longer) approved
 *   OUTDATED            last checked more than 180 days ago, or about an admission year before this one (a cut-off is always about an
 *                       earlier year, so its age is judged by the day it was checked only)
 *   VERIFIED_OFFICIAL   published by a person, from an approved official source, checked recently
 */
export function reliabilityOf(x: { status: string; checkedOn: string; cycleYear: number | null; kind: string; sourceStatus: string }, now = new Date()): Reliability {
  if (x.status !== 'PUBLISHED') return 'UNVERIFIED';
  if (x.sourceStatus !== 'APPROVED') return 'SOURCE_NOT_APPROVED';
  if (daysSince(x.checkedOn, now) > STALE_DAYS) return 'OUTDATED';
  if (x.kind !== 'CUTOFF' && x.cycleYear !== null && x.cycleYear < now.getUTCFullYear()) return 'OUTDATED';
  return 'VERIFIED_OFFICIAL';
}

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
         WHERE f.university_slug = ? AND f.status = 'PUBLISHED' AND s.status = 'APPROVED' AND (f.programme_id IS NULL OR EXISTS (SELECT 1 FROM admission_programmes pp WHERE pp.id = f.programme_id AND pp.status = 'PUBLISHED')) ORDER BY f.cycle_year DESC, f.kind, f.event_date, f.programme, f.round, f.category`,
      )
      .bind(slug)
      .all<Record<string, string | number | null>>(),
  ]);
  const entries = listed.results.filter((r) => universitySlug(r.name) === slug);
  const name = entries[0]?.name ?? facts.results[0]?.university_name ?? null;
  if (!name && !facts.results.length && !sources.results.some((s) => s.university_slug === slug)) throw notFound('University');
  const out = facts.results.map(factOut);
  const progs = await db
    .prepare(`SELECT p.id, p.programme_name, p.degree, p.level, p.academic_year, p.exam_code FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id WHERE p.university_slug = ? AND p.status = 'PUBLISHED' AND s.status = 'APPROVED' ORDER BY p.academic_year DESC, p.programme_name`)
    .bind(slug)
    .all<{ id: string; programme_name: string; degree: string | null; level: string; academic_year: string; exam_code: string }>();
  return {
    slug,
    name: name as string,
    listedBy: [...new Map(entries.map((e) => [e.exam_code, { exam: e.exam_code, cycle: e.cycle, type: e.type, sourceUrl: e.source_url }])).values()],
    officialPages: sources.results.map((s) => ({ url: s.url, title: s.title, kind: s.kind, covers: s.covers, format: s.format, updateFrequency: s.update_frequency, lastCheckedOn: s.last_checked_on })),
    programmes: progs.results.map((r) => ({ id: r.id, programmeName: r.programme_name, degree: r.degree, level: r.level, academicYear: r.academic_year, exam: r.exam_code, cycle: cycleInfo(Number(r.academic_year.slice(0, 4))) })),
    dates: out.filter((f) => f.kind === 'EVENT' && !f.programmeId),
    eligibility: out.filter((f) => f.kind === 'ELIGIBILITY' && !f.programmeId),
    cutoffs: out.filter((f) => f.kind === 'CUTOFF'),
    note: 'Information here is copied from the university’s own pages as they were on the day shown against each item. Always confirm on the official page before you rely on it.',
  };
}


// ---------------------------------------------------------------- programmes

export const programmeInputSchema = z.object({
  universityName: z.string().trim().min(3).max(200),
  /** As NTA lists the university. Filled in from NTA's list when the university is on it. */
  universityType: z.string().trim().max(80).nullable().optional(),
  programmeName: z.string().trim().min(3).max(200),
  degree: z.string().trim().max(80).nullable().optional(),
  level: z.enum(LEVELS).default('UG'),
  /** For example 2026-27. */
  academicYear: z.string().regex(/^20\d\d-\d\d$/, 'Write the year as 2026-27'),
  exam: z.enum(EXAMS),
  sourceId: z.string().min(1).max(100),
  sourcePage: z.number().int().min(1).max(5000).nullable().optional(),
  sourceLocator: z.string().trim().max(300).nullable().optional(),
  lastVerifiedOn: day,
});
export type ProgrammeInput = z.infer<typeof programmeInputSchema>;

export function programmeProblems(p: ProgrammeInput): string[] {
  const out: string[] = [];
  const y = Number(p.academicYear.slice(0, 4));
  if (Number(p.academicYear.slice(5)) !== (y + 1) % 100) out.push('The academic year must be consecutive years, such as 2026-27');
  if (p.sourcePage == null && !p.sourceLocator) out.push('Cite where in the source the programme is listed: a page number, or a locator such as a table or heading');
  if (p.lastVerifiedOn > today()) out.push('lastVerifiedOn cannot be in the future');
  const pd = personalDataProblem(p.programmeName, p.degree, p.sourceLocator);
  if (pd) out.push(`The text ${pd}`);
  return out;
}

/** The university's type as NTA lists it (latest list), when it is on NTA's list. */
async function listedType(db: D1Database, slug: string): Promise<{ name: string; type: string } | null> {
  const { results } = await db.prepare('SELECT name, type FROM participating_universities ORDER BY cycle DESC').all<{ name: string; type: string }>();
  return results.find((r) => universitySlug(r.name) === slug) ?? null;
}

export async function createProgramme(db: D1Database, input: ProgrammeInput, actor: string) {
  const problems = programmeProblems(input);
  if (problems.length) throw new ApiError(422, 'PROGRAMME_REFUSED', problems[0]!, problems);
  const src = await approvedSource(db, input.sourceId);
  const slug = universitySlug(input.universityName);
  if (src.university_slug && src.university_slug !== slug) throw invalid(`This source belongs to a different university (${src.university_slug})`);
  const listed = await listedType(db, slug);
  const id = newId('aprog');
  const now = nowIso();
  try {
    await db
      .prepare(
        `INSERT INTO admission_programmes (id, university_slug, university_name, university_type, programme_name, degree, level, academic_year, exam_code, source_id, source_page, source_locator, last_verified_on, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`,
      )
      .bind(id, slug, listed?.name ?? input.universityName, listed?.type ?? input.universityType ?? null, input.programmeName, input.degree ?? null, input.level, input.academicYear, input.exam, input.sourceId, input.sourcePage ?? null, input.sourceLocator ?? null, input.lastVerifiedOn, actor, now, now)
      .run();
  } catch (e) {
    if (/UNIQUE/i.test(String((e as Error).message))) throw conflict('This programme is already in the register for that university, year and exam');
    throw e;
  }
  return { id, status: 'DRAFT' };
}

export const programmeImportSchema = z.object({ programmes: z.array(programmeInputSchema).min(1).max(300) });

/** A list of programmes from one official page, all or nothing, as drafts. */
export async function importProgrammes(db: D1Database, input: z.infer<typeof programmeImportSchema>, actor: string, dryRun: boolean) {
  const errors: { row: number; problems: string[] }[] = [];
  const seen = new Set<string>();
  const sources = new Map<string, { status: string; university_slug: string | null } | null>();
  for (const [i, p] of input.programmes.entries()) {
    const problems = programmeProblems(p);
    if (!sources.has(p.sourceId)) sources.set(p.sourceId, (await db.prepare('SELECT status, university_slug FROM admission_sources WHERE id = ?').bind(p.sourceId).first<{ status: string; university_slug: string | null }>()) ?? null);
    const src = sources.get(p.sourceId);
    if (!src) problems.push('The source is not in the register');
    else if (src.status !== 'APPROVED') problems.push('The source has not been approved');
    else if (src.university_slug && src.university_slug !== universitySlug(p.universityName)) problems.push('The source belongs to a different university');
    const key = `${universitySlug(p.universityName)}|${p.programmeName.toLowerCase()}|${p.academicYear}|${p.exam}`;
    if (seen.has(key)) problems.push('The same programme appears twice in this list');
    seen.add(key);
    const dup = await db.prepare('SELECT 1 FROM admission_programmes WHERE university_slug = ? AND programme_name = ? AND academic_year = ? AND exam_code = ?').bind(universitySlug(p.universityName), p.programmeName, p.academicYear, p.exam).first();
    if (dup) problems.push('This programme is already in the register');
    if (problems.length) errors.push({ row: i + 1, problems });
  }
  if (errors.length) throw new ApiError(422, 'PACK_REFUSED', `${errors.length} of ${input.programmes.length} rows were refused and nothing was saved`, errors);
  if (dryRun) return { outcome: 'VALID', programmes: input.programmes.length };
  for (const p of input.programmes) await createProgramme(db, p, actor);
  return { outcome: 'CREATED', programmes: input.programmes.length };
}

export const programmeDecisionSchema = z.object({ action: z.enum(['PUBLISH', 'REJECT', 'WITHDRAW']), reason: z.string().trim().min(5).max(500).optional() });

export async function decideProgramme(db: D1Database, id: string, input: z.infer<typeof programmeDecisionSchema>, actor: string) {
  const p = await db.prepare('SELECT id, status, source_id FROM admission_programmes WHERE id = ?').bind(id).first<{ id: string; status: string; source_id: string }>();
  if (!p) throw notFound('Programme');
  const now = nowIso();
  if (input.action === 'PUBLISH') {
    if (!['DRAFT', 'WITHDRAWN'].includes(p.status)) throw conflict('Only a draft or a withdrawn programme can be published');
    await approvedSource(db, p.source_id);
    await db.prepare(`UPDATE admission_programmes SET status = 'PUBLISHED', published_by = ?, published_at = ?, status_note = ?, updated_at = ? WHERE id = ?`).bind(actor, now, input.reason ?? null, now, id).run();
    return { id, status: 'PUBLISHED' };
  }
  if (!input.reason) throw invalid('Say why (reason)');
  if (input.action === 'REJECT') {
    if (p.status !== 'DRAFT') throw conflict('Only a draft can be rejected');
    await db.prepare(`UPDATE admission_programmes SET status = 'REJECTED', status_note = ?, updated_at = ? WHERE id = ?`).bind(`Rejected by ${actor}: ${input.reason}`, now, id).run();
    return { id, status: 'REJECTED' };
  }
  if (p.status !== 'PUBLISHED') throw conflict('Only a published programme can be withdrawn');
  await db.prepare(`UPDATE admission_programmes SET status = 'WITHDRAWN', status_note = ?, updated_at = ? WHERE id = ?`).bind(`Withdrawn by ${actor}: ${input.reason}`, now, id).run();
  return { id, status: 'WITHDRAWN' };
}

type PRow = Record<string, string | number | null>;
const programmeOut = (r: PRow) => ({
  id: r.id as string, universitySlug: r.university_slug as string, universityName: r.university_name as string, universityType: r.university_type as string | null, programmeName: r.programme_name as string,
  degree: r.degree as string | null, level: r.level as string, academicYear: r.academic_year as string, exam: r.exam_code as string, lastVerifiedOn: r.last_verified_on as string, status: r.status as string,
  sourceUrl: (r.source_url as string | null) ?? null, sourceTitle: (r.source_title as string | null) ?? null, sourcePage: (r.source_page as number | null) ?? null, sourceLocator: (r.source_locator as string | null) ?? null,
  statusNote: (r.status_note as string | null) ?? null,
  cycle: cycleInfo(Number(String(r.academic_year).slice(0, 4))),
  reliability: reliabilityOf({ status: String(r.status), checkedOn: String(r.last_verified_on), cycleYear: Number(String(r.academic_year).slice(0, 4)), kind: 'PROGRAMME', sourceStatus: (r.source_status as string | null) ?? 'APPROVED' }),
});

export async function listProgrammesAdmin(db: D1Database, f: { status?: string; slug?: string }) {
  const where: string[] = [];
  const binds: string[] = [];
  if (f.status) (where.push('p.status = ?'), binds.push(f.status));
  if (f.slug) (where.push('p.university_slug = ?'), binds.push(f.slug));
  const { results } = await db
    .prepare(`SELECT p.*, s.url AS source_url, s.title AS source_title, s.status AS source_status, (SELECT COUNT(*) FROM admission_facts x WHERE x.programme_id = p.id AND x.status = 'PUBLISHED') AS published_facts FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.created_at DESC LIMIT 300`)
    .bind(...binds)
    .all<PRow>();
  return results.map((r) => ({ ...programmeOut(r), publishedFacts: Number(r.published_facts) }));
}

// ---------------------------------------------------------------- students: browse and detail

export const programmeQuery = z.object({
  type: z.string().trim().max(80).optional(),
  university: z.string().trim().max(120).optional(),
  subject: z.string().trim().max(80).optional(),
  exam: z.enum(EXAMS).optional(),
  year: z.string().regex(/^20\d\d(-\d\d)?$/).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

const SHOWN_FACT = `f.status = 'PUBLISHED' AND fs.status = 'APPROVED'`;

/** Programmes students may see: published, from an approved source. Each says which of the things a student needs are known and which are not. */
export async function programmesList(db: D1Database, q: z.infer<typeof programmeQuery>) {
  const where = [`p.status = 'PUBLISHED'`, `s.status = 'APPROVED'`];
  const binds: (string | number)[] = [];
  if (q.type) (where.push("p.university_type LIKE '%' || ? || '%' COLLATE NOCASE"), binds.push(q.type));
  if (q.university) (where.push('p.university_slug = ?'), binds.push(q.university));
  if (q.exam) (where.push('p.exam_code = ?'), binds.push(q.exam));
  if (q.year) (where.push('p.academic_year LIKE ? || \'%\''), binds.push(q.year));
  if (q.q) (where.push("(p.programme_name LIKE '%' || ?1 || '%' COLLATE NOCASE OR p.university_name LIKE '%' || ?1 || '%' COLLATE NOCASE)".replace(/\?1/g, '?')), binds.push(q.q, q.q));
  if (q.subject) {
    where.push(`EXISTS (SELECT 1 FROM admission_facts f JOIN admission_sources fs ON fs.id = f.source_id WHERE f.programme_id = p.id AND f.kind = 'SUBJECTS' AND ${SHOWN_FACT} AND f.subjects_json LIKE '%"' || ? || '"%' COLLATE NOCASE)`);
    binds.push(q.subject);
  }
  const clause = where.join(' AND ');
  const [rows, total] = await Promise.all([
    db.prepare(`SELECT p.*, s.url AS source_url, s.title AS source_title, s.status AS source_status FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id WHERE ${clause} ORDER BY p.university_name, p.programme_name LIMIT ? OFFSET ?`).bind(...binds, q.limit, q.offset).all<PRow>(),
    db.prepare(`SELECT COUNT(*) AS n FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id WHERE ${clause}`).bind(...binds).first<{ n: number }>(),
  ]);
  const ids = rows.results.map((r) => String(r.id));
  const facts = ids.length
    ? (await db.prepare(`SELECT f.programme_id, f.kind, f.category, f.event_date, f.label, f.subjects_json FROM admission_facts f JOIN admission_sources fs ON fs.id = f.source_id WHERE ${SHOWN_FACT} AND f.programme_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<PRow>()).results
    : [];
  const todayIso = today();
  return {
    total: total?.n ?? 0,
    programmes: rows.results.map((r) => {
      const mine = facts.filter((f) => f.programme_id === r.id);
      const has = (k: string) => mine.some((f) => f.kind === k);
      const deadlines = mine.filter((f) => f.kind === 'EVENT' && f.category === 'APPLICATION_DEADLINE' && f.event_date).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
      const next = deadlines.find((d) => String(d.event_date) >= todayIso) ?? null;
      const subj = mine.find((f) => f.kind === 'SUBJECTS');
      return {
        ...programmeOut(r),
        subjects: subj?.subjects_json ? (JSON.parse(String(subj.subjects_json)) as string[]) : null,
        nextDeadline: next ? { date: String(next.event_date), label: String(next.label) } : null,
        lastDeadline: !next && deadlines.length ? { date: String(deadlines.at(-1)!.event_date), label: String(deadlines.at(-1)!.label) } : null,
        known: { eligibility: has('ELIGIBILITY'), subjects: has('SUBJECTS'), procedure: has('PROCEDURE'), counselling: has('COUNSELLING'), deadline: deadlines.length > 0, cutoffs: has('CUTOFF') },
      };
    }),
  };
}

/**
 * One programme. Current information (eligibility, required subjects, procedure, counselling, dated steps) is kept apart from the
 * historical cut-offs, which are published figures from earlier rounds and years and never a prediction. Anything not published is
 * listed in `unavailable`, so the page says so plainly instead of staying silent.
 */
export async function programmeDetail(db: D1Database, id: string) {
  const r = await db
    .prepare(`SELECT p.*, s.url AS source_url, s.title AS source_title, s.status AS source_status FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id WHERE p.id = ? AND p.status = 'PUBLISHED' AND s.status = 'APPROVED'`)
    .bind(id)
    .first<PRow>();
  if (!r) throw notFound('Programme');
  const [facts, pages] = await Promise.all([
    db
      .prepare(
        `SELECT f.*, fs.url AS source_url, fs.title AS source_title, fs.status AS source_status FROM admission_facts f JOIN admission_sources fs ON fs.id = f.source_id
         WHERE f.programme_id = ? AND ${SHOWN_FACT} ORDER BY f.cycle_year DESC, f.event_date, f.round, f.category`,
      )
      .bind(id)
      .all<PRow>(),
    db.prepare(`SELECT url, title, kind, covers, format, update_frequency, last_checked_on FROM admission_sources WHERE status = 'APPROVED' AND university_slug = ? ORDER BY title`).bind(r.university_slug).all<PRow>(),
  ]);
  const out = facts.results.map(factOut);
  const of = (k: string) => out.filter((f) => f.kind === k);
  const current = { eligibility: of('ELIGIBILITY'), subjects: of('SUBJECTS'), procedure: of('PROCEDURE'), counselling: of('COUNSELLING'), dates: of('EVENT') };
  const unavailable = [
    ...(current.eligibility.length ? [] : ['eligibility']),
    ...(current.subjects.length ? [] : ['subjects']),
    ...(current.procedure.length ? [] : ['procedure']),
    ...(current.counselling.length ? [] : ['counselling']),
    ...(current.dates.some((d) => d.category === 'APPLICATION_DEADLINE') ? [] : ['deadline']),
    ...(of('CUTOFF').length ? [] : ['cutoffs']),
  ];
  return {
    programme: programmeOut(r),
    current,
    unavailable,
    historicalCutoffs: of('CUTOFF'),
    officialPages: pages.results.map((p) => ({ url: p.url as string, title: p.title as string, kind: p.kind as string, covers: p.covers as string, format: p.format as string, updateFrequency: p.update_frequency as string | null, lastCheckedOn: p.last_checked_on as string | null })),
    note: 'Information here is copied from the university’s own pages as they were on the day shown against each item. Cut-offs are figures published for earlier rounds and years; they are not a prediction. Always confirm on the official page before you rely on any of it.',
  };
}

/** What can be filtered on: the types, subjects and years that published programmes actually have. */
export async function admissionFilters(db: D1Database) {
  const [types, years, subj] = await Promise.all([
    db.prepare(`SELECT p.university_type AS t, COUNT(*) AS n FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id WHERE p.status = 'PUBLISHED' AND s.status = 'APPROVED' AND p.university_type IS NOT NULL GROUP BY 1 ORDER BY n DESC`).all<{ t: string; n: number }>(),
    db.prepare(`SELECT p.academic_year AS y, COUNT(*) AS n FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id WHERE p.status = 'PUBLISHED' AND s.status = 'APPROVED' GROUP BY 1 ORDER BY 1 DESC`).all<{ y: string; n: number }>(),
    db.prepare(`SELECT f.subjects_json AS j FROM admission_facts f JOIN admission_sources fs ON fs.id = f.source_id JOIN admission_programmes p ON p.id = f.programme_id WHERE f.kind = 'SUBJECTS' AND ${SHOWN_FACT} AND p.status = 'PUBLISHED'`).all<{ j: string }>(),
  ]);
  const counts = new Map<string, number>();
  for (const r of subj.results) for (const x of JSON.parse(r.j) as string[]) counts.set(x, (counts.get(x) ?? 0) + 1);
  return {
    types: types.results.map((x) => ({ type: x.t, count: x.n })),
    years: years.results.map((x) => ({ year: x.y, count: x.n })),
    subjects: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([subject, count]) => ({ subject, count })),
  };
}

// ---------------------------------------------------------------- staff: what needs attention

/** Published information that has gone out of date, and approved sources not checked for a long time. */
export async function outdatedItems(db: D1Database) {
  const [progs, facts, sources] = await Promise.all([
    db.prepare(`SELECT p.*, s.status AS source_status FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id WHERE p.status = 'PUBLISHED'`).all<PRow>(),
    db.prepare(`SELECT f.*, s.status AS source_status FROM admission_facts f JOIN admission_sources s ON s.id = f.source_id WHERE f.status = 'PUBLISHED'`).all<PRow>(),
    db.prepare(`SELECT id, title, url, last_checked_on FROM admission_sources WHERE status = 'APPROVED'`).all<PRow>(),
  ]);
  const now = new Date();
  const items: { type: 'PROGRAMME' | 'FACT' | 'SOURCE'; id: string; label: string; university: string | null; lastVerifiedOn: string | null; reason: string }[] = [];
  for (const r of progs.results) {
    const rel = programmeOut(r).reliability;
    if (rel === 'OUTDATED' || rel === 'SOURCE_NOT_APPROVED') items.push({ type: 'PROGRAMME', id: String(r.id), label: `${r.programme_name} (${r.academic_year})`, university: String(r.university_name), lastVerifiedOn: String(r.last_verified_on), reason: rel === 'OUTDATED' ? (daysSince(String(r.last_verified_on), now) > STALE_DAYS ? `Not checked for ${daysSince(String(r.last_verified_on), now)} days` : `About the ${r.academic_year} admission year`) : 'Its source is no longer approved' });
  }
  for (const r of facts.results) {
    const f = factOut(r);
    if (f.reliability === 'OUTDATED' || f.reliability === 'SOURCE_NOT_APPROVED') items.push({ type: 'FACT', id: f.id, label: `${f.kind.toLowerCase()}: ${f.label}${f.programme ? ` (${f.programme})` : ''}`, university: f.universityName, lastVerifiedOn: f.checkedOn, reason: f.reliability === 'OUTDATED' ? (daysSince(f.checkedOn, now) > STALE_DAYS ? `Not checked for ${daysSince(f.checkedOn, now)} days` : `About the ${f.year} admission year`) : 'Its source is no longer approved' });
  }
  for (const r of sources.results) {
    if (!r.last_checked_on || daysSince(String(r.last_checked_on), now) > STALE_DAYS) items.push({ type: 'SOURCE', id: String(r.id), label: String(r.title), university: null, lastVerifiedOn: (r.last_checked_on as string | null) ?? null, reason: r.last_checked_on ? `Source not checked for ${daysSince(String(r.last_checked_on), now)} days` : 'Source never checked' });
  }
  return { staleAfterDays: STALE_DAYS, total: items.length, items };
}
