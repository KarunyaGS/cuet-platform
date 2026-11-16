import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { factProblems, reliabilityOf, type FactInput } from '../src/services/admissions';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function login(role?: string) {
  const email = `dir-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Dir' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const ctx = createExecutionContext();
  const res = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct-horse-battery' }) }, env, ctx);
  await waitOnExecutionContext(ctx);
  return { 'content-type': 'application/json', cookie: res.headers.get('set-cookie')!.split(';')[0]! };
}
const TODAY = new Date().toISOString().slice(0, 10);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const YEAR = new Date().getUTCFullYear();
const AY = `${YEAR}-${String(YEAR + 1).slice(2)}`;

describe('how far a record can be trusted', () => {
  const now = new Date();
  const base = { status: 'PUBLISHED', checkedOn: TODAY, cycleYear: YEAR, kind: 'ELIGIBILITY', sourceStatus: 'APPROVED' };
  it('says unverified, source-not-approved, outdated or verified, by fixed rules', () => {
    expect(reliabilityOf(base, now)).toBe('VERIFIED_OFFICIAL');
    expect(reliabilityOf({ ...base, status: 'DRAFT' }, now)).toBe('UNVERIFIED');
    expect(reliabilityOf({ ...base, sourceStatus: 'RETIRED' }, now)).toBe('SOURCE_NOT_APPROVED');
    expect(reliabilityOf({ ...base, checkedOn: daysFromNow(-181) }, now)).toBe('OUTDATED');
    expect(reliabilityOf({ ...base, checkedOn: daysFromNow(-179) }, now)).toBe('VERIFIED_OFFICIAL');
    expect(reliabilityOf({ ...base, cycleYear: YEAR - 1 }, now)).toBe('OUTDATED'); // about an earlier admission year
    // A cut-off is always about an earlier year, so only the day it was checked matters.
    expect(reliabilityOf({ ...base, kind: 'CUTOFF', cycleYear: YEAR - 2 }, now)).toBe('VERIFIED_OFFICIAL');
    expect(reliabilityOf({ ...base, kind: 'CUTOFF', cycleYear: YEAR - 2, checkedOn: daysFromNow(-200) }, now)).toBe('OUTDATED');
  });
  it('holds the new fact kinds to their own rules', () => {
    const b: FactInput = { universityName: 'University of Delhi', sourceId: 's', kind: 'SUBJECTS', exam: 'CUET_UG', year: YEAR, programme: null, label: 'Required CUET subjects', valueText: 'English and any two of the following', valueNumber: null, basis: null, category: null, round: null, eventDate: null, sourcePage: 3, sourceLocator: null, checkedOn: TODAY, programmeId: 'p1', subjects: ['English', 'Physics'] };
    expect(factProblems(b)).toEqual([]);
    expect(factProblems({ ...b, subjects: null }).join('|')).toMatch(/subjects as a list/);
    expect(factProblems({ ...b, programmeId: null }).join('|')).toMatch(/belong to a programme/);
    expect(factProblems({ ...b, valueText: null }).join('|')).toMatch(/exactly as printed/);
    expect(factProblems({ ...b, kind: 'ELIGIBILITY' }).join('|')).toMatch(/Only a required-subjects fact has a subjects list/);
    expect(factProblems({ ...b, kind: 'PROCEDURE', subjects: null, valueText: null }).join('|')).toMatch(/admission procedure/);
    expect(factProblems({ ...b, kind: 'COUNSELLING', subjects: null, valueText: null }).join('|')).toMatch(/counselling procedure/);
    expect(factProblems({ ...b, kind: 'EVENT', subjects: null, eventDate: TODAY, category: 'WHENEVER' }).join('|')).toMatch(/type of a dated step/);
    expect(factProblems({ ...b, kind: 'EVENT', subjects: null, eventDate: TODAY, category: 'APPLICATION_DEADLINE' })).toEqual([]);
    expect(factProblems({ ...b, subjects: ['Physics', 'Roll no 123456'] }).join('|')).toMatch(/Candidate details are never stored/);
  });
});

describe('the programme directory, end to end', () => {
  let staff: Record<string, string>;
  let student: Record<string, string>;
  let du = '';
  let state = '';
  let progA = '';
  let progB = '';
  let progState = '';
  const sid = async (url: string) => (await call('GET', '/api/console/admissions/sources', undefined, staff)).json.find((s: { url: string }) => s.url === url).id as string;
  const prog = (sourceId: string, over: Record<string, unknown> = {}) => ({ universityName: 'University of Delhi', programmeName: 'B.A. (Hons) Economics', degree: 'B.A. (Hons)', level: 'UG', academicYear: AY, exam: 'CUET_UG', sourceId, sourcePage: 12, lastVerifiedOn: TODAY, ...over });
  const fact = (over: Record<string, unknown>) => ({ universityName: 'University of Delhi', sourceId: du, exam: 'CUET_UG', year: YEAR, checkedOn: TODAY, sourcePage: 12, ...over });
  const publishFact = async (body: Record<string, unknown>) => {
    const made = await call('POST', '/api/console/admissions/facts', fact(body), staff);
    expect(made.status, JSON.stringify(made.json).slice(0, 250)).toBe(201);
    expect((await call('POST', `/api/console/admissions/facts/${made.json.id}/decision`, { action: 'PUBLISH' }, staff)).status).toBe(200);
    return made.json.id as string;
  };

  beforeAll(async () => {
    [staff, student] = [await login('SUPER_ADMIN'), await login()];
    await env.DB.prepare("INSERT INTO participating_universities (id, exam_code, cycle, name, type, state, source_url) VALUES ('pu_dir_du', 'CUET_UG', '2026', 'University of Delhi', 'Central Universities', NULL, 'https://cuet.nta.nic.in/x'), ('pu_dir_st', 'CUET_UG', '2026', 'Test State University', 'State Universities', NULL, 'https://cuet.nta.nic.in/x')").run();
    await call('POST', '/api/console/admissions/sources/load-reviewed', {}, staff);
    du = await sid('https://admission.uod.ac.in');
    await call('POST', `/api/console/admissions/sources/${du}/decision`, { action: 'APPROVE', checkedOn: TODAY }, staff);
    const st = await call('POST', '/api/console/admissions/sources', { url: 'https://admission.tsu.example.ac.in', title: 'Test State University: admissions', universityName: 'Test State University', kind: 'UNIVERSITY_ADMISSION', covers: 'Programmes and eligibility for the 2026-27 session.', format: 'HTML' }, staff);
    state = st.json.id;
    await call('POST', `/api/console/admissions/sources/${state}/decision`, { action: 'APPROVE', checkedOn: TODAY }, staff);
  });

  it('is for staff only', async () => {
    for (const p of ['/api/console/admissions/programmes', '/api/console/admissions/outdated']) {
      expect((await call('GET', p)).status).toBe(401);
      expect((await call('GET', p, undefined, student)).status).toBe(403);
    }
    expect((await call('POST', '/api/console/admissions/programmes', prog(du), student)).status).toBe(403);
  });

  it('refuses a programme without a place in the source, with a bad year, from a source not approved, or from another university\'s source', async () => {
    const refuse = async (over: Record<string, unknown>, why: RegExp, source = du) => {
      const r = await call('POST', '/api/console/admissions/programmes', prog(source, over), staff);
      expect(r.status, JSON.stringify(r.json).slice(0, 200)).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(r.json)).toMatch(why);
    };
    await refuse({ sourcePage: null }, /Cite where in the source/);
    await refuse({ academicYear: '2026-28' }, /consecutive years/);
    await refuse({ academicYear: '2026' }, /Write the year as 2026-27/);
    await refuse({ lastVerifiedOn: '2099-01-01' }, /future/);
    await refuse({ universityName: 'Banaras Hindu University' }, /different university/);
    await refuse({ programmeName: 'Roll number 20260012345' }, /Candidate details are never stored/);
    await refuse({}, /SOURCE_NOT_APPROVED|approved/, await sid('https://allduniv.ac.in/admission'));
  });

  it('saves a programme as a draft, takes the university\'s type from NTA\'s list, and refuses a second copy', async () => {
    const a = await call('POST', '/api/console/admissions/programmes', prog(du), staff);
    expect(a.status).toBe(201);
    progA = a.json.id;
    progB = (await call('POST', '/api/console/admissions/programmes', prog(du, { programmeName: 'B.Sc. (Hons) Physics', degree: 'B.Sc. (Hons)' }), staff)).json.id;
    progState = (await call('POST', '/api/console/admissions/programmes', prog(state, { universityName: 'Test State University', programmeName: 'B.A. Political Science' }), staff)).json.id;
    const list = (await call('GET', '/api/console/admissions/programmes', undefined, staff)).json;
    expect(list.find((p: { id: string }) => p.id === progA)).toMatchObject({ status: 'DRAFT', universityType: 'Central Universities', universitySlug: 'university-of-delhi', reliability: 'UNVERIFIED' });
    expect(list.find((p: { id: string }) => p.id === progState)).toMatchObject({ universityType: 'State Universities' });
    expect((await call('POST', '/api/console/admissions/programmes', prog(du), staff)).status).toBe(409);
    // Nothing of it reaches students yet.
    expect((await call('GET', '/api/public/admissions/programmes')).json.total).toBe(0);
    expect((await call('GET', `/api/public/admissions/programmes/${progA}`)).status).toBe(404);
  });

  it('imports a list of programmes all or nothing', async () => {
    const good = prog(du, { programmeName: 'B.Com (Hons)', degree: 'B.Com (Hons)' });
    const dupInList = [good, good];
    const refused = await call('POST', '/api/console/admissions/programmes/import', { programmes: dupInList }, staff);
    expect(refused.status).toBe(422);
    expect(refused.json.error.details).toEqual([{ row: 2, problems: [expect.stringMatching(/twice/)] }]);
    const exists = await call('POST', '/api/console/admissions/programmes/import', { programmes: [prog(du)] }, staff);
    expect(exists.json.error.details[0].problems.join('|')).toMatch(/already in the register/);
    const before = (await call('GET', '/api/console/admissions/programmes', undefined, staff)).json.length;
    expect((await call('POST', '/api/console/admissions/programmes/import?dryRun=1', { programmes: [good] }, staff)).json).toEqual({ outcome: 'VALID', programmes: 1 });
    expect((await call('GET', '/api/console/admissions/programmes', undefined, staff)).json).toHaveLength(before);
    expect((await call('POST', '/api/console/admissions/programmes/import', { programmes: [good] }, staff)).json).toEqual({ outcome: 'CREATED', programmes: 1 });
    expect((await call('GET', '/api/console/admissions/programmes', undefined, staff)).json).toHaveLength(before + 1);
  });

  it('holds facts about a programme to that programme: same university, real, and with the subjects as a list', async () => {
    const bad = async (over: Record<string, unknown>, why: RegExp) => {
      const r = await call('POST', '/api/console/admissions/facts', fact(over), staff);
      expect(r.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(r.json)).toMatch(why);
    };
    await bad({ kind: 'SUBJECTS', programmeId: progA, label: 'Required CUET subjects', valueText: 'English, Mathematics' }, /subjects as a list/);
    await bad({ kind: 'SUBJECTS', programmeId: 'nope', label: 'Required CUET subjects', valueText: 'English', subjects: ['English'] }, /does not exist/);
    await bad({ kind: 'SUBJECTS', programmeId: progState, label: 'Required CUET subjects', valueText: 'English', subjects: ['English'] }, /different university/);
    await bad({ kind: 'PROCEDURE', programmeId: progA, label: 'How to apply' }, /exactly as printed|quoted as printed/i);
    // A cut-off for a programme may name the programme by id; its name is filled in.
    const id = await publishFact({ kind: 'CUTOFF', programmeId: progA, year: YEAR - 1, label: 'Minimum allocation score, Round 1', valueNumber: 742.5, basis: 'ALLOCATION_SCORE', category: 'General', round: 'Round 1' });
    const stored = await env.DB.prepare('SELECT programme, programme_id FROM admission_facts WHERE id = ?').bind(id).first();
    expect(stored).toEqual({ programme: 'B.A. (Hons) Economics', programme_id: progA });
  });

  it('shows a programme only after staff publish it, and says plainly what is not known', async () => {
    expect((await call('POST', `/api/console/admissions/programmes/${progA}/decision`, { action: 'PUBLISH' }, student)).status).toBe(403);
    expect((await call('POST', `/api/console/admissions/programmes/${progA}/decision`, { action: 'WITHDRAW', reason: 'not yet' }, staff)).status).toBe(409);
    expect((await call('POST', `/api/console/admissions/programmes/${progA}/decision`, { action: 'REJECT' }, staff)).status).toBe(422);
    for (const id of [progA, progB, progState]) expect((await call('POST', `/api/console/admissions/programmes/${id}/decision`, { action: 'PUBLISH' }, staff)).json).toEqual({ id, status: 'PUBLISHED' });
    const list = (await call('GET', '/api/public/admissions/programmes?limit=50')).json;
    expect(list.total).toBe(3); // the imported B.Com is still a draft
    const a = list.programmes.find((p: { id: string }) => p.id === progA);
    expect(a).toMatchObject({ universityName: 'University of Delhi', universityType: 'Central Universities', programmeName: 'B.A. (Hons) Economics', academicYear: AY, reliability: 'VERIFIED_OFFICIAL', subjects: null, nextDeadline: null, known: { eligibility: false, subjects: false, procedure: false, counselling: false, deadline: false, cutoffs: true } });
    const detail = (await call('GET', `/api/public/admissions/programmes/${progA}`)).json;
    // Everything except the cut-off is marked unavailable: nothing is guessed.
    expect(detail.unavailable).toEqual(['eligibility', 'subjects', 'procedure', 'counselling', 'deadline']);
    expect(detail.current).toEqual({ eligibility: [], subjects: [], procedure: [], counselling: [], dates: [] });
    expect(detail.note).toMatch(/not a prediction/);
  });

  it('keeps current information and historical cut-offs apart, and filters by type, subject, year, exam and name', async () => {
    await publishFact({ kind: 'SUBJECTS', programmeId: progA, label: 'Required CUET subjects', valueText: 'English, Mathematics and any one other domain subject', subjects: ['English', 'Mathematics', 'Economics'] });
    await publishFact({ kind: 'SUBJECTS', programmeId: progB, label: 'Required CUET subjects', valueText: 'English, Physics and Mathematics', subjects: ['English', 'Physics', 'Mathematics'] });
    await publishFact({ kind: 'ELIGIBILITY', programmeId: progA, label: 'Eligibility', valueText: 'At least 50% in Class XII with Mathematics' });
    await publishFact({ kind: 'PROCEDURE', programmeId: progA, label: 'How to apply', valueText: 'Register on CSAS, choose programmes, pay the fee.' });
    await publishFact({ kind: 'COUNSELLING', programmeId: progA, label: 'Counselling', valueText: 'Seats are allotted in rounds by merit.' });
    await publishFact({ kind: 'EVENT', programmeId: progA, label: 'Last date to apply', eventDate: daysFromNow(20), category: 'APPLICATION_DEADLINE' });
    const detail = (await call('GET', `/api/public/admissions/programmes/${progA}`)).json;
    expect(detail.unavailable).toEqual([]);
    expect(detail.current.subjects[0]).toMatchObject({ subjects: ['English', 'Mathematics', 'Economics'], valueText: expect.stringContaining('English, Mathematics'), sourcePage: 12, checkedOn: TODAY, reliability: 'VERIFIED_OFFICIAL' });
    expect(detail.current.eligibility).toHaveLength(1);
    expect(detail.current.dates[0]).toMatchObject({ category: 'APPLICATION_DEADLINE', eventDate: daysFromNow(20) });
    // The cut-off is in its own list, labelled with its year; it is not among the current information.
    expect(detail.historicalCutoffs).toHaveLength(1);
    expect(detail.historicalCutoffs[0]).toMatchObject({ year: YEAR - 1, basis: 'ALLOCATION_SCORE', valueNumber: 742.5 });
    expect(Object.values(detail.current).flat().some((f) => (f as { kind: string }).kind === 'CUTOFF')).toBe(false);
    expect(detail.programme).toMatchObject({ reliability: 'VERIFIED_OFFICIAL', sourceUrl: 'https://admission.uod.ac.in', sourcePage: 12, lastVerifiedOn: TODAY });
    // The browse list summarises the same.
    const q = async (qs: string) => (await call('GET', `/api/public/admissions/programmes?${qs}`)).json;
    const a = (await q('university=university-of-delhi')).programmes.find((p: { id: string }) => p.id === progA);
    expect(a).toMatchObject({ subjects: ['English', 'Mathematics', 'Economics'], nextDeadline: { date: daysFromNow(20) }, known: { eligibility: true, subjects: true, procedure: true, counselling: true, deadline: true, cutoffs: true } });
    expect((await q('type=Central')).total).toBe(2);
    expect((await q('type=state')).programmes.map((p: { id: string }) => p.id)).toEqual([progState]);
    expect((await q('subject=physics')).programmes.map((p: { id: string }) => p.id)).toEqual([progB]);
    expect((await q('subject=Mathematics')).total).toBe(2);
    expect((await q('subject=Chemistry')).total).toBe(0);
    expect((await q(`year=${YEAR}`)).total).toBe(3);
    expect((await q('year=2019-20')).total).toBe(0);
    expect((await q('exam=CUET_PG')).total).toBe(0);
    expect((await q('q=political')).programmes.map((p: { id: string }) => p.id)).toEqual([progState]);
    expect((await q('university=test-state-university')).total).toBe(1);
    const f = (await call('GET', '/api/public/admissions/filters')).json;
    expect(f.types.map((t: { type: string }) => t.type).sort()).toEqual(['Central Universities', 'State Universities']);
    expect(f.subjects.find((s: { subject: string }) => s.subject === 'Mathematics')).toMatchObject({ count: 2 });
    expect(f.years).toEqual([{ year: AY, count: 3 }]);
    // The university page lists its programmes, and keeps programme facts off its university-wide lists.
    const uni = (await call('GET', '/api/public/admissions/universities/university-of-delhi')).json;
    expect(uni.programmes.map((p: { id: string }) => p.id)).toEqual(expect.arrayContaining([progA, progB]));
    expect(uni.eligibility).toEqual([]);
  });

  it('takes a programme and everything about it off the student pages when it is withdrawn or its source is retired', async () => {
    expect((await call('POST', `/api/console/admissions/programmes/${progB}/decision`, { action: 'WITHDRAW', reason: 'Programme discontinued by the university' }, staff)).json).toEqual({ id: progB, status: 'WITHDRAWN' });
    expect((await call('GET', `/api/public/admissions/programmes/${progB}`)).status).toBe(404);
    expect((await call('GET', '/api/public/admissions/programmes?subject=physics')).json.total).toBe(0);
    expect((await call('GET', '/api/public/admissions/universities/university-of-delhi')).json.programmes.map((p: { id: string }) => p.id)).not.toContain(progB);
    expect((await call('POST', `/api/console/admissions/programmes/${progB}/decision`, { action: 'PUBLISH', reason: 'Reinstated' }, staff)).json).toEqual({ id: progB, status: 'PUBLISHED' });
    // Retiring a source hides every programme and fact that cites it.
    await call('POST', `/api/console/admissions/sources/${state}/decision`, { action: 'RETIRE' }, staff);
    expect((await call('GET', `/api/public/admissions/programmes/${progState}`)).status).toBe(404);
    expect((await call('GET', '/api/public/admissions/programmes?university=test-state-university')).json.total).toBe(0);
    expect((await call('POST', `/api/console/admissions/programmes/${progState}/decision`, { action: 'PUBLISH' }, staff)).status).toBe(409);
  });

  it('lists what has gone out of date, so nobody has to remember', async () => {
    expect((await call('GET', '/api/console/admissions/outdated', undefined, staff)).json).toMatchObject({ staleAfterDays: 180 });
    // An old fact (checked 300 days ago, about an earlier year) and an old source check.
    await publishFact({ kind: 'ELIGIBILITY', programmeId: progB, label: 'Eligibility (older reading)', valueText: 'Class XII with Physics', checkedOn: daysFromNow(-300), year: YEAR - 1 });
    await env.DB.prepare('UPDATE admission_sources SET last_checked_on = ? WHERE id = ?').bind(daysFromNow(-200), du).run();
    const out = (await call('GET', '/api/console/admissions/outdated', undefined, staff)).json;
    expect(out.items.find((i: { type: string; label: string }) => i.type === 'FACT' && /older reading/.test(i.label))).toMatchObject({ reason: expect.stringMatching(/Not checked for 3\d\d days/), university: 'University of Delhi' });
    expect(out.items.find((i: { type: string; id: string }) => i.type === 'SOURCE' && i.id === du)).toMatchObject({ reason: expect.stringMatching(/Source not checked for 20\d days/) });
    // The fact shows to students marked outdated rather than hidden or passed off as current.
    const detail = (await call('GET', `/api/public/admissions/programmes/${progB}`)).json;
    expect(detail.current.eligibility[0]).toMatchObject({ reliability: 'OUTDATED' });
    // A programme whose source has been retired is no longer showing, and staff are told why it needs attention.
    expect(out.items.find((i: { id: string }) => i.id === progState)).toMatchObject({ type: 'PROGRAMME', reason: 'Its source is no longer approved' });
  });
});
