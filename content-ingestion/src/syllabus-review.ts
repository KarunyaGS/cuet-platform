/**
 * Visual syllabus review (scraping completion): compare the stored rows of a paper with the page images and every
 * independent text source, correct structure and wording, transcribe papers no extractor can read.
 *
 *   review-export  [--exam X] [--paper A,B] [--set review|blocked|machine|all]
 *       storage/local/syllabus-review/<EXAM>/<code>/input.json + pages/p<n>.png
 *   (a reviewer writes storage/local/syllabus-review/<EXAM>/<code>/reviewed.json — format below)
 *   review-validate [--exam X] [--paper A,B]   -> validation.json per paper + summary
 *   review-import   [--exam X] [--paper A,B]   -> corrected trees stored as a NEW draft version (old one archived)
 *
 * reviewed.json:
 *   { "schema": "cuet-syllabus-review/1", "exam", "code",
 *     "decision": "CONFIRMED_AS_STORED" | "CORRECTED" | "TRANSCRIBED",
 *     "pages": [{ "page": 1, "content": "cover|instructions|syllabus|blank|other", "note": "" }],
 *     "nodes": [{ "ref", "parentRef", "kind", "label", "title", "body", "sourcePage" }],   // full tree unless CONFIRMED_AS_STORED
 *     "changes": ["what was corrected and why"], "unresolved": ["anything a person must decide"] }
 *
 * Nothing here marks anything VERIFIED. Rows stay UNVERIFIED until a signed-in reviewer verifies them.
 */
import { checkStructure } from './structure-checks';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderPagePng } from './ocr';
import { readPdf } from './pdf';
import { popplerPageText } from './poppler';
import type { ExtractionResult, Registry } from './types';
import { parseCsv, type PaperVerification } from './verify';

const KINDS = ['PART', 'SECTION', 'COURSE', 'UNIT', 'CHAPTER', 'TOPIC', 'SUBTOPIC', 'ITEM', 'NOTE'];
const tokens = (s: string) => s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? [];

interface Paths { extracted: string; audit: string; verification: string; review: string }
interface ReviewedNode { ref: string; parentRef: string | null; kind: string; label: string | null; title: string; body: string | null; sourcePage: number }
interface Reviewed {
  schema: string; exam: string; code: string; decision: 'CONFIRMED_AS_STORED' | 'CORRECTED' | 'TRANSCRIBED';
  pages: { page: number; content: string; note?: string }[];
  nodes?: ReviewedNode[]; changes?: string[]; unresolved?: string[];
}

