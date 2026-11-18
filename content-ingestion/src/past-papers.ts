/**
 * Previous-year paper packs: one JSON file per paper under content/past-papers/<EXAM>/<year>/.
 *
 *   npm run ingest -- pyq-validate [--exam X] [--year Y]   checks every pack with the API's own rules; writes nothing
 *   npm run ingest -- pyq-import   [--exam X] [--year Y]   stores valid packs as DRAFT papers (never published by a tool)
 *
 * A pack must name its source document (address, SHA-256, retrieval date) and a registered usage permission.
 * The server refuses a pack whose stored answer key differs from the official key it cites, or that leaves a
 * question of the paper unaccounted for. Format: see docs/past-papers.md.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

interface PackFigure { key: string; file: string; alt: string; caption?: string; page: number; mimeType: 'image/png' | 'image/webp' | 'image/svg+xml' }

/** Uploads the figures a pack names (to the existing media store) and registers each as a media asset, before the paper is imported. Repeatable: the same file is stored once. */
async function uploadFigures(file: string, body: { figures?: PackFigure[]; exam?: string; year?: number; subjectCode?: string; questionPaperSource?: { title?: string } }, api: string, token: string): Promise<string[]> {
  const problems: string[] = [];
  for (const f of body.figures ?? []) {
    const path = join(dirname(file), f.file);
    if (!existsSync(path)) { problems.push(`Figure file not found: ${f.file}`); continue; }
    const bytes = readFileSync(path);
    const png = f.mimeType === 'image/png' && bytes.length > 24 ? { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) } : null;
    const headers = { 'x-admin-token': token, 'x-admin-actor': 'past-paper-cli' };
    const up = await fetch(`${api}/api/admin/files/media`, { method: 'PUT', headers: { ...headers, 'content-type': f.mimeType }, body: bytes });
    const stored = (await up.json().catch(() => ({}))) as { r2Key?: string };
    if (!up.ok || !stored.r2Key) { problems.push(`Could not store ${f.file} (${up.status})`); continue; }
    const reg = await fetch(`${api}/api/admin/content/media/${f.key}`, {
      method: 'PUT', headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'IMAGE', r2Key: stored.r2Key, sha256: createHash('sha256').update(bytes).digest('hex'), mimeType: f.mimeType, byteSize: bytes.length, width: png?.w ?? null, height: png?.h ?? null, altText: f.alt, caption: f.caption ?? null, longDescription: null, curriculumNodeId: null, origin: 'LICENSED', usagePermissionId: 'perm_nta_reference', attribution: `Cut from ${body.questionPaperSource?.title ?? 'the official question paper'}, page ${f.page}` }),
    });
    if (!reg.ok) problems.push(`Could not register ${f.key} (${reg.status})`);
  }
  return problems;
}

export interface PackReport { file: string; ok: boolean; outcome?: string; questions?: number; dropped?: number; errors: string[]; warnings: string[] }

function packFiles(root: string, exam?: string, year?: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.json')) out.push(p);
    }
  };
  walk(root);
  return out.filter((f) => {
    const parts = relative(root, f).split(/[\\/]/);
    return (!exam || parts[0] === exam) && (!year || parts[1] === year);
  });
}

export async function runPastPapers(root: string, api: string, token: string, opts: { exam?: string; year?: string; dryRun: boolean }): Promise<PackReport[]> {
  const reports: PackReport[] = [];
  for (const file of packFiles(root, opts.exam, opts.year)) {
    const name = relative(root, file);
    let body: unknown;
    try {
      body = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      reports.push({ file: name, ok: false, errors: [`Not valid JSON: ${(e as Error).message}`], warnings: [] });
      continue;
    }
    if (!opts.dryRun) {
      const figureProblems = await uploadFigures(file, body as Parameters<typeof uploadFigures>[1], api, token);
      if (figureProblems.length) { reports.push({ file: name, ok: false, errors: figureProblems, warnings: [] }); continue; }
    }
    const res = await fetch(`${api}/api/admin/past-papers${opts.dryRun ? '?dryRun=1' : ''}`, { method: 'POST', headers: { 'x-admin-token': token, 'x-admin-actor': 'past-paper-cli', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { outcome?: string; questions?: number; dropped?: number; warnings?: string[]; error?: { message?: string; details?: unknown } };
    if (res.ok) reports.push({ file: name, ok: true, outcome: json.outcome, questions: json.questions, dropped: json.dropped, errors: [], warnings: json.warnings ?? [] });
    else {
      const d = json.error?.details as { errors?: string[]; warnings?: string[] } | { path?: (string | number)[]; message?: string }[] | undefined;
      const errors = Array.isArray(d) ? d.map((i) => `${(i.path ?? []).join('.')}: ${i.message}`) : d?.errors ?? [json.error?.message ?? `The server answered ${res.status}`];
      reports.push({ file: name, ok: false, errors, warnings: Array.isArray(d) ? [] : d?.warnings ?? [] });
    }
  }
  return reports;
}

export function printPastPapers(reports: PackReport[], dryRun: boolean) {
  if (!reports.length) console.log('No previous-year paper packs found under content/past-papers/.');
  for (const r of reports) {
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.file}${r.ok ? `  ${r.outcome}: ${r.questions} questions, ${r.dropped} dropped` : ''}`);
    for (const e of r.errors) console.log(`     x ${e}`);
    for (const w of r.warnings) console.log(`     ! ${w}`);
  }
  if (reports.length) console.log(`${reports.filter((r) => r.ok).length} of ${reports.length} packs ${dryRun ? 'valid' : 'stored as drafts'}`);
}
