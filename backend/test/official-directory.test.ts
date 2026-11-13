import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token' };
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie')?.split(';')[0] ?? '' };
}
async function staff() {
  const email = `dir-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const r = await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Dir' });
  await call('POST', '/api/admin/users/roles', { email, role: 'SUPER_ADMIN' }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { id: r.json.id as string, auth: { cookie: s.cookie } };
}
const KEY_URL = 'https://cdnbbsr.s3waas.gov.in/s3test/uploads/2033/06/final-key.pdf';
const directory = (over: Record<string, unknown> = {}) => ({
  schema: 'cuet-official-directory/1', exam: 'CUET_UG', year: 2033,
  key: { title: 'CUET (UG) 2033 : Final Answer Keys', url: KEY_URL, version: 'FINAL', sha256: 'c'.repeat(64), pages: 40, retrievedAt: '2026-11-13T06:00:00.000Z' },
  paper: { status: 'NOT_PUBLISHED', note: 'NTA does not publish the question papers openly. Each candidate can view only their own paper after logging in.' },
  sessions: [
    { date: '2033-05-12', shift: 'Shift 2', subjectCode: '322', subjectName: 'Physics', keyPage: 26, keyPages: 1, dropped: 1 },
    { date: '2033-05-14', shift: 'Shift 1', subjectCode: '322', subjectName: 'Physics', keyPage: 31, keyPages: 1, dropped: 0 },
    { date: '2033-05-11', shift: 'Shift 1', subjectCode: '101', subjectName: 'English', keyPage: 1, keyPages: 2, dropped: 0 },
  ],
  ...over,
});
const year = async () => ((await call('GET', '/api/learn/official-directory?exam=CUET_UG')).json.years as { year: number }[]).find((y) => y.year === 2033) as Record<string, any> | undefined;
const sessions = async (subject: string) => (await call('GET', `/api/learn/official-directory/sessions?exam=CUET_UG&year=2033&subject=${subject}`)).json as Record<string, any>[];

describe('official paper directory', () => {
  it('refuses a directory whose key is not on the exam body\'s site, or that names a paper twice or a page that does not exist', async () => {
    expect((await call('POST', '/api/admin/official-directory', directory({ key: { ...directory().key, url: 'https://papers.example.com/key.pdf' } }), ADMIN)).status).toBe(422);
    const twice = directory();
    twice.sessions.push({ ...twice.sessions[0]! });
    expect((await call('POST', '/api/admin/official-directory', twice, ADMIN)).status).toBe(422);
    const beyond = directory();
    beyond.sessions[0]!.keyPage = 99;
    expect((await call('POST', '/api/admin/official-directory', beyond, ADMIN)).status).toBe(422);
    expect(await year()).toBeUndefined();
  });

  it('lists every paper by year, subject, date and shift, with its status; links appear only after the linking basis is recorded', async () => {
    const admin = await staff();
    const imp = await call('POST', '/api/admin/official-directory', directory(), ADMIN);
    expect(imp.json).toEqual({ exam: 'CUET_UG', year: 2033, sessions: 3, subjects: 2, unreadPages: 0 });

    // The directory is complete and useful at once, without any link.
    const y = (await year())!;
    expect(y).toMatchObject({ year: 2033, papers: 3, questionPaper: { status: 'NOT_PUBLISHED', note: expect.stringMatching(/does not publish the question papers openly/) } });
    expect(y.subjects.map((s: { code: string; name: string; sessions: number; dropped: number }) => [s.code, s.name, s.sessions, s.dropped])).toEqual([['101', 'English', 1, 0], ['322', 'Physics', 2, 1]]);
    expect(y.answerKey).toMatchObject({ title: 'CUET (UG) 2033 : Final Answer Keys', publisher: 'National Testing Agency (NTA)', checkedOn: '2026-11-13', url: null, linkPending: true });
    const physics = await sessions('322');
    expect(physics.map((r) => [r.date, r.shift, r.questionPaper.available, r.answerKey.published, r.answerKey.page, r.answerKey.url, r.dropped])).toEqual([
      ['2033-05-12', 'Shift 2', false, true, 26, null, 1],
      ['2033-05-14', 'Shift 1', false, true, 31, null, 0],
    ]);
    // No address leaves the server before the basis is on record.
    expect(JSON.stringify([y, physics])).not.toContain('s3waas');

    // Importing again changes nothing and does not duplicate.
    await call('POST', '/api/admin/official-directory', directory(), ADMIN);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM official_paper_sessions WHERE year = 2033').first<{ n: number }>())!.n).toBe(3);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM official_paper_links WHERE year = 2033').first<{ n: number }>())!.n).toBe(2);

    // Staff record the linking basis once for the year's key file: every row then opens the key at its own page.
    const links = (await call('GET', '/api/console/official-papers', undefined, admin.auth)).json as { id: string; year: number; kind: string }[];
    const key = links.find((l) => l.year === 2033 && l.kind === 'ANSWER_KEY')!;
    expect((await call('POST', `/api/console/official-papers/${key.id}/status`, { action: 'PUBLISH' }, admin.auth)).json.error.code).toBe('LINKING_BASIS_REQUIRED');
    expect((await call('POST', `/api/console/official-papers/${key.id}/status`, { action: 'PUBLISH', linkingBasis: 'Owner decision recorded on 13 Nov 2033', conditionsChecked: true }, admin.auth)).json.status).toBe('PUBLISHED');
    expect((await year())!.answerKey).toMatchObject({ url: KEY_URL, linkPending: false });
    expect((await sessions('322')).map((r) => r.answerKey.url)).toEqual([`${KEY_URL}#page=26`, `${KEY_URL}#page=31`]);
    expect((await sessions('101'))[0]!.answerKey).toMatchObject({ page: 1, pages: 2, url: `${KEY_URL}#page=1` });
    // A question paper is never shown as available: none is published.
    expect((await sessions('322')).every((r) => r.questionPaper.available === false && r.questionPaper.url === null)).toBe(true);
  });

  it('lists question papers the exam body hosts itself, and shows "View paper" only after the linking basis is recorded', async () => {
    const admin = await staff();
    const paper = (name: string, date: string, shift: string, file: string) => ({ subjectName: name, date, shift, title: `${name} ${date} ${shift}`, url: `https://nta.ac.in/Download/ExamPaper/${file}.pdf`, pages: 87, sha256: 'd'.repeat(64), retrievedAt: '2026-11-13T06:20:00.000Z' });
    const pack = { schema: 'cuet-official-papers/1', exam: 'CUET_PG', year: 2034, attribution: 'Each file is on the server of the exam body and names its subject, date and shift.', paperNote: 'The server holds the question papers of some subjects. Papers for the other subjects were not found.', papers: [paper('Physics', '2034-03-14', 'Shift 2', 'Paper_a'), paper('Botany', '2034-03-15', 'Shift 1', 'Paper_b')] };
    expect((await call('POST', '/api/admin/official-question-papers', { ...pack, papers: [{ ...pack.papers[0], url: 'https://papers.example.com/physics.pdf' }] }, ADMIN)).status).toBe(422);
    expect((await call('POST', '/api/admin/official-question-papers', pack, ADMIN)).json).toEqual({ exam: 'CUET_PG', year: 2034, papers: 2 });
    await call('POST', '/api/admin/official-question-papers', pack, ADMIN); // again: nothing is duplicated
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM official_paper_sessions WHERE year = 2034').first<{ n: number }>())!.n).toBe(2);

    const y = ((await call('GET', '/api/learn/official-directory?exam=CUET_PG')).json.years as Record<string, any>[]).find((x) => x.year === 2034)!;
    expect(y).toMatchObject({ papers: 2, answerKey: null, questionPaper: { status: 'SOME_PUBLISHED', published: 2, note: expect.stringMatching(/some subjects/) } });
    const physics = y.subjects.find((s: { name: string }) => s.name === 'Physics');
    expect(physics).toMatchObject({ showCode: false, papersPublished: 1, sessions: 1 });
    const rows = async () => (await call('GET', `/api/learn/official-directory/sessions?exam=CUET_PG&year=2034&subject=${encodeURIComponent(physics.code)}`)).json as Record<string, any>[];
    // The paper is listed as published by the exam body, but its address is withheld until the basis is on record.
    expect((await rows())[0]).toMatchObject({ date: '2034-03-14', shift: 'Shift 2', questionPaper: { published: true, available: false, url: null, pages: 87 }, answerKey: { published: false, url: null } });
    const link = ((await call('GET', '/api/console/official-papers', undefined, admin.auth)).json as { id: string; year: number; subjectName: string | null; available: boolean }[]).find((l) => l.year === 2034 && l.subjectName === 'Physics' && l.available)!;
    await call('POST', `/api/console/official-papers/${link.id}/status`, { action: 'PUBLISH', linkingBasis: 'Owner decision recorded for this file', conditionsChecked: true }, admin.auth);
    expect((await rows())[0]!.questionPaper).toMatchObject({ published: true, available: true, url: 'https://nta.ac.in/Download/ExamPaper/Paper_a.pdf' });
  });
});
