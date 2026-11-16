import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { factProblems, personalDataProblem, universitySlug, type FactInput } from '../src/services/admissions';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function account(role?: string) {
  const email = `adm-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Adm' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { cookie: '' };
}
async function login(role?: string) {
  const email = `adm-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Adm' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const ctx = createExecutionContext();
  const res = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct-horse-battery' }) }, env, ctx);
  await waitOnExecutionContext(ctx);
  return { 'content-type': 'application/json', cookie: res.headers.get('set-cookie')!.split(';')[0]! };
}
void account;

const TODAY = new Date().toISOString().slice(0, 10);
const cutoff = (sourceId: string, over: Partial<FactInput> = {}): FactInput => ({
  universityName: 'University of Delhi', sourceId, kind: 'CUTOFF', exam: 'CUET_UG', year: 2026, programme: 'B.A. (Hons) Economics', label: 'Minimum allocation score, Round 1', valueText: null,
  valueNumber: 742.5, basis: 'ALLOCATION_SCORE', category: 'General', round: 'Round 1', eventDate: null, sourcePage: 14, sourceLocator: null, checkedOn: TODAY, ...over,
});

describe('rules for a fact (no database)', () => {
  const base = cutoff('src');
  it('accepts a complete cut-off, and says exactly what is missing from an incomplete one', () => {
    expect(factProblems(base)).toEqual([]);
    expect(factProblems({ ...base, basis: null }).join('|')).toMatch(/basis/);
    expect(factProblems({ ...base, category: null, round: null, programme: null }).join('|')).toMatch(/category.*round.*programme/s);
    expect(factProblems({ ...base, valueNumber: null }).join('|')).toMatch(/figure/);
    expect(factProblems({ ...base, sourcePage: null, sourceLocator: null }).join('|')).toMatch(/where in the source/);
    expect(factProblems({ ...base, checkedOn: '2099-01-01' }).join('|')).toMatch(/future/);
  });
  it('checks the figure against what its basis allows', () => {
    expect(factProblems({ ...base, basis: 'PERCENTILE', valueNumber: 101 }).join('|')).toMatch(/0 and 100/);
    expect(factProblems({ ...base, basis: 'PERCENTILE', valueNumber: 99.4 })).toEqual([]);
    expect(factProblems({ ...base, basis: 'RANK', valueNumber: 12.5 }).join('|')).toMatch(/whole number/);
    expect(factProblems({ ...base, basis: 'ALLOCATION_SCORE', valueNumber: 5000 }).join('|')).toMatch(/0 and 2000/);
  });
  it('keeps dates, eligibility and cut-offs to their own fields', () => {
    const event: FactInput = { ...base, kind: 'EVENT', basis: null, valueNumber: null, category: null, round: null, programme: null, label: 'Round 1 allocation list', eventDate: '2026-07-20' };
    expect(factProblems(event)).toEqual([]);
    expect(factProblems({ ...event, eventDate: null }).join('|')).toMatch(/needs its date/);
    const elig: FactInput = { ...event, kind: 'ELIGIBILITY', eventDate: null, label: 'Eligibility, B.A. (Hons) Economics', valueText: '50% in Class XII with Mathematics' };
    expect(factProblems(elig)).toEqual([]);
    expect(factProblems({ ...elig, valueText: null }).join('|')).toMatch(/exactly as printed/);
    expect(factProblems({ ...elig, valueNumber: 50 }).join('|')).toMatch(/no number/);
  });
  it('refuses text that looks like a candidate\'s details', () => {
    expect(personalDataProblem('Roll No. 20260012345')).toMatch(/roll or application number/);
    expect(personalDataProblem('Merit list of candidates 1234567890123')).toMatch(/long number/);
    expect(personalDataProblem('write to someone@example.com')).toMatch(/email/);
    expect(personalDataProblem('call 9876543210')).toMatch(/phone/);
    expect(personalDataProblem('Candidate name: A. Student')).toMatch(/name/);
    expect(personalDataProblem('Minimum allocation score, Round 1')).toBeNull();
    expect(factProblems({ ...base, label: 'Selected: roll number 12345' }).join('|')).toMatch(/Candidate details are never stored/);
    expect(universitySlug('University of Delhi')).toBe('university-of-delhi');
  });
});

