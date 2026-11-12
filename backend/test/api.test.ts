import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';
import { evaluateResponse } from '../src/services/scoring';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = ADMIN) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : typeof body === 'string' || body instanceof ArrayBuffer ? (body as BodyInit) : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const sha = (c: string) => c.repeat(64);
const PDF_URL = 'https://cdnbbsr.s3waas.gov.in/test/physics.pdf';

async function registerPhysics() {
  return call('POST', '/api/admin/registry/papers', {
    exam: 'CUET_UG', year: 2026,
    papers: [{ code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: PDF_URL, listedOnUrl: 'https://cuet.nta.nic.in/cuetug-2026-syllabus/' }],
  });
}

function bundle(key: string, digest = sha('a')) {
  return {
    idempotencyKey: key, exam: 'CUET_UG', year: 2026, paperCode: '322',
    source: { kind: 'OFFICIAL_SYLLABUS', title: 'CUET-UG 2026 syllabus: Physics (322)', publisher: 'NTA', url: PDF_URL, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: digest, byteSize: 1000, mimeType: 'application/pdf', pageCount: 4 },
    extractor: { name: 'test', version: '1', mode: 'text_layer' },
    nodes: [
      { ref: 'n1', parentRef: null, kind: 'UNIT', label: '1', title: 'Electrostatics', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
      { ref: 'n2', parentRef: 'n1', kind: 'SUBTOPIC', label: null, title: "Electric charges, Conservation of charge, Coulomb's law", body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
      { ref: 'n3', parentRef: null, kind: 'UNIT', label: '2', title: 'Current Electricity', body: null, position: 1, depth: 1, sourcePage: 2, flags: [] as string[] },
    ],
    tables: [{ nodeRef: 'n1', page: 1, rows: [['Unit', 'Topic', 'Weight'], ['1', 'Electrostatics', '-']] }],
    figures: [],
  };
}

describe('health and auth', () => {
  it('reports health and the seeded exams', async () => {
    expect((await call('GET', '/api/health', undefined, {})).status).toBe(200);
    expect((await call('GET', '/api/health/db', undefined, {})).json).toMatchObject({ ok: true, exams: 2 });
  });
  it('rejects admin calls without the token', async () => {
    expect((await call('GET', '/api/admin/overview', undefined, {})).status).toBe(401);
    expect((await call('GET', '/api/admin/overview', undefined, { 'x-admin-token': 'wrong' })).status).toBe(401);
  });
});

describe('syllabus import pipeline', () => {
  it('registers papers, imports a syllabus atomically and refuses duplicates', async () => {
    expect((await registerPhysics()).json).toMatchObject({ papersRegisteredInCycle: 1 });
    // registering again changes nothing
    expect((await registerPhysics()).json).toMatchObject({ papersRegisteredInCycle: 1 });

    const first = await call('POST', '/api/admin/imports/syllabus', bundle('import-1'));
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ status: 'IMPORTED', versionNumber: 1, nodesCreated: 3, tablesCreated: 1 });

    // same request again: idempotent, same answer
    expect((await call('POST', '/api/admin/imports/syllabus', bundle('import-1'))).json).toEqual({ ...first.json, replayed: true });
    // same document under a new key: recognised as a duplicate, nothing written
    const dup = await call('POST', '/api/admin/imports/syllabus', bundle('import-2'));
    expect(dup.json).toMatchObject({ status: 'DUPLICATE', nodesCreated: 0, syllabusVersionId: first.json.syllabusVersionId });

    const counts = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM curriculum_nodes) n, (SELECT COUNT(*) FROM syllabus_versions) v, (SELECT COUNT(*) FROM source_documents) s, (SELECT COUNT(*) FROM source_tables) t').first();
    expect(counts).toEqual({ n: 3, v: 1, s: 1, t: 1 });

    // every row traces back to the paper, the source document and a page
    const traced = await env.DB.prepare(
      `SELECT COUNT(*) AS c FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id
       JOIN source_documents d ON d.id = v.source_document_id JOIN test_papers p ON p.id = v.test_paper_id
       WHERE d.url = ? AND p.code = '322' AND n.source_page IS NOT NULL AND n.verification = 'UNVERIFIED'`,
    ).bind(PDF_URL).first<{ c: number }>();
    expect(traced?.c).toBe(3);

    // the pipeline job moved to IMPORTED
    const job = await env.DB.prepare('SELECT stage, status FROM extraction_jobs WHERE source_url = ?').bind(PDF_URL).first();
    expect(job).toEqual({ stage: 'IMPORTED', status: 'SUCCEEDED' });
  });

  it('rejects a bundle with a broken hierarchy and writes nothing', async () => {
    await registerPhysics();
    const bad = bundle('import-bad', sha('b'));
    bad.nodes[1]!.parentRef = 'missing';
    const res = await call('POST', '/api/admin/imports/syllabus', bad);
    expect(res.status).toBe(422);
    expect(await env.DB.prepare('SELECT COUNT(*) AS c FROM source_documents WHERE sha256 = ?').bind(sha('b')).first()).toEqual({ c: 0 });
  });
});

