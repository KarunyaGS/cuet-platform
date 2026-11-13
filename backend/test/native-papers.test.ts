import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token' };
const sha = (c: string) => c.repeat(64);

async function raw(method: string, path: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}, bindings: unknown = env) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: init.headers, body: init.body }, bindings as typeof env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, bindings: unknown = env) {
  const res = await raw(method, path, { body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }, bindings);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const PDF = new TextEncoder().encode('%PDF-1.4\n% a small stand-in for a generated paper\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n');

async function seed(tag: string, digest: string) {
  const url = `https://cdnbbsr.s3waas.gov.in/test/native-${tag}.pdf`;
  await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: url, listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
  const imp = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `native-test-${tag}`, exam: 'CUET_UG', year: 2026, paperCode: '322',
    source: { kind: 'OFFICIAL_SYLLABUS', title: 'Physics (322)', publisher: 'NTA', url, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: sha(digest), byteSize: 10, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} },
    nodes: [
      { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Electrostatics', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
      { ref: 't1', parentRef: 'u1', kind: 'SUBTOPIC', label: null, title: "Coulomb's law", body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
      { ref: 'u2', parentRef: null, kind: 'UNIT', label: '2', title: 'Optics', body: null, position: 1, depth: 1, sourcePage: 2, flags: [] as string[] },
      { ref: 't2', parentRef: 'u2', kind: 'SUBTOPIC', label: null, title: 'Refraction', body: null, position: 0, depth: 2, sourcePage: 2, flags: [] as string[] },
    ],
    tables: [], figures: [],
  }, ADMIN);
  if (!imp.json.syllabusVersionId) throw new Error(JSON.stringify(imp.json).slice(0, 500));
  const node = async (title: string) => (await env.DB.prepare('SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND title = ?').bind(imp.json.syllabusVersionId, title).first<{ id: string }>())!.id;
  const topics = [await node("Coulomb's law"), await node('Refraction')];
  const ids: string[] = [];
  for (let i = 0; i < 12; i++) {
    const q = await call('POST', '/api/admin/questions', {
      testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `(${tag}) Question ${i + 1}: which law gives $F = k\\frac{q_1 q_2}{r^2}$?`, difficulty: 'EASY', origin: 'AUTHORED', usagePermissionId: 'perm_owned', isDemonstration: false,
      options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }, { label: 'C', text: "Hooke's law" }, { label: 'D', text: "Snell's law" }],
      answer: { correctOptionPositions: [2] }, explanation: { body: "Coulomb's law." }, topicNodeIds: [topics[i % 2]],
    }, ADMIN);
    if (q.status !== 201) throw new Error(JSON.stringify(q.json).slice(0, 400));
    ids.push(q.json.id);
  }
  return { paperId: imp.json.testPaperId as string, ids };
}

const indexDoc = { schema: 'cuet-pyq-index/1', exam: 'CUET_UG', builtOn: '2026-11-13', documents: [{
  key: 'selfstudys:phy', exam: 'CUET_UG', year: 2025, kind: 'QUESTION_PAPER', classification: 'THIRD_PARTY_COPY', official: false, section: 'DOMAIN', subjectCode: '322', subjectName: 'Physics', subjectSlug: 'physics', listedAs: 'Physics',
  title: 'CUET UG - Physics - 2025', examDate: null, shift: null, language: 'English', sourceSite: 'SelfStudys', sourcePageUrl: 'https://www.example.com/list', documentPageUrl: 'https://www.example.com/paper', fileUrl: 'https://www.example.com/paper',
  fileHost: 'www.example.com', pages: null, bytes: null, working: true, httpStatus: 200, embeddable: false, sourceClaim: null, note: 'A copy.', alternatives: [], checkedOn: '2026-11-13',
}] };

