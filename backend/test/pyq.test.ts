import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, bindings: unknown = env) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, bindings as typeof env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const doc = (over: Record<string, unknown>) => ({
  key: 'x', exam: 'CUET_UG', year: 2025, kind: 'QUESTION_PAPER', classification: 'THIRD_PARTY_COPY', official: false, section: 'DOMAIN', subjectCode: '322', subjectName: 'Physics', subjectSlug: 'physics', listedAs: 'Physics',
  title: 'CUET UG 2025 Question Paper Physics', examDate: null, shift: null, language: 'English', sourceSite: 'AglaSem', sourcePageUrl: 'https://admission.example.com/cuet-2025-question-paper/',
  documentPageUrl: 'https://docs.example.com/view/abc', fileUrl: 'https://cdn.example.com/abc.pdf', fileHost: 'cdn.example.com', pages: 42, bytes: 6037260, working: true, httpStatus: 206, embeddable: false,
  sourceClaim: 'The source page says "Published by NTA"', note: 'A copy hosted by AglaSem.', alternatives: [], checkedOn: '2026-11-13', ...over,
});
const index = (documents: unknown[]) => ({ schema: 'cuet-pyq-index/1', exam: 'CUET_UG', builtOn: '2026-11-13', documents });

const SAMPLE = [
  doc({ key: 'aglasem:phy-2025' }),
  doc({ key: 'nta:paper:phy-2025', sourceSite: 'NTA', classification: 'OFFICIAL', official: true, title: 'CUET (UG) 2025 question paper: Physics', documentPageUrl: null, fileUrl: 'https://nta.ac.in/Download/ExamPaper/Paper_1.pdf', fileHost: 'nta.ac.in', examDate: '2025-05-16', shift: 'Shift 1' }),
  doc({ key: 'adda247:phy', sourceSite: 'Adda247', classification: 'MEMORY_BASED', title: 'CUET (UG) 2025 memory-based paper: Physics', documentPageUrl: null, fileUrl: 'https://www.adda247.example/physics.pdf', fileHost: 'www.adda247.example', working: false, httpStatus: -1, examDate: '2025-05-16', shift: 'Shift 1' }),
  doc({ key: 'aglasem:dead', title: 'A paper whose file no longer opens', working: false, httpStatus: 404 }),
  doc({ key: 'aglasem:eng-2025', subjectCode: '101', subjectName: 'English', subjectSlug: 'english', section: 'LANGUAGE', title: 'CUET UG 2025 Question Paper English' }),
  doc({ key: 'aglasem:phy-2024', year: 2024, title: 'CUET UG 2024 Question Paper Physics' }),
  // Stored, never shown: a bilingual booklet, a paper in another language, and a paper whose language was not verified.
  doc({ key: 'nta:paper:phy-2025-bilingual', sourceSite: 'NTA', classification: 'OFFICIAL', official: true, title: 'Physics booklet, English and Hindi', documentPageUrl: null, fileUrl: 'https://nta.ac.in/Download/ExamPaper/Paper_2.pdf', fileHost: 'nta.ac.in', language: 'English + Hindi' }),
  doc({ key: 'selfstudys:phy-2025-hindi', sourceSite: 'SelfStudys', title: 'Physics, Hindi medium', language: 'Hindi' }),
  doc({ key: 'aglasem:phy-2025-unknown', title: 'Physics, language not verified', language: null }),
  doc({ key: 'aglasem:hindi-2025', subjectCode: '102', subjectName: 'Hindi', subjectSlug: 'hindi', section: 'LANGUAGE', title: 'CUET UG 2025 Question Paper Hindi', language: 'Hindi' }),
  doc({ key: 'aglasem:phy-sample-hindi', kind: 'SAMPLE_PAPER', classification: 'SAMPLE', year: null, title: 'Physics practice paper in Hindi', language: 'Hindi' }),
  doc({ key: 'aglasem:phy-sample', kind: 'SAMPLE_PAPER', classification: 'SAMPLE', year: null, title: 'Older CUET Physics practice paper' }),
  doc({ key: 'aglasem:key-2025', kind: 'ANSWER_KEY', section: null, subjectCode: null, subjectName: null, subjectSlug: null, title: 'CUET UG 2025 Answer Key (copy)', replacedBy: 'nta:final-key:2025' }),
  doc({
    key: 'nta:final-key:2025', kind: 'ANSWER_KEY', classification: 'OFFICIAL', official: true, section: null, subjectCode: null, subjectName: null, subjectSlug: null, sourceSite: 'NTA', title: 'CUET (UG) 2025 : Final Answer Keys',
    documentPageUrl: null, fileUrl: 'https://cdnbbsr.s3waas.gov.in/key-2025.pdf', fileHost: 'cdnbbsr.s3waas.gov.in', embeddable: true, pages: 324,
    sessions: { '322': [{ date: '2025-05-16', shift: 'Shift 1', keyPage: 40 }, { date: '2025-05-21', shift: 'Shift 2', keyPage: 77 }], '101': [{ date: '2025-05-13', shift: 'Shift 1', keyPage: 1 }] },
    alternatives: [{ site: 'AglaSem', url: 'https://docs.example.com/view/key', title: 'CUET UG 2025 Answer Key (copy)' }],
  }),
];

