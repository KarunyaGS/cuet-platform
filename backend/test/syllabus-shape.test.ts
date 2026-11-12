import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const PDF = 'https://cdnbbsr.s3waas.gov.in/test/shape.pdf';
const note = (ref: string) => [
  { ref, parentRef: null, kind: 'NOTE', label: null, title: 'Note', body: null, position: 0, depth: 1, sourcePage: 2, flags: [] as string[] },
  ...['The Question Paper will have 75 questions.', 'All questions are compulsory.'].map((t, i) => ({ ref: `${ref}-${i}`, parentRef: ref, kind: 'ITEM', label: ['i', 'ii'][i], title: t, body: null, position: i, depth: 2, sourcePage: 2, flags: [] as string[] })),
];

async function importPaper(code: string, name: string, digest: string, nodes: unknown[]) {
  await call('POST', '/api/admin/registry/papers', { exam: 'CUET_PG', year: 2026, papers: [{ code, name, categoryCode: 'ACQP', officialSyllabusUrl: `${PDF}?${code}`, listedOnUrl: 'https://exams.nta.nic.in/cuet-pg/' }] }, ADMIN);
  const r = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `shape-${code}`, exam: 'CUET_PG', year: 2026, paperCode: code,
    source: { kind: 'OFFICIAL_SYLLABUS', title: name, publisher: 'NTA', url: `${PDF}?${code}`, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: digest.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' },
    verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
    nodes, tables: [], figures: [],
  }, ADMIN);
  expect(r.status, JSON.stringify(r.json).slice(0, 300)).toBeLessThan(300);
}

describe('syllabus shape on the subject list', () => {
  it('does not count the question-paper "Note" lines as topics, and counts sections', async () => {
    await importPaper('ZZQP01', 'Flat Darshan', 'a', [
      ...note('n'),
      ...['Metaphysics', 'Logic', 'Ethics', 'Culture'].map((t, i) => ({ ref: `t${i}`, parentRef: null, kind: 'TOPIC', label: String(i + 1), title: t, body: null, position: i + 1, depth: 1, sourcePage: 2, flags: [] as string[] })),
    ]);
    await importPaper('ZZQP02', 'Sectioned Studies', 'b', [
      ...note('n'),
      { ref: 's1', parentRef: null, kind: 'SECTION', label: 'I', title: 'Metaphysics', body: null, position: 1, depth: 1, sourcePage: 2, flags: [] as string[] },
      { ref: 's1t', parentRef: 's1', kind: 'TOPIC', label: '1', title: 'Proofs for the existence of God', body: null, position: 0, depth: 2, sourcePage: 2, flags: [] as string[] },
      { ref: 's2', parentRef: null, kind: 'SECTION', label: 'II', title: 'Epistemology', body: null, position: 2, depth: 1, sourcePage: 2, flags: [] as string[] },
      { ref: 's2t', parentRef: 's2', kind: 'TOPIC', label: '1', title: 'Theories of truth', body: null, position: 0, depth: 2, sourcePage: 2, flags: [] as string[] },
    ]);
    const list = (await call('GET', '/api/learn/exams/CUET_PG/subjects?year=2026')).json;
    expect(list.find((s: { code: string }) => s.code === 'ZZQP01')).toMatchObject({ units: 0, sections: 0, topics: 4 });
    expect(list.find((s: { code: string }) => s.code === 'ZZQP02')).toMatchObject({ units: 0, sections: 2, topics: 2 });
  });

  it('refuses an import that stores syllabus topics inside the Note box or a cover title as a row', async () => {
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_PG', year: 2026, papers: [{ code: 'ZZQP03', name: 'Guarded', categoryCode: 'ACQP', officialSyllabusUrl: `${PDF}?g`, listedOnUrl: 'https://exams.nta.nic.in/cuet-pg/' }] }, ADMIN);
    const send = (nodes: unknown[], d: string) => call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `storage-guard-${d}`, exam: 'CUET_PG', year: 2026, paperCode: 'ZZQP03',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Guarded', publisher: 'NTA', url: `${PDF}?g`, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: d.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, nodes, tables: [], figures: [],
    }, ADMIN);
    const inNote = Array.from({ length: 10 }, (_, i) => ({ ref: `x${i}`, parentRef: 'n', kind: 'ITEM', label: null, title: `Dance history ${i}`, body: null, position: i + 2, depth: 2, sourcePage: 2, flags: [] as string[] }));
    const a = await send([...note('n'), ...inNote], 'c');
    expect(a.status, JSON.stringify(a.json).slice(0, 400)).toBe(422);
    expect(a.json.error.message).toContain('Note box');
    const b = await send([{ ref: 'c', parentRef: null, kind: 'NOTE', label: null, title: 'Guarded Studies', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] }], 'd');
    expect(b.status).toBe(422);
    expect(b.json.error.message).toContain('cover-page title');
  });

  it('searches subjects and syllabus rows, but not the Note lines or hidden syllabi', async () => {
    await importPaper('ZZQP04', 'Searchable Philosophy', 'e', [
      ...note('n'),
      { ref: 'u', parentRef: null, kind: 'UNIT', label: 'I', title: 'Epistemology', body: null, position: 1, depth: 1, sourcePage: 2, flags: [] as string[] },
      { ref: 't', parentRef: 'u', kind: 'TOPIC', label: '1', title: 'Theories of truth', body: 'Correspondence, coherence and pragmatic accounts of knowledge.', position: 0, depth: 2, sourcePage: 2, flags: [] as string[] },
    ]);
    const find = async (q: string, exam = '') => (await call('GET', `/api/learn/search?q=${encodeURIComponent(q)}${exam ? `&exam=${exam}` : ''}`)).json;
    expect((await find('searchable')).subjects).toEqual([expect.objectContaining({ code: 'ZZQP04', exam: 'CUET_PG', available: true })]);
    const byTitle = await find('theories truth');
    expect(byTitle.topics.filter((t: { paperCode: string }) => t.paperCode === 'ZZQP04')).toEqual([expect.objectContaining({ title: 'Theories of truth', parentTitle: 'Epistemology', snippet: null })]);
    const byText = await find('pragmatic');
    expect(byText.topics[0]).toMatchObject({ title: 'Theories of truth' });
    expect(byText.topics[0].snippet).toContain('pragmatic');
    expect((await find('compulsory')).topics).toEqual([]); // Note lines are not syllabus
    expect((await find('truth', 'CUET_UG')).topics).toEqual([]); // exam filter
    expect((await find('a')).topics).toEqual([]); // too short
    expect((await find('100%_')).topics).toEqual([]); // wildcards are literal
    expect((await call('GET', '/api/learn/search?q=x&exam=NEET')).status).toBe(422);
  });
});
