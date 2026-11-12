/**
 * Syllabus ingestion CLI.
 *   npm run ingest -- discover                 list official papers from NTA pages and check them against the bulletins
 *   npm run ingest -- extract [--exam CUET_UG|CUET_PG] [--paper CODE] [--only-unfinished] [--refresh]
 *   npm run ingest -- status                   summarise the last extraction report
 *   npm run ingest -- import [--allow-incomplete] [--api http://127.0.0.1:8787]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printAuditSummary, runAudit } from './audit';
import { printCrosscheck, runCrosscheck } from './crosscheck';
import { runTrace } from './trace';
import { printVerification, runVerification } from './verify';
import { discover } from './discover';
import { extractPaper } from './extract';
import { adminToken, runImport } from './importer';
import { importPacks, renderSvg, snapshot, validateAll } from './content';
import { parseCsv } from './verify';
import { reviewExport, reviewImport, reviewValidate } from './syllabus-review';
import { importMissing } from './import-missing';
import type { ExtractionResult, Registry } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');
export const PATHS = {
  registry: join(here, '..', 'registry', 'cuet-2026-official-papers.json'),
  checks: join(here, '..', 'registry', 'cuet-2026-paper-list-checks.json'),
  cache: join(repo, 'storage', 'cache'),
  extracted: join(repo, 'storage', 'local', 'extracted'),
  figures: join(repo, 'storage', 'local', 'figures'),
  review: join(repo, 'storage', 'local', 'review-pages'),
  audit: join(repo, 'storage', 'local', 'audit'),
  report: join(repo, 'storage', 'local', 'extraction-report.json'),
  progressLog: join(repo, 'storage', 'local', 'extraction-progress.log'),
  verification: join(repo, 'storage', 'local', 'verification'),
  syllabusReview: join(repo, 'storage', 'local', 'syllabus-review'),
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

function loadRegistry(): Registry {
  if (!existsSync(PATHS.registry)) throw new Error('No registry yet. Run: npm run ingest -- discover');
  return JSON.parse(readFileSync(PATHS.registry, 'utf8')) as Registry;
}

export function resultFile(r: { paper: { exam: string; code: string } }): string {
  return join(PATHS.extracted, r.paper.exam, `${r.paper.code}.json`);
}

type ReportRow = {
  exam: string; code: string; name: string; status: string; reason: string | null; method: string | null; pages: number | null;
  sha256: string | null; nodes: number; byKind: Record<string, number>; tables: number; figures: number;
  ocrLowConfidenceLines: number; meanOcrConfidence: number | null; unparsedLines: number; flags: string[];
};

function summarise(r: ExtractionResult): ReportRow {
  const byKind: Record<string, number> = {};
  for (const n of r.nodes) byKind[n.kind] = (byKind[n.kind] ?? 0) + 1;
  return {
    exam: r.paper.exam, code: r.paper.code, name: r.paper.name, status: r.status, reason: r.reason, method: r.method,
    pages: r.source?.pageCount ?? null, sha256: r.source?.sha256 ?? null, nodes: r.nodes.length, byKind, tables: r.tables.length,
    figures: r.figures.length, ocrLowConfidenceLines: r.quality.ocrLowConfidenceLines, meanOcrConfidence: r.quality.meanOcrConfidence,
    unparsedLines: r.quality.unparsedLines, flags: r.documentFlags,
  };
}

async function cmdDiscover() {
  const { registry, checks } = await discover();
  mkdirSync(dirname(PATHS.registry), { recursive: true });
  writeFileSync(PATHS.registry, JSON.stringify(registry, null, 2) + '\n');
  writeFileSync(PATHS.checks, JSON.stringify({ checkedAt: registry.generatedAt, checks }, null, 2) + '\n');
  for (const c of checks) {
    console.log(`${c.exam}: ${c.codesOnSyllabusPages} papers on syllabus pages, ${c.codesInBulletin} codes in bulletin -> ${c.matches ? 'MATCH' : 'MISMATCH'}`);
    if (c.missingFromSyllabusPages.length) console.log('  in bulletin but no syllabus link:', c.missingFromSyllabusPages.join(', '));
    if (c.notInBulletin.length) console.log('  on syllabus pages but not found in bulletin text:', c.notInBulletin.join(', '));
  }
}

async function cmdExtract() {
  const registry = loadRegistry();
  const exam = option('exam');
  const paperCode = option('paper');
  const onlyUnfinished = flag('only-unfinished');
  const previous: ReportRow[] = existsSync(PATHS.report) ? (JSON.parse(readFileSync(PATHS.report, 'utf8')) as { rows: ReportRow[] }).rows : [];
  const rows = new Map(previous.map((r) => [`${r.exam}:${r.code}`, r]));
  const todo = registry.papers.filter(
    (p) => (!exam || p.exam === exam) && (!paperCode || p.code === paperCode) && (!onlyUnfinished || rows.get(`${p.exam}:${p.code}`)?.status !== 'EXTRACTED'),
  );
  // One extraction at a time: two writers once overwrote each other's results.
  const lock = join(PATHS.extracted, '..', 'extract.lock');
  mkdirSync(dirname(lock), { recursive: true });
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8').trim());
    let alive = false;
    if (Number.isInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        alive = false;
      }
    }
    if (alive && pid !== process.pid) throw new Error(`Another extraction (pid ${pid}) is running. Stop it first.`);
  }
  writeFileSync(lock, String(process.pid));
  process.on('exit', () => {
    try {
      if (readFileSync(lock, 'utf8') === String(process.pid)) writeFileSync(lock, '');
    } catch {
      /* ignore */
    }
  });
  console.log(`Extracting ${todo.length} document(s)...`);
  for (const [i, paper] of todo.entries()) {
    const t0 = Date.now();
    let result: ExtractionResult;
    try {
      result = await extractPaper(paper, { cacheDir: PATHS.cache, figuresDir: PATHS.figures, reviewDir: PATHS.review, refresh: flag('refresh'), forceOcrPages: forcedOcrPages(paper.exam, paper.code) });
    } catch (e) {
      result = {
        paper, status: 'FAILED', reason: `Unexpected error: ${(e as Error).message}`, source: null, method: null, nodes: [], tables: [], figures: [],
        documentFlags: [], issues: [], ocrPages: [], reviewImages: [],
        quality: { lines: 0, unparsedLines: 0, ocrLines: 0, ocrLowConfidenceLines: 0, meanOcrConfidence: null },
      };
    }
    mkdirSync(dirname(resultFile(result)), { recursive: true });
    // Write to a temporary file, then rename: a crash never leaves a half-written checkpoint.
    writeFileSync(`${resultFile(result)}.tmp`, JSON.stringify(result, null, 1));
    renameSync(`${resultFile(result)}.tmp`, resultFile(result));
    appendFileSync(PATHS.progressLog, `${new Date().toISOString()} ${paper.exam} ${paper.code} ${result.status} ${result.method ?? '-'} nodes=${result.nodes.length} ocrPages=${result.ocrPages.join(',') || '-'}${result.reason ? ' reason=' + result.reason : ''}\n`);
    rows.set(`${paper.exam}:${paper.code}`, summarise(result));
    console.log(
      `[${i + 1}/${todo.length}] ${paper.exam} ${paper.code} ${result.status} ${result.method ?? ''} nodes=${result.nodes.length} tables=${result.tables.length} figures=${result.figures.length} ${((Date.now() - t0) / 1000).toFixed(1)}s${result.reason ? ' - ' + result.reason : ''}`,
    );
    writeReport(registry, [...rows.values()]);
  }
  markBranding(registry);
  writeReport(registry, [...rows.values()]);
  cmdStatus();
}

