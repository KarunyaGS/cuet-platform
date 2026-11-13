/**
 * Practice Centre: links to official documents, and our own mock papers.
 *
 * Official links
 *  - Only an address is stored. Nothing is downloaded, copied or re-hosted.
 *  - An address must be on the exam body's own sites.
 *  - A link is shown to students only after a member of staff records why linking is allowed (the exam body's
 *    site asks for prior permission before other sites link to it). A "not available" notice carries no link and
 *    needs no such basis.
 *
 * Mock papers
 *  - Our own original practice questions, never official ones, and labelled so.
 *  - Built only from questions a reviewer has approved, to a written blueprint: every syllabus unit is covered in
 *    proportion to its share of the syllabus, with a fixed mix of easy, medium and hard questions.
 *  - The blueprint is based on the syllabus, not on past-paper trends: no official question paper is available to
 *    measure trends from, and none is claimed.
 *  - A reviewer approves the paper as a whole, then a member of staff publishes it. A tool can do neither.
 */
import { z } from 'zod';
import { ApiError, conflict, invalid, notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { insertRows, nowIso } from '../lib/sql';
import { createSession } from './practice';

// ---------------------------------------------------------------- official links

/** The exam body's own sites. A link anywhere else is refused. */
const OFFICIAL_HOSTS = [/(^|\.)nta\.ac\.in$/, /(^|\.)nta\.nic\.in$/, /^cdnbbsr\.s3waas\.gov\.in$/];
const isOfficialUrl = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && OFFICIAL_HOSTS.some((h) => h.test(x.hostname));
  } catch {
    return false;
  }
};

