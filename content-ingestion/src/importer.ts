/**
 * STORE SOURCE -> IMPORT INTO LOCAL D1 -> RECORD STATUS, through the local Worker API.
 *
 * Only papers that are MACHINE_VERIFIED (see verify.ts) are imported as syllabus content. Every other
 * paper is still registered (it is on the official list) and its pipeline job records why it is waiting
 * (NEEDS_REVIEW) or BLOCKED. Its rows stay in the extraction dataset and the review queue.
 * Re-running is safe: the API deduplicates by SHA-256 and idempotency key.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractionResult, Registry } from './types';
import type { PaperVerification } from './verify';

interface ImportOptions {
  registry: Registry;
  api: string;
  paths: { extracted: string; verification: string };
}

function adminToken(): string {
  if (process.env['CUET_ADMIN_TOKEN']) return process.env['CUET_ADMIN_TOKEN'];
  const vars = join(import.meta.dirname, '..', '..', 'backend', '.dev.vars');
  if (existsSync(vars)) {
    const m = /^ADMIN_API_TOKEN\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(vars, 'utf8'));
    if (m?.[1]) return m[1];
  }
  throw new Error('No admin token: set CUET_ADMIN_TOKEN or create backend/.dev.vars from .dev.vars.example');
}

async function call(api: string, token: string, method: string, path: string, body?: unknown, contentType = 'application/json') {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { 'x-admin-token': token, 'x-admin-actor': 'ingestion-cli', 'content-type': contentType },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : (body as NonNullable<RequestInit['body']>),
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return json as Record<string, unknown>;
}

export async function runImport(opts: ImportOptions) {
  const { registry, api } = opts;
  const vfile = join(opts.paths.verification, 'verification.json');
  if (!existsSync(vfile)) throw new Error('Run verification first: npm run ingest -- verify');
  const verification = JSON.parse(readFileSync(vfile, 'utf8')) as { method: string; verifiedAt: string; results: PaperVerification[] };
  const verdicts = new Map(verification.results.map((v) => [`${v.exam}:${v.code}`, v]));
  const token = adminToken();
  const health = await fetch(`${api}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`Local API not reachable at ${api}. Start it with: npm run dev:api`);

  // 1. The official paper list (all 194: it is verified against the bulletins).
  for (const exam of ['CUET_UG', 'CUET_PG'] as const) {
    const papers = registry.papers.filter((p) => p.exam === exam);
    const r = await call(api, token, 'POST', '/api/admin/registry/papers', {
      exam, year: registry.year,
      papers: papers.map((p) => ({ code: p.code, name: p.name, categoryCode: p.categoryCode, officialSyllabusUrl: p.officialSyllabusUrl, listedOnUrl: p.listedOnUrl })),
    });
    console.log(`${exam}: ${String(r['papersRegisteredInCycle'])} official papers registered`);
  }

  const counts = { imported: 0, alreadyPresent: 0, needsReview: 0, blocked: 0, nodes: 0 };
  for (const p of registry.papers) {
    const v = verdicts.get(`${p.exam}:${p.code}`);
    const f = join(opts.paths.extracted, p.exam, `${p.code}.json`);
    const r = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as ExtractionResult) : null;
    const job = (stage: string, status: string, extra: Record<string, unknown> = {}) =>
      call(api, token, 'POST', '/api/admin/jobs/report', { sourceUrl: p.officialSyllabusUrl, stage, status, ...extra });
    if (!r?.source || !v) {
      await job('DISCOVERED', 'FAILED', { error: 'not downloaded or not verified' });
      continue;
    }
    // Keep a private copy of every official PDF in local R2, whatever its review status.
    await job('DOWNLOADED', 'SUCCEEDED', { sha256: r.source.sha256 });
    const stored = await call(api, token, 'PUT', '/api/admin/files/sources', readFileSync(r.source.localFile), 'application/pdf');
    await job('STORED', 'SUCCEEDED', { sha256: r.source.sha256 });

    if (v.verdict === 'BLOCKED') {
      await job('EXTRACTED', 'BLOCKED', { blockerReason: v.reasons.join('; ').slice(0, 500) });
      counts.blocked++;
      continue;
    }
    if (v.verdict === 'NEEDS_REVIEW') {
      await job('VALIDATED', 'PENDING', { blockerReason: `Needs review: ${v.reasons.join('; ')}`.slice(0, 500), stats: { rows: v.metrics.rows, recordsPassing: v.metrics.recordsPassing } });
      counts.needsReview++;
      continue;
    }

    // MACHINE_VERIFIED: import with its evidence.
    await job('VALIDATED', 'SUCCEEDED', { stats: v.metrics as unknown as Record<string, unknown> });
    const res = await call(api, token, 'POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `syllabus:${p.exam}:${p.year}:${p.code}:${r.source.sha256}`,
      exam: p.exam, year: p.year, paperCode: p.code,
      source: {
        kind: 'OFFICIAL_SYLLABUS', title: r.source.title, publisher: 'National Testing Agency (NTA)', url: r.source.url, listedOnUrl: r.source.listedOnUrl,
        retrievedAt: r.source.retrievedAt, sha256: r.source.sha256, byteSize: r.source.byteSize, mimeType: 'application/pdf',
        pageCount: r.source.pageCount, r2Key: stored['r2Key'],
      },
      extractor: { name: '@cuet/ingestion', version: '0.2.0', mode: r.method ?? 'unknown' },
      verification: { level: 'MACHINE', method: verification.method, metrics: { ...v.metrics, verifiedAt: verification.verifiedAt } },
      nodes: r.nodes.map(({ ref, parentRef, kind, label, title, body, position, depth, sourcePage, flags }) => ({ ref, parentRef, kind, label, title, body, position, depth, sourcePage, flags })),
      tables: r.tables.map((t) => ({ nodeRef: t.nodeRef, page: t.page, rows: t.rows.map((row) => row.slice(0, 30).map((c) => c.slice(0, 2000))) })),
      figures: [],
    });
    if (res['status'] === 'DUPLICATE' || res['replayed']) counts.alreadyPresent++;
    else {
      counts.imported++;
      counts.nodes += Number(res['nodesCreated'] ?? 0);
    }
  }
  console.log(`Done. Imported ${counts.imported} machine-verified papers (${counts.nodes} rows), already present ${counts.alreadyPresent}, needs review ${counts.needsReview}, blocked ${counts.blocked}.`);
  return counts;
}