/** Images that appear in 3+ different documents are logos or headers, not syllabus figures: drop them. */
function markBranding(registry: Registry) {
  const docsBySha = new Map<string, Set<string>>();
  const results: ExtractionResult[] = [];
  for (const p of registry.papers) {
    const f = resultFile({ paper: p });
    if (!existsSync(f)) continue;
    const r = JSON.parse(readFileSync(f, 'utf8')) as ExtractionResult;
    results.push(r);
    for (const fig of r.figures) (docsBySha.get(fig.sha256) ?? docsBySha.set(fig.sha256, new Set()).get(fig.sha256)!).add(p.code);
  }
  for (const r of results) {
    const before = r.figures.length;
    r.figures = r.figures.filter((fig) => (docsBySha.get(fig.sha256)?.size ?? 0) < 3);
    const dropped = before - r.figures.length;
    r.documentFlags = r.documentFlags.filter((f) => !f.startsWith('branding_images_dropped'));
    if (dropped) r.documentFlags.push(`branding_images_dropped(${dropped})`);
    writeFileSync(resultFile(r), JSON.stringify(r, null, 1));
  }
}

function writeReport(registry: Registry, rows: ReportRow[]) {
  const listed = new Set(registry.papers.map((p) => `${p.exam}:${p.code}`));
  const fresh = rows.filter((r) => listed.has(`${r.exam}:${r.code}`));
  for (const r of fresh) {
    const f = join(PATHS.extracted, r.exam, `${r.code}.json`);
    if (existsSync(f)) {
      const res = JSON.parse(readFileSync(f, 'utf8')) as ExtractionResult;
      r.figures = res.figures.length;
      r.flags = res.documentFlags;
    }
  }
  mkdirSync(dirname(PATHS.report), { recursive: true });
  writeFileSync(PATHS.report, JSON.stringify({ updatedAt: new Date().toISOString(), papersInRegistry: registry.papers.length, rows: fresh }, null, 1));
}

