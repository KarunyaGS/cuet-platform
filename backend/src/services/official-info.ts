/**
 * Official exam information (from NTA documents and notices) and the participating-university lists.
 * Stored per exam and cycle; an import replaces that exam's information for the cycle in one batch,
 * so the public pages never show a mix of old and new facts. Nothing here is generated: every fact
 * keeps the document link (and page) it was taken from.
 */
import { z } from 'zod';
import { notFound } from '../lib/errors';
import { newId } from '../lib/hash';
import { insertRows, nowIso } from '../lib/sql';

const EXAMS = ['CUET_UG', 'CUET_PG'] as const;
export const examSchema = z.enum(EXAMS);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const url = z.url().max(2000);

/** The format of content/official-info/<EXAM>.json plus the rows of universities-<EXAM>.csv. */
export const officialInfoSchema = z.object({
  exam: examSchema,
  cycle: z.string().regex(/^\d{4}$/),
  asOf: day,
  sections: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z0-9-]{2,40}$/),
        title: z.string().trim().min(2).max(200),
        items: z.array(z.object({ text: z.string().trim().min(3).max(4000), source: url.nullable().optional(), page: z.number().int().min(1).max(2000).nullable().optional(), note: z.string().trim().max(2000).nullable().optional() })).max(200),
      }),
    )
    .min(1)
    .max(40),
  notices: z.array(z.object({ date: day.nullable().optional(), title: z.string().trim().min(3).max(1000), url })).max(500).default([]),
  unknown: z.array(z.string().trim().min(3).max(2000)).max(100).default([]),
  universities: z.array(z.object({ name: z.string().trim().min(2).max(300), type: z.string().trim().min(2).max(120), state: z.string().trim().max(120).nullable().optional(), sourceUrl: url })).max(2000).default([]),
});

/** Section shown last: what NTA has not published yet (kept so students are not misled by older facts). */
const GAPS = { key: 'not-yet-published', title: 'Not yet published or not confirmed' };

export async function importOfficialInfo(db: D1Database, input: z.infer<typeof officialInfoSchema>) {
  const now = nowIso();
  const items = input.sections.flatMap((s, si) =>
    s.items.map((it, ii) => ({
      id: newId('ofi'), exam_code: input.exam, cycle: input.cycle, section_key: s.key, section_title: s.title, section_position: si, position: ii,
      text: it.text, source_url: it.source ?? null, source_page: it.page ?? null, note: it.note ?? null, as_of: input.asOf, created_at: now,
    })),
  );
  input.unknown.forEach((text, ii) =>
    items.push({ id: newId('ofi'), exam_code: input.exam, cycle: input.cycle, section_key: GAPS.key, section_title: GAPS.title, section_position: 99, position: ii, text, source_url: null, source_page: null, note: null, as_of: input.asOf, created_at: now }),
  );
  const seen = new Set<string>();
  const notices = input.notices
    .filter((n) => (seen.has(n.url) ? false : (seen.add(n.url), true)))
    .map((n) => ({ id: newId('ntc'), exam_code: input.exam, notice_date: n.date ?? null, title: n.title, url: n.url, created_at: now }));
  const names = new Set<string>();
  const unis = input.universities
    .filter((u) => (names.has(u.name) ? false : (names.add(u.name), true)))
    .map((u) => ({ id: newId('uni'), exam_code: input.exam, cycle: input.cycle, name: u.name, type: u.type, state: u.state || null, source_url: u.sourceUrl, created_at: now }));
  await db.batch([
    db.prepare('DELETE FROM official_info_items WHERE exam_code = ? AND cycle = ?').bind(input.exam, input.cycle),
    db.prepare('DELETE FROM official_notices WHERE exam_code = ?').bind(input.exam),
    ...(input.universities.length ? [db.prepare('DELETE FROM participating_universities WHERE exam_code = ? AND cycle = ?').bind(input.exam, input.cycle)] : []),
    ...insertRows(db, 'official_info_items', items),
    ...insertRows(db, 'official_notices', notices),
    ...insertRows(db, 'participating_universities', unis),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
      newId('aud'), 'admin:import', 'IMPORT_OFFICIAL_INFO', 'EXAM', input.exam,
      JSON.stringify({ cycle: input.cycle, asOf: input.asOf, items: items.length, notices: notices.length, universities: unis.length }), now,
    ),
  ]);
  return { exam: input.exam, cycle: input.cycle, items: items.length, notices: notices.length, universities: unis.length };
}