const linkSchema = z
  .object({
    exam: z.enum(['CUET_UG', 'CUET_PG']),
    year: z.number().int().min(2022).max(2100),
    subjectCode: z.string().trim().max(20).optional(),
    subjectName: z.string().trim().max(200).optional(),
    session: z.string().trim().max(80).optional(),
    kind: z.enum(['QUESTION_PAPER', 'ANSWER_KEY']),
    availability: z.enum(['AVAILABLE', 'NOT_AVAILABLE']),
    url: z.string().max(1000).optional(),
    title: z.string().trim().min(3).max(200),
    note: z.string().trim().max(600).optional(),
    evidenceUrl: z.string().max(1000).optional(),
    checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .superRefine((l, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (l.availability === 'AVAILABLE') {
      if (!l.url) issue('An available document needs its address');
      else if (!isOfficialUrl(l.url)) issue('The address must be an https address on the exam body\'s own site');
    } else {
      if (l.url) issue('A document that is not available cannot carry an address');
      if (!l.note) issue('Say why the document is not available');
    }
    if (l.evidenceUrl && !isOfficialUrl(l.evidenceUrl)) issue('The evidence address must be on the exam body\'s own site');
    if (l.subjectCode && !l.subjectName) issue('Give the subject name with the subject code');
  });
export const linksImportSchema = z.object({ schema: z.literal('cuet-official-links/1'), links: z.array(linkSchema).min(1).max(2000) });

const linkKey = (l: z.infer<typeof linkSchema>) => `${l.exam}:${l.year}:${l.subjectCode ?? 'all'}:${(l.session ?? 'all').replace(/\s+/g, '-')}:${l.kind}`.toLowerCase();

/** Stores links as drafts. A row that is already published is left as it is. */
export async function importOfficialLinks(db: D1Database, body: unknown, actor: string) {
  const input = linksImportSchema.parse(body);
  const out = { created: 0, updated: 0, unchanged: 0, skippedPublished: [] as string[] };
  const now = nowIso();
  for (const l of input.links) {
    const key = linkKey(l);
    const cur = await db.prepare('SELECT id, status, url, title, note, availability, checked_on FROM official_paper_links WHERE external_key = ?').bind(key).first<Record<string, string | null>>();
    if (cur?.['status'] === 'PUBLISHED') {
      out.skippedPublished.push(key);
      continue;
    }
    const row = { exam_code: l.exam, year: l.year, subject_code: l.subjectCode ?? null, subject_name: l.subjectName ?? null, session: l.session ?? null, kind: l.kind, availability: l.availability, url: l.url ?? null, title: l.title, note: l.note ?? null, evidence_url: l.evidenceUrl ?? null, checked_on: l.checkedOn, updated_at: now };
    if (!cur) {
      await db.batch(insertRows(db, 'official_paper_links', [{ id: newId('opl'), ...row, publisher: 'National Testing Agency (NTA)', linking_basis: null, linking_checked_by: null, status: 'DRAFT', external_key: key, created_by: actor, created_at: now, published_at: null }]));
      out.created++;
    } else if (cur['url'] === row.url && cur['title'] === row.title && cur['note'] === row.note && cur['availability'] === row.availability && cur['checked_on'] === row.checked_on) out.unchanged++;
    else {
      // A changed address loses its recorded linking basis: it must be checked again.
      await db.prepare(`UPDATE official_paper_links SET ${Object.keys(row).map((k) => `${k} = ?`).join(', ')}, linking_basis = NULL, linking_checked_by = NULL, status = 'DRAFT' WHERE id = ?`).bind(...(Object.values(row) as (string | number | null)[]), cur['id']).run();
      out.updated++;
    }
  }
  return out;
}

type LinkRow = Record<string, string | number | null>;
const linkOut = (r: LinkRow) => ({
  id: r['id'], exam: r['exam_code'], year: r['year'], subjectCode: r['subject_code'], subjectName: r['subject_name'], session: r['session'], kind: r['kind'], available: r['availability'] === 'AVAILABLE',
  url: r['url'], title: r['title'], note: r['note'], evidenceUrl: r['evidence_url'], publisher: r['publisher'], checkedOn: r['checked_on'],
});

/** What students see: published rows only. A link is included only when its linking basis is on record. */
export async function listOfficialLinks(db: D1Database, exam: string) {
  const { results } = await db
    .prepare(`SELECT * FROM official_paper_links WHERE exam_code = ? AND status = 'PUBLISHED' AND (availability = 'NOT_AVAILABLE' OR (linking_basis IS NOT NULL AND url IS NOT NULL)) ORDER BY year DESC, kind DESC, subject_name, session`)
    .bind(exam)
    .all<LinkRow>();
  const years = [...new Set(results.map((r) => Number(r['year'])))];
  return { exam, years: years.map((y) => ({ year: y, items: results.filter((r) => r['year'] === y).map(linkOut) })) };
}

export async function listOfficialLinksAdmin(db: D1Database, inAppViewing = false) {
  const { results } = await db.prepare('SELECT * FROM official_paper_links ORDER BY exam_code, year DESC, kind DESC, subject_name, session').all<LinkRow>();
  return results.map((r) => ({ ...linkOut(r), status: r['status'], key: r['external_key'], linkingBasis: r['linking_basis'], linkingCheckedBy: r['linking_checked_by'], publishedAt: r['published_at'], embedBasis: r['embed_basis'], viewerMode: r['url'] ? viewerMode(String(r['url']), Boolean(r['embed_basis']), inAppViewing) : null, inAppViewing }));
}

export const linkActionSchema = z.object({
  action: z.enum(['PUBLISH', 'UNPUBLISH', 'ARCHIVE', 'ALLOW_IN_APP', 'DISALLOW_IN_APP']),
  /** For ALLOW_IN_APP: the exam body's permission to show the document inside this platform. */
  embedBasis: z.string().trim().max(500).optional(),
  /** Required to publish a link: the reference of the exam body's permission, or the owner's recorded decision. */
  linkingBasis: z.string().trim().max(500).optional(),
  /** The staff member confirms they read the site's linking conditions. */
  conditionsChecked: z.boolean().optional(),
});

export async function setOfficialLinkStatus(db: D1Database, id: string, input: z.infer<typeof linkActionSchema>, actor: string, inAppViewing = false) {
  if (!actor.startsWith('user:')) throw new ApiError(403, 'HUMAN_REVIEW_REQUIRED', 'Only a signed-in member of staff can publish an official link');
  const cur = await db.prepare('SELECT id, status, availability, url FROM official_paper_links WHERE id = ?').bind(id).first<{ id: string; status: string; availability: string; url: string | null }>();
  if (!cur) throw notFound('Official link');
  const now = nowIso();
  const audit = (action: string, detail: object) => db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, action, 'OFFICIAL_LINK', id, JSON.stringify(detail), now);
  if (input.action === 'PUBLISH') {
    if (cur.status !== 'DRAFT') throw conflict('Only a draft can be published');
    if (cur.availability === 'AVAILABLE') {
      if (!cur.url || !isOfficialUrl(cur.url)) throw invalid('The address is not on the exam body\'s own site');
      if (!input.conditionsChecked || (input.linkingBasis ?? '').length < 10) throw new ApiError(409, 'LINKING_BASIS_REQUIRED', 'Before a link is shown, record why linking is allowed (for example the reference of the exam body\'s permission) and confirm you checked the site\'s linking conditions');
    }
    await db.batch([
      db.prepare(`UPDATE official_paper_links SET status = 'PUBLISHED', linking_basis = ?, linking_checked_by = ?, published_at = ?, updated_at = ? WHERE id = ? AND status = 'DRAFT'`).bind(cur.availability === 'AVAILABLE' ? input.linkingBasis! : null, cur.availability === 'AVAILABLE' ? actor : null, now, now, id),
      audit('PUBLISH_OFFICIAL_LINK', { linkingBasis: input.linkingBasis ?? null }),
    ]);
  } else if (input.action === 'ALLOW_IN_APP') {
    // Only needed where the exam body's server does not itself allow its files to be shown on other sites.
    if (!inAppViewing) throw new ApiError(409, 'IN_APP_VIEWING_OFF', 'Viewing official documents inside CUET Prep is switched off until NTA grants permission to display them. Documents open on NTA\'s own website.');
    if (cur.status !== 'PUBLISHED' || cur.availability !== 'AVAILABLE') throw conflict('Publish the link first; in-app viewing is a further step');
    if (!input.conditionsChecked || (input.embedBasis ?? '').length < 10) throw new ApiError(409, 'EMBED_BASIS_REQUIRED', 'Showing this document inside CUET Prep passes the file through our server, which the exam body\'s copyright policy allows only with its permission. Record that permission and confirm you have it.');
    await db.batch([db.prepare('UPDATE official_paper_links SET embed_basis = ?, embed_recorded_by = ?, updated_at = ? WHERE id = ?').bind(input.embedBasis!, actor, now, id), audit('ALLOW_IN_APP_OFFICIAL_LINK', { embedBasis: input.embedBasis })]);
  } else if (input.action === 'DISALLOW_IN_APP') {
    await db.batch([db.prepare('UPDATE official_paper_links SET embed_basis = NULL, embed_recorded_by = NULL, updated_at = ? WHERE id = ?').bind(now, id), audit('DISALLOW_IN_APP_OFFICIAL_LINK', {})]);
  } else {
    // Unpublishing or archiving also withdraws in-app viewing.
    await db.batch([db.prepare('UPDATE official_paper_links SET status = ?, embed_basis = NULL, embed_recorded_by = NULL, updated_at = ? WHERE id = ?').bind(input.action === 'ARCHIVE' ? 'ARCHIVED' : 'DRAFT', now, id), audit(`${input.action}_OFFICIAL_LINK`, {})]);
  }
  return (await listOfficialLinksAdmin(db, inAppViewing)).find((x) => x.id === id)!;
}

// ---------------------------------------------------------------- mock papers

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
type Difficulty = (typeof DIFFICULTIES)[number];
/** Our own target mix. It is a design choice stated on every paper, not a measured exam trend. */
const DIFFICULTY_TARGET: Record<Difficulty, number> = { EASY: 0.3, MEDIUM: 0.5, HARD: 0.2 };
const MAX_PER_TOPIC = 2;

/** Splits `total` across weights so the parts add up exactly (largest remainder). */
export function apportion(total: number, weights: number[], minEach = 0): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map((r) => Math.max(minEach, Math.floor(r)));
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k]!.i]!++;
  // If the minimum pushed the sum over, take back from the largest parts.
  for (let guard = 0; left < 0 && guard < 10000; guard++) {
    const i = out.indexOf(Math.max(...out));
    if (out[i]! <= minEach) break;
    out[i]!--;
    left++;
  }
  return out;
}

interface Rules { questionsPerPaper?: number; durationMinutes?: number; marksCorrect?: number; marksIncorrect?: number; optionsPerQuestion?: number }