export function cmdStatus() {
  const registry = loadRegistry();
  const report = existsSync(PATHS.report) ? (JSON.parse(readFileSync(PATHS.report, 'utf8')) as { rows: ReportRow[] }) : { rows: [] };
  const byKey = new Map(report.rows.map((r) => [`${r.exam}:${r.code}`, r]));
  for (const exam of ['CUET_UG', 'CUET_PG']) {
    const papers = registry.papers.filter((p) => p.exam === exam);
    const rows = papers.map((p) => byKey.get(`${exam}:${p.code}`));
    const count = (s: string) => rows.filter((r) => r?.status === s).length;
    const kinds: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(r?.byKind ?? {})) kinds[k] = (kinds[k] ?? 0) + v;
    console.log(
      `${exam}: official papers ${papers.length} | extracted ${count('EXTRACTED')} | blocked ${count('BLOCKED')} | failed ${count('FAILED')} | not run ${rows.filter((r) => !r).length}`,
    );
    console.log(`   nodes by kind: ${JSON.stringify(kinds)} | tables ${rows.reduce((s, r) => s + (r?.tables ?? 0), 0)} | figures ${rows.reduce((s, r) => s + (r?.figures ?? 0), 0)} | OCR docs ${rows.filter((r) => r?.method === 'ocr').length}`);
    for (const r of rows.filter((x) => x && x.status !== 'EXTRACTED')) console.log(`   ${r!.status} ${r!.code} ${r!.name}: ${r!.reason}`);
  }
}

/** Pages where the visual (OCR) cross-check found words the text layer lacks: those pages are re-read by OCR. */
function forcedOcrPages(exam: string, code: string): number[] {
  const f = join(PATHS.audit, 'visual-crosscheck.csv');
  if (!flag('ocr-flagged-pages') || !existsSync(f)) return [];
  return parseCsv(readFileSync(f, 'utf8')).filter((r) => r['exam'] === exam && r['code'] === code && r['status'] === 'CHECK').map((r) => Number(r['page']));
}

