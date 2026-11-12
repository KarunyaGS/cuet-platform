/**
 * STORE SOURCE -> IMPORT INTO LOCAL D1 -> RECORD STATUS, through the local Worker API.
 *
 *  - MACHINE_VERIFIED papers: imported with their evidence (rows MACHINE_VERIFIED; never VERIFIED).
 *  - NEEDS_REVIEW papers: imported as UNVERIFIED drafts for the reviewer screen, each row carrying the
 *    exact automatic check it failed. Students never see UNVERIFIED rows.
 *  - BLOCKED papers: an empty draft version linked to the official PDF, ready for manual transcription.
 *  - Every source PDF is kept privately in local R2, and the visual (OCR) check of each page is stored.
 *  - Rows already stored whose re-extracted text changed (e.g. a page footer removed by an extractor fix)
 *    get a recorded machine correction (before/after kept), only if the new text passes the same checks
 *    and no person has decided on the row yet.
 * Re-running is safe: the API deduplicates by SHA-256 and idempotency key.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractionResult, Registry } from './types';
import { parseCsv, type PaperVerification } from './verify';

interface ImportOptions {
  registry: Registry;
  api: string;
  paths: { extracted: string; verification: string; audit: string };
}

const EXTRACTOR = { name: '@cuet/ingestion', version: '0.3.0' };
const PAGE_CHECK_METHOD = 'VISUAL_OCR_CROSSCHECK_v1';

export function adminToken(): string {
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
  const crossFile = join(opts.paths.audit, 'visual-crosscheck.csv');
  const cross = existsSync(crossFile) ? parseCsv(readFileSync(crossFile, 'utf8')) : [];
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

  const counts = { machineVerified: 0, review: 0, transcription: 0, alreadyPresent: 0, rowsCreated: 0, pageChecks: 0, corrections: 0, correctionsSkipped: [] as string[] };
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

    const records = new Map(v.records.map((x) => [x.ref, x]));
    const source = {
      kind: 'OFFICIAL_SYLLABUS', title: r.source.title, publisher: 'National Testing Agency (NTA)', url: r.source.url, listedOnUrl: r.source.listedOnUrl,
      retrievedAt: r.source.retrievedAt, sha256: r.source.sha256, byteSize: r.source.byteSize, mimeType: 'application/pdf',
      pageCount: r.source.pageCount, r2Key: stored['r2Key'],
    };
    const nodes = (withChecks: boolean) =>
      r.nodes.map(({ ref, parentRef, kind, label, title, body, position, depth, sourcePage, flags }) => {
        const rc = records.get(ref);
        return {
          ref, parentRef, kind, label, title, body, position, depth, sourcePage, flags,
          ...(withChecks && rc ? { check: { ok: rc.ok, missingOnPage: rc.missingOnPagePdfjs.slice(0, 200), secondExtractorAgreementPct: rc.popplerAgreementPct, flags: rc.flags } } : {}),
        };
      });
    const tables = r.tables.map((t) => ({ nodeRef: t.nodeRef, page: t.page, rows: t.rows.map((row) => row.slice(0, 30).map((c) => c.slice(0, 2000))) }));

    let res: Record<string, unknown>;
    if (v.verdict === 'BLOCKED') {
      await job('EXTRACTED', 'BLOCKED', { blockerReason: v.reasons.join('; ').slice(0, 500) });
      res = await call(api, token, 'POST', '/api/admin/imports/syllabus', {
        idempotencyKey: `syllabus-transcription:${p.exam}:${p.year}:${p.code}:${r.source.sha256}`,
        exam: p.exam, year: p.year, paperCode: p.code, source,
        extractor: { ...EXTRACTOR, mode: 'manual_transcription' },
        notes: `Blocked: ${v.reasons.join('; ').slice(0, 1500)}. Awaiting manual transcription from the page images in the reviewer screen.`,
        nodes: [], tables: [], figures: [],
      });
      counts.transcription++;
    } else if (v.verdict === 'NEEDS_REVIEW') {
      await job('VALIDATED', 'PENDING', { blockerReason: `Needs review: ${v.reasons.join('; ')}`.slice(0, 500), stats: { rows: v.metrics.rows, recordsPassing: v.metrics.recordsPassing } });
      res = await call(api, token, 'POST', '/api/admin/imports/syllabus', {
        idempotencyKey: `syllabus-review:${p.exam}:${p.year}:${p.code}:${r.source.sha256}`,
        exam: p.exam, year: p.year, paperCode: p.code, source,
        extractor: { ...EXTRACTOR, mode: r.method ?? 'unknown' },
        notes: `Needs human review: ${v.reasons.join('; ').slice(0, 2500)}`,
        nodes: nodes(true), tables, figures: [],
      });
      counts.review++;
    } else {
      await job('VALIDATED', 'SUCCEEDED', { stats: v.metrics as unknown as Record<string, unknown> });
      res = await call(api, token, 'POST', '/api/admin/imports/syllabus', {
        idempotencyKey: `syllabus:${p.exam}:${p.year}:${p.code}:${r.source.sha256}`,
        exam: p.exam, year: p.year, paperCode: p.code, source,
        extractor: { name: EXTRACTOR.name, version: '0.2.0', mode: r.method ?? 'unknown' },
        verification: { level: 'MACHINE', method: verification.method, metrics: { ...v.metrics, verifiedAt: verification.verifiedAt } },
        nodes: nodes(false), tables, figures: [],
      });
      counts.machineVerified++;
    }
    const replay = res['status'] === 'DUPLICATE' || Boolean(res['replayed']);
    if (replay) counts.alreadyPresent++;
    else counts.rowsCreated += Number(res['nodesCreated'] ?? 0);

    // Visual check of every page, so reviewers see what OCR saw that the extraction does not have.
    const pages = cross.filter((c) => c['exam'] === p.exam && c['code'] === p.code);
    if (pages.length) {
      await call(api, token, 'PUT', '/api/admin/page-checks', {
        sha256: r.source.sha256, method: PAGE_CHECK_METHOD,
        pages: pages.map((c) => ({
          page: Number(c['page']), status: c['status'], ocrWords: Number(c['ocrWords'] || 0), foundWords: Number(c['foundInExtraction'] || 0),
          foundPct: c['pct'] ? Number(c['pct']) : null, missingSample: c['missingSample'] || null,
        })),
      });
      counts.pageChecks += pages.length;
    }

    // Rows stored by an earlier run whose re-extracted text has since changed.
    if (replay && res['syllabusVersionId'] && v.verdict !== 'BLOCKED') {
      const fixed = await applyCorrections(api, token, String(res['syllabusVersionId']), r, v, verification.method);
      counts.corrections += fixed.applied;
      if (fixed.skipped) counts.correctionsSkipped.push(`${p.exam}:${p.code} (${fixed.skipped})`);
    }
  }
  console.log(
    `Done. Machine-verified papers ${counts.machineVerified}, review drafts ${counts.review}, transcription drafts ${counts.transcription}; ` +
      `already present ${counts.alreadyPresent}; new rows ${counts.rowsCreated}; page checks ${counts.pageChecks}; corrections ${counts.corrections}.`,
  );
  if (counts.correctionsSkipped.length) console.log(`Corrections NOT applied (structure changed; needs a reviewer): ${counts.correctionsSkipped.join(', ')}`);
  return counts;
}

/** "a/b/c": the row's place in the tree (sibling order at each level), independent of its text. */
function treePaths<T>(items: T[], id: (x: T) => string, parent: (x: T) => string | null, position: (x: T) => number): Map<string, T> {
  const kids = new Map<string | null, T[]>();
  for (const x of items) kids.set(parent(x), [...(kids.get(parent(x)) ?? []), x]);
  const out = new Map<string, T>();
  const walk = (p: string | null, prefix: string) =>
    (kids.get(p) ?? [])
      .sort((a, b) => position(a) - position(b))
      .forEach((x, i) => {
        const path = `${prefix}${i}`;
        out.set(path, x);
        walk(id(x), `${path}/`);
      });
  walk(null, '');
  return out;
}