async function call(api: string, token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${api}${path}`, { method, headers: { 'x-admin-token': token, 'x-admin-actor': 'syllabus-review', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : null) as Record<string, unknown>;
}

async function currentVersion(api: string, token: string, exam: string, code: string) {
  const list = await call(api, token, 'GET', `/api/admin/papers?exam=${exam}&year=2026&q=${encodeURIComponent(code)}&pageSize=50`);
  const item = (list['items'] as { code: string; syllabusVersions: { id: string; verification: string; status: string }[] }[]).find((p) => p.code === code);
  const v = item?.syllabusVersions[0];
  if (!v) return null;
  const data = await call(api, token, 'GET', `/api/admin/syllabus-versions/${v.id}/nodes`);
  return { version: v, nodes: data['nodes'] as { id: string; parentId: string | null; kind: string; label: string | null; title: string; body: string | null; position: number; depth: number; sourcePage: number | null; extractionFlags: string | null; verification: string }[] };
}

export function targetPapers(registry: Registry, paths: Paths, set: string, exam?: string, papers?: string[]) {
  const verdicts = new Map((JSON.parse(readFileSync(join(paths.verification, 'verification.json'), 'utf8')) as { results: PaperVerification[] }).results.map((v) => [`${v.exam}:${v.code}`, v]));
  return registry.papers.filter((p) => {
    if (exam && p.exam !== exam) return false;
    if (papers?.length) return papers.includes(p.code);
    const v = verdicts.get(`${p.exam}:${p.code}`)?.verdict;
    return set === 'all' || (set === 'review' && v === 'NEEDS_REVIEW') || (set === 'blocked' && v === 'BLOCKED') || (set === 'machine' && v === 'MACHINE_VERIFIED');
  });
}

export async function reviewExport(registry: Registry, paths: Paths, api: string, token: string, set: string, exam?: string, papers?: string[]) {
  const targets = targetPapers(registry, paths, set, exam, papers);
  const verdicts = new Map((JSON.parse(readFileSync(join(paths.verification, 'verification.json'), 'utf8')) as { results: PaperVerification[] }).results.map((v) => [`${v.exam}:${v.code}`, v]));
  const cross = parseCsv(readFileSync(join(paths.audit, 'visual-crosscheck.csv'), 'utf8'));
  let n = 0;
  for (const p of targets) {
    const x = JSON.parse(readFileSync(join(paths.extracted, p.exam, `${p.code}.json`), 'utf8')) as ExtractionResult & { ocrText?: { page: number; meanConfidence: number; text: string }[] };
    if (!x.source) continue;
    const dir = join(paths.review, p.exam, p.code);
    mkdirSync(join(dir, 'pages'), { recursive: true });
    const data = new Uint8Array(readFileSync(x.source.localFile));
    const pdf = await readPdf(data);
    const pages = [];
    for (let pg = 1; pg <= pdf.pageCount; pg++) {
      const png = join(dir, 'pages', `p${pg}.png`);
      if (!existsSync(png)) writeFileSync(png, await renderPagePng(data, pg, 1.6));
      const c = cross.find((r) => r['exam'] === p.exam && r['code'] === p.code && Number(r['page']) === pg);
      pages.push({
        page: pg,
        image: `pages/p${pg}.png`,
        pdfjsText: pdf.lines.filter((l) => l.page === pg).map((l) => l.text).join('\n'),
        popplerText: popplerPageText(x.source.localFile, pg) ?? '',
        ocrText: (x.ocrText ?? []).filter((o) => o.page === pg).map((o) => o.text).join('\n'),
        visualCheck: c ? { status: c['status'], ocrWords: Number(c['ocrWords'] || 0), found: Number(c['foundInExtraction'] || 0), missingSample: c['missingSample'] } : null,
      });
    }
    const cur = await currentVersion(api, token, p.exam, p.code);
    const v = verdicts.get(`${p.exam}:${p.code}`);
    writeFileSync(join(dir, 'input.json'), JSON.stringify({
      paper: { exam: p.exam, code: p.code, name: p.name, officialSyllabusUrl: p.officialSyllabusUrl }, pageCount: pdf.pageCount,
      machineVerdict: v?.verdict, reasons: v?.reasons ?? [], extractionFlags: x.documentFlags, issues: x.issues,
      pages,
      stored: cur ? { versionId: cur.version.id, verification: cur.version.verification, nodes: cur.nodes.map((nd) => ({ id: nd.id, parentId: nd.parentId, kind: nd.kind, label: nd.label, title: nd.title, body: nd.body, sourcePage: nd.sourcePage, depth: nd.depth, position: nd.position, flags: nd.extractionFlags })) } : null,
    }, null, 1));
    n++;
  }
  return { exported: n };
}

/** Validates a reviewed tree against the paper's own text sources. */
export async function reviewValidate(registry: Registry, paths: Paths, exam?: string, papers?: string[]) {
  const results = [];
  for (const p of registry.papers.filter((x) => (!exam || x.exam === exam) && (!papers?.length || papers.includes(x.code)))) {
    const dir = join(paths.review, p.exam, p.code);
    const f = join(dir, 'reviewed.json');
    if (!existsSync(f)) continue;
    const input = JSON.parse(readFileSync(join(dir, 'input.json'), 'utf8')) as { pageCount: number; pages: { page: number; pdfjsText: string; popplerText: string; ocrText: string; visualCheck: { missingSample?: string } | null }[]; stored: { nodes: { kind: string; label: string | null; title: string; body: string | null; sourcePage: number | null; parentId: string | null; id: string }[] } | null };
    const errors: string[] = [];
    const warnings: string[] = [];
    let r: Reviewed;
    try {
      r = JSON.parse(readFileSync(f, 'utf8')) as Reviewed;
    } catch (e) {
      results.push({ exam: p.exam, code: p.code, ok: false, errors: [`reviewed.json is not valid JSON: ${(e as Error).message}`], warnings, rows: 0 });
      continue;
    }
    if (r.schema !== 'cuet-syllabus-review/1') errors.push('schema must be cuet-syllabus-review/1');
    if (!['CONFIRMED_AS_STORED', 'CORRECTED', 'TRANSCRIBED'].includes(r.decision)) errors.push('decision must be CONFIRMED_AS_STORED, CORRECTED or TRANSCRIBED');
    // Every page classified.
    const classified = new Map((r.pages ?? []).map((x) => [x.page, x.content]));
    for (let pg = 1; pg <= input.pageCount; pg++) if (!classified.has(pg)) errors.push(`page ${pg} is not classified`);
    for (const [pg, c] of classified) if (!['cover', 'instructions', 'syllabus', 'blank', 'other'].includes(c)) errors.push(`page ${pg}: unknown content "${c}"`);
    const nodes: ReviewedNode[] = r.decision === 'CONFIRMED_AS_STORED'
      ? (input.stored?.nodes ?? []).map((n) => ({ ref: n.id, parentRef: n.parentId, kind: n.kind, label: n.label, title: n.title, body: n.body, sourcePage: n.sourcePage ?? 1 }))
      : (r.nodes ?? []);
    if (r.decision !== 'CONFIRMED_AS_STORED' && !nodes.length) errors.push('a CORRECTED or TRANSCRIBED review needs the full nodes tree');
    // Tree validity.
    const refs = new Set<string>();
    for (const n of nodes) {
      if (!n.ref || refs.has(n.ref)) errors.push(`missing or duplicate ref ${n.ref}`);
      if (n.parentRef !== null && !refs.has(n.parentRef)) errors.push(`row ${n.ref}: parent ${n.parentRef} missing or later in the list`);
      refs.add(n.ref);
      if (!KINDS.includes(n.kind)) errors.push(`row ${n.ref}: unknown kind ${n.kind}`);
      if (!n.title?.trim()) errors.push(`row ${n.ref}: empty title`);
      if (!Number.isInteger(n.sourcePage) || n.sourcePage < 1 || n.sourcePage > input.pageCount) errors.push(`row ${n.ref}: sourcePage ${n.sourcePage} outside 1..${input.pageCount}`);
      else if (['cover', 'blank'].includes(classified.get(n.sourcePage) ?? '')) warnings.push(`row ${n.ref} cites page ${n.sourcePage}, classified ${classified.get(n.sourcePage)}`);
    }
    // Structure: the Note box holds only instructions, no cover-page rows, printed units are units, numbering is whole.
    const structure = nodes.length ? checkStructure(nodes, { pageCount: input.pageCount }) : null;
    if (structure) {
      errors.push(...structure.errors.map((e) => `structure: ${e}`));
      warnings.push(...structure.warnings.map((w) => `structure: ${w}`));
    }
    // Text evidence: each row's words found in the page's (and next page's) independent text sources.
    const pageTokens = new Map(input.pages.map((pg) => [pg.page, new Set(tokens(`${pg.pdfjsText}\n${pg.popplerText}\n${pg.ocrText}\n${pg.visualCheck?.missingSample ?? ''}`))]));
    const transcribed = r.decision === 'TRANSCRIBED';
    let unconfirmed = 0;
    const rowChecks: Record<string, { words: number; found: number; pct: number }> = {};
    for (const n of nodes) {
      const ws = tokens(`${n.label ?? ''} ${n.title} ${n.body ?? ''}`);
      const pool = new Set([...(pageTokens.get(n.sourcePage) ?? []), ...(pageTokens.get(n.sourcePage + 1) ?? [])]);
      const found = ws.filter((w) => pool.has(w)).length;
      const pct = ws.length ? Math.round((1000 * found) / ws.length) / 10 : 100;
      rowChecks[n.ref] = { words: ws.length, found, pct };
      if (pct < 90) unconfirmed++;
    }
    if (unconfirmed && !transcribed) warnings.push(`${unconfirmed} row(s) have under 90% of their words in the page's text sources (marked for a person)`);
    // Completeness: share of each syllabus/instructions page's words captured by rows (best source per page).
    const pageCoverage: Record<number, number | null> = {};
    for (const pg of input.pages) {
      const kind = classified.get(pg.page);
      if (kind === 'cover' || kind === 'blank') continue;
      const rowWords = new Set(nodes.filter((n) => n.sourcePage === pg.page || n.sourcePage === pg.page - 1).flatMap((n) => tokens(`${n.label ?? ''} ${n.title} ${n.body ?? ''}`)));
      const best = [pg.pdfjsText, pg.popplerText, pg.ocrText].map((t) => [...new Set(tokens(t))]).filter((t) => t.length >= 5).map((t) => t.filter((w) => rowWords.has(w)).length / t.length);
      pageCoverage[pg.page] = best.length ? Math.round(1000 * Math.max(...best)) / 10 : null;
      if (best.length && Math.max(...best) < 0.9 && kind === 'syllabus') warnings.push(`page ${pg.page}: rows hold only ${pageCoverage[pg.page]}% of the page's words (best text source)`);
    }
    const out = { exam: p.exam, code: p.code, decision: r.decision, ok: errors.length === 0, errors, warnings, rows: nodes.length, unconfirmedRows: unconfirmed, pageCoverage, rowChecks, changes: r.changes ?? [], unresolved: r.unresolved ?? [] };
    writeFileSync(join(dir, 'validation.json'), JSON.stringify(out, null, 1));
    results.push(out);
  }
  return results;
}