const cmd = args[0];
try {
  if (cmd === 'discover') await cmdDiscover();
  else if (cmd === 'extract') await cmdExtract();
  else if (cmd === 'status') cmdStatus();
  else if (cmd === 'audit') printAuditSummary(await runAudit(loadRegistry(), { extracted: PATHS.extracted, audit: PATHS.audit, checks: PATHS.checks, cache: PATHS.cache }));
  else if (cmd === 'crosscheck') printCrosscheck(await runCrosscheck(loadRegistry(), { extracted: PATHS.extracted, audit: PATHS.audit, cache: PATHS.cache }));
  else if (cmd === 'trace') await runTrace(loadRegistry(), { extracted: PATHS.extracted, audit: PATHS.audit, verification: PATHS.verification }, option('api') ?? 'http://127.0.0.1:8787');
  else if (cmd === 'verify') printVerification(await runVerification(loadRegistry(), { extracted: PATHS.extracted, audit: PATHS.audit, out: PATHS.verification }));
  else if (cmd === 'import') await runImport({ registry: loadRegistry(), api: option('api') ?? 'http://127.0.0.1:8787', paths: { extracted: PATHS.extracted, verification: PATHS.verification, audit: PATHS.audit }, supersedeDrafts: flag('supersede-drafts'), onlyPapers: (option('paper') ?? '').split(',').filter(Boolean) });
  else if (cmd === 'content-snapshot') {
    const exam = option('exam') ?? 'CUET_UG';
    for (const paper of (option('paper') ?? '').split(',').filter(Boolean)) {
      const r = await snapshot(option('api') ?? 'http://127.0.0.1:8787', adminToken(), exam, 2026, paper);
      console.log(`${exam} ${paper}: ${r.rows} verified rows -> ${r.file}`);
    }
  } else if (cmd === 'content-validate') {
    const reports = validateAll(option('exam'), option('paper'));
    for (const r of reports) {
      console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.file.replace(/^.*packs[\/]/, '')}  words ${r.stats.lessonWords}, solved ${r.stats.solved}, formulas ${r.stats.formulas}, diagrams ${r.stats.diagrams}, tables ${r.stats.tables}, questions ${r.stats.questions} ${JSON.stringify(r.stats.byDifficulty)}`);
      for (const e of r.errors) console.log(`     x ${e}`);
      for (const w of r.warnings) console.log(`     ! ${w}`);
    }
    console.log(`${reports.filter((r) => r.ok).length} of ${reports.length} packs valid`);
    if (reports.some((r) => !r.ok)) process.exitCode = 1;
  } else if (cmd === 'render-svg') {
    const r = await renderSvg(args[1]!, args[2]!, Number(option('width') ?? 900));
    console.log(`Rendered ${args[1]} -> ${args[2]} (${r.width}x${r.height})`);
  } else if (cmd === 'content-import') {
    const r = await importPacks(option('api') ?? 'http://127.0.0.1:8787', adminToken(), option('exam'), option('paper'));
    console.log(JSON.stringify(r, null, 1));
  }
  else if (cmd === 'import-missing') {
    const r = await importMissing(loadRegistry(), { extracted: PATHS.extracted, review: PATHS.syllabusReview, registryDir: dirname(PATHS.registry) }, option('api') ?? 'http://127.0.0.1:8787', adminToken());
    console.log(JSON.stringify(r, null, 1));
  }
  else if (cmd === 'review-export' || cmd === 'review-validate' || cmd === 'review-import') {
    const rp = { extracted: PATHS.extracted, audit: PATHS.audit, verification: PATHS.verification, review: PATHS.syllabusReview };
    const papers = (option('paper') ?? '').split(',').filter(Boolean);
    const api = option('api') ?? 'http://127.0.0.1:8787';
    if (cmd === 'review-export') console.log(JSON.stringify(await reviewExport(loadRegistry(), rp, api, adminToken(), option('set') ?? 'review', option('exam'), papers)));
    else if (cmd === 'review-import') console.log(JSON.stringify(await reviewImport(loadRegistry(), rp, api, adminToken(), option('exam'), papers), null, 1));
    else {
      const res = await reviewValidate(loadRegistry(), rp, option('exam'), papers);
      for (const r of res) {
        console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.exam} ${r.code} ${'decision' in r ? r.decision : ''} rows ${r.rows}${'unconfirmedRows' in r ? `, unconfirmed ${r.unconfirmedRows}` : ''}`);
        for (const e of r.errors) console.log(`     x ${e}`);
        for (const w of r.warnings) console.log(`     ! ${w}`);
      }
      console.log(`${res.filter((r) => r.ok).length} of ${res.length} reviews valid`);
    }
  }
  else console.log('Commands: discover | extract [--exam X] [--paper CODE] [--only-unfinished] [--refresh] | status | import [--allow-incomplete]');
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
}
