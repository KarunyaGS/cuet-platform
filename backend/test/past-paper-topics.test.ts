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
const src = (d: string, t: string) => ({ title: t, publisher: 'Test Board', url: `https://example.test/papers/${d}.pdf`, retrievedAt: '2026-11-18T00:00:00.000Z', sha256: d.repeat(64).slice(0, 64), byteSize: 1000, mimeType: 'application/pdf', pageCount: 6 });

describe('previous-year papers: topics and deferred questions', () => {
  it('maps questions to syllabus topics, accounts for deferred questions, blocks publishing until they are imported, and keeps drafts out of practice', async () => {
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '914', name: 'Topic Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/topic-studies.pdf', listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `pp-topics-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: '914',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Topic Studies (914)', publisher: 'NTA', url: 'https://cdnbbsr.s3waas.gov.in/test/topic-studies.pdf', retrievedAt: '2026-11-18T00:00:00.000Z', sha256: '9'.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 1 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'TEST', metrics: {} },
      nodes: [{ ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Unit one', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] }],
      tables: [], figures: [],
    }, ADMIN);
    expect(imp.status).toBeLessThan(300);
    const topic = (await env.DB.prepare("SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = 'UNIT'").bind(imp.json.syllabusVersionId).first<{ id: string }>())!.id;
    const q = (position: number, key: number) => ({
      position, type: 'MCQ_SINGLE', stem: `Sample ${position}: which option does the test key mark as correct?`, sourcePage: 2, topicNodeId: topic,
      options: ['One', 'Two', 'Three', 'Four'].map((t, i) => ({ label: 'ABCD'[i], text: `${t} for sample ${position}` })), correctOptionPositions: [key], officialKey: [key],
    });
    const pack = {
      schema: 'cuet-past-paper/1', exam: 'CUET_UG', year: 2024, subjectCode: '914', subjectName: 'Topic Studies', examDate: '2024-05-16', language: 'en', title: 'Topic Studies test paper',
      rules: { questionsInPaper: 4, durationMinutes: 10, marksCorrect: 5, marksIncorrect: -1 }, usagePermission: 'OWNED_ORIGINAL',
      questionPaperSource: src('a', 'Paper'), answerKeySource: src('b', 'Key'), keyVersion: 'FINAL',
      deferred: [{ position: 4, sourcePage: 3, reason: 'figure', topicNodeId: topic }],
      questions: [q(1, 2), q(2, 3), q(3, 1)],
    };
    // A topic from another subject is refused; an unaccounted question is refused.
    expect((await call('POST', '/api/admin/past-papers?dryRun=1', { ...pack, questions: [{ ...q(1, 2), topicNodeId: 'cn_nope' }, q(2, 3), q(3, 1)] }, ADMIN)).status).toBe(422);
    expect((await call('POST', '/api/admin/past-papers?dryRun=1', { ...pack, deferred: [] }, ADMIN)).status).toBe(422);
    const done = await call('POST', '/api/admin/past-papers', pack, ADMIN);
    expect(done.json).toMatchObject({ outcome: 'CREATED', questions: 3 });
    expect(done.json.warnings.join(' ')).toMatch(/deferred/);
    const rows = await env.DB.prepare("SELECT COUNT(*) AS n FROM question_topics WHERE curriculum_node_id = ? AND question_id IN (SELECT id FROM questions WHERE origin = 'PAST_PAPER')").bind(topic).first<{ n: number }>();
    expect(rows!.n).toBe(3);
    const paper = await env.DB.prepare("SELECT id, notes FROM past_papers WHERE subject_code = '914'").first<{ id: string; notes: string }>();
    expect(paper!.notes).toMatch(/Q4 \(figure\)/);

    // The drafts are linked to a topic but still invisible to students, even with local preview on.
    const student = await call('POST', '/api/auth/register', { email: 'pp-topics@example.test', password: 'correct-horse-battery', displayName: 'S' });
    expect(student.status).toBeLessThan(300);
    const login = await call('POST', '/api/auth/login', { email: 'pp-topics@example.test', password: 'correct-horse-battery' });
    const auth = { cookie: login.cookie };
    expect((await call('GET', `/api/learn/question-counts?nodeIds=${topic}`, undefined, auth)).json.total).toBe(0);
    expect((await call('POST', '/api/student/practice', { mode: 'PRACTICE', nodeIds: [topic] }, auth)).status).toBe(404);

    // Publishing is blocked for the question that was never imported, as well as for the unverified ones.
    await call('POST', '/api/admin/users/roles', { email: 'pp-topics@example.test', role: 'SUPER_ADMIN' }, ADMIN);
    const blockers = (await call('POST', `/api/console/past-papers/${paper!.id}/status`, { action: 'PUBLISH' }, auth)).json.error.details.blockers as string[];
    expect(blockers.join(' | ')).toMatch(/1 of the paper's 4 questions are not imported yet/);
  });
  it('stores question figures and option images in the media store, links them to the source page, and shows them only after the paper is published and the figures are verified', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const up = await app.request('/api/admin/files/media', { method: 'PUT', headers: { 'x-admin-token': 'test-admin-token', 'content-type': 'image/png' }, body: png }, env, createExecutionContext());
    expect(up.status).toBe(200);
    const stored = (await up.json()) as { r2Key: string };
    const sha = stored.r2Key.slice(6, 70);
    const register = (key: string) => call('PUT', `/api/admin/content/media/${key}`, { kind: 'IMAGE', r2Key: stored.r2Key, sha256: sha, mimeType: 'image/png', byteSize: png.length, width: 1, height: 1, altText: 'A test figure showing a single dot on a plain background', caption: null, longDescription: null, curriculumNodeId: null, origin: 'LICENSED', usagePermissionId: 'perm_owned', attribution: 'Cut from a test paper, page 2' }, ADMIN);
    const figure = await register('pyq.test.fig1');
    expect(figure.status).toBe(200);
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '915', name: 'Figure Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/figure-studies.pdf', listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const q = (position: number, over: Record<string, unknown> = {}) => ({
      position, type: 'DIAGRAM_BASED', stem: `Sample ${position}: which option does the test key mark as correct for the figure?`, sourcePage: 2,
      options: ['One', 'Two', 'Three', 'Four'].map((t, i) => ({ label: 'ABCD'[i], text: `${t} for sample ${position}` })), correctOptionPositions: [2], officialKey: [2], ...over,
    });
    const pack = {
      schema: 'cuet-past-paper/1', exam: 'CUET_UG', year: 2024, subjectCode: '915', subjectName: 'Figure Studies', examDate: '2024-05-16', language: 'en', title: 'Figure Studies test paper',
      rules: { questionsInPaper: 2, durationMinutes: 10, marksCorrect: 5, marksIncorrect: -1 }, usagePermission: 'OWNED_ORIGINAL', questionPaperSource: src('c', 'Paper'), answerKeySource: src('d', 'Key'), keyVersion: 'FINAL',
      questions: [
        q(1, { figure: { mediaKey: 'pyq.test.fig1' } }),
        q(2, { type: 'MCQ_SINGLE', options: ['Graph 1', 'Graph 2', 'Graph 3', 'Graph 4'].map((t, i) => ({ label: 'ABCD'[i], text: t, figure: { mediaKey: 'pyq.test.fig1' } })) }),
      ],
    };
    // A figure that was never uploaded is refused (a dry run only warns, because the import uploads it first).
    expect((await call('POST', '/api/admin/past-papers', { ...pack, questions: [q(1, { figure: { mediaKey: 'pyq.test.nope' } }), pack.questions[1]] }, ADMIN)).status).toBe(422);
    const done = await call('POST', '/api/admin/past-papers', pack, ADMIN);
    expect(done.json).toMatchObject({ outcome: 'CREATED', questions: 2 });
    const mediaId = (await env.DB.prepare("SELECT id FROM media_assets WHERE external_key = 'pyq.test.fig1'").first<{ id: string }>())!.id;
    const row = await env.DB.prepare("SELECT structure_json FROM questions WHERE external_key LIKE 'pyq:cuet_ug:2024:915:%:1'").first<{ structure_json: string }>();
    expect(JSON.parse(row!.structure_json)).toEqual({ mediaAssetId: mediaId });
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM question_options WHERE media_asset_id = ?").bind(mediaId).first<{ n: number }>())!.n).toBe(4);
    // The figure remembers the source document and the page.
    const m = await env.DB.prepare('SELECT source_document_id, source_page, status, verification FROM media_assets WHERE id = ?').bind(mediaId).first<{ source_document_id: string; source_page: number; status: string; verification: string }>();
    expect(m).toMatchObject({ source_page: 2, status: 'DRAFT', verification: 'UNVERIFIED' });
    expect(m!.source_document_id).toBeTruthy();
    // Draft figures of an official paper are never served, even with local preview on.
    expect((await call('GET', `/api/learn/media/${mediaId}`)).status).toBe(404);
    // Publishing is blocked by the unverified figure as well.
    const paper = await env.DB.prepare("SELECT id FROM past_papers WHERE subject_code = '915'").first<{ id: string }>();
    await call('POST', '/api/auth/register', { email: 'pp-fig@example.test', password: 'correct-horse-battery', displayName: 'F' });
    await call('POST', '/api/admin/users/roles', { email: 'pp-fig@example.test', role: 'SUPER_ADMIN' }, ADMIN);
    const login = await call('POST', '/api/auth/login', { email: 'pp-fig@example.test', password: 'correct-horse-battery' });
    const blockers = (await call('POST', `/api/console/past-papers/${paper!.id}/status`, { action: 'PUBLISH' }, { cookie: login.cookie })).json.error.details.blockers as string[];
    expect(blockers.join(' | ')).toMatch(/1 of 1 figures are not yet verified/);
    // Importing the same pack again changes nothing about the stored figure.
    expect((await call('POST', '/api/admin/past-papers', pack, ADMIN)).json.outcome).toBe('REPLACED');
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM media_assets WHERE external_key = 'pyq.test.fig1'").first<{ n: number }>())!.n).toBe(1);
  });
});
