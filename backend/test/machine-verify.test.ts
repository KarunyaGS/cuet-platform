import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from '../src/index';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = ADMIN) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

const PDF = 'https://cdnbbsr.s3waas.gov.in/test/machine-verify.pdf';
type Row = { title: string; flags?: string[]; ok?: boolean };

/** Imports a page-image correction the way `review-import` does: no verification, each row with its own check. */
async function importCorrection(code: string, digest: string, rows: Row[]) {
  await call('POST', '/api/admin/registry/papers', { exam: 'CUET_PG', year: 2026, papers: [{ code, name: `Paper ${code}`, categoryCode: 'ACQP', officialSyllabusUrl: `${PDF}?${code}`, listedOnUrl: 'https://exams.nta.nic.in/cuet-pg/' }] });
  const r = await call('POST', '/api/admin/imports/syllabus', {
    idempotencyKey: `machine-verify-${code}`, exam: 'CUET_PG', year: 2026, paperCode: code,
    source: { kind: 'OFFICIAL_SYLLABUS', title: `Paper ${code}`, publisher: 'NTA', url: `${PDF}?${code}`, retrievedAt: '2026-11-12T00:00:00.000Z', sha256: digest.repeat(64), byteSize: 10, mimeType: 'application/pdf', pageCount: 2 },
    extractor: { name: 'ai-visual-review', version: '1', mode: 'page_image_review' },
    nodes: rows.map((row, i) => {
      const flags = row.flags ?? ['ai_visual_review'];
      return { ref: `r${i}`, parentRef: null, kind: 'TOPIC', label: String(i + 1), title: row.title, body: null, position: i, depth: 1, sourcePage: 2, flags, check: { ok: row.ok ?? true, missingOnPage: [], secondExtractorAgreementPct: 100, flags } };
    }),
    tables: [], figures: [],
  });
  expect(r.status, JSON.stringify(r.json).slice(0, 300)).toBeLessThan(300);
  return r.json.syllabusVersionId as string;
}

const mark = (id: string, expectedRows: number) => call('POST', `/api/admin/syllabus-versions/${id}/machine-verify`, { method: 'AI_PAGE_IMAGE_REVIEW_TEXT_AND_STRUCTURE_CHECK_v1', expectedRows, metrics: { unconfirmedRows: 0 } });
const visible = async (code: string) => ((await call('GET', '/api/learn/exams/CUET_PG/subjects?year=2026', undefined, {})).json as { code: string; available: boolean }[]).some((s) => s.code === code && s.available);

describe('machine-check marking of a corrected syllabus version', () => {
  it('marks a correction whose every row passed its check, and only then do students see it', async () => {
    const id = await importCorrection('MVQP01', 'd', [{ title: 'Vedic period' }, { title: 'Mauryan period' }]);
    expect(await visible('MVQP01')).toBe(false);
    const r = await mark(id, 2);
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(r.json).toMatchObject({ changed: true, rows: 2 });
    expect(await visible('MVQP01')).toBe(true);
    const nodes = (await call('GET', `/api/admin/syllabus-versions/${id}/nodes`)).json;
    expect(nodes.version.verification).toBe('MACHINE_VERIFIED');
    expect(nodes.nodes.every((n: { verification: string }) => n.verification === 'MACHINE_VERIFIED')).toBe(true);
    // Never a person's approval, and a second call changes nothing.
    expect(nodes.nodes.some((n: { verification: string }) => n.verification === 'VERIFIED')).toBe(false);
    expect((await mark(id, 2)).json).toMatchObject({ changed: false });
  });

  it('refuses unconfirmed text, transcriptions, a failed row check and a row-count mismatch', async () => {
    const unconfirmed = await importCorrection('MVQP02', 'e', [{ title: 'Topic one' }, { title: 'Topic two', flags: ['ai_visual_review', 'text_not_in_sources'], ok: false }]);
    expect((await mark(unconfirmed, 2)).status).toBe(409);
    const transcribed = await importCorrection('MVQP03', 'f', [{ title: 'Topic one', flags: ['ai_visual_review', 'ai_transcription'], ok: false }]);
    expect((await mark(transcribed, 1)).status).toBe(409);
    const failedCheck = await importCorrection('MVQP04', '1', [{ title: 'Topic one', ok: false }]);
    expect((await mark(failedCheck, 1)).status).toBe(409);
    const mismatch = await importCorrection('MVQP05', '2', [{ title: 'Topic one' }, { title: 'Topic two' }]);
    expect((await mark(mismatch, 3)).status).toBe(409);
    for (const code of ['MVQP02', 'MVQP03', 'MVQP04', 'MVQP05']) expect(await visible(code)).toBe(false);
  });
});