/** Stores CORRECTED / TRANSCRIBED trees as a new draft version of the paper (the untouched previous draft is archived). */
export async function reviewImport(registry: Registry, paths: Paths, api: string, token: string, exam?: string, papers?: string[]) {
  const counts = { imported: 0, alreadyPresent: 0, confirmedAsStored: 0, refused: [] as string[], rows: 0 };
  for (const p of registry.papers.filter((x) => (!exam || x.exam === exam) && (!papers?.length || papers.includes(x.code)))) {
    const dir = join(paths.review, p.exam, p.code);
    if (!existsSync(join(dir, 'validation.json'))) continue;
    const val = JSON.parse(readFileSync(join(dir, 'validation.json'), 'utf8')) as { ok: boolean; decision: string; rowChecks: Record<string, { pct: number }>; changes: string[]; unresolved: string[] };
    if (!val.ok) { counts.refused.push(`${p.code} (validation failed)`); continue; }
    if (val.decision === 'CONFIRMED_AS_STORED') { counts.confirmedAsStored++; continue; }
    const r = JSON.parse(readFileSync(join(dir, 'reviewed.json'), 'utf8')) as Reviewed;
    const x = JSON.parse(readFileSync(join(paths.extracted, p.exam, `${p.code}.json`), 'utf8')) as ExtractionResult;
    if (!x.source) continue;
    const depth = new Map<string, number>();
    const position = new Map<string | null, number>();
    const nodes = r.nodes!.map((n) => {
      const d = n.parentRef ? depth.get(n.parentRef)! + 1 : 1;
      depth.set(n.ref, d);
      const pos = position.get(n.parentRef) ?? 0;
      position.set(n.parentRef, pos + 1);
      const pct = val.rowChecks[n.ref]?.pct ?? 0;
      const flags = ['ai_visual_review', ...(r.decision === 'TRANSCRIBED' ? ['ai_transcription'] : []), ...(pct < 90 ? ['text_not_in_sources'] : [])];
      return {
        ref: n.ref, parentRef: n.parentRef, kind: n.kind, label: n.label || null, title: n.title.trim(), body: n.body?.trim() ? n.body : null,
        position: pos, depth: d, sourcePage: n.sourcePage, flags,
        check: { ok: pct >= 90 && r.decision !== 'TRANSCRIBED', missingOnPage: [], secondExtractorAgreementPct: Math.min(100, pct), flags },
      };
    });
    const treeHash = createHash('sha256').update(JSON.stringify(nodes.map((n) => [n.ref, n.parentRef, n.kind, n.label, n.title, n.body, n.sourcePage]))).digest('hex').slice(0, 16);
    const notes = [
      r.decision === 'TRANSCRIBED' ? 'Transcribed from the page images with AI assistance (no machine text source exists for this script).' : 'Corrected against the page images with AI assistance; every row checked against the PDF text sources.',
      r.changes?.length ? `Changes: ${r.changes.join('; ')}` : '',
      r.unresolved?.length ? `For a person to decide: ${r.unresolved.join('; ')}` : '',
      'Not verified by a person.',
    ].filter(Boolean).join(' ').slice(0, 3900);
    const res = await call(api, token, 'POST', '/api/admin/imports/syllabus', {
      idempotencyKey: `syllabus-ai-review:${p.exam}:${p.year}:${p.code}:${x.source.sha256}:${treeHash}`,
      exam: p.exam, year: p.year, paperCode: p.code, supersedeUntouchedDraft: true,
      source: {
        kind: 'OFFICIAL_SYLLABUS', title: x.source.title, publisher: 'National Testing Agency (NTA)', url: x.source.url, listedOnUrl: x.source.listedOnUrl,
        retrievedAt: x.source.retrievedAt, sha256: x.source.sha256, byteSize: x.source.byteSize, mimeType: 'application/pdf', pageCount: x.source.pageCount,
        r2Key: `sources/${x.source.sha256}.pdf`,
      },
      extractor: { name: 'ai-visual-review', version: '1', mode: r.decision === 'TRANSCRIBED' ? 'ai_transcription' : 'page_image_review' },
      notes, nodes, tables: [], figures: [],
    });
    if (res['status'] === 'DUPLICATE' && !res['replayed']) counts.refused.push(`${p.code} (current version is not an untouched draft: a person has worked on it, or it is machine-verified)`);
    else if (res['replayed']) counts.alreadyPresent++;
    else { counts.imported++; counts.rows += Number(res['nodesCreated'] ?? 0); }
  }
  return counts;
}