async function subjectFrame(db: D1Database, paperId: string) {
  const paper = await db
    .prepare(
      `SELECT tp.id, tp.code, tp.name, e.code AS exam, ec.year, ec.rules_json,
         (SELECT sv.id FROM syllabus_versions sv WHERE sv.test_paper_id = tp.id AND sv.verification IN ('MACHINE_VERIFIED','VERIFIED') AND sv.status != 'ARCHIVED' ORDER BY sv.version_number DESC LIMIT 1) AS version_id
       FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE tp.id = ?`,
    )
    .bind(paperId)
    .first<{ id: string; code: string; name: string; exam: string; year: number; rules_json: string | null; version_id: string | null }>();
  if (!paper) throw notFound('Subject');
  if (!paper.version_id) throw conflict('This subject has no checked syllabus yet, so a paper cannot be built to it');
  const rules = JSON.parse(paper.rules_json ?? '{}') as Rules;
  // Units = the top-level parts of the syllabus (the question-paper "Note" box is not syllabus). Weight = its rows.
  const { results: units } = await db
    .prepare(
      `WITH RECURSIVE tree(id, root) AS (
         SELECT id, id FROM curriculum_nodes WHERE syllabus_version_id = ?1 AND parent_id IS NULL AND kind != 'NOTE'
         UNION ALL SELECT c.id, tree.root FROM curriculum_nodes c JOIN tree ON c.parent_id = tree.id)
       SELECT r.id, r.label, r.title, r.position, (SELECT COUNT(*) FROM tree t WHERE t.root = r.id) AS weight FROM curriculum_nodes r WHERE r.syllabus_version_id = ?1 AND r.parent_id IS NULL AND r.kind != 'NOTE' ORDER BY r.position`,
    )
    .bind(paper.version_id)
    .all<{ id: string; label: string | null; title: string; position: number; weight: number }>();
  return { paper, rules, units };
}

interface Candidate { id: string; difficulty: Difficulty; type: string; unit: string; topic: string; content_hash: string }

async function candidates(db: D1Database, paperId: string, versionId: string, optionsPerQuestion: number, onlyVerified: boolean) {
  const { results } = await db
    .prepare(
      `WITH RECURSIVE tree(id, root) AS (
         SELECT id, id FROM curriculum_nodes WHERE syllabus_version_id = ?1 AND parent_id IS NULL AND kind != 'NOTE'
         UNION ALL SELECT c.id, tree.root FROM curriculum_nodes c JOIN tree ON c.parent_id = tree.id)
       SELECT q.id, q.difficulty, q.type, q.verification, q.content_hash, t.root AS unit, qt.curriculum_node_id AS topic,
         (SELECT COUNT(*) FROM question_options o WHERE o.question_id = q.id) AS options,
         EXISTS (SELECT 1 FROM mock_paper_questions m JOIN mock_papers mp ON mp.id = m.mock_paper_id WHERE m.question_id = q.id AND mp.status != 'ARCHIVED') AS used
       FROM questions q JOIN question_topics qt ON qt.question_id = q.id JOIN tree t ON t.id = qt.curriculum_node_id
       WHERE q.is_demonstration = 0 AND q.status != 'ARCHIVED' AND q.origin != 'PAST_PAPER' AND (q.test_paper_id = ?2 OR q.test_paper_id IS NULL)
         AND EXISTS (SELECT 1 FROM answer_keys a WHERE a.question_id = q.id) AND EXISTS (SELECT 1 FROM explanations x WHERE x.question_id = q.id)
       GROUP BY q.id ORDER BY q.content_hash`,
    )
    .bind(versionId, paperId)
    .all<Candidate & { verification: string; options: number; used: number }>();
  const fits = results.filter((q) => q.type === 'NUMERICAL' || q.options === optionsPerQuestion);
  return {
    bank: results.length,
    wrongOptionCount: results.length - fits.length,
    approved: fits.filter((q) => q.verification === 'VERIFIED').length,
    eligible: fits.filter((q) => (!onlyVerified || q.verification === 'VERIFIED') && !q.used) as Candidate[],
  };
}

/** What a paper for this subject must look like, and whether the approved question bank can supply it today. */
export async function mockPaperReadiness(db: D1Database, paperId: string) {
  const { paper, rules, units } = await subjectFrame(db, paperId);
  const total = rules.questionsPerPaper ?? 50;
  const optionsPerQuestion = rules.optionsPerQuestion ?? 4;
  const quotas = apportion(total, units.map((u) => u.weight), units.length <= total ? 1 : 0);
  const c = await candidates(db, paperId, paper.version_id!, optionsPerQuestion, true);
  const perUnit = units.map((u, i) => ({ id: u.id, label: u.label, title: u.title, syllabusRows: u.weight, needed: quotas[i]!, available: c.eligible.filter((q) => q.unit === u.id).length }));
  const targets = apportion(total, DIFFICULTIES.map((d) => DIFFICULTY_TARGET[d]));
  const perDifficulty = DIFFICULTIES.map((d, i) => ({ difficulty: d, needed: targets[i]!, available: c.eligible.filter((q) => q.difficulty === d).length }));
  const shortfalls = [
    ...perUnit.filter((u) => u.available < u.needed).map((u) => `Unit ${u.label ?? ''} ${u.title}: ${u.needed} needed, ${u.available} approved and unused`.replace(/\s+/g, ' ')),
    ...perDifficulty.filter((d) => d.available < d.needed).map((d) => `${d.difficulty.toLowerCase()} questions: ${d.needed} needed, ${d.available} approved and unused`),
  ];
  return {
    subject: { paperId: paper.id, code: paper.code, name: paper.name, exam: paper.exam, year: paper.year },
    pattern: { questions: total, durationMinutes: rules.durationMinutes ?? 60, marksCorrect: rules.marksCorrect ?? 1, marksIncorrect: rules.marksIncorrect ?? 0, optionsPerQuestion },
    basis: 'Syllabus-proportional: each unit gets questions in proportion to its share of the official syllabus. No past-paper trend is used, because no official question paper is available to measure one.',
    bank: { questions: c.bank, approvedByReviewer: c.approved, notMatchingOptionCount: c.wrongOptionCount, eligibleUnused: c.eligible.length },
    perUnit, perDifficulty, ready: shortfalls.length === 0, shortfalls,
  };
}