const stripFooter = (s: string | null) => (s == null ? null : s.replace(/(?:^|\s)\d{1,3}\s*\|\s*P\s?a\s?g\s?e(?=\s|$)/gi, ' ').replace(/\s{2,}/g, ' ').trim() || null);

/**
 * Applies only the known extractor fix (a page footer removed from a row's text) to stored rows, matching
 * rows by their exact place in the tree, and only when the whole tree has the same shape. Any other
 * difference is left alone and reported for a reviewer.
 */
async function applyCorrections(api: string, token: string, versionId: string, r: ExtractionResult, v: PaperVerification, method: string) {
  const stored = (await call(api, token, 'GET', `/api/admin/syllabus-versions/${versionId}/nodes`))['nodes'] as {
    id: string; parentId: string | null; kind: string; label: string | null; title: string; body: string | null; position: number; sourcePage: number | null; verification: string;
  }[];
  const sPaths = treePaths(stored, (x) => x.id, (x) => x.parentId, (x) => x.position);
  const dPaths = treePaths(r.nodes, (x) => x.ref, (x) => x.parentRef, (x) => x.position);
  if (sPaths.size !== dPaths.size || [...sPaths.keys()].some((k) => !dPaths.has(k))) return { applied: 0, skipped: 1 };
  const records = new Map(v.records.map((x) => [x.ref, x]));
  let applied = 0;
  let skipped = 0;
  for (const [path, s] of sPaths) {
    const d = dPaths.get(path)!;
    if (d.kind !== s.kind || (d.label ?? null) !== (s.label ?? null) || (d.sourcePage ?? null) !== (s.sourcePage ?? null)) return { applied, skipped: skipped + 1 };
    if (d.title === s.title && (d.body ?? null) === (s.body ?? null)) continue;
    const isFooterFix = (stripFooter(s.title) ?? s.title) === d.title && stripFooter(s.body) === (d.body ?? null);
    const rc = records.get(d.ref);
    const allowed = isFooterFix && (s.verification === 'UNVERIFIED' || (s.verification === 'MACHINE_VERIFIED' && rc?.ok && v.verdict === 'MACHINE_VERIFIED'));
    if (!allowed) {
      skipped++;
      continue;
    }
    const out = await call(api, token, 'POST', `/api/admin/nodes/${s.id}/machine-correction`, {
      expect: { title: s.title, body: s.body ?? null }, title: d.title, body: d.body ?? null,
      reason: 'Extractor fix: page-footer text (e.g. "2 | P a g e") had been captured inside this row; re-extracted and re-checked against the source page.',
      method, metrics: { recordCheck: rc ?? null, paperVerdict: v.verdict, extractor: EXTRACTOR.version, matchedBy: `tree path ${path}` },
    });
    if (out['changed']) applied++;
  }
  return { applied, skipped };
}
