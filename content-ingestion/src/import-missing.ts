/**
 * Imports already-collected CUET data that was not yet in local D1. Additive only and idempotent:
 *  1. machine-readable rows of the 3 blocked papers (added to their empty drafts; unreadable OCR rows left out)
 *  2. the figure cut from an official PDF page (with its document, page and syllabus row)
 *  3. per-page text of every PDF as each method read it (text layer, pdftotext, OCR)
 *  4. problems found in the official documents themselves (registry/source-issues.json)
 * Nothing existing is changed or deleted.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtractionResult, Registry } from './types';

async function call(api: string, token: string, method: string, path: string, body?: unknown, contentType = 'application/json') {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: { 'x-admin-token': token, 'x-admin-actor': 'import-missing', 'content-type': contentType },
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : (body as NonNullable<RequestInit['body']>),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : null) as Record<string, unknown>;
}

export async function importMissing(registry: Registry, paths: { extracted: string; review: string; registryDir: string }, api: string, token: string) {
  const report: Record<string, unknown> = {};

  // 1. Blocked papers: rows the extractor could read with confidence.
  const blocked = [];
  for (const p of registry.papers) {
    const x = JSON.parse(readFileSync(join(paths.extracted, p.exam, `${p.code}.json`), 'utf8')) as ExtractionResult;
    if (x.status === 'EXTRACTED' || !x.source || !x.nodes.length) continue;
    const keep = new Set<string>();
    for (const n of x.nodes) if (!n.flags.some((f) => f.startsWith('ocr_low_confidence')) && (n.parentRef === null || keep.has(n.parentRef))) keep.add(n.ref);
    const nodes = x.nodes.filter((n) => keep.has(n.ref)).map(({ ref, parentRef, kind, label, title, body, position, depth, sourcePage, flags }) => ({
      ref, parentRef, kind, label, title, body, position, depth, sourcePage, flags: [...flags, 'partial_extraction_of_blocked_paper'],
    }));
    const left = x.nodes.length - nodes.length;
    const hash = createHash('sha256').update(JSON.stringify(nodes)).digest('hex').slice(0, 16);
    const res = await call(api, token, 'POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `syllabus-partial:${p.exam}:${p.year}:${p.code}:${x.source.sha256}:${hash}`,
      exam: p.exam, year: p.year, paperCode: p.code, appendToEmptyDraft: true,
      source: {
        kind: 'OFFICIAL_SYLLABUS', title: x.source.title, publisher: 'National Testing Agency (NTA)', url: x.source.url, listedOnUrl: x.source.listedOnUrl,
        retrievedAt: x.source.retrievedAt, sha256: x.source.sha256, byteSize: x.source.byteSize, mimeType: 'application/pdf', pageCount: x.source.pageCount, r2Key: `sources/${x.source.sha256}.pdf`,
      },
      extractor: { name: '@cuet/ingestion', version: '0.3.0', mode: x.method ?? 'partial' },
      notes: `Partial machine extraction of a blocked paper: ${nodes.length} row(s) the extractor read with confidence; ${left} row(s) of unreadable OCR left out (kept in the extraction dataset). The rest must be transcribed from the page images.`,
      nodes, tables: [], figures: [],
    });
    blocked.push({ code: p.code, kept: nodes.length, leftOut: left, status: res['replayed'] ? 'ALREADY_PRESENT' : String(res['status']), nodesCreated: res['nodesCreated'] ?? 0 });

    // 2. Figures cut from this PDF (the image holding text the extractor could not read).
    for (const f of x.figures ?? []) {
      const g = f as unknown as { nodeRef: string | null; page: number; sha256: string; width: number; height: number; localFile: string; byteSize: number };
      if (!existsSync(g.localFile)) continue;
      const stored = await call(api, token, 'PUT', '/api/admin/files/media', readFileSync(g.localFile), 'image/png');
      const node = g.nodeRef ? x.nodes.find((n) => n.ref === g.nodeRef) : null;
      let nodeId: string | null = null;
      if (node && keep.has(node.ref)) {
        const list = await call(api, token, 'GET', `/api/admin/papers?exam=${p.exam}&year=2026&q=${p.code}&pageSize=50`);
        const item = (list['items'] as { code: string; syllabusVersions: { id: string }[] }[]).find((i) => i.code === p.code)!;
        const rows = (await call(api, token, 'GET', `/api/admin/syllabus-versions/${item.syllabusVersions[0]!.id}/nodes`))['nodes'] as { id: string; title: string; sourcePage: number | null; kind: string }[];
        nodeId = rows.find((r) => r.title === node.title && r.sourcePage === node.sourcePage && r.kind === node.kind)?.id ?? null;
      }
      const res2 = await call(api, token, 'PUT', '/api/admin/source-figures', {
        documentSha256: x.source.sha256, page: g.page, nodeId, r2Key: stored['r2Key'], sha256: g.sha256, mimeType: 'image/png', byteSize: g.byteSize,
        width: g.width, height: g.height,
        altText: `Image on page ${g.page} of the official ${p.name} (${p.code}) syllabus PDF; it holds syllabus text in a script the extractor could not read`,
        caption: `Official syllabus, page ${g.page} (image)`,
      });
      report['figure'] = { paper: p.code, page: g.page, linkedToRow: Boolean(nodeId), inserted: res2['inserted'] };
    }
  }
  report['blockedPapers'] = blocked;

  // 3. Page texts of every PDF.
  let inserted = 0;
  let already = 0;
  let pages = 0;
  for (const p of registry.papers) {
    const f = join(paths.review, p.exam, p.code, 'input.json');
    if (!existsSync(f)) continue;
    const input = JSON.parse(readFileSync(f, 'utf8')) as { pages: { page: number; pdfjsText: string; popplerText: string; ocrText: string }[] };
    const x = JSON.parse(readFileSync(join(paths.extracted, p.exam, `${p.code}.json`), 'utf8')) as ExtractionResult & { ocrText?: { page: number; meanConfidence: number; text: string }[] };
    if (!x.source) continue;
    const rows = input.pages.flatMap((pg) => {
      const ocr = (x.ocrText ?? []).filter((o) => o.page === pg.page);
      const conf = ocr.length ? Math.round((10 * ocr.reduce((t, o) => t + o.meanConfidence, 0)) / ocr.length) / 10 : null;
      return [
        pg.pdfjsText.trim() ? { page: pg.page, method: 'pdfjs', text: pg.pdfjsText, meanConfidence: null } : null,
        pg.popplerText.trim() ? { page: pg.page, method: 'pdftotext', text: pg.popplerText, meanConfidence: null } : null,
        pg.ocrText.trim() ? { page: pg.page, method: 'ocr', text: pg.ocrText, meanConfidence: conf } : null,
      ].filter(Boolean);
    });
    pages += input.pages.length;
    if (!rows.length) continue;
    const r = await call(api, token, 'PUT', '/api/admin/page-texts', { sha256: x.source.sha256, pages: rows });
    inserted += Number(r['inserted']);
    already += Number(r['alreadyStored']);
  }
  report['pageTexts'] = { pagesSeen: pages, inserted, alreadyStored: already };

  // 4. Problems in the official documents themselves.
  const issues = (JSON.parse(readFileSync(join(paths.registryDir, 'source-issues.json'), 'utf8')) as { issues: { exam: 'CUET_UG' | 'CUET_PG'; code: string; issue: string; evidence?: string }[] }).issues;
  const expand = (code: string) => {
    const range = /^(\d+)-(\d+)$/.exec(code);
    if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => String(Number(range[1]) + i));
    return code.split(',').map((c) => c.trim());
  };
  let issueRows = 0;
  let issueNew = 0;
  for (const [i, it] of issues.entries()) {
    for (const code of expand(it.code)) {
      if (!registry.papers.some((p) => p.exam === it.exam && p.code === code)) continue;
      const r = await call(api, token, 'PUT', '/api/admin/source-issues', { exam: it.exam, code, issue: it.issue, evidence: it.evidence ?? null, key: `${i + 1}-${it.exam.toLowerCase()}-${code.toLowerCase()}` });
      issueRows++;
      if (r['inserted']) issueNew++;
    }
  }
  report['sourceIssues'] = { issues: issues.length, paperEntries: issueRows, inserted: issueNew };
  return report;
}