/** Builds the next mock paper of a subject as a DRAFT. Deterministic: the same bank gives the same paper. */
export async function buildMockPaper(db: D1Database, paperId: string, actor: string) {
  const ready = await mockPaperReadiness(db, paperId);
  if (!ready.ready) throw new ApiError(409, 'NOT_ENOUGH_QUESTIONS', 'There are not enough reviewer-approved questions to build a paper to the blueprint', { shortfalls: ready.shortfalls, bank: ready.bank });
  const { paper } = await subjectFrame(db, paperId);
  const pool = (await candidates(db, paperId, paper.version_id!, ready.pattern.optionsPerQuestion, true)).eligible;
  const need: Record<Difficulty, number> = Object.fromEntries(ready.perDifficulty.map((d) => [d.difficulty, d.needed])) as Record<Difficulty, number>;
  const chosen: (Candidate & { unitId: string })[] = [];
  const perTopic = new Map<string, number>();
  for (const u of ready.perUnit) {
    const inUnit = pool.filter((q) => q.unit === u.id);
    for (let slot = 0; slot < u.needed; slot++) {
      const free = inUnit.filter((q) => !chosen.some((c) => c.id === q.id));
      // Prefer the difficulty the paper still needs most, then a topic not used twice already.
      const byNeed = [...DIFFICULTIES].sort((a, b) => need[b] - need[a]);
      const pick =
        byNeed.flatMap((d) => free.filter((q) => q.difficulty === d && (perTopic.get(q.topic) ?? 0) < MAX_PER_TOPIC)).find(() => true) ??
        byNeed.flatMap((d) => free.filter((q) => q.difficulty === d)).find(() => true);
      if (!pick) throw new ApiError(409, 'NOT_ENOUGH_QUESTIONS', 'There are not enough reviewer-approved questions to build a paper to the blueprint', { shortfalls: [`Unit ${u.label ?? ''} ${u.title}`.trim()] });
      chosen.push({ ...pick, unitId: u.id });
      need[pick.difficulty]--;
      perTopic.set(pick.topic, (perTopic.get(pick.topic) ?? 0) + 1);
    }
  }
  const count = (f: (q: Candidate) => string) => chosen.reduce<Record<string, number>>((a, q) => ((a[f(q)] = (a[f(q)] ?? 0) + 1), a), {});
  const difficulty = count((q) => q.difficulty);
  // The mix may miss its target by a few questions when a unit lacks a level; more than 10 points off is refused.
  const off = DIFFICULTIES.map((d) => Math.abs((difficulty[d] ?? 0) / chosen.length - DIFFICULTY_TARGET[d]));
  if (Math.max(...off) > 0.1) throw new ApiError(409, 'UNBALANCED', 'The approved questions cannot give a balanced paper yet', { difficulty, target: DIFFICULTY_TARGET });
  const last = await db.prepare('SELECT COALESCE(MAX(number), 0) AS n FROM mock_papers WHERE test_paper_id = ?').bind(paperId).first<{ n: number }>();
  const number = (last?.n ?? 0) + 1;
  const id = newId('mp');
  const now = nowIso();
  const blueprint = {
    basis: ready.basis, pattern: ready.pattern, difficultyTarget: DIFFICULTY_TARGET, maxPerTopic: MAX_PER_TOPIC,
    units: ready.perUnit.map((u) => ({ id: u.id, label: u.label, title: u.title, syllabusRows: u.syllabusRows, questions: u.needed })),
    result: { difficulty, formats: count((q) => q.type), topicsCovered: perTopic.size },
  };
  await db.batch([
    ...insertRows(db, 'mock_papers', [{ id, test_paper_id: paperId, number, title: `${ready.subject.name}: Mock Paper ${number}`, blueprint_json: JSON.stringify(blueprint), status: 'DRAFT', created_by: actor, approved_by: null, approved_at: null, approval_note: null, published_by: null, published_at: null, created_at: now, updated_at: now }]),
    ...insertRows(db, 'mock_paper_questions', chosen.map((q, i) => ({ mock_paper_id: id, position: i + 1, question_id: q.id, unit_node_id: q.unitId }))),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'BUILD_MOCK_PAPER', 'MOCK_PAPER', id, JSON.stringify({ subject: ready.subject.code, number, difficulty }), now),
  ]);
  return mockPaperAdmin(db, id);
}

const ALL_VERIFIED = `NOT EXISTS (SELECT 1 FROM mock_paper_questions m JOIN questions q ON q.id = m.question_id WHERE m.mock_paper_id = mp.id AND (q.verification != 'VERIFIED' OR q.status = 'ARCHIVED'))`;

export async function listMockPapersAdmin(db: D1Database, paperId?: string) {
  const { results } = await db
    .prepare(
      `SELECT mp.id, mp.test_paper_id, mp.number, mp.title, mp.status, mp.blueprint_json, mp.created_by, mp.approved_by, mp.approved_at, mp.approval_note, mp.published_at, tp.code, tp.name, e.code AS exam,
         (SELECT COUNT(*) FROM mock_paper_questions m WHERE m.mock_paper_id = mp.id) AS questions, ${ALL_VERIFIED} AS all_verified
       FROM mock_papers mp JOIN test_papers tp ON tp.id = mp.test_paper_id JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id
       ${paperId ? 'WHERE mp.test_paper_id = ?' : ''} ORDER BY tp.name, mp.number`,
    )
    .bind(...(paperId ? [paperId] : []))
    .all<Record<string, string | number | null>>();
  return results.map((r) => ({ id: r['id'], paperId: r['test_paper_id'], subjectCode: r['code'], subjectName: r['name'], exam: r['exam'], number: r['number'], title: r['title'], status: r['status'], questions: Number(r['questions']), allQuestionsApproved: Boolean(r['all_verified']), blueprint: JSON.parse(r['blueprint_json'] as string), approvedBy: r['approved_by'], approvedAt: r['approved_at'], approvalNote: r['approval_note'], publishedAt: r['published_at'] }));
}

export async function mockPaperAdmin(db: D1Database, id: string) {
  const paper = (await listMockPapersAdmin(db)).find((p) => p.id === id);
  if (!paper) throw notFound('Mock paper');
  const { results } = await db
    .prepare(`SELECT m.position, q.id, q.type, q.difficulty, q.verification, substr(q.stem, 1, 160) AS stem, u.label AS unit_label, u.title AS unit_title FROM mock_paper_questions m JOIN questions q ON q.id = m.question_id LEFT JOIN curriculum_nodes u ON u.id = m.unit_node_id WHERE m.mock_paper_id = ? ORDER BY m.position`)
    .bind(id)
    .all();
  return { ...paper, items: results };
}

export const mockActionSchema = z.object({ action: z.enum(['APPROVE', 'PUBLISH', 'UNPUBLISH', 'ARCHIVE']), note: z.string().trim().max(1000).optional() });

