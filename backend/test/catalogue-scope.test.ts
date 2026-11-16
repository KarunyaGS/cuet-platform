import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { UG_SCIENCE_PAPER_CODES, paperInScope, scopeInfoSections } from '../src/lib/scope';
import type { Bindings } from '../src/types';

// Active catalogue (16 Nov 2026): CUET UG only, science-focused papers only. Nothing is hidden by deleting or changing a record.
const active = { ...env, ACTIVE_EXAMS: 'CUET_UG', CATALOGUE_SCOPE: 'ug-science' } as unknown as Bindings;
const everything = env as unknown as Bindings;
async function get(path: string, e: Bindings = active) {
  const ctx = createExecutionContext();
  const res = await app.request(path, {}, e, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

describe('active catalogue: CUET UG, science papers only', () => {
  it('pins the science paper list to NTA codes: Physics, Chemistry, Mathematics, Biology, Geography/Geology, Computer Science/IP and General Aptitude Test', () => {
    expect([...UG_SCIENCE_PAPER_CODES].sort()).toEqual(['304', '306', '308', '313', '319', '322', '501']);
  });

  it('shows only CUET UG as an exam; CUET PG is not offered', async () => {
    const exams = await get('/api/learn/exams');
    expect(exams.json.map((x: { code: string }) => x.code)).toEqual(['CUET_UG']);
    // The card shows how many papers students can open here, not NTA's 37.
    const inScope = await env.DB.prepare(`SELECT COUNT(*) AS n FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE e.code = 'CUET_UG' AND ec.year = 2026 AND tp.code IN ('322','306','319','304','313','308','501')`).first<{ n: number }>();
    expect(exams.json[0].rules.papersOffered).toBe(inScope!.n);
    expect(exams.json[0].rules.papersOfferedByNta).toBe(37);
    expect((await get('/api/learn/exams/CUET_PG/subjects?year=2026')).status).toBe(404);
    expect((await get('/api/learn/official-directory?exam=CUET_PG')).status).toBe(404);
    expect((await get('/api/learn/pyq?exam=CUET_PG')).status).toBe(404);
  });

  it('lists only the approved science papers for CUET UG, under NTA\'s own names, with no arts, commerce, language or other subject', async () => {
    const r = await get('/api/learn/exams/CUET_UG/subjects?year=2026');
    expect(r.status).toBe(200);
    const codes = r.json.map((s: { code: string }) => s.code).sort();
    // These exist in a fresh test database only when the seed contains the paper; whatever is listed must be inside the approved set.
    expect(codes.every((c: string) => UG_SCIENCE_PAPER_CODES.includes(c))).toBe(true);
    const all = await get('/api/learn/exams/CUET_UG/subjects?year=2026', everything);
    expect(all.json.length).toBeGreaterThanOrEqual(r.json.length);
  });

  it('does not touch the stored records: the same data is still there for administrators and in the database', async () => {
    const before = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM subjects) s, (SELECT COUNT(*) FROM test_papers) p, (SELECT COUNT(*) FROM exams) e').first();
    await get('/api/learn/exams');
    await get('/api/learn/exams/CUET_UG/subjects?year=2026');
    const after = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM subjects) s, (SELECT COUNT(*) FROM test_papers) p, (SELECT COUNT(*) FROM exams) e').first();
    expect(after).toEqual(before);
    expect((await get('/api/learn/exams', everything)).json.map((x: { code: string }) => x.code).sort()).toEqual(['CUET_PG', 'CUET_UG']);
  });

  it('the rule itself: out-of-scope exam or paper code is refused, in-scope accepted, unset means everything', () => {
    expect(paperInScope(active, 'CUET_UG', '322')).toBe(true);
    expect(paperInScope(active, 'CUET_UG', '501')).toBe(true);
    expect(paperInScope(active, 'CUET_UG', '101')).toBe(false); // English
    expect(paperInScope(active, 'CUET_UG', '314')).toBe(false); // History
    expect(paperInScope(active, 'CUET_UG', '305')).toBe(false); // Business Studies
    expect(paperInScope(active, 'CUET_PG', 'SCQP24')).toBe(false);
    expect(paperInScope(active, 'CUET_UG', null)).toBe(true); // not about one subject
    expect(paperInScope(everything, 'CUET_PG', 'SCQP24')).toBe(true);
  });

  it('the official exam information keeps NTA wording but drops whole-exam figures and lists of languages and other subjects', () => {
    const item = (text: string) => ({ text, source: null, page: null, note: null });
    const sections = [
      { key: 'pattern', title: 'Pattern', items: [item('Mode: Computer Based Test (CBT) only.'), item('There are 37 subjects in total: 13 languages, 23 domain-specific subjects and 1 General Aptitude Test.'), item('Each test paper lasts 60 minutes.'), item('Question papers are available in 13 languages: English, Hindi.'), item('A candidate can take Hindi as the language test and English as the medium.')] },
      { key: 'subjects', title: 'Subjects', items: [item('Languages (codes 101-113): English, Hindi.'), item('Domain subjects (23): 301 Accountancy, 322 Physics.'), item('General Aptitude Test: code 501.'), item('Sanskrit (325) is a domain subject.'), item('Domain subject tests follow the NCERT syllabus.')] },
      { key: 'fees', title: 'Fees', items: [item('Fees are paid online.')] },
    ];
    const out = scopeInfoSections(active, 'CUET_UG', sections, [{ code: '322', name: 'Physics' }, { code: '301', name: 'Accountancy' }, { code: '501', name: 'General Aptitude Test' }]);
    expect(out.find((x) => x.key === 'pattern')!.items.map((i) => i.text)).toEqual(['Mode: Computer Based Test (CBT) only.', 'Each test paper lasts 60 minutes.']);
    const subjects = out.find((x) => x.key === 'subjects')!.items.map((i) => i.text);
    expect(subjects[0]).toBe('Papers covered on this site (2): 322 Physics; 501 General Aptitude Test.');
    expect(subjects).toEqual(['Papers covered on this site (2): 322 Physics; 501 General Aptitude Test.', 'General Aptitude Test: code 501.', 'Domain subject tests follow the NCERT syllabus.']);
    expect(out.find((x) => x.key === 'fees')).toEqual(sections[2]);
    expect(scopeInfoSections(everything, 'CUET_UG', sections, [])).toEqual(sections); // unset scope: nothing is changed
  });

  it('government updates: all notices of the exam, UGC notices only when they concern CUET, admissions or counselling; nothing is deleted', async () => {
    const add = (id: string, authority: string, exam: string | null, title: string) =>
      env.DB.prepare(`INSERT INTO gov_notices (id, source_key, source_name, source_url, document_url, is_pdf, title, description, category, exam_code, published_on, verification_status, first_detected_at, last_checked_at, updated_at, authority, content_hash) VALUES (?, 'k', 'n', 'https://x.test/', ?, 1, ?, NULL, 'GENERAL', ?, '2026-11-01', 'PUBLISHED', '2026-11-01', '2026-11-01', '2026-11-01', ?, ?)`).bind(id, `https://x.test/${id}.pdf`, title, exam, authority, id).run();
    await add('n1', 'UGC', null, 'UGC letter regarding Vigilance Awareness Week');
    await add('n2', 'UGC', null, 'UGC letter regarding admission of students through CUET in universities');
    await add('n3', 'NTA', 'CUET_UG', 'Public Notice regarding facility for city selection');
    const before = (await env.DB.prepare('SELECT COUNT(*) AS n FROM gov_notices').first<{ n: number }>())!.n;
    const titles = ((await get('/api/public/notices?limit=100')).json.notices as { title: string }[]).map((x) => x.title);
    expect(titles).toContain('UGC letter regarding admission of students through CUET in universities');
    expect(titles).toContain('Public Notice regarding facility for city selection');
    expect(titles).not.toContain('UGC letter regarding Vigilance Awareness Week');
    const all = ((await get('/api/public/notices?limit=100', everything)).json.notices as { title: string }[]).map((x) => x.title);
    // A hidden notice is not reachable by its own link either; a visible one is.
    const idOf = async (t: string) => (await env.DB.prepare('SELECT id FROM gov_notices WHERE title = ?').bind(t).first<{ id: string }>())!.id;
    expect((await get(`/api/public/notices/${await idOf('UGC letter regarding Vigilance Awareness Week')}`)).status).toBe(404);
    expect((await get(`/api/public/notices/${await idOf('UGC letter regarding Vigilance Awareness Week')}`, everything)).status).toBe(200);
    expect((await get(`/api/public/notices/${await idOf('Public Notice regarding facility for city selection')}`)).status).toBe(200);
    expect(all).toContain('UGC letter regarding Vigilance Awareness Week'); // still stored; only hidden for students in this catalogue
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM gov_notices').first<{ n: number }>())!.n).toBe(before);
  });
});
