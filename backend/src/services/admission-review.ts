/**
 * Structured admission requirements: reading, review, publication and use.
 *
 * What this file guarantees:
 *  1. The server reads a university's printed subject rule into a structured DRAFT. Reading is not verification.
 *  2. A person reviews the reading beside the printed text and approves, rejects, asks the university, or revises it. Every step is kept
 *     (who, when, what the record said, which source, page and admission year).
 *  3. Only an APPROVED requirement can influence a student's result, and only while ALL of these hold: its programme is published, the
 *     programme's source and the printed fact's source are approved, the printed fact is published, nothing in that programme's
 *     subject or eligibility text carries an open review flag, the printed text has not changed since it was read, and every list the
 *     rule names (List A, List B) is published. If any one fails the student is told the information is not available, never given a guess.
 *  4. A result is about the papers named in the rule only. It is never a prediction and never an admission outcome.
 */
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId, sha256Hex, slugify } from '../lib/hash';
import { nowIso } from '../lib/sql';
import { CURRENT_ADMISSION_CYCLE, cycleInfo, reliabilityOf, STALE_DAYS, type CycleInfo, type Reliability } from './admissions';
import { evaluateRule, type EligibilityResult, type GroupMembers } from './admission-eligibility';
import { buildRule, parseRequirementText, structuralIssues, type Combination, type ExtraTest, type Family, type Issue, type ParsedRule, type Requirement } from './admission-requirements';
import { CUET_UG_PAPERS, paperByCode, resolveSubject, type GroupId } from './admission-subjects';

export const PARSER_VERSION = 'req-1';
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const todayIso = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- shapes

export interface Resolution { note: string; sourceUrl?: string; by: string; at: string }
/** What is stored in `parsed_json`: the reading, plus what a reviewer has said about each open question. */
export type StoredRule = ParsedRule & { resolutions?: Record<string, Resolution> };

const SELF_CLEARING = 'GROUP_MEMBERSHIP_NOT_IN_TEXT'; // cleared by a published list at the time of use, not by a reviewer
const STRUCTURAL_CODES = new Set(['UNKNOWN_SUBJECT', 'AMBIGUOUS_SUBJECT', 'SUBJECT_CODE_CONFLICT', 'UNRESOLVED_TEXT', 'EMPTY_COMBINATION', SELF_CLEARING, 'PART_NAME_MAPPING', 'VARIANT_NAME_MAPPING']);

/** Issues still open: the ones that follow from the structure, plus the ones from the text that no reviewer has answered. */
export function openIssues(stored: StoredRule): Issue[] {
  const res = stored.resolutions ?? {};
  const structural = structuralIssues(stored);
  const carried = stored.issues.filter((i) => !STRUCTURAL_CODES.has(i.code));
  const open = [...structural.filter((i) => !(i.code === 'PART_NAME_MAPPING' && res.PART_NAME_MAPPING)), ...carried.filter((i) => !res[i.code])];
  return open.filter((i, k, all) => all.findIndex((o) => o.code === i.code && o.text === i.text && o.message === i.message) === k);
}

/** What stops an approval. A list that is not yet published is not one of them: it only stops the rule being used. */
export const approvalBlockers = (stored: StoredRule): Issue[] => openIssues(stored).filter((i) => i.code !== SELF_CLEARING && (i.severity === 'BLOCKING' || i.severity === 'REVIEW'));

// ---------------------------------------------------------------- events

function eventStmt(db: D1Database, type: 'REQUIREMENT' | 'GROUP', id: string, action: string, actor: string, from: string | null, to: string | null, note: string | null, snapshot: unknown) {
  return db
    .prepare('INSERT INTO admission_review_events (id, entity_type, entity_id, action, actor, from_status, to_status, note, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('are'), type, id, action, actor, from, to, note, snapshot === null ? null : JSON.stringify(snapshot), nowIso());
}

interface ProgrammeRow {
  id: string; university_slug: string; university_name: string; programme_name: string; degree: string | null; academic_year: string; exam_code: string; level: string;
  status: string; source_id: string; source_page: number | null; source_locator: string | null; last_verified_on: string; campus: string | null;
  source_url: string; source_title: string; source_status: string;
}
const PROGRAMME_SQL = `SELECT p.*, s.url AS source_url, s.title AS source_title, s.status AS source_status FROM admission_programmes p JOIN admission_sources s ON s.id = p.source_id`;

const sourceInfo = (p: ProgrammeRow) => ({
  sourceUrl: p.source_url, sourceTitle: p.source_title, sourceStatus: p.source_status, sourcePage: p.source_page, sourceLocator: p.source_locator,
  academicYear: p.academic_year, examCode: p.exam_code, lastVerifiedOn: p.last_verified_on,
});

interface PrintedFact { id: string; kind: string; value_text: string | null; status: string; review_flag: string | null; checked_on: string; source_id: string }

/** The text a programme's rule is read from: the required-subjects fact, else the eligibility fact (the order the student page uses). */
function printedFact(facts: PrintedFact[]): PrintedFact | null {
  return facts.find((f) => f.kind === 'SUBJECTS' && f.value_text) ?? facts.find((f) => f.kind === 'ELIGIBILITY' && f.value_text) ?? null;
}

async function factsByProgramme(db: D1Database, ids: string[]) {
  const out = new Map<string, PrintedFact[]>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { results } = await db
      .prepare(`SELECT id, programme_id, kind, value_text, status, review_flag, checked_on, source_id FROM admission_facts WHERE kind IN ('SUBJECTS','ELIGIBILITY') AND programme_id IN (${part.map(() => '?').join(',')}) ORDER BY kind DESC, created_at`)
      .bind(...part)
      .all<PrintedFact & { programme_id: string }>();
    for (const r of results) out.set(r.programme_id, [...(out.get(r.programme_id) ?? []), r]);
  }
  return out;
}

// ---------------------------------------------------------------- proposing (reading)

export interface ProposeResult { examined: number; created: number; unchanged: number; noPrintedRule: number; superseded: number; byStatus: Record<string, number>; dryRun: boolean }

/**
 * Reads every programme's printed rule and stores the reading as a DRAFT. Safe to repeat: an unchanged text and parser creates nothing.
 * A changed text creates a new version; an older DRAFT it replaces becomes SUPERSEDED, an older APPROVED version keeps its approval only
 * until it is no longer applicable (a changed text makes it stale and it stops being used immediately).
 */