export async function setMockPaperStatus(db: D1Database, id: string, input: z.infer<typeof mockActionSchema>, staff: { id: string; permissions: string[] }) {
  const actor = `user:${staff.id}`;
  const p = (await listMockPapersAdmin(db)).find((x) => x.id === id);
  if (!p) throw notFound('Mock paper');
  const need = (perm: string, what: string) => {
    if (!staff.permissions.includes(perm)) throw new ApiError(403, 'FORBIDDEN', `Your account cannot ${what}`);
  };
  const now = nowIso();
  const audit = (action: string) => db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, action, 'MOCK_PAPER', id, JSON.stringify({ note: input.note ?? null }), now);
  if (input.action === 'APPROVE') {
    need('content:review', 'approve a mock paper');
    if (p.status !== 'DRAFT') throw conflict('Only a draft can be approved');
    if (!p.allQuestionsApproved) throw conflict('Every question must be approved by a reviewer before the paper is');
    if ((input.note ?? '').length < 10) throw invalid('Say what you checked (coverage, balance, answer keys): the note is kept with the paper');
    await db.batch([db.prepare(`UPDATE mock_papers SET status = 'APPROVED', approved_by = ?, approved_at = ?, approval_note = ?, updated_at = ? WHERE id = ? AND status = 'DRAFT'`).bind(actor, now, input.note!, now, id), audit('APPROVE_MOCK_PAPER')]);
  } else if (input.action === 'PUBLISH') {
    need('content:publish', 'publish a mock paper');
    if (p.status !== 'APPROVED') throw conflict('A reviewer must approve the paper before it is published');
    if (!p.allQuestionsApproved) throw conflict('A question in this paper is no longer approved; the paper cannot be published');
    await db.batch([db.prepare(`UPDATE mock_papers SET status = 'PUBLISHED', published_by = ?, published_at = ?, updated_at = ? WHERE id = ? AND status = 'APPROVED'`).bind(actor, now, now, id), audit('PUBLISH_MOCK_PAPER')]);
  } else {
    need('content:publish', 'unpublish or archive a mock paper');
    if (input.action === 'UNPUBLISH' && p.status !== 'PUBLISHED') throw conflict('This paper is not published');
    await db.batch([db.prepare('UPDATE mock_papers SET status = ?, updated_at = ? WHERE id = ?').bind(input.action === 'ARCHIVE' ? 'ARCHIVED' : 'APPROVED', now, id), audit(`${input.action}_MOCK_PAPER`)]);
  }
  return mockPaperAdmin(db, id);
}

/** Published papers whose every question is still approved. The preview setting never widens this. */
export async function listMockPapers(db: D1Database, f: { exam?: string; paperId?: string }) {
  const where = [`mp.status = 'PUBLISHED'`, ALL_VERIFIED];
  const params: string[] = [];
  if (f.exam) (where.push('e.code = ?'), params.push(f.exam));
  if (f.paperId) (where.push('mp.test_paper_id = ?'), params.push(f.paperId));
  const { results } = await db
    .prepare(
      `SELECT mp.id, mp.test_paper_id, mp.number, mp.title, mp.blueprint_json, tp.code, tp.name, e.code AS exam, (SELECT COUNT(*) FROM mock_paper_questions m WHERE m.mock_paper_id = mp.id) AS questions
       FROM mock_papers mp JOIN test_papers tp ON tp.id = mp.test_paper_id JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE ${where.join(' AND ')} ORDER BY tp.name, mp.number`,
    )
    .bind(...params)
    .all<Record<string, string | number | null>>();
  return results.map((r) => {
    const b = JSON.parse(r['blueprint_json'] as string) as { pattern: { durationMinutes: number; marksCorrect: number; marksIncorrect: number }; result: { difficulty: Record<string, number> }; units: unknown[] };
    return { id: r['id'], paperId: r['test_paper_id'], subjectCode: r['code'], subjectName: r['name'], exam: r['exam'], number: r['number'], title: r['title'], questions: Number(r['questions']), durationMinutes: b.pattern.durationMinutes, marksCorrect: b.pattern.marksCorrect, marksIncorrect: b.pattern.marksIncorrect, difficulty: b.result.difficulty, units: b.units.length };
  });
}

export const startMockSchema = z.object({ mode: z.enum(['PRACTICE', 'MOCK_TEST']).default('MOCK_TEST') });

export async function startMockPaper(db: D1Database, userId: string, id: string, input: z.infer<typeof startMockSchema>) {
  const p = (await listMockPapers(db, {})).find((x) => x.id === id);
  if (!p) throw notFound('Mock paper');
  const { results } = await db.prepare('SELECT question_id FROM mock_paper_questions WHERE mock_paper_id = ? ORDER BY position').bind(id).all<{ question_id: string }>();
  const rules = { questionsPerPaper: p.questions, durationMinutes: p.durationMinutes, marksCorrect: p.marksCorrect, marksIncorrect: p.marksIncorrect };
  return createSession(db, userId, { mode: input.mode, paperId: p.paperId as string, nodeId: null, ids: results.map((r) => r.question_id) }, { rulesJson: JSON.stringify(rules), rules }, { kind: 'MOCK_PAPER', id, title: String(p.title) });
}

// ---------------------------------------------------------------- official paper directory

const directorySchema = z.object({
  schema: z.literal('cuet-official-directory/1'),
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  year: z.number().int().min(2022).max(2100),
  key: z.object({ title: z.string().trim().min(3).max(200), url: z.string().max(1000), version: z.enum(['FINAL', 'PROVISIONAL']), sha256: z.string().regex(/^[0-9a-f]{64}$/), pages: z.number().int().positive(), retrievedAt: z.iso.datetime() }),
  paper: z.object({ status: z.literal('NOT_PUBLISHED'), note: z.string().trim().min(10).max(600), evidenceUrl: z.string().max(1000).optional() }),
  unreadPages: z.array(z.number().int()).max(2000).default([]),
  sessions: z
    .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shift: z.string().trim().min(1).max(40), subjectCode: z.string().trim().min(1).max(20), subjectName: z.string().trim().min(1).max(200), keyPage: z.number().int().min(1), keyPages: z.number().int().min(1).default(1), dropped: z.number().int().min(0).default(0) }))
    .min(1)
    .max(5000),
});

/**
 * Stores the directory of one exam and year, read from the exam body's own answer-key file. Entries are facts
 * (subject, date, shift, key page) and are shown as soon as they are stored; the ADDRESS of the key file is a
 * separate link row, which stays a draft until staff record the linking basis.
 */
