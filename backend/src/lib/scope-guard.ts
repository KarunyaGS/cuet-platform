/**
 * Staff screens (administration console and reviewer area) follow the same active-exam rule as the student site (16 Nov 2026):
 * CUET PG is not offered anywhere. This is a visibility rule only: no PG record is changed or deleted, and the token-guarded
 * ingestion API (/api/admin) is not affected.
 *
 *  - a request that names a PG exam, or a paper of a PG exam, is answered "not found";
 *  - PG rows are removed from every JSON answer (any object that says exam / examCode is PG, or whose paper is PG, or that is the CUET PG website listed as a source).
 * Does nothing while ACTIVE_EXAMS is unset (tests and local use that want everything).
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { notFound } from './errors';
import { activeExams } from './scope';

const ALL = ['CUET_UG', 'CUET_PG'];
const PAPER_PATHS = /\/(?:papers|mock-papers\/readiness|mock-papers\/build|official-papers\/paper)\/([A-Za-z0-9_-]+)/;

export const staffScope: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.env.ACTIVE_EXAMS) return next();
  const active = activeExams(c.env);
  const off = new Set(ALL.filter((e) => !active.includes(e)));
  if (!off.size) return next();

  const exam = c.req.query('exam');
  if (exam && off.has(exam)) throw notFound('Exam');
  const paperId = c.req.query('paperId') || c.req.query('testPaperId') || PAPER_PATHS.exec(c.req.path)?.[1];
  if (paperId) {
    const row = await c.env.DB.prepare('SELECT e.code AS code FROM test_papers p JOIN exam_cycles ec ON ec.id = p.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE p.id = ?').bind(paperId).first<{ code: string }>();
    if (row && off.has(row.code)) throw notFound('Paper');
  }

  await next();

  const res = c.res;
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) return;
  let body: unknown;
  try { body = JSON.parse(await res.clone().text()); } catch { return; }
  const isOff = (x: unknown): boolean => {
    if (!x || typeof x !== 'object') return false;
    const o = x as Record<string, unknown>;
    const p = o.paper as Record<string, unknown> | null | undefined;
    if (off.has('CUET_PG') && ((typeof o.url === 'string' && /\/cuet-pg\b/i.test(o.url)) || (typeof o.key === 'string' && /^cuet-pg/i.test(o.key)))) return true; // the CUET PG website as a notice or admissions source
    return [o.exam, o.examCode, o.exam_code, p && typeof p === 'object' ? p.exam : undefined].some((v) => typeof v === 'string' && off.has(v));
  };
  // Descriptions of a source that also cover PG: the PG clause and PG-only sentences are left out of what staff see (the stored text is unchanged).
  const scrub = (t: string) => t.replace(/,? and PG programmes \(CUET-PG\)/g, '').split(/(?<=\.)\s+/).filter((x) => !/\bPG\b|CUET[- ]PG/i.test(x)).join(' ');
  const strip = (v: unknown, key = ''): unknown =>
    Array.isArray(v) ? v.filter((x) => !isOff(x)).map((x) => strip(x))
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, strip(x, k)]))
    : typeof v === 'string' && off.has('CUET_PG') && (key === 'covers' || key === 'reliabilityNote') ? scrub(v) : v;
  const headers = new Headers(res.headers);
  headers.delete('content-length');
  c.res = new Response(JSON.stringify(strip(body)), { status: res.status, headers });
};
