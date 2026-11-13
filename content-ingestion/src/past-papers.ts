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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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