export async function importOfficialDirectory(db: D1Database, body: unknown, actor: string) {
  const d = directorySchema.parse(body);
  if (!isOfficialUrl(d.key.url)) throw invalid("The answer-key address must be on the exam body's own site");
  if (d.paper.evidenceUrl && !isOfficialUrl(d.paper.evidenceUrl)) throw invalid("The evidence address must be on the exam body's own site");
  if (d.sessions.some((s) => s.keyPage > d.key.pages)) throw invalid('A session cites a page beyond the end of the answer-key file');
  if (d.sessions.some((s) => !s.date.startsWith(String(d.year)))) throw invalid('A session date does not belong to this exam year');
  const seen = new Set<string>();
  for (const s of d.sessions) {
    const k = `${s.subjectCode}|${s.date}|${s.shift}`;
    if (seen.has(k)) throw invalid(`The same paper appears twice: ${k}`);
    seen.add(k);
  }
  const checkedOn = d.key.retrievedAt.slice(0, 10);
  const examName = d.exam === 'CUET_PG' ? 'CUET (PG)' : 'CUET (UG)';
  // The year's key file and the "question papers are not published" notice: link rows, created as drafts.
  await importOfficialLinks(
    db,
    {
      schema: 'cuet-official-links/1',
      links: [
        { exam: d.exam, year: d.year, kind: 'ANSWER_KEY', availability: 'AVAILABLE', url: d.key.url, title: d.key.title, note: `One file for every paper of the year, ${d.key.pages} pages. It lists the exam body's question id and the correct option id. It does not contain the questions.`, checkedOn },
        { exam: d.exam, year: d.year, kind: 'QUESTION_PAPER', availability: 'NOT_AVAILABLE', title: `${examName} ${d.year} question papers`, note: d.paper.note, ...(d.paper.evidenceUrl ? { evidenceUrl: d.paper.evidenceUrl } : {}), checkedOn },
      ],
    },
    actor,
  );
  const link = await db.prepare(`SELECT id FROM official_paper_links WHERE exam_code = ? AND year = ? AND kind = 'ANSWER_KEY' AND subject_code IS NULL AND session IS NULL`).bind(d.exam, d.year).first<{ id: string }>();
  const now = nowIso();
  const rows = d.sessions.map((s) => ({ id: newId('ops'), exam_code: d.exam, year: d.year, subject_code: s.subjectCode, subject_name: s.subjectName, exam_date: s.date, shift: s.shift, paper_status: d.paper.status, paper_url: null, paper_link_id: null, paper_pages: null, key_link_id: link?.id ?? null, key_page: s.keyPage, key_pages: s.keyPages, dropped: s.dropped, source_sha256: d.key.sha256, created_by: actor, created_at: now }));
  const statements = [
    db.prepare('DELETE FROM official_paper_sessions WHERE exam_code = ? AND year = ? AND paper_link_id IS NULL').bind(d.exam, d.year),
    ...insertRows(db, 'official_paper_sessions', rows),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'IMPORT_OFFICIAL_DIRECTORY', 'OFFICIAL_DIRECTORY', `${d.exam}:${d.year}`, JSON.stringify({ sessions: rows.length, sha256: d.key.sha256 }), now),
  ];
  await db.batch(statements);
  return { exam: d.exam, year: d.year, sessions: rows.length, subjects: new Set(d.sessions.map((s) => s.subjectCode)).size, unreadPages: d.unreadPages.length };
}

const LINK_SHOWN = `l.status = 'PUBLISHED' AND l.linking_basis IS NOT NULL AND l.url IS NOT NULL`;

/** The directory by year and subject, for one exam. Always complete: every paper named in the official key is listed. */
export async function officialDirectory(db: D1Database, exam: string) {
  const [subjects, keys, notes] = await Promise.all([
    db
      .prepare(
        `SELECT s.year, s.subject_code, s.subject_name, COUNT(*) AS sessions, SUM(s.dropped) AS dropped, MIN(s.exam_date) AS first_date, MAX(s.exam_date) AS last_date, SUM(s.paper_status = 'AVAILABLE') AS papers_published,
           (SELECT tp.id FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE e.code = s.exam_code AND tp.code = s.subject_code ORDER BY ec.year DESC LIMIT 1) AS paper_id
         FROM official_paper_sessions s WHERE s.exam_code = ? GROUP BY s.year, s.subject_code, s.subject_name ORDER BY s.year DESC, s.subject_name`,
      )
      .bind(exam)
      .all<{ year: number; subject_code: string; subject_name: string; sessions: number; dropped: number; first_date: string; last_date: string; papers_published: number; paper_id: string | null }>(),
    db
      .prepare(`SELECT l.year, l.title, l.publisher, l.checked_on, l.note, CASE WHEN ${LINK_SHOWN} THEN l.url END AS url FROM official_paper_links l WHERE l.exam_code = ? AND l.kind = 'ANSWER_KEY' AND l.subject_code IS NULL AND l.status != 'ARCHIVED'`)
      .bind(exam)
      .all<{ year: number; title: string; publisher: string; checked_on: string; note: string | null; url: string | null }>(),
    db.prepare(`SELECT year, note FROM official_paper_links WHERE exam_code = ? AND kind = 'QUESTION_PAPER' AND subject_code IS NULL AND session IS NULL AND status != 'ARCHIVED'`).bind(exam).all<{ year: number; note: string | null }>(),
  ]);
  const years = [...new Set(subjects.results.map((r) => r.year))];
  return {
    exam,
    years: years.map((y) => {
      const rows = subjects.results.filter((r) => r.year === y);
      const key = keys.results.find((k) => k.year === y);
      return {
        year: y,
        papers: rows.reduce((n, r) => n + r.sessions, 0),
        // A code starting with "~" is a placeholder made from the subject name, used when the source prints no code.
        subjects: rows.map((r) => ({ code: r.subject_code, showCode: !r.subject_code.startsWith('~'), name: r.subject_name, sessions: r.sessions, dropped: r.dropped, firstDate: r.first_date, lastDate: r.last_date, papersPublished: r.papers_published, paperId: r.paper_id })),
        questionPaper: { status: rows.some((r) => r.papers_published > 0) ? ('SOME_PUBLISHED' as const) : ('NOT_PUBLISHED' as const), published: rows.reduce((n, r) => n + r.papers_published, 0), note: notes.results.find((n) => n.year === y)?.note ?? null },
        answerKey: key ? { title: key.title, publisher: key.publisher, checkedOn: key.checked_on, note: key.note, url: key.url, linkPending: !key.url } : null,
      };
    }),
  };
}

