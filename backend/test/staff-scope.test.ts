import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import type { Bindings } from '../src/types';

// Administration console and reviewer area: CUET PG is not offered (visibility only; nothing is deleted).
const TOKEN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
const JSON_H = { 'content-type': 'application/json' };
const scoped = { ...env, ACTIVE_EXAMS: 'CUET_UG', CATALOGUE_SCOPE: 'ug-science' } as unknown as Bindings;
const everything = env as unknown as Bindings;

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_H, e: Bindings = everything) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}
async function admin(email: string) {
  await call('POST', '/api/auth/register', { email, password: 'correct horse battery', displayName: 'Boss' });
  await call('POST', '/api/admin/users/roles', { email, role: 'SUPER_ADMIN' }, TOKEN);
  const res = await call('POST', '/api/auth/login', { email, password: 'correct horse battery' });
  return { ...JSON_H, cookie: res.cookie!.split(';')[0]! };
}

describe('staff screens do not offer CUET PG', () => {
  it('hides PG papers, notices and requests for PG in the console and the reviewer area, and deletes nothing', async () => {
    const boss = await admin('scope-boss@example.test');
    // a PG paper and a PG notice exist in the database
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_PG', year: 2026, papers: [{ code: 'SCQP99', name: 'PG scope test', categoryCode: 'SCQP', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/pg-scope.pdf', listedOnUrl: 'https://exams.nta.nic.in/' }] }, TOKEN);
    const pgPaper = await env.DB.prepare("SELECT p.id AS id FROM test_papers p WHERE p.code = 'SCQP99'").first<{ id: string }>();
    expect(pgPaper).toBeTruthy();
    await env.DB.prepare(`INSERT INTO gov_notices (id, source_key, source_name, source_url, document_url, is_pdf, title, category, exam_code, published_on, verification_status, first_detected_at, last_checked_at, updated_at, authority, content_hash)
      VALUES ('gn_pg_scope', 'k', 'n', 'https://x.test/', 'https://x.test/pg.pdf', 1, 'PG scope test notice', 'GENERAL', 'CUET_PG', '2026-11-01', 'NEEDS_REVIEW', '2026-11-01', '2026-11-01', '2026-11-01', 'NTA', 'pgscope')`).run();
    const before = (await env.DB.prepare('SELECT (SELECT COUNT(*) FROM test_papers) p, (SELECT COUNT(*) FROM gov_notices) n').first())!;

    // everything visible when the scope is not set
    const all = await call('GET', '/api/console/notices?limit=100', undefined, boss, everything);
    expect(JSON.stringify(all.json)).toContain('PG scope test notice');
    expect(JSON.stringify((await call('GET', '/api/console/overview', undefined, boss, everything)).json.syllabus)).toContain('CUET_PG');

    // scoped: no PG in notices, the review queue of notices, the overview, or the paper lists
    const n = await call('GET', '/api/console/notices?limit=100', undefined, boss, scoped);
    expect(n.status).toBe(200);
    expect(JSON.stringify(n.json)).not.toContain('PG scope test notice');
    expect(JSON.stringify((await call('GET', '/api/console/notices/queue', undefined, boss, scoped)).json)).not.toContain('PG scope test notice');
    const ov = await call('GET', '/api/console/overview', undefined, boss, scoped);
    expect(JSON.stringify(ov.json.syllabus)).not.toContain('CUET_PG');
    expect(JSON.stringify((await call('GET', '/api/console/content/papers', undefined, boss, scoped)).json)).not.toContain('CUET_PG');
    const reg = await call('GET', '/api/console/registry', undefined, boss, scoped);
    expect(JSON.stringify(reg.json)).not.toMatch(/cuet-pg/i);
    expect(JSON.stringify((await call('GET', '/api/console/registry', undefined, boss, everything)).json)).toMatch(/cuet-pg/i);
    // a university source that also covers PG keeps its UG description only
    await env.DB.prepare("INSERT INTO admission_sources (id, university_slug, university_name, url, title, kind, covers, format, update_frequency, reliability_note, personal_data_risk, recommendation, status, created_by, created_at, updated_at) VALUES ('asrc_pg_scope', 'pg-scope-uni', 'PG Scope University', 'https://pg-scope.example.test', 'PG scope', 'UNIVERSITY_ADMISSION', 'Admissions: e-prospectuses for UG programmes (CUET-UG) and PG programmes (CUET-PG), schedules. Only UG is held; PG is kept separate.', 'PDF', NULL, 'Official.', 'LISTS_LINKED', 'USE_WITH_CARE', 'APPROVED', 'test', '2026-11-01', '2026-11-01')").run();
    const src = JSON.stringify((await call('GET', '/api/console/admissions/sources', undefined, boss, scoped)).json);
    expect(src).toContain('PG Scope University');
    expect(src).not.toMatch(/CUET-PG|PG is kept/);
    // requests that name PG are not found (console and reviewer area)
    expect((await call('GET', '/api/console/coverage?exam=CUET_PG', undefined, boss, scoped)).status).toBe(404);
    expect((await call('GET', '/api/review/queue?exam=CUET_PG&year=2026', undefined, boss, scoped)).status).toBe(404);
    expect((await call('GET', `/api/review/papers/${pgPaper!.id}`, undefined, boss, scoped)).status).toBe(404);
    expect((await call('GET', '/api/console/coverage?exam=CUET_UG', undefined, boss, scoped)).status).toBe(200);
    // the token-guarded ingestion API is not affected
    expect((await call('POST', '/api/admin/registry/papers', { exam: 'CUET_PG', year: 2026, papers: [{ code: 'SCQP99', name: 'PG scope test', categoryCode: 'SCQP', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/pg-scope.pdf', listedOnUrl: 'https://exams.nta.nic.in/' }] }, TOKEN, scoped)).status).toBeLessThan(300);

    const after = (await env.DB.prepare('SELECT (SELECT COUNT(*) FROM test_papers) p, (SELECT COUNT(*) FROM gov_notices) n').first())!;
    expect(after).toEqual(before);
  });
});