describe('sources and facts, end to end', () => {
  let staff: Record<string, string>;
  let writer: Record<string, string>;
  let student: Record<string, string>;
  let du = '';
  let nta = '';
  let amu = '';
  beforeAll(async () => {
    [staff, student] = [await login('SUPER_ADMIN'), await login()];
    writer = staff;
    await env.DB.prepare("INSERT INTO participating_universities (id, exam_code, cycle, name, type, state, source_url) VALUES ('pu_test_du', 'CUET_UG', '2026', 'University of Delhi', 'Central Universities', NULL, 'https://cuet.nta.nic.in/x')").run();
  });

  it('is for staff only', async () => {
    for (const [m, p] of [['GET', '/api/console/admissions/sources'], ['GET', '/api/console/admissions/overview'], ['GET', '/api/console/admissions/facts']] as const) {
      expect((await call(m, p)).status).toBe(401);
      expect((await call(m, p, undefined, student)).status).toBe(403);
    }
    expect((await call('POST', '/api/console/admissions/sources/load-reviewed', {}, student)).status).toBe(403);
  });

  it('loads the sources of the 16 November review as PROPOSED, carrying what the review found, and nothing is used yet', async () => {
    const r = await call('POST', '/api/console/admissions/sources/load-reviewed', {}, writer);
    expect(r.json).toEqual({ added: 9, total: 9 });
    expect((await call('POST', '/api/console/admissions/sources/load-reviewed', {}, writer)).json).toMatchObject({ added: 0 });
    const list = (await call('GET', '/api/console/admissions/sources', undefined, staff)).json;
    expect(list).toHaveLength(9);
    expect(list.every((s: { status: string }) => s.status === 'PROPOSED')).toBe(true);
    du = list.find((s: { url: string }) => s.url === 'https://admission.uod.ac.in').id;
    nta = list.find((s: { url: string }) => s.url.startsWith('https://cuet.nta.nic.in')).id;
    amu = list.find((s: { url: string }) => s.url === 'https://amucontrollerexams.com').id;
    expect(list.find((s: { id: string }) => s.id === amu)).toMatchObject({ recommendation: 'DO_NOT_USE', personalDataRisk: 'LISTS_LINKED' });
    expect(list.find((s: { id: string }) => s.id === du)).toMatchObject({ recommendation: 'USE_WITH_CARE', personalDataRisk: 'LISTS_LINKED', universitySlug: 'university-of-delhi' });
    expect((await call('GET', '/api/console/admissions/overview', undefined, staff)).json).toMatchObject({ sources: { proposed: 9, approved: 0 }, facts: { draft: 0, published: 0 } });
    // Nothing is shown to students before a source is approved.
    expect((await call('GET', '/api/public/admissions/universities/university-of-delhi')).json).toMatchObject({ name: 'University of Delhi', officialPages: [], dates: [], eligibility: [], cutoffs: [] });
    expect((await call('GET', '/api/public/universities?exam=CUET_UG')).json.universities[0]).toMatchObject({ name: 'University of Delhi', slug: 'university-of-delhi', hasAdmissionInfo: false });
  });

  it('refuses a fact that cites a source nobody has approved', async () => {
    const r = await call('POST', '/api/console/admissions/facts', cutoff(du), writer);
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('SOURCE_NOT_APPROVED');
    expect((await call('GET', '/api/console/admissions/facts', undefined, staff)).json).toEqual([]);
  });

  it('approves a source only after the page has been opened, and asks for a reason before approving one the review advised against', async () => {
    expect((await call('POST', `/api/console/admissions/sources/${du}/decision`, { action: 'APPROVE' }, staff)).status).toBe(422);
    expect((await call('POST', `/api/console/admissions/sources/${du}/decision`, { action: 'APPROVE', checkedOn: '2099-01-01' }, staff)).status).toBe(422);
    expect((await call('POST', `/api/console/admissions/sources/${amu}/decision`, { action: 'APPROVE', checkedOn: TODAY }, staff)).status).toBe(422);
    expect((await call('POST', `/api/console/admissions/sources/${du}/decision`, { action: 'APPROVE', checkedOn: TODAY, note: 'Opened admission.uod.ac.in; DU branding, ac.in domain' }, staff)).json).toEqual({ id: du, status: 'APPROVED' });
    const row = await env.DB.prepare('SELECT status, reviewed_by, last_checked_on FROM admission_sources WHERE id = ?').bind(du).first<{ status: string; reviewed_by: string; last_checked_on: string }>();
    expect(row).toMatchObject({ status: 'APPROVED', last_checked_on: TODAY });
    expect(row!.reviewed_by).toMatch(/^user:/);
  });

  it('saves a complete fact as a draft and refuses the ones that are incomplete, for another university, or carry personal details', async () => {
    const refuse = async (over: Partial<FactInput>, why: RegExp) => {
      const r = await call('POST', '/api/console/admissions/facts', cutoff(du, over), writer);
      expect(r.status, JSON.stringify(r.json).slice(0, 200)).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(r.json)).toMatch(why);
    };
    await refuse({ basis: null }, /basis/);
    await refuse({ sourcePage: null, sourceLocator: null }, /where in the source/);
    await refuse({ universityName: 'Banaras Hindu University' }, /different university/);
    await refuse({ label: 'Candidate name: A. Student, roll number 4455' }, /Candidate details are never stored/);
    const ok = await call('POST', '/api/console/admissions/facts', cutoff(du), writer);
    expect(ok.status).toBe(201);
    expect(ok.json.status).toBe('DRAFT');
    // A draft is not shown to students.
    const page = (await call('GET', '/api/public/admissions/universities/university-of-delhi')).json;
    expect(page.cutoffs).toEqual([]);
    expect(page.officialPages).toHaveLength(1);
    expect(page.officialPages[0]).toMatchObject({ url: 'https://admission.uod.ac.in', lastCheckedOn: TODAY });
    expect((await call('GET', '/api/public/universities?exam=CUET_UG')).json.universities[0]).toMatchObject({ hasAdmissionInfo: true });
  });

  it('shows a fact only after staff publish it, with its source, page and the day it was checked; and hides it if the source is retired', async () => {
    const draft = (await call('GET', '/api/console/admissions/facts?status=DRAFT', undefined, staff)).json[0];
    expect((await call('POST', `/api/console/admissions/facts/${draft.id}/decision`, { action: 'PUBLISH' }, student)).status).toBe(403);
    expect((await call('POST', `/api/console/admissions/facts/${draft.id}/decision`, { action: 'REJECT' }, staff)).status).toBe(422); // a reason is needed
    expect((await call('POST', `/api/console/admissions/facts/${draft.id}/decision`, { action: 'PUBLISH' }, staff)).json).toEqual({ id: draft.id, status: 'PUBLISHED' });
    expect((await call('POST', `/api/console/admissions/facts/${draft.id}/decision`, { action: 'PUBLISH' }, staff)).status).toBe(409);
    const page = (await call('GET', '/api/public/admissions/universities/university-of-delhi')).json;
    expect(page.cutoffs).toHaveLength(1);
    expect(page.cutoffs[0]).toMatchObject({ programme: 'B.A. (Hons) Economics', valueNumber: 742.5, basis: 'ALLOCATION_SCORE', category: 'General', round: 'Round 1', sourcePage: 14, checkedOn: TODAY, sourceUrl: 'https://admission.uod.ac.in', year: 2026, exam: 'CUET_UG' });
    expect(page.note).toMatch(/Always confirm on the official page/);
    // Retiring the source takes its facts off the page.
    expect((await call('POST', `/api/console/admissions/sources/${du}/decision`, { action: 'RETIRE' }, staff)).json).toEqual({ id: du, status: 'RETIRED' });
    const after = (await call('GET', '/api/public/admissions/universities/university-of-delhi')).json;
    expect(after.cutoffs).toEqual([]);
    expect(after.officialPages).toEqual([]);
    expect((await call('GET', '/api/public/universities?exam=CUET_UG')).json.universities[0]).toMatchObject({ hasAdmissionInfo: false });
  });

  it('imports a pack all or nothing, as drafts, and a dry run saves nothing', async () => {
    await call('POST', `/api/console/admissions/sources/${du}/decision`, { action: 'APPROVE', checkedOn: TODAY }, staff);
    const good = cutoff(du, { programme: 'B.Com (Hons)', valueNumber: 701 });
    const bad = cutoff(du, { programme: 'B.Sc. Physics', basis: null });
    const before = (await call('GET', '/api/console/admissions/facts', undefined, staff)).json.length;
    const refused = await call('POST', '/api/console/admissions/facts/import', { facts: [good, bad] }, writer);
    expect(refused.status).toBe(422);
    expect(refused.json.error.code).toBe('PACK_REFUSED');
    expect(refused.json.error.details).toEqual([{ row: 2, problems: [expect.stringMatching(/basis/)] }]);
    expect((await call('GET', '/api/console/admissions/facts', undefined, staff)).json).toHaveLength(before);
    expect((await call('POST', '/api/console/admissions/facts/import?dryRun=1', { facts: [good] }, writer)).json).toEqual({ outcome: 'VALID', facts: 1 });
    expect((await call('GET', '/api/console/admissions/facts', undefined, staff)).json).toHaveLength(before);
    expect((await call('POST', '/api/console/admissions/facts/import', { facts: [good] }, writer)).json).toEqual({ outcome: 'CREATED', facts: 1 });
    const drafts = (await call('GET', '/api/console/admissions/facts?status=DRAFT', undefined, staff)).json;
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ programme: 'B.Com (Hons)', status: 'DRAFT' });
  });

  it('does not invent a page for an unknown university', async () => {
    expect((await call('GET', '/api/public/admissions/universities/no-such-university')).status).toBe(404);
    expect((await call('GET', '/api/public/admissions/universities/NOT%20A%20SLUG!')).status).toBe(404);
    // A source that covers every university (NTA's list) appears on each university's page once approved.
    await call('POST', `/api/console/admissions/sources/${nta}/decision`, { action: 'APPROVE', checkedOn: TODAY }, staff);
    const page = (await call('GET', '/api/public/admissions/universities/university-of-delhi')).json;
    expect(page.officialPages.map((p: { url: string }) => p.url)).toContain('https://cuet.nta.nic.in/participating-universities/');
  });
});