export const directorySessionsQuery = z.object({ exam: z.enum(['CUET_UG', 'CUET_PG']), year: z.coerce.number().int().min(2022).max(2100), subject: z.string().trim().min(1).max(20) });

/** Every paper of one subject in one year: date, shift, question-paper status and where its official key is. */
export async function officialDirectorySessions(db: D1Database, f: z.infer<typeof directorySessionsQuery>) {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.subject_code, s.subject_name, s.exam_date, s.shift, s.paper_status, s.paper_pages, s.key_page, s.key_pages, s.dropped, CASE WHEN ${LINK_SHOWN} THEN l.url END AS key_url, l.title AS key_title,
         (SELECT p.url FROM official_paper_links p WHERE p.id = s.paper_link_id AND p.status = 'PUBLISHED' AND p.linking_basis IS NOT NULL) AS paper_url, s.paper_link_id, s.key_link_id, (SELECT p.title FROM official_paper_links p WHERE p.id = s.paper_link_id) AS paper_title
       FROM official_paper_sessions s LEFT JOIN official_paper_links l ON l.id = s.key_link_id WHERE s.exam_code = ? AND s.year = ? AND s.subject_code = ? ORDER BY s.exam_date, s.shift`,
    )
    .bind(f.exam, f.year, f.subject)
    .all<Record<string, string | number | null>>();
  return results.map((r) => ({
    id: r['id'], subjectCode: r['subject_code'], subjectName: r['subject_name'], date: r['exam_date'], shift: r['shift'],
    // published: the exam body hosts the paper. url: sent only when the linking basis for that file is on record.
    questionPaper: { published: r['paper_status'] === 'AVAILABLE', available: r['paper_status'] === 'AVAILABLE' && Boolean(r['paper_url']), url: r['paper_status'] === 'AVAILABLE' ? r['paper_url'] : null, linkId: r['paper_url'] ? r['paper_link_id'] : null, title: r['paper_title'], pages: r['paper_pages'] },
    // The key is one file for the whole year; the link opens it at this paper's page.
    answerKey: { published: r['key_page'] !== null && r['key_title'] !== null, page: r['key_page'], pages: r['key_pages'], title: r['key_title'], url: r['key_url'] ? `${r['key_url']}#page=${r['key_page']}` : null, linkId: r['key_url'] ? r['key_link_id'] : null },
    dropped: r['dropped'],
  }));
}

// ---------------------------------------------------------------- question papers the exam body hosts itself

const papersSchema = z.object({
  schema: z.literal('cuet-official-papers/1'),
  exam: z.enum(['CUET_UG', 'CUET_PG']),
  year: z.number().int().min(2022).max(2100),
  /** Why these files are listed under this exam and year, in plain words. Shown with the year. */
  attribution: z.string().trim().min(20).max(800),
  paperNote: z.string().trim().min(10).max(600),
  papers: z
    .array(z.object({
      subjectCode: z.string().trim().max(20).optional(), subjectName: z.string().trim().min(1).max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shift: z.string().trim().min(1).max(40),
      /** The paper's name exactly as its own first page prints it. */
      title: z.string().trim().min(3).max(200), url: z.string().max(1000), pages: z.number().int().positive(), sha256: z.string().regex(/^[0-9a-f]{64}$/), retrievedAt: z.iso.datetime(),
    }))
    .min(1)
    .max(2000),
});

const slug = (name: string) => `~${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18)}`;

/**
 * Lists question papers that sit on the exam body's own server. Only the address and the facts read from each
 * file's first page are stored; no file is kept. Each address is a draft link until staff record the linking basis.
 */
export async function importOfficialPapers(db: D1Database, body: unknown, actor: string) {
  const d = papersSchema.parse(body);
  for (const p of d.papers) if (!isOfficialUrl(p.url)) throw invalid(`The address of "${p.title}" is not on the exam body's own site`);
  const seen = new Set<string>();
  for (const p of d.papers) {
    const k = `${p.subjectCode ?? slug(p.subjectName)}|${p.date}|${p.shift}`;
    if (seen.has(k)) throw invalid(`The same paper appears twice: ${p.title}`);
    seen.add(k);
    if (!p.date.startsWith(String(d.year))) throw invalid(`"${p.title}" is not dated in ${d.year}`);
  }
  const examName = d.exam === 'CUET_PG' ? 'CUET (PG)' : 'CUET (UG)';
  const now = nowIso();
  await importOfficialLinks(
    db,
    {
      schema: 'cuet-official-links/1',
      links: d.papers.map((p) => ({ exam: d.exam, year: d.year, subjectCode: p.subjectCode ?? slug(p.subjectName), subjectName: p.subjectName, session: `${p.date} ${p.shift}`, kind: 'QUESTION_PAPER' as const, availability: 'AVAILABLE' as const, url: p.url, title: p.title, note: `${p.pages} pages. ${d.attribution}`.slice(0, 600), checkedOn: p.retrievedAt.slice(0, 10) })),
    },
    actor,
  );
  // The year's note about question papers: a notice row, replaced only while it is a draft.
  const noteKey = `${d.exam}:${d.year}:all:all:question_paper`.toLowerCase();
  const note = await db.prepare('SELECT id, status FROM official_paper_links WHERE external_key = ?').bind(noteKey).first<{ id: string; status: string }>();
  const noteRow = { exam_code: d.exam, year: d.year, subject_code: null, subject_name: null, session: null, kind: 'QUESTION_PAPER', availability: 'NOT_AVAILABLE', url: null, title: `${examName} ${d.year} question papers`, note: d.paperNote, evidence_url: null, checked_on: now.slice(0, 10), updated_at: now };
  if (!note) await db.batch(insertRows(db, 'official_paper_links', [{ id: newId('opl'), ...noteRow, publisher: 'National Testing Agency (NTA)', linking_basis: null, linking_checked_by: null, status: 'DRAFT', external_key: noteKey, created_by: actor, created_at: now, published_at: null }]));
  else if (note.status === 'DRAFT') await db.prepare('UPDATE official_paper_links SET note = ?, updated_at = ? WHERE id = ?').bind(d.paperNote, now, note.id).run();
  const { results: links } = await db.prepare(`SELECT id, subject_code, session FROM official_paper_links WHERE exam_code = ? AND year = ? AND kind = 'QUESTION_PAPER' AND availability = 'AVAILABLE'`).bind(d.exam, d.year).all<{ id: string; subject_code: string; session: string }>();
  const statements: D1PreparedStatement[] = [];
  for (const p of d.papers) {
    const code = p.subjectCode ?? slug(p.subjectName);
    const link = links.find((l) => l.subject_code === code && l.session === `${p.date} ${p.shift}`);
    // A paper may already be listed from the answer key: then the row gains its paper; otherwise the row is new.
    statements.push(
      db
        .prepare(
          `INSERT INTO official_paper_sessions (id, exam_code, year, subject_code, subject_name, exam_date, shift, paper_status, paper_url, paper_link_id, paper_pages, key_link_id, key_page, key_pages, dropped, source_sha256, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', NULL, ?, ?, NULL, NULL, 1, 0, ?, ?, ?)
           ON CONFLICT (exam_code, year, subject_code, exam_date, shift) DO UPDATE SET paper_status = 'AVAILABLE', paper_link_id = excluded.paper_link_id, paper_pages = excluded.paper_pages`,
        )
        .bind(newId('ops'), d.exam, d.year, code, p.subjectName, p.date, p.shift, link?.id ?? null, p.pages, p.sha256, actor, now),
    );
  }
  statements.push(db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), actor, 'IMPORT_OFFICIAL_PAPERS', 'OFFICIAL_DIRECTORY', `${d.exam}:${d.year}`, JSON.stringify({ papers: d.papers.length }), now));
  await db.batch(statements);
  return { exam: d.exam, year: d.year, papers: d.papers.length };
}