describe('coverage is computed from imported records only', () => {
  it('marks coverage provisional while official papers are not imported', async () => {
    await call('POST', '/api/admin/registry/papers', {
      exam: 'CUET_UG', year: 2026,
      papers: [
        { code: '322', name: 'Physics', categoryCode: 'DOMAIN', officialSyllabusUrl: PDF_URL, listedOnUrl: 'https://cuet.nta.nic.in/' },
        { code: '306', name: 'Chemistry', categoryCode: 'DOMAIN', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/chem.pdf', listedOnUrl: 'https://cuet.nta.nic.in/' },
      ],
    });
    await call('POST', '/api/admin/imports/syllabus', bundle('coverage-import-1', sha('c')));
    const cov = (await call('GET', '/api/admin/coverage?exam=CUET_UG&year=2026')).json;
    expect(cov.provisional).toBe(true);
    expect(cov.papers).toEqual({ officialPapersRegistered: 2, papersWithImportedSyllabus: 1, papersPendingImport: 1 });
    expect(cov.curriculum).toMatchObject({ unitsImported: 2, subtopicsImported: 1, awaitingVerification: 1, machineVerified: 0, humanVerified: 0 });
    expect(cov.pendingPapers.map((p: { code: string }) => p.code)).toEqual(['306']);
  });
});

describe('machine-verified imports', () => {
  it('marks rows MACHINE_VERIFIED (never VERIFIED), stores the evidence and keeps the version in DRAFT', async () => {
    await registerPhysics();
    const b = { ...bundle('machine-verified-1', sha('e')), verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: { rows: 3 } } };
    const res = await call('POST', '/api/admin/imports/syllabus', b);
    expect(res.status).toBe(200);
    const v = await env.DB.prepare('SELECT status, verification FROM syllabus_versions WHERE id = ?').bind(res.json.syllabusVersionId).first();
    expect(v).toEqual({ status: 'DRAFT', verification: 'MACHINE_VERIFIED' });
    const rows = await env.DB.prepare('SELECT DISTINCT verification FROM curriculum_nodes WHERE syllabus_version_id = ?').bind(res.json.syllabusVersionId).all();
    expect(rows.results).toEqual([{ verification: 'MACHINE_VERIFIED' }]);
    const ev = await env.DB.prepare('SELECT level, method FROM verification_evidence WHERE entity_id = ?').bind(res.json.syllabusVersionId).first();
    expect(ev).toEqual({ level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1' });
  });

  it('refuses a machine-verified import that contains guessed headings', async () => {
    await registerPhysics();
    const b = { ...bundle('machine-verified-bad', sha('f')), verification: { level: 'MACHINE', method: 'AUTOMATED_TRIPLE_SOURCE_RECONCILIATION_v1', metrics: {} } };
    b.nodes[0]!.flags = ['heading_inferred_from_formatting'];
    expect((await call('POST', '/api/admin/imports/syllabus', b)).status).toBe(422);
  });
});

describe('question bank and deterministic answering', () => {
  async function seedQuestion(tag = 'base') {
    await registerPhysics();
    const imp = await call('POST', '/api/admin/imports/syllabus', bundle('question-import', sha('d')));
    if (!imp.json?.syllabusVersionId) throw new Error(`import failed: ${imp.status} ${JSON.stringify(imp.json)}`);
    const node = await env.DB.prepare('SELECT id FROM curriculum_nodes WHERE syllabus_version_id = ? AND kind = ?').bind(imp.json.syllabusVersionId, 'SUBTOPIC').first<{ id: string }>();
    const created = await call('POST', '/api/admin/questions', {
      testPaperId: imp.json.testPaperId, type: 'MCQ_SINGLE', stem: `TEST ONLY (${tag}): which law gives the force between two point charges?`, difficulty: 'EASY',
      origin: 'DEMONSTRATION', usagePermissionId: 'perm_demo', isDemonstration: true,
      options: [{ label: 'A', text: "Ohm's law" }, { label: 'B', text: "Coulomb's law" }, { label: 'C', text: "Faraday's law" }, { label: 'D', text: "Lenz's law" }],
      answer: { correctOptionPositions: [2] },
      explanation: { body: "Coulomb's law gives the electrostatic force between two point charges." },
      topicNodeIds: [node!.id],
    });
    return created;
  }

  it('stores the answer key separately and never returns it from public endpoints', async () => {
    const created = await seedQuestion();
    expect(created.status).toBe(201);
    const adminView = await call('GET', `/api/admin/questions/${created.json.id}`);
    expect(adminView.json.answerKey.correctOptionPositions).toBe('[2]');
    // demonstration and unpublished questions are invisible to students
    expect((await call('GET', `/api/public/questions/${created.json.id}`, undefined, {})).status).toBe(404);
    expect((await call('POST', `/api/public/questions/${created.json.id}/evaluate`, { selectedPositions: [2] }, { 'content-type': 'application/json' })).status).toBe(404);
  });

  it('refuses to create the same question twice', async () => {
    await seedQuestion('twice');
    const again = await seedQuestion('twice');
    expect(again.status).toBe(409);
  });

  it('evaluates answers from the stored key with the cycle marking scheme (+5/-1 for UG)', async () => {
    const created = await seedQuestion('evaluate');
    const right = await call('POST', `/api/admin/questions/${created.json.id}/preview-evaluate`, { selectedPositions: [2] });
    expect(right.json).toMatchObject({ outcome: 'CORRECT', score: 5, answeredBy: 'stored-answer-key' });
    const wrong = await call('POST', `/api/admin/questions/${created.json.id}/preview-evaluate`, { selectedPositions: [1] });
    expect(wrong.json).toMatchObject({ outcome: 'INCORRECT', score: -1 });
    expect(wrong.json.explanation.body).toContain("Coulomb's law");
    const skipped = await call('POST', `/api/admin/questions/${created.json.id}/preview-evaluate`, {});
    expect(skipped.json).toMatchObject({ outcome: 'UNATTEMPTED', score: 0 });
  });

  it('never publishes demonstration records', async () => {
    const created = await seedQuestion('publish');
    const id = created.json.id;
    expect((await call('POST', '/api/admin/review', { entityType: 'QUESTION', entityIds: [id], action: 'SUBMITTED' })).status).toBe(200);
    expect((await call('POST', '/api/admin/review', { entityType: 'QUESTION', entityIds: [id], action: 'APPROVED' })).status).toBe(409); // not verified yet
    expect((await call('POST', '/api/admin/review', { entityType: 'QUESTION', entityIds: [id], action: 'VERIFIED' })).status).toBe(200);
    expect((await call('POST', '/api/admin/review', { entityType: 'QUESTION', entityIds: [id], action: 'APPROVED' })).status).toBe(200);
    const pub = await call('POST', '/api/admin/review', { entityType: 'QUESTION', entityIds: [id], action: 'PUBLISHED' });
    expect(pub.status).toBe(409);
    const history = await call('GET', `/api/admin/review/history?entityType=QUESTION&entityId=${id}`);
    expect(history.json.map((h: { action: string }) => h.action)).toEqual(['APPROVED', 'VERIFIED', 'SUBMITTED']);
  });
});

describe('scoring rules', () => {
  const m = { correct: 4, incorrect: -1, unattempted: 0 };
  it('multi-correct needs the exact set', () => {
    expect(evaluateResponse('MCQ_MULTI', { correctOptionPositions: [1, 3], numericAnswer: null, numericTolerance: null }, { selectedPositions: [3, 1] }, m).outcome).toBe('CORRECT');
    expect(evaluateResponse('MCQ_MULTI', { correctOptionPositions: [1, 3], numericAnswer: null, numericTolerance: null }, { selectedPositions: [1] }, m).outcome).toBe('INCORRECT');
  });
  it('numerical answers use the stored tolerance', () => {
    const key = { correctOptionPositions: null, numericAnswer: 9.8, numericTolerance: 0.05 };
    expect(evaluateResponse('NUMERICAL', key, { numericAnswer: 9.84 }, m).outcome).toBe('CORRECT');
    expect(evaluateResponse('NUMERICAL', key, { numericAnswer: 9.9 }, m).outcome).toBe('INCORRECT');
  });
  it('a key with two accepted options (answer-key anomaly) accepts either', () => {
    expect(evaluateResponse('MCQ_SINGLE', { correctOptionPositions: [2, 4], numericAnswer: null, numericTolerance: null }, { selectedPositions: [4] }, m).score).toBe(4);
  });
});