/** Everything the public pages need for one exam: the latest cycle's facts by section, notices and university counts. */
export async function getOfficialInfo(db: D1Database, exam: z.infer<typeof examSchema>) {
  const latest = await db.prepare('SELECT cycle, MAX(as_of) AS as_of FROM official_info_items WHERE exam_code = ? GROUP BY cycle ORDER BY cycle DESC LIMIT 1').bind(exam).first<{ cycle: string; as_of: string }>();
  if (!latest) throw notFound('Official information for this exam');
  const [items, notices, unis] = await Promise.all([
    db
      .prepare('SELECT section_key, section_title, section_position, position, text, source_url, source_page, note FROM official_info_items WHERE exam_code = ? AND cycle = ? ORDER BY section_position, position')
      .bind(exam, latest.cycle)
      .all<{ section_key: string; section_title: string; section_position: number; position: number; text: string; source_url: string | null; source_page: number | null; note: string | null }>(),
    db.prepare('SELECT notice_date, title, url FROM official_notices WHERE exam_code = ? ORDER BY notice_date DESC, title').bind(exam).all<{ notice_date: string | null; title: string; url: string }>(),
    db.prepare('SELECT type, COUNT(*) AS n FROM participating_universities WHERE exam_code = ? AND cycle = ? GROUP BY type ORDER BY n DESC').bind(exam, latest.cycle).all<{ type: string; n: number }>(),
  ]);
  const sections: { key: string; title: string; items: { text: string; source: string | null; page: number | null; note: string | null }[] }[] = [];
  for (const r of items.results) {
    let s = sections.find((x) => x.key === r.section_key);
    if (!s) sections.push((s = { key: r.section_key, title: r.section_title, items: [] }));
    s.items.push({ text: r.text, source: r.source_url, page: r.source_page, note: r.note });
  }
  return {
    exam,
    cycle: latest.cycle,
    asOf: latest.as_of,
    sections,
    notices: notices.results.map((n) => ({ date: n.notice_date, title: n.title, url: n.url })),
    universities: { total: unis.results.reduce((t, u) => t + u.n, 0), byType: unis.results.map((u) => ({ type: u.type, count: u.n })) },
  };
}

export const universityQuery = z.object({ exam: examSchema, q: z.string().trim().max(100).optional(), type: z.string().trim().max(120).optional() });

/** Participating universities for the latest cycle, with search by name and filter by NTA's type. */
export async function listUniversities(db: D1Database, query: z.infer<typeof universityQuery>) {
  const latest = await db.prepare('SELECT MAX(cycle) AS cycle FROM participating_universities WHERE exam_code = ?').bind(query.exam).first<{ cycle: string | null }>();
  if (!latest?.cycle) return { exam: query.exam, cycle: null, total: 0, types: [], universities: [] };
  const where = ['exam_code = ?', 'cycle = ?'];
  const params: string[] = [query.exam, latest.cycle];
  if (query.q) {
    where.push("name LIKE '%' || ? || '%' COLLATE NOCASE");
    params.push(query.q);
  }
  if (query.type) {
    where.push('type = ?');
    params.push(query.type);
  }
  const [rows, types] = await Promise.all([
    db
      .prepare(`SELECT name, type, state, source_url FROM participating_universities WHERE ${where.join(' AND ')} ORDER BY name LIMIT 1000`)
      .bind(...params)
      .all<{ name: string; type: string; state: string | null; source_url: string }>(),
    db.prepare('SELECT type, COUNT(*) AS n FROM participating_universities WHERE exam_code = ? AND cycle = ? GROUP BY type ORDER BY n DESC').bind(query.exam, latest.cycle).all<{ type: string; n: number }>(),
  ]);
  return {
    exam: query.exam,
    cycle: latest.cycle,
    total: types.results.reduce((t, x) => t + x.n, 0),
    types: types.results.map((t) => ({ type: t.type, count: t.n })),
    universities: rows.results.map((r) => ({ name: r.name, type: r.type, state: r.state, sourceUrl: r.source_url })),
  };
}
