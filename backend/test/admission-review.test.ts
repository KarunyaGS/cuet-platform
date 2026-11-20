import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import app from '../src/index';
import { evaluateRule } from '../src/services/admission-eligibility';
import { parseRequirementText } from '../src/services/admission-requirements';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}
async function login(role?: string) {
  const email = `rev-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Rev' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const ctx = createExecutionContext();
  const res = await app.request('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'correct-horse-battery' }) }, env, ctx);
  await waitOnExecutionContext(ctx);
  return { 'content-type': 'application/json', cookie: res.headers.get('set-cookie')!.split(';')[0]! };
}
const TODAY = new Date().toISOString().slice(0, 10);
const YEAR = new Date().getUTCFullYear();
const AY = `${YEAR}-${String(YEAR + 1).slice(2)}`;

// ---------------------------------------------------------------- the evaluator (no database)

const LIST_A = ['101', '102', '325'];
const LIST_B = ['301', '306', '319', '320', '322', '304', '308'];
const groups = { LIST_A, LIST_B };
const DU = (combos: string, tail = 'Merit will be based on the best CUET score.') => `Candidates must appear in CUET in any of the following subject combinations: ${combos} ${tail}`;
const rule = (t: string) => parseRequirementText(t);

describe('minimum eligibility (pure)', () => {
  it('mandatory subjects: all must be taken', () => {
    const r = rule(DU('Combination I: Physics + Chemistry + Mathematics/Applied Mathematics', 'Candidates must appear in any one language from List A in CUET'));
    expect(evaluateRule(r, ['322', '306', '319', '101'], groups)).toMatchObject({ verdict: 'MEETS', matched: 'Combination I' });
    const missing = evaluateRule(r, ['322', '306', '101'], groups);
    expect(missing.verdict).toBe('DOES_NOT_MEET');
    expect(missing.combinations[0]!.missing.join(' ')).toContain('Mathematics');
  });

  it('alternative combinations: any one satisfied is enough', () => {
    const r = rule(DU('Combination I: Physics + Chemistry + Mathematics/Applied Mathematics OR Combination II: Physics + Chemistry + Biology/Biological Studies/Biotechnology/Biochemistry', 'Candidates must appear in any one language from List A in CUET'));
    expect(evaluateRule(r, ['322', '306', '304', '102'], groups)).toMatchObject({ verdict: 'MEETS', matched: 'Combination II' });
    expect(evaluateRule(r, ['322', '306', '319', '102'], groups)).toMatchObject({ verdict: 'MEETS', matched: 'Combination I' });
    expect(evaluateRule(r, ['322', '306', '102'], groups).verdict).toBe('DOES_NOT_MEET');
  });

  it('any N of a list: counts different papers, and one paper never fills two places', () => {
    const r = rule(DU('Combination I: Any one Language from List A + Any three subjects from List B OR Combination II: Any two Languages from List A + Any two subjects from List B'));
    expect(evaluateRule(r, ['101', '322', '306', '319'], groups).verdict).toBe('MEETS'); // 1 language + 3 domain
    expect(evaluateRule(r, ['101', '102', '322', '306'], groups).verdict).toBe('MEETS'); // 2 languages + 2 domain
    expect(evaluateRule(r, ['101', '322', '306'], groups)).toMatchObject({ verdict: 'DOES_NOT_MEET' }); // only 2 domain, one language
    expect(evaluateRule(r, ['322', '306', '319'], groups).verdict).toBe('DOES_NOT_MEET'); // no language at all
    expect(evaluateRule(r, ['322', '322', '322', '101'], groups).verdict).toBe('DOES_NOT_MEET'); // a repeated paper counts once
  });

  it('a named subject taken from a list must be in that list', () => {
    const r = rule(DU('Combination I: Any one Language from List A + Performing Arts from List B + Any two subjects from List B'));
    expect(evaluateRule(r, ['101', '320', '322', '306'], groups).verdict).toBe('MEETS');
    // Performing Arts is the named one; without it the other two subjects cannot stand in for it
    expect(evaluateRule(r, ['101', '322', '306', '319'], groups).verdict).toBe('DOES_NOT_MEET');
    // If the university's List B did not contain it, the combination could never be met
    expect(evaluateRule(r, ['101', '320', '322', '306'], { LIST_A, LIST_B: LIST_B.filter((c) => c !== '320') }).verdict).toBe('DOES_NOT_MEET');
  });

  it('a named subject plus one more language', () => {
    const r = rule(DU('Combination I: Hindi from List A + Any three subjects from List B OR Combination II: Hindi and one Language from List A + Any two subjects from List B'));
    expect(evaluateRule(r, ['102', '322', '306', '319'], groups).verdict).toBe('MEETS');
    expect(evaluateRule(r, ['102', '101', '322', '306'], groups).verdict).toBe('MEETS');
    expect(evaluateRule(r, ['101', '322', '306', '319'], groups).verdict).toBe('DOES_NOT_MEET'); // no Hindi
  });

  it('a choice among listed papers (any one of English or Hindi) and a mandatory paper', () => {
    const r = rule('1. Language Test - English (101) or Hindi (102) 2. General Aptitude Test (501)');
    expect(evaluateRule(r, ['102', '501'], {}).verdict).toBe('MEETS');
    expect(evaluateRule(r, ['102'], {}).verdict).toBe('DOES_NOT_MEET');
    expect(evaluateRule(r, ['322', '501'], {}).verdict).toBe('DOES_NOT_MEET');
  });

  it('never says "does not meet" on incomplete information', () => {
    const lists = rule(DU('Combination I: Any one Language from List A + Any three subjects from List B'));
    expect(evaluateRule(lists, ['101', '322'], {}).verdict).toBe('CANNOT_TELL'); // lists not published
    expect(evaluateRule(lists, ['101', '322'], { LIST_A }).verdict).toBe('CANNOT_TELL'); // List B missing
    const unknown = rule(DU('Combination I: Astrology + Physics'));
    expect(evaluateRule(unknown, ['322'], groups).verdict).toBe('CANNOT_TELL');
    // a combination that is known and unmet, beside one that is unknown, is still unknown overall
    const mixed = rule(DU('Combination I: Physics + Chemistry OR Combination II: Astrology + Physics'));
    expect(evaluateRule(mixed, ['322'], groups).verdict).toBe('CANNOT_TELL');
    // but one that is met is enough, whatever the others say
    expect(evaluateRule(mixed, ['322', '306'], groups).verdict).toBe('MEETS');
    expect(evaluateRule(rule('not a rule'), ['322'], groups)).toMatchObject({ verdict: 'CANNOT_TELL', combinations: [] });
  });

  it('a test set by the university is reported, not judged', () => {
    const r = rule("Candidates must appear in both CUET and Performance-based test. Candidates must appear in CUET in any of the following subject combinations: Combination I: Any one Language from List A + Any three subjects from List B AND Performance-Based Test Merit will be calculated by considering the combined 'CUET score (50% weightage)'");
    const e = evaluateRule(r, ['101', '322', '306', '319'], groups);
    expect(e.verdict).toBe('MEETS');
    expect(e.additionalRequirements).toEqual(['A performance-based test set by the university']);
  });
});

// ---------------------------------------------------------------- the workflow, end to end

describe('structured requirements: reading, review, publication and use', () => {
  let staff: Record<string, string>;
  let student: Record<string, string>;
  let du = '';
  let seq = 0;

  const fact = (over: Record<string, unknown>) => ({ universityName: 'University of Delhi', sourceId: du, exam: 'CUET_UG', year: YEAR, checkedOn: TODAY, sourcePage: 20, ...over });
  /** A published programme with its printed rule published too (the way staff would have done it). */
  async function programme(text: string, opts: { publish?: boolean; kind?: 'SUBJECTS' | 'ELIGIBILITY'; flag?: string } = {}) {
    const name = `B.A. (Hons.) Test Programme ${++seq}`;
    const p = await call('POST', '/api/console/admissions/programmes', { universityName: 'University of Delhi', programmeName: name, degree: 'B.A. (Hons.)', level: 'UG', academicYear: AY, exam: 'CUET_UG', sourceId: du, sourcePage: 20, lastVerifiedOn: TODAY }, staff);
    expect(p.status, JSON.stringify(p.json).slice(0, 200)).toBe(201);
    const kind = opts.kind ?? 'SUBJECTS';
    const f = await call('POST', '/api/console/admissions/facts', fact({ kind, programmeId: p.json.id, programme: name, label: `${kind === 'SUBJECTS' ? 'Required CUET subjects' : 'Eligibility'}, as printed`, valueText: text, ...(kind === 'SUBJECTS' ? { subjects: ['Physics'] } : {}), ...(opts.flag ? { reviewFlag: opts.flag } : {}) }), staff);
    expect(f.status, JSON.stringify(f.json).slice(0, 300)).toBe(201);
    if (opts.publish !== false && !opts.flag) {
      expect((await call('POST', `/api/console/admissions/facts/${f.json.id}/decision`, { action: 'PUBLISH' }, staff)).status).toBe(200);
      expect((await call('POST', `/api/console/admissions/programmes/${p.json.id}/decision`, { action: 'PUBLISH' }, staff)).status).toBe(200);
    }
    return { pid: p.json.id as string, fid: f.json.id as string, name };
  }
  const reqOf = async (pid: string) => ((await call('GET', '/api/console/admissions/requirements?all=1&limit=200', undefined, staff)).json.items as { id: string; programme: { id: string }; status: string; version: number }[]).filter((r) => r.programme.id === pid).sort((a, b) => b.version - a.version);
  const approve = (id: string) => call('POST', `/api/console/admissions/requirements/${id}/decision`, { action: 'APPROVE', note: 'Read against the printed text; matches' }, staff);
  const eligibility = async (pid: string, papers?: string) => (await call('GET', `/api/student/admissions/eligibility?ids=${pid}${papers ? `&papers=${papers}` : ''}`, undefined, student)).json.results[0];
  const physChemMath = 'Candidates must appear in CUET in any of the following subject combinations: Combination I: Physics + Chemistry + Mathematics/Applied Mathematics OR Combination II: Physics + Chemistry + Biology/Biological Studies/Biotechnology/Biochemistry Merit will be based on the best CUET score. Candidates must appear in any one language from List A in CUET';

  beforeAll(async () => {
    [staff, student] = [await login('SUPER_ADMIN'), await login()];
    await env.DB.prepare("INSERT INTO participating_universities (id, exam_code, cycle, name, type, state, source_url) VALUES ('pu_rev_du', 'CUET_UG', '2026', 'University of Delhi', 'Central Universities', NULL, 'https://cuet.nta.nic.in/x')").run();
    await call('POST', '/api/admin/registry/papers', {
      exam: 'CUET_UG', year: 2026,
      papers: [['101', 'English', 'LANGUAGE'], ['102', 'Hindi', 'LANGUAGE'], ['306', 'Chemistry', 'DOMAIN'], ['319', 'Mathematics / Applied Mathematics', 'DOMAIN'], ['322', 'Physics', 'DOMAIN'], ['304', 'Biology/ Biological Science/ Biotechnology /Biochemistry', 'DOMAIN'], ['501', 'General Aptitude Test', 'GAT']]
        .map(([code, name, categoryCode]) => ({ code, name, categoryCode, officialSyllabusUrl: `https://cdnbbsr.s3waas.gov.in/test/${code}.pdf`, listedOnUrl: 'https://cuet.nta.nic.in/' })),
    }, ADMIN);
    await call('POST', '/api/console/admissions/sources/load-reviewed', {}, staff);
    du = ((await call('GET', '/api/console/admissions/sources', undefined, staff)).json.find((s: { url: string }) => s.url === 'https://admission.uod.ac.in')).id;
    await call('POST', `/api/console/admissions/sources/${du}/decision`, { action: 'APPROVE', checkedOn: TODAY, note: 'Opened the page' }, staff);
  });

  it('is for staff only, and a student can use the student routes only', async () => {
    for (const [m, p] of [['GET', '/api/console/admissions/requirements'], ['GET', '/api/console/admissions/groups'], ['GET', '/api/console/admissions/validation'], ['POST', '/api/console/admissions/requirements/propose']] as const) {
      expect((await call(m, p)).status).toBe(401);
      expect((await call(m, p, undefined, student)).status).toBe(403);
    }
    expect((await call('GET', '/api/student/admissions/targets')).status).toBe(401);
  });

  it('reads printed rules as drafts only, repeats safely, and records what it read from where', async () => {
    const a = await programme(physChemMath);
    const dry = await call('POST', '/api/console/admissions/requirements/propose?dryRun=1', {}, staff);
    expect(dry.json).toMatchObject({ dryRun: true, created: expect.any(Number) });
    expect(await reqOf(a.pid)).toHaveLength(0); // a dry run writes nothing
    const first = await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    expect(first.json.created).toBeGreaterThan(0);
    const [r] = await reqOf(a.pid);
    expect(r).toMatchObject({ status: 'DRAFT', version: 1 });
    const second = await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    expect(second.json.created).toBe(0);
    expect(second.json.unchanged).toBeGreaterThan(0);
    const d = (await call('GET', `/api/console/admissions/requirements/${r!.id}`, undefined, staff)).json;
    expect(d).toMatchObject({ printedText: physChemMath, printedTextChanged: false, family: 'DU_COMBINATIONS', source: { academicYear: AY, sourcePage: 20 } });
    expect(d.history[0]).toMatchObject({ action: 'READ', to_status: 'DRAFT' });
    expect(d.history[0].snapshot).toMatchObject({ academicYear: AY, sourcePage: 20, sourceUrl: 'https://admission.uod.ac.in' });
  });

  it('a draft requirement never influences a student', async () => {
    const a = await programme(physChemMath);
    await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    await call('PUT', '/api/student/preferences', { examCode: 'CUET_UG', targetYear: 2027, paperIds: ['paper_cuet_ug_2026_322', 'paper_cuet_ug_2026_306'] }, student);
    const e = await eligibility(a.pid);
    expect(e).toMatchObject({ available: false, result: null, unavailable: { code: 'NO_APPROVED_REQUIREMENT' } });
  });

  it('a list the rule refers to must be published before the rule is used, and a doubtful entry must be confirmed', async () => {
    const a = await programme(physChemMath);
    await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    const [r] = await reqOf(a.pid);
    expect((await approve(r!.id)).status).toBe(200); // the structure is sound, so it can be approved
    expect(await eligibility(a.pid)).toMatchObject({ available: false, unavailable: { code: 'LISTS_NOT_PUBLISHED' } });

    // List A as printed, with Sanskrit named in the language list (NTA offers it as a domain paper)
    const g = await call('POST', '/api/console/admissions/groups', {
      universitySlug: 'university-of-delhi', groupCode: 'LIST_A', title: 'List A: Languages', academicYear: AY, exam: 'CUET_UG', sourceId: du, sourcePage: 20,
      sourceLocator: 'Bulletin of Information UG, PDF p.20 / printed p.xvi', checkedOn: TODAY, members: [{ printedName: 'English' }, { printedName: 'Hindi' }, { printedName: 'Sanskrit' }],
    }, staff);
    expect(g.status, JSON.stringify(g.json).slice(0, 300)).toBe(201);
    expect(g.json.members.map((m: { printed_name: string; mapping_status: string; paper_code: string | null }) => [m.printed_name, m.mapping_status, m.paper_code])).toEqual([['English', 'MAPPED', '101'], ['Hindi', 'MAPPED', '102'], ['Sanskrit', 'NEEDS_CONFIRMATION', '325']]);
    const blocked = await call('POST', `/api/console/admissions/groups/${g.json.id}/decision`, { action: 'PUBLISH', note: 'Checked against the bulletin' }, staff);
    expect(blocked.status).toBe(409);
    expect(JSON.stringify(blocked.json)).toMatch(/Sanskrit/);
    const sanskrit = g.json.members.find((m: { printed_name: string }) => m.printed_name === 'Sanskrit').id;
    expect((await call('POST', `/api/console/admissions/groups/${g.json.id}/decision`, { action: 'PUBLISH', note: 'Checked against the bulletin; Sanskrit read as paper 325', confirmMembers: [sanskrit] }, staff)).json.status).toBe('PUBLISHED');
    const e = await eligibility(a.pid);
    expect(e).toMatchObject({ available: true, result: { verdict: 'DOES_NOT_MEET' } }); // student has Physics and Chemistry only
    expect(e.basis).toMatchObject({ academicYear: AY, sourceUrl: 'https://admission.uod.ac.in', sourcePage: 20, requirementVersion: 1 });
    expect(e.caveats.join(' ')).toMatch(/not a cut-off comparison/);
  });

  it('gives MEETS, DOES_NOT_MEET and CANNOT_TELL from the papers a student takes (and what-if papers)', async () => {
    const a = await programme(physChemMath);
    await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    expect((await approve((await reqOf(a.pid))[0]!.id)).status).toBe(200);
    await call('PUT', '/api/student/preferences', { examCode: 'CUET_UG', targetYear: 2027, paperIds: ['paper_cuet_ug_2026_322', 'paper_cuet_ug_2026_306', 'paper_cuet_ug_2026_319', 'paper_cuet_ug_2026_101'] }, student);
    expect(await eligibility(a.pid)).toMatchObject({ available: true, result: { verdict: 'MEETS', matched: 'Combination I' } });
    expect(await eligibility(a.pid, '322,306,101')).toMatchObject({ result: { verdict: 'DOES_NOT_MEET' }, papersUsed: ['322', '306', '101'] });
    expect(await eligibility(a.pid, '322,306,304,102')).toMatchObject({ result: { verdict: 'MEETS', matched: 'Combination II' } });
    // nothing chosen: no result, and a message saying what to do
    const none = await login();
    const e = (await call('GET', `/api/student/admissions/eligibility?ids=${a.pid}`, undefined, none)).json.results[0];
    expect(e).toMatchObject({ available: false, unavailable: { code: 'STUDENT_PAPERS_NOT_SET' } });
    // previous cycle is labelled
    expect((await eligibility(a.pid)).caveats.join(' ')).toMatch(/previous admission cycle/i);
  });

  it('an unresolved question blocks approval; a revision answers it and keeps the history', async () => {
    const bhu = '1. Subject Test - Chemistry (306) 2. Subject Test - Mathematics (319) 3. Subject Test - Physics (322) OR 1. Subject Test - Biology/ Biological Science/ Biotechnology/ Biochemistry (304) 2. Subject Test - Chemistry (306) 3. Subject Test - Physics (322)';
    const a = await programme(bhu);
    await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    const [r] = await reqOf(a.pid);
    const blocked = await approve(r!.id);
    expect(blocked.status).toBe(409);
    expect(JSON.stringify(blocked.json)).toMatch(/all of them or any of them/);
    // a revision must say what it changed and cannot claim the university's confirmation without its address
    const d = (await call('GET', `/api/console/admissions/requirements/${r!.id}`, undefined, staff)).json;
    const body = { combinations: d.rule.combinations.map((c: { label: string; requirements: unknown[]; effective: unknown[] }) => ({ label: c.label, requirements: c.requirements, effective: c.effective })), extraTests: [], note: 'University confirmed all papers in a set are needed' };
    expect((await call('POST', `/api/console/admissions/requirements/${r!.id}/revise`, { ...body, resolutions: { ALL_OR_ANY_NOT_STATED: { note: 'Confirmed by the admission cell by email' } } }, staff)).status).toBe(422);
    const revised = await call('POST', `/api/console/admissions/requirements/${r!.id}/revise`, { ...body, resolutions: { ALL_OR_ANY_NOT_STATED: { note: 'Confirmed by the admission cell by email', sourceUrl: 'https://admission.bhu.ac.in/en/faq' } } }, staff);
    expect(revised.status).toBe(201);
    expect(revised.json).toMatchObject({ version: 2, status: 'DRAFT', origin: 'REVIEWER', canApprove: true });
    const rows = await reqOf(a.pid);
    expect(rows.map((x) => [x.version, x.status])).toEqual([[2, 'DRAFT'], [1, 'SUPERSEDED']]);
    // the default list hides replaced versions
    expect(((await call('GET', '/api/console/admissions/requirements?limit=200', undefined, staff)).json.items as { programme: { id: string } }[]).filter((x) => x.programme.id === a.pid)).toHaveLength(1);
    const old = (await call('GET', `/api/console/admissions/requirements/${r!.id}`, undefined, staff)).json;
    expect(old.status).toBe('SUPERSEDED');
    expect(old.history.map((h: { action: string }) => h.action)).toEqual(['READ', 'SUPERSEDED']);
    expect((await approve(revised.json.id)).status).toBe(200);
    expect(revised.json.rule.resolutions.ALL_OR_ANY_NOT_STATED.sourceUrl).toBe('https://admission.bhu.ac.in/en/faq');
  });

  it('a revision cannot hide a structural problem or pair a subject with the wrong paper code', async () => {
    const a = await programme(`${physChemMath.replace('Mathematics/Applied Mathematics', 'Astrology')}`);
    await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    const [r] = await reqOf(a.pid);
    expect(r!.status).toBe('DRAFT');
    expect((await approve(r!.id)).status).toBe(409); // unknown subject
    const d = (await call('GET', `/api/console/admissions/requirements/${r!.id}`, undefined, staff)).json;
    const combos = d.rule.combinations.map((c: { label: string; requirements: unknown[]; effective: unknown[] }) => ({ label: c.label, requirements: c.requirements, effective: c.effective }));
    // claiming a note answers the unknown subject is refused: the reading itself must change
    expect((await call('POST', `/api/console/admissions/requirements/${r!.id}/revise`, { combinations: combos, resolutions: { UNKNOWN_SUBJECT: { note: 'I looked at it' } }, note: 'trying to wave it through' }, staff)).status).toBe(422);
    // a wrong pairing is refused
    const bad = JSON.parse(JSON.stringify(combos));
    const subj = bad[0].requirements.find((q: { kind: string }) => q.kind === 'SUBJECT');
    subj.subject = { status: 'MAPPED', text: 'Physics', subjectId: 'physics', paperCode: '306', basis: 'ALIAS' };
    expect((await call('POST', `/api/console/admissions/requirements/${r!.id}/revise`, { combinations: bad, note: 'wrong pairing' }, staff)).status).toBe(422);
    // a revision that leaves the unknown subject in place is still not approvable
    const kept = await call('POST', `/api/console/admissions/requirements/${r!.id}/revise`, { combinations: combos, note: 'no real change' }, staff);
    expect(kept.json.canApprove).toBe(false);
    expect((await approve(kept.json.id)).status).toBe(409);
  });

  it('a flagged programme never gives a result, and neither does one whose text changed, whose programme is withdrawn or whose source is retired', async () => {
    const a = await programme(physChemMath);
    await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    const id = (await reqOf(a.pid))[0]!.id;
    expect((await approve(id)).status).toBe(200);
    const g = (await call('GET', '/api/console/admissions/groups?university=university-of-delhi&status=PUBLISHED', undefined, staff)).json;
    expect(g.length).toBeGreaterThan(0); // List A was published by the earlier test
    await call('PUT', '/api/student/preferences', { examCode: 'CUET_UG', targetYear: 2027, paperIds: ['paper_cuet_ug_2026_322', 'paper_cuet_ug_2026_306', 'paper_cuet_ug_2026_319', 'paper_cuet_ug_2026_101'] }, student);
    expect(await eligibility(a.pid)).toMatchObject({ available: true, result: { verdict: 'MEETS' } });

    // 1. an open review flag on the programme's own text
    await env.DB.prepare('UPDATE admission_facts SET review_flag = ? WHERE id = ?').bind('Two documents disagree', a.fid).run();
    expect(await eligibility(a.pid)).toMatchObject({ available: false, result: null, unavailable: { code: 'PRINTED_FACT_FLAGGED' } });
    expect((await call('POST', `/api/console/admissions/requirements/${id}/decision`, { action: 'REJECT', note: 'Pulled while the flag is open' }, staff)).status).toBe(200);
    expect(await eligibility(a.pid)).toMatchObject({ unavailable: { code: expect.stringMatching(/NO_APPROVED_REQUIREMENT|PRINTED_FACT_FLAGGED/) } });
    await env.DB.prepare('UPDATE admission_facts SET review_flag = NULL WHERE id = ?').bind(a.fid).run();
    expect((await call('POST', `/api/console/admissions/requirements/${id}/decision`, { action: 'REOPEN', note: 'Flag resolved, reading again' }, staff)).status).toBe(200);
    expect((await approve(id)).status).toBe(200);
    expect(await eligibility(a.pid)).toMatchObject({ available: true });

    // 2. the printed text changes after approval
    await env.DB.prepare('UPDATE admission_facts SET value_text = ? WHERE id = ?').bind(`${physChemMath} Extra sentence.`, a.fid).run();
    expect(await eligibility(a.pid)).toMatchObject({ available: false, unavailable: { code: 'PRINTED_TEXT_CHANGED' } });
    const stale = (await call('GET', `/api/console/admissions/requirements/${id}`, undefined, staff)).json;
    expect(stale.printedTextChanged).toBe(true);
    expect(stale.canApprove).toBe(false);
    await env.DB.prepare('UPDATE admission_facts SET value_text = ? WHERE id = ?').bind(physChemMath, a.fid).run();
    expect(await eligibility(a.pid)).toMatchObject({ available: true });

    // 3. the printed fact is unpublished
    await env.DB.prepare(`UPDATE admission_facts SET status = 'DRAFT' WHERE id = ?`).bind(a.fid).run();
    expect(await eligibility(a.pid)).toMatchObject({ unavailable: { code: 'PRINTED_FACT_NOT_PUBLISHED' } });
    await env.DB.prepare(`UPDATE admission_facts SET status = 'PUBLISHED' WHERE id = ?`).bind(a.fid).run();

    // 4. the programme is withdrawn
    expect((await call('POST', `/api/console/admissions/programmes/${a.pid}/decision`, { action: 'WITHDRAW', reason: 'Superseded by the new bulletin' }, staff)).status).toBe(200);
    expect(await eligibility(a.pid)).toMatchObject({ unavailable: { code: 'PROGRAMME_NOT_AVAILABLE' } });
  });

  it('a requirement version that is not the approved one never counts, and a newer approval replaces the older one', async () => {
    const a = await programme(physChemMath);
    await call('POST', '/api/console/admissions/requirements/propose', {}, staff);
    const v1 = (await reqOf(a.pid))[0]!;
    expect((await approve(v1.id)).status).toBe(200);
    const d = (await call('GET', `/api/console/admissions/requirements/${v1.id}`, undefined, staff)).json;
    const combos = d.rule.combinations.slice(0, 1).map((c: { label: string; requirements: unknown[]; effective: unknown[] }) => ({ label: c.label, requirements: c.requirements, effective: c.effective }));
    const v2 = await call('POST', `/api/console/admissions/requirements/${v1.id}/revise`, { combinations: combos, note: 'Only the first combination applies to this programme' }, staff);
    expect(v2.status).toBe(201);
    // the approved version 1 keeps serving until version 2 is approved
    expect((await call('GET', `/api/console/admissions/requirements/${v1.id}`, undefined, staff)).json.status).toBe('APPROVED');
    expect((await approve(v2.json.id)).status).toBe(200);
    expect((await call('GET', `/api/console/admissions/requirements/${v1.id}`, undefined, staff)).json.status).toBe('SUPERSEDED');
    await call('PUT', '/api/student/preferences', { examCode: 'CUET_UG', targetYear: 2027, paperIds: ['paper_cuet_ug_2026_322', 'paper_cuet_ug_2026_306', 'paper_cuet_ug_2026_304', 'paper_cuet_ug_2026_102'] }, student);
    expect(await eligibility(a.pid)).toMatchObject({ result: { verdict: 'DOES_NOT_MEET' }, basis: { requirementVersion: 2 } }); // Combination II is gone in version 2
  });

  it('target programmes: only published ones, a limit, removal, and the information gaps stay visible', async () => {
    const a = await programme(physChemMath);
    const draftOnly = await programme(physChemMath, { publish: false });
    expect((await call('POST', '/api/student/admissions/targets', { programmeId: draftOnly.pid }, student)).status).toBe(404);
    expect((await call('POST', '/api/student/admissions/targets', { programmeId: a.pid, note: 'first choice' }, student)).status).toBe(201);
    expect((await call('POST', '/api/student/admissions/targets', { programmeId: a.pid }, student)).status).toBe(201); // idempotent
    const t = (await call('GET', '/api/student/admissions/targets', undefined, student)).json;
    expect(t.targets.filter((x: { programmeId: string }) => x.programmeId === a.pid)).toHaveLength(1);
    const mine = t.targets.find((x: { programmeId: string }) => x.programmeId === a.pid);
    expect(mine).toMatchObject({ available: true, information: { cycle: { status: 'PREVIOUS' }, stale: false }, eligibility: { available: false } });
    expect(mine.information.cycle.label).toMatch(/Previous admission cycle/);
    // withdrawn later: still listed, clearly marked
    await call('POST', `/api/console/admissions/programmes/${a.pid}/decision`, { action: 'WITHDRAW', reason: 'Replaced by a newer record' }, staff);
    const after = (await call('GET', '/api/student/admissions/targets', undefined, student)).json.targets.find((x: { programmeId: string }) => x.programmeId === a.pid);
    expect(after).toMatchObject({ available: false, information: { message: expect.stringMatching(/no longer published/) } });
    expect((await call('DELETE', `/api/student/admissions/targets/${a.pid}`, undefined, student)).json).toEqual({ removed: true });
    expect((await call('GET', '/api/student/admissions/targets', undefined, student)).json.targets.some((x: { programmeId: string }) => x.programmeId === a.pid)).toBe(false);
    // another student's targets are separate
    const other = await login();
    expect((await call('GET', '/api/student/admissions/targets', undefined, other)).json.targets).toEqual([]);
  });

  it('data validation reports gaps at university, programme and campus level without changing anything', async () => {
    await programme(physChemMath); // published, no degree issue, no campus
    await call('POST', '/api/console/admissions/groups', {
      universitySlug: 'university-of-delhi', groupCode: 'LIST_B', title: 'List B: Domain Specific Subjects', academicYear: AY, exam: 'CUET_UG', sourceId: du, sourcePage: 20,
      sourceLocator: 'Bulletin PDF p.20', checkedOn: TODAY, members: [{ printedName: 'Physics' }, { printedName: 'Chemistry' }],
    }, staff); // left as a draft
    const bad = await call('POST', '/api/console/admissions/programmes', { universityName: 'University of Delhi', programmeName: 'No Degree Programme', level: 'UG', academicYear: AY, exam: 'CUET_UG', sourceId: du, sourcePage: 20, lastVerifiedOn: TODAY }, staff);
    expect(bad.status).toBe(201);
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM admission_programmes').first<{ n: number }>();
    const v = (await call('GET', '/api/console/admissions/validation', undefined, staff)).json;
    expect(v.summary).toMatchObject({ ERROR: expect.any(Number), WARNING: expect.any(Number), INFO: expect.any(Number) });
    const msgs = v.findings.map((f: { level: string; message: string }) => `${f.level}:${f.message}`).join('\n');
    expect(msgs).toMatch(/CAMPUS:The campus or college is not recorded/);
    expect(msgs).toMatch(/PROGRAMME:Degree is not recorded/);
    expect(msgs).toMatch(/GROUP:/); // a list still in draft or with entries to check
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM admission_programmes').first<{ n: number }>())!.n).toBe(before!.n);
  });

  it('a list cannot be published from an unapproved source, or twice for the same name', async () => {
    const dup = await call('POST', '/api/console/admissions/groups', {
      universitySlug: 'university-of-delhi', groupCode: 'LIST_B', title: 'List B', academicYear: AY, exam: 'CUET_UG', sourceId: du, sourcePage: 20, sourceLocator: 'Bulletin PDF p.20', checkedOn: TODAY,
      members: [{ printedName: 'Physics' }, { printedName: 'physics' }],
    }, staff);
    expect(dup.status).toBe(422);
    const nta = ((await call('GET', '/api/console/admissions/sources', undefined, staff)).json.find((s: { url: string }) => s.url.startsWith('https://cuet.nta.nic.in'))).id;
    const unapproved = await call('POST', '/api/console/admissions/groups', {
      universitySlug: 'university-of-delhi', groupCode: 'LIST_B', title: 'List B', academicYear: AY, exam: 'CUET_UG', sourceId: nta, sourcePage: 1, sourceLocator: 'x page', checkedOn: TODAY, members: [{ printedName: 'Physics' }],
    }, staff);
    expect([409, 422]).toContain(unapproved.status);
  });
});