describe('previous-year papers index', () => {
  it('imports the index, and lists only years and subjects that have a paper', async () => {
    expect((await call('POST', '/api/admin/pyq-index', index(SAMPLE))).status).toBe(401);
    const imp = await call('POST', '/api/admin/pyq-index', index(SAMPLE), ADMIN);
    expect(imp.json).toEqual({ exam: 'CUET_UG', stored: 14, shown: 7, checkedWorking: 6, notMachineChecked: 1, hiddenNotEnglish: 5, notWorking: 1, replacedByOfficial: 1 });

    const tree = (await call('GET', '/api/learn/pyq?exam=CUET_UG')).json;
    expect(tree.total).toBe(7);
    expect(tree.years.map((y: { year: number; papers: number; answerKeys: number }) => [y.year, y.papers, y.answerKeys])).toEqual([[2025, 4, 1], [2024, 1, 0]]);
    // Languages first. Not counted: the paper whose file does not open, and every paper not verified as English-medium
    // (so Hindi, which has only a Hindi paper, is not a subject here at all).
    expect(tree.years[0].subjects).toEqual([
      { slug: 'english', code: '101', name: 'English', section: 'LANGUAGE', papers: 1, samplePapers: 0 },
      { slug: 'physics', code: '322', name: 'Physics', section: 'DOMAIN', papers: 3, samplePapers: 1 },
    ]);
    expect((await call('GET', '/api/learn/pyq?exam=CUET_PG')).json).toMatchObject({ total: 0, years: [] });
    expect((await call('GET', '/api/learn/pyq?exam=JEE')).status).toBe(400);
  });

  it('gives a subject its papers with honest labels, the year\'s answer key with that subject\'s sessions, and sample papers', async () => {
    await call('POST', '/api/admin/pyq-index', index(SAMPLE), ADMIN);
    const s = (await call('GET', '/api/learn/pyq/2025/physics')).json;
    expect(s.subject).toEqual({ slug: 'physics', code: '322', name: 'Physics', section: 'DOMAIN' });
    expect(s.papers).toHaveLength(3);
    expect(s.papers.some((p: { title: string }) => p.title.includes('no longer opens'))).toBe(false);
    const by = (site: string) => s.papers.find((p: { sourceSite: string }) => p.sourceSite === site);
    // NTA's own file: official, with the date and shift it prints. Its host does not let other sites show it, so it opens on NTA's site.
    expect(by('NTA')).toMatchObject({ classification: 'OFFICIAL', official: true, examDate: '2025-05-16', shift: 'Shift 1', viewer: 'SOURCE', fileUrl: null, openUrl: 'https://nta.ac.in/Download/ExamPaper/Paper_1.pdf', linkChecked: true });
    // A third-party copy is never called official, has no invented date or shift, and opens on the source's page for it.
    expect(by('AglaSem')).toMatchObject({ classification: 'THIRD_PARTY_COPY', official: false, examDate: null, shift: null, language: 'English', viewer: 'SOURCE', fileUrl: null, openUrl: 'https://docs.example.com/view/abc' });
    // A link a site's robots rules did not let us check is shown, and says so.
    expect(by('Adda247')).toMatchObject({ classification: 'MEMORY_BASED', linkChecked: false, openUrl: 'https://www.adda247.example/physics.pdf' });
    // Only English-medium papers: the bilingual booklet, the Hindi-medium paper and the unverified one are not listed.
    expect(s.papers.map((p: { language: string }) => p.language)).toEqual(['English', 'English', 'English']);
    expect(s.papers.some((p: { title: string }) => /English and Hindi|Hindi medium|not verified/.test(p.title))).toBe(false);
    // NTA's own file is the primary source: it is listed first, ahead of an undated third-party copy.
    expect(s.papers.map((p: { sourceSite: string }) => p.sourceSite)).toEqual(['NTA', 'AglaSem', 'Adda247']);
    expect((await call('GET', '/api/learn/pyq/2025/hindi')).status).toBe(404);
    // Every paper has somewhere to open.
    expect(s.papers.every((p: { openUrl: string }) => /^https:\/\//.test(p.openUrl))).toBe(true);

    // The answer key: NTA's own, not the third-party copy it replaces; this subject's two sessions with their pages.
    expect(s.answerKeys).toHaveLength(1);
    expect(s.answerKeys[0]).toMatchObject({ classification: 'OFFICIAL', viewer: 'IN_APP', fileUrl: 'https://cdnbbsr.s3waas.gov.in/key-2025.pdf', sessions: [{ date: '2025-05-16', shift: 'Shift 1', page: 40 }, { date: '2025-05-21', shift: 'Shift 2', page: 77 }] });
    expect(s.answerKeys[0].alternatives).toEqual([{ site: 'AglaSem', url: 'https://docs.example.com/view/key', title: 'CUET UG 2025 Answer Key (copy)' }]);
    expect(s.samplePapers.map((p: { classification: string; year: number | null; language: string }) => [p.classification, p.year, p.language])).toEqual([['SAMPLE', null, 'English']]);

    expect((await call('GET', '/api/learn/pyq/2025/english')).json.answerKeys[0].sessions).toEqual([{ date: '2025-05-13', shift: 'Shift 1', page: 1 }]);
    expect((await call('GET', '/api/learn/pyq/2024/physics')).json).toMatchObject({ papers: [{ title: 'CUET UG 2024 Question Paper Physics' }], answerKeys: [] });
    expect((await call('GET', '/api/learn/pyq/2026/physics')).status).toBe(404); // no paper, so no page
    expect((await call('GET', '/api/learn/pyq/2025/chemistry')).status).toBe(404);
    expect((await call('GET', '/api/learn/pyq/abc/physics')).status).toBe(422);
  });

  it('shows a paper inside the platform only when its host allows it and the setting is on', async () => {
    await call('POST', '/api/admin/pyq-index', index(SAMPLE), ADMIN);
    const s = (await call('GET', '/api/learn/pyq/2025/physics')).json;
    const key = s.answerKeys[0];
    const copy = s.papers.find((p: { sourceSite: string }) => p.sourceSite === 'AglaSem');
    expect((await call('GET', `/api/learn/pyq/documents/${key.id}`)).json).toMatchObject({ viewer: 'IN_APP', fileUrl: 'https://cdnbbsr.s3waas.gov.in/key-2025.pdf', exam: 'CUET_UG' });
    expect((await call('GET', `/api/learn/pyq/documents/${copy.id}`)).json).toMatchObject({ viewer: 'SOURCE', fileUrl: null, openUrl: 'https://docs.example.com/view/abc' });
    // With the setting off, even an embeddable file opens on its source, and no file address is handed to the viewer.
    const off = { ...env, PYQ_IN_APP_VIEWING: 'off' };
    expect((await call('GET', `/api/learn/pyq/documents/${key.id}`, undefined, {}, off)).json).toMatchObject({ viewer: 'SOURCE', fileUrl: null, openUrl: 'https://cdnbbsr.s3waas.gov.in/key-2025.pdf' });
    expect((await call('GET', '/api/learn/pyq/2025/physics', undefined, {}, off)).json.answerKeys[0].viewer).toBe('SOURCE');
    // A document that does not open, or that an official file replaces, has no page.
    const hidden = await env.DB.prepare(`SELECT id FROM pyq_documents WHERE key IN ('aglasem:dead', 'aglasem:key-2025', 'nta:paper:phy-2025-bilingual', 'selfstudys:phy-2025-hindi', 'aglasem:phy-2025-unknown', 'aglasem:hindi-2025')`).all<{ id: string }>();
    expect(hidden.results).toHaveLength(6); // all still stored
    expect((await env.DB.prepare(`SELECT language FROM pyq_documents WHERE key = 'nta:paper:phy-2025-bilingual'`).first<{ language: string }>())!.language).toBe('English + Hindi');
    for (const h of hidden.results) expect((await call('GET', `/api/learn/pyq/documents/${h.id}`)).status).toBe(404);
    expect((await call('GET', '/api/learn/pyq/documents/nope')).status).toBe(404);
  });

  it('refuses a bad index, and a new import replaces the old one without leftovers', async () => {
    expect((await call('POST', '/api/admin/pyq-index', index([doc({ key: 'a', fileUrl: 'http://insecure.example.com/a.pdf' })]), ADMIN)).status).toBe(400);
    expect((await call('POST', '/api/admin/pyq-index', index([doc({ key: 'a', classification: 'GENUINE' })]), ADMIN)).status).toBe(400);
    expect((await call('POST', '/api/admin/pyq-index', { ...index([doc({ key: 'a' })]), schema: 'other/1' }, ADMIN)).status).toBe(400);
    expect((await call('POST', '/api/admin/pyq-index', index([doc({ key: 'a' }), doc({ key: 'a' })]), ADMIN)).status).toBeGreaterThanOrEqual(400);
    await call('POST', '/api/admin/pyq-index', index(SAMPLE), ADMIN);
    const again = await call('POST', '/api/admin/pyq-index', index([doc({ key: 'only-one' })]), ADMIN);
    expect(again.json).toMatchObject({ stored: 1, shown: 1 });
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM pyq_documents').first<{ n: number }>())!.n).toBe(1);
    expect((await call('GET', '/api/learn/pyq')).json.years.map((y: { year: number }) => y.year)).toEqual([2025]);
  });

  it('with the English + Hindi setting on, NTA\u2019s bilingual papers are shown too, labelled as bilingual; nothing else changes', async () => {
    await call('POST', '/api/admin/pyq-index', index(SAMPLE), ADMIN);
    const on = { ...env, PYQ_ENGLISH_HINDI: 'on' };
    const strict = (await call('GET', '/api/learn/pyq/2025/physics')).json;
    const wide = (await call('GET', '/api/learn/pyq/2025/physics', undefined, {}, on)).json;
    expect(strict.papers.map((p: { language: string }) => p.language)).toEqual(['English', 'English', 'English']);
    expect(wide.papers.map((p: { language: string }) => p.language).sort()).toEqual(['English', 'English', 'English', 'English + Hindi']);
    expect(wide.papers.find((p: { language: string }) => p.language === 'English + Hindi').title).toBe('Physics booklet, English and Hindi');
    // Hindi-medium and unverified papers are hidden either way.
    expect(wide.papers.some((p: { title: string }) => /Hindi medium|not verified/.test(p.title))).toBe(false);
    expect((await call('GET', '/api/learn/pyq/2025/hindi', undefined, {}, on)).status).toBe(404);
    expect((await call('GET', '/api/learn/pyq', undefined, {}, on)).json.years[0].subjects.find((x: { slug: string }) => x.slug === 'physics').papers).toBe(4);
    const bilingual = await env.DB.prepare(`SELECT id FROM pyq_documents WHERE key = 'nta:paper:phy-2025-bilingual'`).first<{ id: string }>();
    expect((await call('GET', `/api/learn/pyq/documents/${bilingual!.id}`)).status).toBe(404);
    expect((await call('GET', `/api/learn/pyq/documents/${bilingual!.id}`, undefined, {}, on)).json).toMatchObject({ language: 'English + Hindi', classification: 'OFFICIAL' });
  });
});