export async function proposeRequirements(db: D1Database, actor: string, opts: { dryRun: boolean; programmeId?: string }): Promise<ProposeResult> {
  const { results: programmes } = await db.prepare(`${PROGRAMME_SQL} ${opts.programmeId ? 'WHERE p.id = ?' : ''} ORDER BY p.university_slug, p.programme_name`).bind(...(opts.programmeId ? [opts.programmeId] : [])).all<ProgrammeRow>();
  const facts = await factsByProgramme(db, programmes.map((p) => p.id));
  const latest = new Map<string, { id: string; version: number; hash: string; parser: string; status: string }>();
  const { results: existing } = await db.prepare('SELECT id, programme_id, version, source_text_hash AS hash, parser_version AS parser, status FROM admission_requirements ORDER BY version').all<{ id: string; programme_id: string; version: number; hash: string; parser: string; status: string }>();
  for (const e of existing) latest.set(e.programme_id, e);
  const out: ProposeResult = { examined: programmes.length, created: 0, unchanged: 0, noPrintedRule: 0, superseded: 0, byStatus: {}, dryRun: opts.dryRun };
  const statements: D1PreparedStatement[] = [];
  for (const p of programmes) {
    const fact = printedFact(facts.get(p.id) ?? []);
    if (!fact) { out.noPrintedRule++; continue; }
    const text = fact.value_text!;
    const hash = await sha256Hex(text);
    const prev = latest.get(p.id);
    if (prev && prev.hash === hash && prev.parser === PARSER_VERSION) { out.unchanged++; continue; }
    const rule = parseRequirementText(text);
    out.created++;
    out.byStatus[rule.status] = (out.byStatus[rule.status] ?? 0) + 1;
    if (opts.dryRun) continue;
    const id = newId('areq');
    const version = (prev?.version ?? 0) + 1;
    const now = nowIso();
    if (prev && (prev.status === 'DRAFT' || prev.status === 'NEEDS_UNIVERSITY_CONFIRMATION')) {
      statements.push(db.prepare(`UPDATE admission_requirements SET status = 'SUPERSEDED', updated_at = ? WHERE id = ?`).bind(now, prev.id));
      statements.push(eventStmt(db, 'REQUIREMENT', prev.id, 'SUPERSEDED', actor, prev.status, 'SUPERSEDED', `Replaced by version ${version}: the printed text or the reader changed`, null));
      out.superseded++;
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO admission_requirements (id, programme_id, source_fact_id, source_text, source_text_hash, parser_version, family, parsed_json, issues_json, version, status, origin, supersedes_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'PARSER', ?, ?, ?, ?)`,
        )
        .bind(id, p.id, fact.id, text, hash, PARSER_VERSION, rule.family, JSON.stringify(rule), JSON.stringify(rule.issues), version, prev?.id ?? null, actor, now, now),
      eventStmt(db, 'REQUIREMENT', id, 'READ', actor, null, 'DRAFT', `Read by the server (${PARSER_VERSION}): ${rule.status}`, { ...sourceInfo(p), factId: fact.id, factStatus: fact.status, textHash: hash, parserVersion: PARSER_VERSION, result: rule.status, issues: rule.issues.map((i) => i.code) }),
    );
  }
  for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40));
  return out;
}

// ---------------------------------------------------------------- reviewing

export const REQUIREMENT_STATUSES = ['DRAFT', 'NEEDS_UNIVERSITY_CONFIRMATION', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const;
export const requirementQuery = z.object({
  status: z.enum(REQUIREMENT_STATUSES).optional(),
  university: z.string().trim().max(120).optional(),
  q: z.string().trim().max(100).optional(),
  all: z.enum(['0', '1']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

interface RequirementRow {
  id: string; programme_id: string; source_fact_id: string | null; source_text: string; source_text_hash: string; parser_version: string; family: string; parsed_json: string;
  issues_json: string; version: number; status: string; origin: string; supersedes_id: string | null; review_note: string | null; reviewed_by: string | null; reviewed_at: string | null;
  created_by: string; created_at: string;
}

async function requirementView(db: D1Database, rows: RequirementRow[]) {
  const programmes = new Map<string, ProgrammeRow>();
  for (let i = 0; i < rows.length; i += 80) {
    const ids = [...new Set(rows.slice(i, i + 80).map((r) => r.programme_id))];
    const { results } = await db.prepare(`${PROGRAMME_SQL} WHERE p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<ProgrammeRow>();
    for (const p of results) programmes.set(p.id, p);
  }
  const facts = await factsByProgramme(db, [...programmes.keys()]);
  const out = [];
  for (const r of rows) {
    const p = programmes.get(r.programme_id)!;
    const current = printedFact(facts.get(r.programme_id) ?? []);
    const stored = JSON.parse(r.parsed_json) as StoredRule;
    const stale = !current || (await sha256Hex(current.value_text ?? '')) !== r.source_text_hash;
    const flagged = (facts.get(r.programme_id) ?? []).some((f) => f.review_flag);
    const blockers = approvalBlockers(stored);
    out.push({
      id: r.id, version: r.version, status: r.status, origin: r.origin, family: r.family, parserVersion: r.parser_version,
      programme: { id: p.id, name: p.programme_name, university: p.university_name, universitySlug: p.university_slug, status: p.status, degree: p.degree, campus: p.campus },
      source: { ...sourceInfo(p), factId: r.source_fact_id, factStatus: current?.status ?? null },
      printedText: r.source_text, printedTextChanged: stale, factFlagged: flagged, factFlag: (facts.get(r.programme_id) ?? []).find((f) => f.review_flag)?.review_flag ?? null,
      rule: stored, openIssues: openIssues(stored), approvalBlockers: blockers,
      canApprove: ['DRAFT', 'NEEDS_UNIVERSITY_CONFIRMATION'].includes(r.status) && blockers.length === 0 && !stale && !flagged && p.source_status === 'APPROVED',
      reviewNote: r.review_note, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, createdBy: r.created_by, createdAt: r.created_at,
    });
  }
  return out;
}

export async function listRequirements(db: D1Database, q: z.infer<typeof requirementQuery>) {
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (q.status) (where.push('r.status = ?'), binds.push(q.status));
  else if (q.all !== '1') where.push(`r.status <> 'SUPERSEDED'`);
  if (q.university) (where.push('p.university_slug = ?'), binds.push(q.university));
  if (q.q) (where.push(`(p.programme_name LIKE '%' || ? || '%' COLLATE NOCASE)`), binds.push(q.q));
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'FROM admission_requirements r JOIN admission_programmes p ON p.id = r.programme_id';
  const [rows, total, byStatus] = await Promise.all([
    db.prepare(`SELECT r.* ${from} ${clause} ORDER BY p.university_slug, p.programme_name, r.version DESC LIMIT ? OFFSET ?`).bind(...binds, q.limit, q.offset).all<RequirementRow>(),
    db.prepare(`SELECT COUNT(*) AS n ${from} ${clause}`).bind(...binds).first<{ n: number }>(),
    db.prepare(`SELECT r.status AS status, COUNT(*) AS n ${from} GROUP BY r.status`).all<{ status: string; n: number }>(),
  ]);
  return { total: total?.n ?? 0, byStatus: Object.fromEntries(byStatus.results.map((s) => [s.status, s.n])), items: await requirementView(db, rows.results) };
}

export async function requirementDetail(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM admission_requirements WHERE id = ?').bind(id).first<RequirementRow>();
  if (!row) throw notFound('Requirement');
  const [[view], history, versions] = await Promise.all([
    requirementView(db, [row]),
    db.prepare(`SELECT action, actor, from_status, to_status, note, snapshot_json, created_at FROM admission_review_events WHERE entity_type = 'REQUIREMENT' AND entity_id = ? ORDER BY created_at, id`).bind(id).all<Record<string, unknown>>(),
    db.prepare('SELECT id, version, status, origin, reviewed_by, reviewed_at, created_at FROM admission_requirements WHERE programme_id = ? ORDER BY version').bind(row.programme_id).all<Record<string, unknown>>(),
  ]);
  return { ...view!, history: history.results.map((h) => ({ ...h, snapshot: h.snapshot_json ? JSON.parse(String(h.snapshot_json)) : null, snapshot_json: undefined })), versions: versions.results };
}

export const requirementDecisionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'NEEDS_UNIVERSITY_CONFIRMATION', 'REOPEN']),
  note: z.string().trim().min(5, 'Say why, in a sentence').max(1000),
});

