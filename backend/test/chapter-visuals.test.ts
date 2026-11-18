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

describe('diagrams and tables of a chapter', () => {
  it('lists the figures and tables of the lessons under a chapter, with the note on what to learn, and nothing from other chapters', async () => {
    await call('POST', '/api/admin/registry/papers', { exam: 'CUET_UG', year: 2026, papers: [{ code: '916', name: 'Visual Studies', categoryCode: 'DOMAIN', officialSyllabusUrl: 'https://cdnbbsr.s3waas.gov.in/test/visual-studies.pdf', listedOnUrl: 'https://cuet.nta.nic.in/' }] }, ADMIN);
    const imp = await call('POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `visuals-${Date.now()}`, exam: 'CUET_UG', year: 2026, paperCode: '916',
      source: { kind: 'OFFICIAL_SYLLABUS', title: 'Visual Studies (916)', publisher: 'NTA', url: 'https://cdnbbsr.s3waas.gov.in/test/visual-studies.pdf', retrievedAt: '2026-11-18T00:00:00.000Z', sha256: 'a'.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 1 },
      extractor: { name: 'test', version: '1', mode: 'text_layer' }, verification: { level: 'MACHINE', method: 'TEST', metrics: {} },
      nodes: [
        { ref: 'u1', parentRef: null, kind: 'UNIT', label: '1', title: 'Unit one', body: null, position: 0, depth: 1, sourcePage: 1, flags: [] as string[] },
        { ref: 't1', parentRef: 'u1', kind: 'TOPIC', label: null, title: 'Topic in unit one', body: null, position: 0, depth: 2, sourcePage: 1, flags: [] as string[] },
        { ref: 'u2', parentRef: null, kind: 'UNIT', label: '2', title: 'Unit two', body: null, position: 1, depth: 1, sourcePage: 1, flags: [] as string[] },
      ],
      tables: [], figures: [],
    }, ADMIN);
    expect(imp.status).toBeLessThan(300);
    const nodes = await env.DB.prepare('SELECT id, title FROM curriculum_nodes WHERE syllabus_version_id = ?').bind(imp.json.syllabusVersionId).all<{ id: string; title: string }>();
    const id = (t: string) => nodes.results.find((n) => n.title === t)!.id;
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const up = await app.request('/api/admin/files/media', { method: 'PUT', headers: { 'x-admin-token': 'test-admin-token', 'content-type': 'image/png' }, body: png }, env, createExecutionContext());
    const stored = (await up.json()) as { r2Key: string };
    const media = await call('PUT', '/api/admin/content/media/visuals.test.fig', { kind: 'DIAGRAM', r2Key: stored.r2Key, sha256: stored.r2Key.slice(6, 70), mimeType: 'image/png', byteSize: png.length, width: 1, height: 1, altText: 'A test diagram with one dot', caption: 'One dot', longDescription: 'A single dot on a plain background.', curriculumNodeId: id('Unit one'), origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', attribution: null }, ADMIN);
    expect(media.status).toBe(200);
    const lesson = (key: string, node: string, blocks: unknown[]) => call('PUT', `/api/admin/content/resources/${key}`, { curriculumNodeId: node, testPaperId: imp.json.testPaperId, type: 'LESSON', title: key, language: 'en', origin: 'AI_ASSISTED', usagePermissionId: 'perm_owned', isDemonstration: false, blocks }, ADMIN);
    const table = JSON.stringify({ caption: 'Two things compared', columns: ['Feature', 'First', 'Second'], rows: [['Size', 'big', 'small']] });
    expect((await lesson('visuals-lesson-a', id('Topic in unit one'), [
      { type: 'HEADING', body: 'Heading' },
      { type: 'DIAGRAM', body: 'One dot', mediaAssetId: media.json.id },
      { type: 'CALLOUT', body: 'What to learn from this figure: a single dot is enough to mark a position.' },
      { type: 'TABLE', body: table },
      { type: 'TEXT', body: 'Closing text' },
    ])).status).toBe(200);
    expect((await lesson('visuals-lesson-b', id('Unit two'), [{ type: 'TABLE', body: JSON.stringify({ caption: 'Other chapter', columns: ['A'], rows: [['x']] }) }])).status).toBe(200);

    const unit = (await call('GET', `/api/learn/topics/${id('Unit one')}/visuals`)).json;
    expect(unit.topic).toMatchObject({ title: 'Unit one' });
    expect(unit.counts).toEqual({ diagrams: 1, tables: 1 });
    const fig = unit.items.find((i: { kind: string }) => i.kind === 'DIAGRAM');
    expect(fig).toMatchObject({ caption: 'One dot', alt: 'A test diagram with one dot', description: 'A single dot on a plain background.', learn: 'a single dot is enough to mark a position.', verified: false, mediaAssetId: media.json.id });
    const tab = unit.items.find((i: { kind: string }) => i.kind === 'TABLE');
    expect(tab.table).toEqual({ caption: 'Two things compared', columns: ['Feature', 'First', 'Second'], rows: [['Size', 'big', 'small']] });
    // Nothing from another chapter, in order within the lesson (figure before table).
    expect(unit.items.map((i: { kind: string }) => i.kind)).toEqual(['DIAGRAM', 'TABLE']);
    expect((await call('GET', `/api/learn/topics/${id('Unit two')}/visuals`)).json.counts).toEqual({ diagrams: 0, tables: 1 });
    expect((await call('GET', '/api/learn/topics/cn_missing/visuals')).status).toBe(404);
  });
});