// ---------------------------------------------------------------- viewing an official document inside the platform

/**
 * How a published official document can be shown.
 *  DIRECT   the exam body's server lets other sites read the file (it sends Access-Control-Allow-Origin), so the
 *           student's browser loads it straight from that server into our viewer. Our server never handles the file.
 *  PROXY    the exam body's server does not allow that (nta.ac.in sends X-Frame-Options: SAMEORIGIN and no
 *           cross-origin header). The file can be shown here only by passing it through our server, which is
 *           reproduction: allowed only when staff have recorded the exam body's permission.
 *  NEW_TAB  neither applies: the document opens on the exam body's own site.
 * Headers were read on 13 November 2026; see docs/official-directory.md.
 */
const CROSS_ORIGIN_READABLE = [/^cdnbbsr\.s3waas\.gov\.in$/];
export function viewerMode(url: string, embedAllowed: boolean, inAppViewing: boolean): 'DIRECT' | 'PROXY' | 'NEW_TAB' {
  // The master switch: while it is off, nothing is shown inside the platform, whatever is recorded on a link.
  if (!inAppViewing) return 'NEW_TAB';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return 'NEW_TAB';
  }
  if (CROSS_ORIGIN_READABLE.some((h) => h.test(host))) return 'DIRECT';
  return embedAllowed ? 'PROXY' : 'NEW_TAB';
}

interface DocRow { id: string; exam_code: string; year: number; subject_name: string | null; session: string | null; kind: string; url: string; title: string; publisher: string; checked_on: string; embed_basis: string | null }
async function visibleDocument(db: D1Database, id: string) {
  const r = await db
    .prepare(`SELECT id, exam_code, year, subject_name, session, kind, url, title, publisher, checked_on, embed_basis FROM official_paper_links WHERE id = ? AND status = 'PUBLISHED' AND availability = 'AVAILABLE' AND linking_basis IS NOT NULL AND url IS NOT NULL`)
    .bind(id)
    .first<DocRow>();
  if (!r || !isOfficialUrl(r.url)) throw notFound('Official document');
  return r;
}

/** What the viewer page needs. Only for documents whose link is published with its linking basis. */
export async function officialDocument(db: D1Database, id: string, inAppViewing: boolean) {
  const r = await visibleDocument(db, id);
  const mode = viewerMode(r.url, Boolean(r.embed_basis), inAppViewing);
  return {
    id: r.id, exam: r.exam_code, year: r.year, subjectName: r.subject_name, session: r.session, kind: r.kind, title: r.title, publisher: r.publisher, checkedOn: r.checked_on,
    originalUrl: r.url, viewer: mode,
    // DIRECT: the browser reads the exam body's server. PROXY: our pass-through, signed-in students only.
    fileUrl: mode === 'DIRECT' ? r.url : mode === 'PROXY' ? `/api/student/official-documents/${r.id}/file` : null,
    reason: mode === 'NEW_TAB' ? "This document is published by NTA and opens on NTA's own website. It is not shown inside CUET Prep, because NTA has not given permission to display its documents here." : null,
  };
}

let upstreamFetch: typeof fetch = (...a) => fetch(...a);
/** Tests only: replaces the request to the exam body's server. */
export function setOfficialFetchForTests(f: typeof fetch | null) {
  upstreamFetch = f ?? ((...a) => fetch(...a));
}

/**
 * Passes one official document through to a signed-in student, for the in-app viewer. Nothing is stored or
 * cached on the platform. Refused unless the link is published AND the permission to show it here is on record.
 */
export async function officialDocumentFile(db: D1Database, id: string, range: string | undefined, inAppViewing: boolean): Promise<Response> {
  const r = await visibleDocument(db, id);
  if (viewerMode(r.url, Boolean(r.embed_basis), inAppViewing) !== 'PROXY') throw new ApiError(403, 'IN_APP_NOT_ALLOWED', 'This document is not cleared to be shown inside CUET Prep; open it on the exam body\'s site');
  const res = await upstreamFetch(r.url, { headers: { 'user-agent': 'cuet-prep-official-viewer/0.1', ...(range && /^bytes=\d*-\d*$/.test(range) ? { range } : {}) }, redirect: 'manual' });
  // A redirect is never followed: the document must come from the registered address itself.
  if (!res.ok && res.status !== 206) throw new ApiError(503, 'SOURCE_UNAVAILABLE', 'The exam body\'s site did not return the document. Try again, or open it on that site.');
  if (!(res.headers.get('content-type') ?? '').toLowerCase().startsWith('application/pdf')) throw new ApiError(503, 'SOURCE_UNAVAILABLE', 'The exam body\'s site returned something other than the document');
  const headers = new Headers({ 'content-type': 'application/pdf', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'accept-ranges': 'bytes', 'content-disposition': 'inline' });
  for (const h of ['content-length', 'content-range']) if (res.headers.get(h)) headers.set(h, res.headers.get(h)!);
  return new Response(res.body, { status: res.status, headers });
}