export async function decideRequirement(db: D1Database, id: string, input: z.infer<typeof requirementDecisionSchema>, actor: string) {
  const [view] = await requirementView(db, [await getRow(db, id)]);
  const v = view!;
  const from = v.status;
  const now = nowIso();
  const snapshot = { ...v.source, printedTextHash: await sha256Hex(v.printedText), version: v.version, rule: v.rule, decision: input.action };
  if (input.action === 'APPROVE') {
    if (!['DRAFT', 'NEEDS_UNIVERSITY_CONFIRMATION'].includes(from)) throw conflict(`A requirement that is ${from} cannot be approved`);
    if (v.printedTextChanged) throw conflict('The printed text has changed since this was read. Read it again before approving.');
    if (v.source.sourceStatus !== 'APPROVED') throw conflict('The programme\'s source is not approved');
    if (v.factFlagged) throw conflict(`The printed text still carries a review flag: ${v.factFlag}. A person must resolve it first.`);
    if (v.approvalBlockers.length) throw conflict(`Not ready to approve: ${v.approvalBlockers.map((i) => i.message).join(' | ')}`);
    const others = await db.prepare(`SELECT id FROM admission_requirements WHERE programme_id = ? AND status = 'APPROVED' AND id <> ?`).bind(v.programme.id, id).all<{ id: string }>();
    await db.batch([
      db.prepare(`UPDATE admission_requirements SET status = 'APPROVED', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(input.note, actor, now, now, id),
      ...others.results.flatMap((o) => [
        db.prepare(`UPDATE admission_requirements SET status = 'SUPERSEDED', updated_at = ? WHERE id = ?`).bind(now, o.id),
        eventStmt(db, 'REQUIREMENT', o.id, 'SUPERSEDED', actor, 'APPROVED', 'SUPERSEDED', `Replaced by the approved version ${v.version}`, null),
      ]),
      eventStmt(db, 'REQUIREMENT', id, 'APPROVED', actor, from, 'APPROVED', input.note, snapshot),
    ]);
  } else if (input.action === 'REJECT') {
    if (['SUPERSEDED', 'REJECTED'].includes(from)) throw conflict(`A requirement that is ${from} cannot be rejected`);
    await db.batch([
      db.prepare(`UPDATE admission_requirements SET status = 'REJECTED', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(input.note, actor, now, now, id),
      eventStmt(db, 'REQUIREMENT', id, from === 'APPROVED' ? 'WITHDRAWN' : 'REJECTED', actor, from, 'REJECTED', input.note, snapshot),
    ]);
  } else if (input.action === 'NEEDS_UNIVERSITY_CONFIRMATION') {
    if (from !== 'DRAFT') throw conflict('Only a draft can be sent for the university\'s confirmation');
    await db.batch([
      db.prepare(`UPDATE admission_requirements SET status = 'NEEDS_UNIVERSITY_CONFIRMATION', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(input.note, actor, now, now, id),
      eventStmt(db, 'REQUIREMENT', id, 'AWAITING_UNIVERSITY', actor, from, 'NEEDS_UNIVERSITY_CONFIRMATION', input.note, snapshot),
    ]);
  } else {
    if (!['REJECTED', 'NEEDS_UNIVERSITY_CONFIRMATION'].includes(from)) throw conflict('Only a rejected requirement, or one waiting for the university, can be reopened');
    await db.batch([
      db.prepare(`UPDATE admission_requirements SET status = 'DRAFT', review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`).bind(input.note, actor, now, now, id),
      eventStmt(db, 'REQUIREMENT', id, 'REOPENED', actor, from, 'DRAFT', input.note, snapshot),
    ]);
  }
  return requirementDetail(db, id);
}

async function getRow(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM admission_requirements WHERE id = ?').bind(id).first<RequirementRow>();
  if (!row) throw notFound('Requirement');
  return row;
}

// ---- revising (a person edits the reading: a new version, never an in-place change)

const subjectRefSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('MAPPED'), text: z.string().min(1).max(200), subjectId: z.string(), paperCode: z.string(), basis: z.enum(['OFFICIAL_NAME', 'ALIAS', 'PART_OF_COMBINED_PAPER', 'PAPER_CODE']), note: z.string().max(500).optional() }),
  z.object({ status: z.literal('AMBIGUOUS'), text: z.string().min(1).max(200), candidates: z.array(z.string()), reason: z.string() }),
  z.object({ status: z.literal('CONFLICT'), text: z.string().min(1).max(200), nameSubjectId: z.string(), codeSubjectId: z.string(), reason: z.string() }),
  z.object({ status: z.literal('UNKNOWN'), text: z.string().min(1).max(200) }),
]);
const groupId = z.enum(['LIST_A', 'LIST_B']);
const requirementSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SUBJECT'), subject: subjectRefSchema, group: groupId.nullable() }),
  z.object({ kind: z.literal('ANY_N_OF_GROUP'), n: z.number().int().min(1).max(10), group: groupId, otherThanNamed: z.boolean() }),
  z.object({ kind: z.literal('ANY_N_OF_SET'), n: z.number().int().min(1).max(10), of: z.array(subjectRefSchema).min(2).max(12) }),
  z.object({ kind: z.literal('UNRESOLVED'), text: z.string().min(1).max(500) }),
]);
const combinationSchema = z.object({ label: z.string().min(1).max(80), requirements: z.array(requirementSchema).max(20), effective: z.array(requirementSchema).max(20) });
const resolutionInput = z.object({ note: z.string().trim().min(5).max(1000), sourceUrl: z.url().max(1000).optional() });

export const revisionSchema = z.object({
  combinations: z.array(combinationSchema).min(1).max(12),
  extraTests: z.array(z.object({ kind: z.enum(['PRACTICAL_TEST', 'PERFORMANCE_TEST']), text: z.string().max(500) })).max(3).default([]),
  /** The reviewer's answer to each open question in the text, by issue code. An unstated all-or-any needs the university's confirmation with its address. */
  resolutions: z.record(z.string(), resolutionInput).default({}),
  note: z.string().trim().min(5, 'Say what was changed and why').max(1000),
});

function checkSubjects(reqs: z.infer<typeof requirementSchema>[], problems: string[]) {
  const check = (s: z.infer<typeof subjectRefSchema>) => {
    if (s.status !== 'MAPPED') return;
    const p = paperByCode(s.paperCode);
    if (!p || p.id !== s.subjectId) problems.push(`"${s.text}": subject ${s.subjectId} and paper code ${s.paperCode} do not belong together`);
  };
  for (const r of reqs) {
    if (r.kind === 'SUBJECT') check(r.subject);
    if (r.kind === 'ANY_N_OF_SET') r.of.forEach(check);
  }
}

export async function reviseRequirement(db: D1Database, id: string, input: z.infer<typeof revisionSchema>, actor: string) {
  const prev = await getRow(db, id);
  if (prev.status === 'SUPERSEDED') throw conflict('This version has already been replaced; revise the current one');
  const problems: string[] = [];
  for (const c of input.combinations) { checkSubjects(c.requirements, problems); checkSubjects(c.effective, problems); }
  if (problems.length) throw invalid(problems.join('; '));
  const before = JSON.parse(prev.parsed_json) as StoredRule;
  const resolutions: Record<string, Resolution> = { ...(before.resolutions ?? {}) };
  const now = nowIso();
  for (const [code, r] of Object.entries(input.resolutions)) {
    if (STRUCTURAL_CODES.has(code) && code !== 'PART_NAME_MAPPING') throw invalid(`"${code}" cannot be answered with a note; change the reading itself`);
    if (code === 'ALL_OR_ANY_NOT_STATED' && !r.sourceUrl) throw invalid('Whether all or any papers are needed must be confirmed by the university: give the address of its answer or document');
    resolutions[code] = { note: r.note, ...(r.sourceUrl ? { sourceUrl: r.sourceUrl } : {}), by: actor, at: now };
  }
  const combinations: Combination[] = input.combinations.map((c) => ({ label: c.label, requirements: c.requirements as Requirement[], effective: c.effective as Requirement[], extraTests: [] }));
  // Carried over from the text (the reader's own questions about the printed words); the structural ones are recomputed from the edit.
  const carried = before.issues.filter((i) => !STRUCTURAL_CODES.has(i.code));
  const structural = structuralIssues({ combinations }).filter((i) => i.code !== SELF_CLEARING);
  const rule: StoredRule = { ...buildRule(prev.family as Family, combinations, input.extraTests as ExtraTest[], [...structural, ...carried]), resolutions };
  const version = (await db.prepare('SELECT MAX(version) AS v FROM admission_requirements WHERE programme_id = ?').bind(prev.programme_id).first<{ v: number }>())!.v + 1;
  const newIdValue = newId('areq');
  const stmts = [
    db
      .prepare(
        `INSERT INTO admission_requirements (id, programme_id, source_fact_id, source_text, source_text_hash, parser_version, family, parsed_json, issues_json, version, status, origin, supersedes_id, review_note, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', 'REVIEWER', ?, ?, ?, ?, ?)`,
      )
      .bind(newIdValue, prev.programme_id, prev.source_fact_id, prev.source_text, prev.source_text_hash, prev.parser_version, prev.family, JSON.stringify(rule), JSON.stringify(rule.issues), version, prev.id, input.note, actor, now, now),
    eventStmt(db, 'REQUIREMENT', newIdValue, 'REVISED', actor, prev.status, 'DRAFT', input.note, { fromVersion: prev.version, toVersion: version, resolutions: Object.keys(input.resolutions), before: before.combinations.map((c) => c.label), after: rule.combinations.map((c) => c.label) }),
  ];
  if (prev.status === 'DRAFT' || prev.status === 'NEEDS_UNIVERSITY_CONFIRMATION') {
    stmts.push(db.prepare(`UPDATE admission_requirements SET status = 'SUPERSEDED', updated_at = ? WHERE id = ?`).bind(now, prev.id), eventStmt(db, 'REQUIREMENT', prev.id, 'SUPERSEDED', actor, prev.status, 'SUPERSEDED', `Revised as version ${version}`, null));
  }
  await db.batch(stmts);
  return requirementDetail(db, newIdValue);
}

// ---------------------------------------------------------------- lists (List A, List B)

export const GROUP_CODES = ['LIST_A', 'LIST_B'] as const;
export const groupInputSchema = z.object({
  universitySlug: z.string().trim().min(2).max(120),
  groupCode: z.enum(GROUP_CODES),
  title: z.string().trim().min(2).max(200),
  academicYear: z.string().regex(/^20\d\d-\d\d$/),
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  sourceId: z.string().max(100),
  sourcePage: z.number().int().min(1).optional(),
  sourceLocator: z.string().trim().min(5).max(500),
  checkedOn: day,
  members: z.array(z.object({ printedName: z.string().trim().min(2).max(200), note: z.string().trim().max(500).optional() })).min(1).max(80),
});

/** Matches a printed list entry to an NTA paper. Only a certain match is MAPPED; a possible match is kept as a candidate for a person to confirm. */
function matchMember(name: string, group: GroupId) {
  const r = resolveSubject(name, { group });
  if (r.status === 'MAPPED') return { paperCode: r.paperCode, subjectId: r.subjectId, mappingStatus: 'MAPPED' as const, note: r.note ?? null };
  if (r.status === 'AMBIGUOUS') {
    const candidate = r.candidates.map((c) => CUET_UG_PAPERS.find((p) => p.id === c)).find(Boolean);
    return { paperCode: candidate?.code ?? null, subjectId: candidate?.id ?? null, mappingStatus: 'NEEDS_CONFIRMATION' as const, note: r.reason };
  }
  return { paperCode: null, subjectId: null, mappingStatus: 'UNMAPPED' as const, note: 'No NTA CUET (UG) paper matches this name' };
}

export async function createGroup(db: D1Database, input: z.infer<typeof groupInputSchema>, actor: string) {
  const src = await db.prepare('SELECT status, university_slug FROM admission_sources WHERE id = ?').bind(input.sourceId).first<{ status: string; university_slug: string | null }>();
  if (!src) throw notFound('Source');
  if (src.status !== 'APPROVED') throw conflict('The source is not approved. Approve it after opening its page, then add the list.');
  if (src.university_slug && src.university_slug !== input.universitySlug) throw invalid('That source belongs to a different university');
  const names = input.members.map((m) => slugify(m.printedName));
  if (new Set(names).size !== names.length) throw invalid('A name appears twice in the list');
  const version = ((await db.prepare('SELECT MAX(version) AS v FROM admission_groups WHERE university_slug = ? AND group_code = ? AND academic_year = ? AND exam_code = ?').bind(input.universitySlug, input.groupCode, input.academicYear, input.exam).first<{ v: number | null }>())?.v ?? 0) + 1;
  const id = newId('agrp');
  const now = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(`INSERT INTO admission_groups (id, university_slug, group_code, title, academic_year, exam_code, source_id, source_page, source_locator, checked_on, version, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?)`)
      .bind(id, input.universitySlug, input.groupCode, input.title, input.academicYear, input.exam, input.sourceId, input.sourcePage ?? null, input.sourceLocator, input.checkedOn, version, actor, now, now),
  ];
  input.members.forEach((m, i) => {
    const hit = matchMember(m.printedName, input.groupCode);
    stmts.push(db.prepare('INSERT INTO admission_group_members (id, group_id, position, printed_name, paper_code, subject_id, mapping_status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newId('agm'), id, i + 1, m.printedName, hit.paperCode, hit.subjectId, hit.mappingStatus, [hit.note, m.note].filter(Boolean).join(' | ') || null));
  });
  stmts.push(eventStmt(db, 'GROUP', id, 'READ', actor, null, 'DRAFT', `Entered from the university's printed list (version ${version})`, { sourceId: input.sourceId, sourcePage: input.sourcePage ?? null, sourceLocator: input.sourceLocator, academicYear: input.academicYear, checkedOn: input.checkedOn, members: input.members.length }));
  await db.batch(stmts);
  return groupDetail(db, id);
}

export interface GroupDetail {
  id: string; university_slug: string; group_code: GroupId; title: string; academic_year: string; exam_code: string; source_id: string; source_page: number | null; source_locator: string | null;
  checked_on: string; version: number; status: string; review_note: string | null; published_at: string | null; source_url: string; source_title: string; source_status: string;
  members: { id: string; position: number; printed_name: string; paper_code: string | null; subject_id: string | null; mapping_status: string; note: string | null }[];
  history: { action: string; actor: string; from_status: string | null; to_status: string | null; note: string | null; created_at: string; snapshot: unknown }[];
}

export async function groupDetail(db: D1Database, id: string): Promise<GroupDetail> {
  const g = await db.prepare('SELECT g.*, s.url AS source_url, s.title AS source_title, s.status AS source_status FROM admission_groups g JOIN admission_sources s ON s.id = g.source_id WHERE g.id = ?').bind(id).first<Omit<GroupDetail, 'members' | 'history'>>();
  if (!g) throw notFound('List');
  const [members, history] = await Promise.all([
    db.prepare('SELECT id, position, printed_name, paper_code, subject_id, mapping_status, note FROM admission_group_members WHERE group_id = ? ORDER BY position').bind(id).all<Record<string, unknown>>(),
    db.prepare(`SELECT action, actor, from_status, to_status, note, snapshot_json, created_at FROM admission_review_events WHERE entity_type = 'GROUP' AND entity_id = ? ORDER BY created_at, id`).bind(id).all<Record<string, unknown>>(),
  ]);
  return {
    ...g,
    members: members.results as GroupDetail['members'],
    history: history.results.map((h) => ({ action: String(h.action), actor: String(h.actor), from_status: (h.from_status as string | null) ?? null, to_status: (h.to_status as string | null) ?? null, note: (h.note as string | null) ?? null, created_at: String(h.created_at), snapshot: h.snapshot_json ? JSON.parse(String(h.snapshot_json)) : null })),
  };
}

export async function listGroups(db: D1Database, f: { slug?: string; status?: string }) {
  const where: string[] = [];
  const binds: string[] = [];
  if (f.slug) (where.push('g.university_slug = ?'), binds.push(f.slug));
  if (f.status) (where.push('g.status = ?'), binds.push(f.status));
  const { results } = await db
    .prepare(`SELECT g.id, g.university_slug, g.group_code, g.title, g.academic_year, g.exam_code, g.version, g.status, g.source_page, g.source_locator, g.checked_on, g.review_note, g.published_at,
        (SELECT COUNT(*) FROM admission_group_members m WHERE m.group_id = g.id) AS members,
        (SELECT COUNT(*) FROM admission_group_members m WHERE m.group_id = g.id AND m.mapping_status <> 'MAPPED') AS needs_attention
      FROM admission_groups g ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY g.university_slug, g.group_code, g.version DESC`)
    .bind(...binds)
    .all<Record<string, unknown>>();
  return results;
}

export const groupDecisionSchema = z.object({
  action: z.enum(['PUBLISH', 'REJECT', 'WITHDRAW']),
  note: z.string().trim().min(5, 'Say why, in a sentence').max(1000),
  /** Entries a person has checked and accepts as matched to the paper their candidate names. */
  confirmMembers: z.array(z.string().max(100)).max(80).default([]),
});

export async function decideGroup(db: D1Database, id: string, input: z.infer<typeof groupDecisionSchema>, actor: string) {
  const g = await groupDetail(db, id);
  const from = g.status;
  const now = nowIso();
  if (input.action === 'PUBLISH') {
    if (from !== 'DRAFT') throw conflict(`A list that is ${from} cannot be published`);
    if (g.source_status !== 'APPROVED') throw conflict('The list\'s source is not approved');
    const members = g.members;
    const pending = members.filter((m) => m.mapping_status === 'NEEDS_CONFIRMATION' && !input.confirmMembers.includes(m.id));
    if (pending.length) throw conflict(`These entries must be checked and confirmed before the list is published: ${pending.map((m) => m.printed_name).join(', ')}`);
    const others = await db.prepare(`SELECT id FROM admission_groups WHERE university_slug = ? AND group_code = ? AND academic_year = ? AND exam_code = ? AND status = 'PUBLISHED' AND id <> ?`).bind(g.university_slug, g.group_code, g.academic_year, g.exam_code, id).all<{ id: string }>();
    await db.batch([
      ...input.confirmMembers.map((mid) => db.prepare(`UPDATE admission_group_members SET mapping_status = 'MAPPED', note = COALESCE(note || ' | ', '') || 'Confirmed by ' || ? WHERE id = ? AND group_id = ? AND mapping_status = 'NEEDS_CONFIRMATION' AND paper_code IS NOT NULL`).bind(actor, mid, id)),
      db.prepare(`UPDATE admission_groups SET status = 'PUBLISHED', review_note = ?, published_by = ?, published_at = ?, updated_at = ? WHERE id = ?`).bind(input.note, actor, now, now, id),
      ...others.results.flatMap((o) => [db.prepare(`UPDATE admission_groups SET status = 'WITHDRAWN', updated_at = ? WHERE id = ?`).bind(now, o.id), eventStmt(db, 'GROUP', o.id, 'WITHDRAWN', actor, 'PUBLISHED', 'WITHDRAWN', `Replaced by version ${g.version}`, null)]),
      eventStmt(db, 'GROUP', id, 'PUBLISHED', actor, from, 'PUBLISHED', input.note, { sourceUrl: g.source_url, sourcePage: g.source_page, sourceLocator: g.source_locator, academicYear: g.academic_year, checkedOn: g.checked_on, confirmed: input.confirmMembers, members: members.length }),
    ]);
  } else if (input.action === 'REJECT') {
    if (from !== 'DRAFT') throw conflict('Only a draft list can be rejected');
    await db.batch([db.prepare(`UPDATE admission_groups SET status = 'REJECTED', review_note = ?, updated_at = ? WHERE id = ?`).bind(input.note, now, id), eventStmt(db, 'GROUP', id, 'REJECTED', actor, from, 'REJECTED', input.note, null)]);
  } else {
    if (from !== 'PUBLISHED') throw conflict('Only a published list can be withdrawn');
    await db.batch([db.prepare(`UPDATE admission_groups SET status = 'WITHDRAWN', review_note = ?, updated_at = ? WHERE id = ?`).bind(input.note, now, id), eventStmt(db, 'GROUP', id, 'WITHDRAWN', actor, from, 'WITHDRAWN', input.note, null)]);
  }
  return groupDetail(db, id);
}

/** The lists students may rely on: published, from an approved source, with members matched to NTA papers. */
export async function publishedGroups(db: D1Database, slug: string, academicYear: string, exam: string): Promise<GroupMembers> {
  const { results } = await db
    .prepare(`SELECT g.group_code, m.paper_code FROM admission_groups g JOIN admission_sources s ON s.id = g.source_id JOIN admission_group_members m ON m.group_id = g.id AND m.mapping_status = 'MAPPED' AND m.paper_code IS NOT NULL
      WHERE g.university_slug = ? AND g.academic_year = ? AND g.exam_code = ? AND g.status = 'PUBLISHED' AND s.status = 'APPROVED'`)
    .bind(slug, academicYear, exam)
    .all<{ group_code: GroupId; paper_code: string }>();
  const out: GroupMembers = {};
  for (const r of results) out[r.group_code] = [...(out[r.group_code] ?? []), r.paper_code];
  return out;
}

// ---------------------------------------------------------------- what a student sees

export type Unavailable =
  | 'PROGRAMME_NOT_AVAILABLE' | 'SOURCE_NOT_APPROVED' | 'NO_APPROVED_REQUIREMENT' | 'PRINTED_FACT_NOT_PUBLISHED' | 'PRINTED_FACT_FLAGGED' | 'PRINTED_TEXT_CHANGED'
  | 'LISTS_NOT_PUBLISHED' | 'STUDENT_PAPERS_NOT_SET';

export interface EligibilityOut {
  programmeId: string;
  available: boolean;
  /** Present when not available: why, in plain words. */
  unavailable: { code: Unavailable; message: string } | null;
  result: EligibilityResult | null;
  basis: null | {
    academicYear: string; cycle: CycleInfo; checkedOn: string; sourceUrl: string; sourceTitle: string; sourcePage: number | null; requirementVersion: number; approvedAt: string | null;
    reliability: Reliability;
  };
  papersUsed: string[];
  caveats: string[];
}

const MESSAGES: Record<Unavailable, string> = {
  PROGRAMME_NOT_AVAILABLE: 'This programme is not published.',
  SOURCE_NOT_APPROVED: 'The source of this information is not approved.',
  NO_APPROVED_REQUIREMENT: 'The subject requirement for this programme has not been verified yet, so no result can be shown. Read the university\'s own text on the programme page.',
  PRINTED_FACT_NOT_PUBLISHED: 'The printed requirement for this programme is not published yet.',
  PRINTED_FACT_FLAGGED: 'The requirement text for this programme has a question still open with the source, so no result is shown.',
  PRINTED_TEXT_CHANGED: 'The university\'s text changed after it was checked, so no result is shown until it is checked again.',
  LISTS_NOT_PUBLISHED: 'The subject lists this rule refers to (List A, List B) have not been published yet, so no result can be shown.',
  STUDENT_PAPERS_NOT_SET: 'Choose the CUET subjects you plan to take in your profile to see whether they meet this requirement.',
};

const none = (programmeId: string, code: Unavailable, papers: string[] = []): EligibilityOut => ({ programmeId, available: false, unavailable: { code, message: MESSAGES[code] }, result: null, basis: null, papersUsed: papers, caveats: [] });

/** The CUET papers (codes) a student has chosen in their preferences. Empty when none are chosen. */
export async function studentPaperCodes(db: D1Database, userId: string): Promise<string[]> {
  const row = await db.prepare('SELECT paper_ids_json FROM student_preferences WHERE user_id = ?').bind(userId).first<{ paper_ids_json: string }>();
  const ids: string[] = row ? JSON.parse(row.paper_ids_json) : [];
  if (!ids.length) return [];
  const { results } = await db.prepare(`SELECT code FROM test_papers WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ code: string }>();
  return results.map((r) => r.code).filter((c) => paperByCode(c));
}

export async function eligibilityFor(db: D1Database, programmeIds: string[], paperCodes: string[], now = new Date()): Promise<EligibilityOut[]> {
  const papers = [...new Set(paperCodes)].filter((c) => paperByCode(c));
  const ids = [...new Set(programmeIds)].slice(0, 60);
  if (!ids.length) return [];
  const { results: programmes } = await db.prepare(`${PROGRAMME_SQL} WHERE p.id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<ProgrammeRow>();
  const byId = new Map(programmes.map((p) => [p.id, p]));
  const { results: approved } = await db.prepare(`SELECT * FROM admission_requirements WHERE status = 'APPROVED' AND programme_id IN (${ids.map(() => '?').join(',')}) ORDER BY version`).bind(...ids).all<RequirementRow>();
  const req = new Map<string, RequirementRow>();
  for (const r of approved) req.set(r.programme_id, r);
  const facts = await factsByProgramme(db, ids);
  const groupCache = new Map<string, GroupMembers>();
  const out: EligibilityOut[] = [];
  for (const id of ids) {
    const p = byId.get(id);
    if (!p || p.status !== 'PUBLISHED') { out.push(none(id, 'PROGRAMME_NOT_AVAILABLE', papers)); continue; }
    if (p.source_status !== 'APPROVED') { out.push(none(id, 'SOURCE_NOT_APPROVED', papers)); continue; }
    const r = req.get(id);
    if (!r) { out.push(none(id, 'NO_APPROVED_REQUIREMENT', papers)); continue; }
    const mine = facts.get(id) ?? [];
    // Anything flagged among the programme's subject or eligibility text keeps the whole programme out.
    if (mine.some((f) => f.review_flag)) { out.push(none(id, 'PRINTED_FACT_FLAGGED', papers)); continue; }
    const fact = mine.find((f) => f.id === r.source_fact_id);
    if (!fact || fact.status !== 'PUBLISHED') { out.push(none(id, 'PRINTED_FACT_NOT_PUBLISHED', papers)); continue; }
    const factSource = await db.prepare('SELECT status FROM admission_sources WHERE id = ?').bind(fact.source_id).first<{ status: string }>();
    if (factSource?.status !== 'APPROVED') { out.push(none(id, 'SOURCE_NOT_APPROVED', papers)); continue; }
    if ((await sha256Hex(fact.value_text ?? '')) !== r.source_text_hash) { out.push(none(id, 'PRINTED_TEXT_CHANGED', papers)); continue; }
    const stored = JSON.parse(r.parsed_json) as StoredRule;
    // Defence in depth: an "approved" row whose structure still has a blocking question is never used.
    if (approvalBlockers(stored).length) { out.push(none(id, 'NO_APPROVED_REQUIREMENT', papers)); continue; }
    const key = `${p.university_slug}|${p.academic_year}|${p.exam_code}`;
    if (!groupCache.has(key)) groupCache.set(key, await publishedGroups(db, p.university_slug, p.academic_year, p.exam_code));
    const groups = groupCache.get(key)!;
    if (stored.groupsNeeded.some((g) => !groups[g])) { out.push(none(id, 'LISTS_NOT_PUBLISHED', papers)); continue; }
    if (!papers.length) { out.push(none(id, 'STUDENT_PAPERS_NOT_SET', papers)); continue; }
    const result = evaluateRule(stored, papers, groups);
    const startYear = Number(p.academic_year.slice(0, 4));
    const cycle = cycleInfo(startYear);
    const caveats = [
      'This compares the papers you plan to take with the university\'s published subject rule. It is not a cut-off comparison, a prediction or an admission decision.',
      ...(cycle.status === 'PREVIOUS' ? [`Based on the ${p.academic_year} admission rules (${cycle.label ?? 'previous cycle'}). Confirm the rule for ${CURRENT_ADMISSION_CYCLE} with the university.`] : []),
      ...result.additionalRequirements.map((t) => `${t} also applies and is not judged here.`),
    ];
    out.push({
      programmeId: id, available: true, unavailable: null, result, papersUsed: papers, caveats,
      basis: {
        academicYear: p.academic_year, cycle, checkedOn: fact.checked_on, sourceUrl: p.source_url, sourceTitle: p.source_title, sourcePage: p.source_page, requirementVersion: r.version, approvedAt: r.reviewed_at,
        reliability: reliabilityOf({ status: fact.status, checkedOn: fact.checked_on, cycleYear: startYear, kind: 'ELIGIBILITY', sourceStatus: 'APPROVED' }, now),
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------- targets

const MAX_TARGETS = 30;

export const targetInputSchema = z.object({ programmeId: z.string().max(100), note: z.string().trim().max(300).optional() });

export async function addTarget(db: D1Database, userId: string, input: z.infer<typeof targetInputSchema>) {
  const p = await db.prepare(`${PROGRAMME_SQL} WHERE p.id = ?`).bind(input.programmeId).first<ProgrammeRow>();
  if (!p || p.status !== 'PUBLISHED' || p.source_status !== 'APPROVED') throw notFound('Programme');
  const n = (await db.prepare('SELECT COUNT(*) AS n FROM admission_targets WHERE user_id = ?').bind(userId).first<{ n: number }>())?.n ?? 0;
  const already = await db.prepare('SELECT id FROM admission_targets WHERE user_id = ? AND programme_id = ?').bind(userId, input.programmeId).first();
  if (!already && n >= MAX_TARGETS) throw conflict(`You can follow up to ${MAX_TARGETS} programmes. Remove one to add another.`);
  await db.prepare('INSERT INTO admission_targets (id, user_id, programme_id, note, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, programme_id) DO UPDATE SET note = excluded.note').bind(newId('atg'), userId, input.programmeId, input.note ?? null, nowIso()).run();
  return { added: true };
}

export async function removeTarget(db: D1Database, userId: string, programmeId: string) {
  await db.prepare('DELETE FROM admission_targets WHERE user_id = ? AND programme_id = ?').bind(userId, programmeId).run();
  return { removed: true };
}

/** The student's followed programmes. A programme that has since been withdrawn or lost its source stays listed, marked as no longer available. */
export async function listTargets(db: D1Database, userId: string, now = new Date()) {
  const { results } = await db
    .prepare(`SELECT t.programme_id, t.note, t.created_at, p.programme_name, p.university_name, p.university_slug, p.academic_year, p.exam_code, p.status, p.last_verified_on, s.status AS source_status
      FROM admission_targets t JOIN admission_programmes p ON p.id = t.programme_id JOIN admission_sources s ON s.id = p.source_id WHERE t.user_id = ? ORDER BY t.created_at`)
    .bind(userId)
    .all<{ programme_id: string; note: string | null; created_at: string; programme_name: string; university_name: string; university_slug: string; academic_year: string; exam_code: string; status: string; last_verified_on: string; source_status: string }>();
  const papers = await studentPaperCodes(db, userId);
  const elig = await eligibilityFor(db, results.map((r) => r.programme_id), papers, now);
  const byId = new Map(elig.map((e) => [e.programmeId, e]));
  const targets = results.map((r) => {
    const available = r.status === 'PUBLISHED' && r.source_status === 'APPROVED';
    const start = Number(r.academic_year.slice(0, 4));
    const ageDays = Math.floor((now.getTime() - Date.parse(`${r.last_verified_on}T00:00:00Z`)) / 86_400_000);
    return {
      programmeId: r.programme_id, programmeName: r.programme_name, university: r.university_name, universitySlug: r.university_slug, academicYear: r.academic_year, exam: r.exam_code, addedAt: r.created_at, note: r.note,
      available,
      // What is missing, old or unverified, so the student is never left to assume.
      information: {
        cycle: cycleInfo(start),
        stale: ageDays > STALE_DAYS,
        lastVerifiedOn: r.last_verified_on,
        message: !available ? 'This programme is no longer published. Check the university\'s own page.' : null,
      },
      eligibility: byId.get(r.programme_id) ?? none(r.programme_id, 'PROGRAMME_NOT_AVAILABLE', papers),
    };
  });
  return { papers, targets, limit: MAX_TARGETS };
}

// ---------------------------------------------------------------- validation (university, programme, campus)

export interface Finding { level: 'UNIVERSITY' | 'PROGRAMME' | 'CAMPUS' | 'REQUIREMENT' | 'GROUP'; severity: 'ERROR' | 'WARNING' | 'INFO'; id: string; label: string; message: string }

/** Checks stored admission data without changing it. Errors are things a student could be misled by; warnings and notes are gaps. */
export async function validateAdmissionData(db: D1Database): Promise<{ summary: Record<string, number>; findings: Finding[] }> {
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);
  const { results: programmes } = await db.prepare(PROGRAMME_SQL).all<ProgrammeRow>();
  const { results: listed } = await db.prepare(`SELECT name, exam_code FROM participating_universities WHERE cycle = '2026'`).all<{ name: string; exam_code: string }>();
  const listedSlugs = new Set(listed.map((u) => `${slugify(u.name)}|${u.exam_code}`));
  const seen = new Map<string, string>();
  const facts = await factsByProgramme(db, programmes.map((p) => p.id));
  const { results: flaggedOther } = await db.prepare(`SELECT programme_id, COUNT(*) AS n FROM admission_facts WHERE review_flag IS NOT NULL AND programme_id IS NOT NULL GROUP BY programme_id`).all<{ programme_id: string; n: number }>();
  const flagCount = new Map(flaggedOther.map((r) => [r.programme_id, r.n]));
  const universities = new Set<string>();
  for (const p of programmes) {
    const label = `${p.university_name}: ${p.programme_name}`;
    if (!universities.has(p.university_slug)) {
      universities.add(p.university_slug);
      if (!listedSlugs.has(`${p.university_slug}|${p.exam_code}`)) add({ level: 'UNIVERSITY', severity: 'WARNING', id: p.university_slug, label: p.university_name, message: `Not found by name in NTA's participating-universities list for ${p.exam_code} (2026). Check the spelling against the NTA list.` });
    }
    if (p.source_status !== 'APPROVED') add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: 'The programme cites a source that is not approved' });
    if (p.source_page == null && !p.source_locator) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: 'No page or place in the source is recorded' });
    if (!/^20\d\d-\d\d$/.test(p.academic_year)) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: `Academic year "${p.academic_year}" is not in the form 2026-27` });
    else if (Number(p.academic_year.slice(5)) !== (Number(p.academic_year.slice(0, 4)) + 1) % 100) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: `Academic year "${p.academic_year}" is not two consecutive years` });
    if (Date.parse(`${p.last_verified_on}T00:00:00Z`) > Date.now() + 86_400_000) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: `Last verified date ${p.last_verified_on} is in the future` });
    if (!p.degree) add({ level: 'PROGRAMME', severity: 'INFO', id: p.id, label, message: 'Degree is not recorded' });
    if (!['UG', 'PG'].includes(p.level)) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: `Level "${p.level}" is not UG or PG` });
    const dupKey = `${p.university_slug}|${slugify(p.programme_name)}|${p.academic_year}|${p.exam_code}`;
    if (seen.has(dupKey)) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: `Looks like a duplicate of ${seen.get(dupKey)}` });
    else seen.set(dupKey, p.id);
    if (!p.campus) add({ level: 'CAMPUS', severity: 'INFO', id: p.id, label, message: 'The campus or college is not recorded (the source may not say). Shown to students as not stated.' });
    if (p.status === 'PUBLISHED') {
      const mine = facts.get(p.id) ?? [];
      if (!mine.some((f) => f.status === 'PUBLISHED')) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: 'Published, but none of its subject or eligibility text is published' });
      if ((flagCount.get(p.id) ?? 0) > 0) add({ level: 'PROGRAMME', severity: 'ERROR', id: p.id, label, message: 'Published, but some of its information still carries an open review flag' });
    }
  }
  const { results: reqs } = await db.prepare(`SELECT * FROM admission_requirements WHERE status IN ('APPROVED','DRAFT','NEEDS_UNIVERSITY_CONFIRMATION')`).all<RequirementRow>();
  const pById = new Map(programmes.map((p) => [p.id, p]));
  for (const r of reqs) {
    const p = pById.get(r.programme_id);
    if (!p) continue;
    const label = `${p.university_name}: ${p.programme_name} (v${r.version})`;
    const cur = printedFact(facts.get(r.programme_id) ?? []);
    const stale = !cur || (await sha256Hex(cur.value_text ?? '')) !== r.source_text_hash;
    if (stale) add({ level: 'REQUIREMENT', severity: r.status === 'APPROVED' ? 'ERROR' : 'WARNING', id: r.id, label, message: 'The printed text changed after this was read. It is not used until read and approved again.' });
    if (r.status === 'APPROVED') {
      if (p.status !== 'PUBLISHED') add({ level: 'REQUIREMENT', severity: 'WARNING', id: r.id, label, message: 'Approved, but its programme is not published' });
      if (cur?.review_flag) add({ level: 'REQUIREMENT', severity: 'ERROR', id: r.id, label, message: 'Approved, but the printed text carries an open review flag. It is not used.' });
      if (approvalBlockers(JSON.parse(r.parsed_json) as StoredRule).length) add({ level: 'REQUIREMENT', severity: 'ERROR', id: r.id, label, message: 'Approved with an open question. It is not used.' });
    }
  }
  const { results: groups } = await db.prepare(`SELECT g.id, g.university_slug, g.group_code, g.status, g.academic_year, (SELECT COUNT(*) FROM admission_group_members m WHERE m.group_id = g.id AND m.mapping_status <> 'MAPPED') AS pending FROM admission_groups g WHERE g.status IN ('DRAFT','PUBLISHED')`).all<{ id: string; university_slug: string; group_code: string; status: string; academic_year: string; pending: number }>();
  for (const g of groups) {
    const label = `${g.university_slug} ${g.group_code} ${g.academic_year}`;
    if (g.status === 'DRAFT') add({ level: 'GROUP', severity: 'WARNING', id: g.id, label, message: `Not published yet; rules that refer to it cannot be used${g.pending ? ` (${g.pending} entries still need checking)` : ''}` });
    else if (g.pending) add({ level: 'GROUP', severity: 'INFO', id: g.id, label, message: `${g.pending} entries are published without an NTA paper and never count for a student` });
  }
  const summary: Record<string, number> = { ERROR: 0, WARNING: 0, INFO: 0 };
  for (const f of findings) summary[f.severity] = (summary[f.severity] ?? 0) + 1;
  return { summary: { ...summary, programmes: programmes.length, requirements: reqs.length, groups: groups.length }, findings };
}

export { ApiError };