describe('native CUET Prep documents', () => {
  it('drafts a practice paper only from our own questions, spread over the units, with the answer key kept apart', async () => {
    const s = await seed('draft', 'a');
    expect((await call('GET', `/api/admin/native-papers/draft?paperId=${s.paperId}&count=10`)).status).toBe(401);
    const d = (await call('GET', `/api/admin/native-papers/draft?paperId=${s.paperId}&count=10`, undefined, ADMIN)).json;
    expect(d).toMatchObject({ schema: 'cuet-native-paper/1', kind: 'PRACTICE_PAPER', exam: 'CUET_UG', subjectCode: '322', subjectName: 'Physics', set: 1, language: 'English', reviewState: 'UNREVIEWED', reviewedQuestions: 0, rights: { basis: 'OWNED_ORIGINAL' } });
    expect(d.title).toBe('CUET Prep practice paper: Physics, set 1');
    expect(d.units).toEqual([{ title: 'Electrostatics', questions: 5 }, { title: 'Optics', questions: 5 }]);
    expect(d.questions).toHaveLength(10);
    expect(d.questions.map((q: { number: number }) => q.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(d.questions.map((q: { id: string }) => q.id)).size).toBe(10);
    expect(d.questions.every((q: { options: { label: string }[]; stem: string }) => q.options.map((o) => o.label).join('') === 'ABCD' && q.stem.includes('$F = k'))).toBe(true);
    // The questions carry no answers; the key is a separate list.
    expect(JSON.stringify(d.questions)).not.toMatch(/correct|explanation/i);
    expect(d.answerKey).toHaveLength(10);
    expect(d.answerKey[0]).toEqual({ number: 1, correct: ['B'] });
    // A second set needs different questions; there are not enough for it, and it says so instead of repeating any.
    const two = await call('GET', `/api/admin/native-papers/draft?paperId=${s.paperId}&count=10&set=2`, undefined, ADMIN);
    expect(two.status).toBe(409);
    expect(two.json.error.code).toBe('NOT_ENOUGH_QUESTIONS');
    expect((await call('GET', '/api/admin/native-papers/draft?paperId=nope&count=10', undefined, ADMIN)).status).toBe(404);
  });

  it('records a generated PDF only with confirmed rights, and serves it to the viewer from our own storage', async () => {
    const s = await seed('store', 'b');
    await call('POST', '/api/admin/pyq-index', indexDoc, ADMIN);
    const d = (await call('GET', `/api/admin/native-papers/draft?paperId=${s.paperId}&count=10`, undefined, ADMIN)).json;
    const up = await raw('PUT', '/api/admin/files/media', { body: PDF, headers: { ...ADMIN, 'content-type': 'application/pdf' } });
    const stored = (await up.json()) as { r2Key: string };
    const base = { key: d.key, exam: 'CUET_UG', subjectCode: '322', subjectName: 'Physics', title: d.title, language: 'English', r2Key: stored.r2Key, pages: 3, reviewState: d.reviewState, rights: d.rights, questionIds: d.questions.map((q: { id: string }) => q.id) };

    expect((await call('POST', '/api/admin/native-papers', base)).status).toBe(401);
    // No file in storage: refused.
    expect((await call('POST', '/api/admin/native-papers', { ...base, r2Key: `media/${sha('0')}.pdf` }, ADMIN)).status).toBe(422);
    // "Our own" is checked: a question that is not ours stops the document.
    const notOurs = await call('POST', '/api/admin/native-papers', { ...base, questionIds: [...base.questionIds, 'q_from_somewhere_else'] }, ADMIN);
    expect(notOurs.status).toBe(409);
    expect(notOurs.json.error.code).toBe('RIGHTS_NOT_CONFIRMED');
    // Third-party content needs the permission itself on record.
    expect((await call('POST', '/api/admin/native-papers', { ...base, rights: { basis: 'PERMISSION_ON_RECORD', statement: 'Reproduced with the permission of the exam body.' } }, ADMIN)).status).toBe(400);
    expect((await call('POST', '/api/admin/native-papers', { ...base, language: 'Hindi' }, ADMIN)).status).toBe(400);
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM pyq_documents WHERE r2_key IS NOT NULL').first<{ n: number }>())!.n).toBe(0);

    const made = await call('POST', '/api/admin/native-papers', base, ADMIN);
    expect(made.status).toBe(201);
    expect(made.json).toMatchObject({ key: d.key, created: true, pages: 3, reviewState: 'UNREVIEWED', bytes: PDF.byteLength });
    expect((await call('POST', '/api/admin/native-papers', base, ADMIN)).json).toMatchObject({ id: made.json.id, created: false });
    const row = await env.DB.prepare('SELECT rights_basis, r2_key, review_state, subject_slug, classification, kind, language FROM pyq_documents WHERE id = ?').bind(made.json.id).first<Record<string, string>>();
    expect(row).toMatchObject({ r2_key: stored.r2Key, review_state: 'UNREVIEWED', subject_slug: 'physics', classification: 'CUET_PREP_ORIGINAL', kind: 'PRACTICE_PAPER', language: 'English' });
    expect(row!.rights_basis).toMatch(/^Own content\./);

    // The student sees it with the subject's papers, as our own practice paper, opening in the viewer here.
    const subject = (await call('GET', '/api/learn/pyq/2025/physics')).json;
    expect(subject.papers).toHaveLength(1); // the previous-year paper stays what it was
    expect(subject.practicePapers).toHaveLength(1);
    const p = subject.practicePapers[0];
    expect(p).toMatchObject({ id: made.json.id, kind: 'PRACTICE_PAPER', classification: 'CUET_PREP_ORIGINAL', official: false, year: null, language: 'English', native: true, viewer: 'IN_APP', unreviewed: true, sourceSite: 'CUET Prep', pages: 3,
      fileUrl: `/api/learn/pyq/documents/${made.json.id}/file`, downloadUrl: `/api/learn/pyq/documents/${made.json.id}/file?download=1` });
    expect(p.note).toMatch(/not a previous-year paper/);

    // The file itself, whole, by byte range (as the viewer asks), and as a download.
    const whole = await raw('GET', p.fileUrl);
    expect(whole.status).toBe(200);
    expect(whole.headers.get('content-type')).toBe('application/pdf');
    expect(whole.headers.get('accept-ranges')).toBe('bytes');
    expect(whole.headers.get('content-disposition')).toMatch(/^inline; filename="CUET Prep practice paper Physics, set 1\.pdf"$/);
    expect(new Uint8Array(await whole.arrayBuffer())).toEqual(PDF);
    const part = await raw('GET', p.fileUrl, { headers: { range: 'bytes=0-4' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(`bytes 0-4/${PDF.byteLength}`);
    expect(await part.text()).toBe('%PDF-');
    const tail = await raw('GET', p.fileUrl, { headers: { range: `bytes=${PDF.byteLength - 6}-` } });
    expect(await tail.text()).toBe('%%EOF\n');
    expect((await raw('GET', p.downloadUrl)).headers.get('content-disposition')).toMatch(/^attachment; filename=/);
    // A document held on another website has no file with us.
    expect((await raw('GET', `/api/learn/pyq/documents/${subject.papers[0].id}/file`)).status).toBe(404);

    // Rebuilding the index of public papers does not remove our own document.
    await call('POST', '/api/admin/pyq-index', indexDoc, ADMIN);
    expect((await call('GET', '/api/learn/pyq/2025/physics')).json.practicePapers.map((x: { id: string }) => x.id)).toEqual([made.json.id]);

    // Where draft content is not shown, an unreviewed paper is not shown either: no row, no page, no file.
    const live = { ...env, CONTENT_PREVIEW: 'false' };
    expect((await call('GET', '/api/learn/pyq/2025/physics', undefined, {}, live)).json.practicePapers).toEqual([]);
    expect((await call('GET', `/api/learn/pyq/documents/${made.json.id}`, undefined, {}, live)).status).toBe(404);
    expect((await raw('GET', p.fileUrl, {}, live)).status).toBe(404);
    // Once every question is reviewed and the document is recorded as reviewed, it is shown everywhere.
    await env.DB.prepare(`UPDATE pyq_documents SET review_state = 'REVIEWED' WHERE id = ?`).bind(made.json.id).run();
    expect((await call('GET', '/api/learn/pyq/2025/physics', undefined, {}, live)).json.practicePapers[0]).toMatchObject({ unreviewed: false, native: true });
    expect((await raw('GET', p.fileUrl, {}, live)).status).toBe(200);
  });
});
