/**
 * DRY RUN. Reads the 109 admission programmes from the local development database and runs the server-side requirement reader over each
 * programme's printed subject rule. It opens the database READ ONLY and writes nothing to it. The only file it writes is the report.
 *
 *   npx tsx scripts/admission-requirements-dry-run.mts [--db <path to .sqlite>] [--out <report.json>]
 *
 * Run from `backend/`. Without --db it uses the local database that `wrangler dev` uses (.wrangler/state).
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describeRule, parseRequirementText, type ParsedRule } from '../src/services/admission-requirements';
import { CUET_UG_PAPERS } from '../src/services/admission-subjects';
import { parseRule as frontendParse } from '../../frontend/src/subject-rule';

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };

function defaultDb() {
  const dir = join(import.meta.dirname, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite').map((f) => join(dir, f));
  return files.sort((a, b) => statSync(b).size - statSync(a).size)[0]!;
}

const db = new DatabaseSync(arg('--db') ?? defaultDb(), { readOnly: true });
const programmes = db.prepare(`SELECT id, university_slug, university_name, programme_name, status, academic_year FROM admission_programmes ORDER BY university_slug, programme_name`).all() as Record<string, string>[];
const facts = db.prepare(`SELECT programme_id, kind, status, value_text, review_flag FROM admission_facts WHERE programme_id IS NOT NULL AND kind IN ('SUBJECTS','ELIGIBILITY')`).all() as Record<string, string | null>[];

interface Row {
  id: string; university: string; programme: string; programmeStatus: string; source: 'SUBJECTS' | 'ELIGIBILITY' | 'NONE';
  flagged: boolean; rule: ParsedRule; lines: string[]; frontendCombos: number | null; textStart: string;
}
const rows: Row[] = [];
for (const p of programmes) {
  const mine = facts.filter((f) => f.programme_id === p.id);
  // The student page shows the required-subjects text, else the eligibility text. The reader follows the same order.
  const subj = mine.find((f) => f.kind === 'SUBJECTS');
  const elig = mine.find((f) => f.kind === 'ELIGIBILITY');
  const chosen = subj ?? elig;
  const rule = parseRequirementText(chosen?.value_text ?? null);
  const fe = frontendParse(chosen?.value_text ?? null);
  rows.push({
    id: p.id!, university: p.university_slug!, programme: p.programme_name!, programmeStatus: p.status!,
    source: subj ? 'SUBJECTS' : elig ? 'ELIGIBILITY' : 'NONE', flagged: mine.some((f) => f.review_flag), rule, lines: describeRule(rule),
    frontendCombos: fe ? fe.combos.length : null, textStart: (chosen?.value_text ?? '').replace(/\s+/g, ' ').slice(0, 160),
  });
}

const count = <T,>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;
const byStatus = (s: string) => count(rows, (r) => r.rule.status === s);
const issueCounts = new Map<string, number>();
const unknown = new Map<string, number>();
const ambiguous = new Map<string, number>();
const partMaps = new Map<string, number>();
const variants = new Map<string, number>();
for (const r of rows) for (const i of r.rule.issues) {
  issueCounts.set(i.code, (issueCounts.get(i.code) ?? 0) + 1);
  if (i.code === 'UNKNOWN_SUBJECT' && i.text) unknown.set(i.text, (unknown.get(i.text) ?? 0) + 1);
  if (i.code === 'AMBIGUOUS_SUBJECT' && i.text) ambiguous.set(i.text, (ambiguous.get(i.text) ?? 0) + 1);
  if (i.code === 'PART_NAME_MAPPING' && i.text) partMaps.set(i.text, (partMaps.get(i.text) ?? 0) + 1);
  if (i.code === 'VARIANT_NAME_MAPPING' && i.text) variants.set(i.text, (variants.get(i.text) ?? 0) + 1);
}
const needsManual = rows.filter((r) => r.rule.status !== 'PARSED' || r.flagged || r.rule.issues.some((i) => i.severity === 'REVIEW' && i.code !== 'GROUP_MEMBERSHIP_NOT_IN_TEXT'));

const report = {
  generatedAt: new Date().toISOString(),
  note: 'Dry run. Nothing was written to the database.',
  papersKnown: CUET_UG_PAPERS.length,
  total: rows.length,
  byUniversity: Object.fromEntries([...new Set(rows.map((r) => r.university))].map((u) => [u, rows.filter((r) => r.university === u).length])),
  ruleSource: { SUBJECTS: count(rows, (r) => r.source === 'SUBJECTS'), ELIGIBILITY: count(rows, (r) => r.source === 'ELIGIBILITY'), NONE: count(rows, (r) => r.source === 'NONE') },
  status: { PARSED: byStatus('PARSED'), PARTIAL: byStatus('PARTIAL'), UNPARSED: byStatus('UNPARSED') },
  families: Object.fromEntries([...new Set(rows.map((r) => r.rule.family))].map((f) => [f, rows.filter((r) => r.rule.family === f).length])),
  evaluableNow: count(rows, (r) => r.rule.evaluable),
  needGroupMembership: count(rows, (r) => r.rule.groupsNeeded.length > 0),
  withExtraTest: count(rows, (r) => r.rule.extraTests.length > 0),
  needsManualVerification: needsManual.length,
  flaggedInDatabase: count(rows, (r) => r.flagged),
  issueCounts: Object.fromEntries(issueCounts),
  unknownSubjects: Object.fromEntries(unknown),
  ambiguousSubjects: Object.fromEntries(ambiguous),
  partNameMappings: Object.fromEntries(partMaps),
  variantNameMappings: Object.fromEntries(variants),
  frontendParity: {
    comparedDuStyle: count(rows, (r) => r.rule.family === 'DU_COMBINATIONS'),
    sameCombinationCount: count(rows, (r) => r.rule.family === 'DU_COMBINATIONS' && r.frontendCombos === r.rule.combinations.length),
    frontendReadsOtherFamilies: count(rows, (r) => r.rule.family !== 'DU_COMBINATIONS' && r.frontendCombos !== null),
  },
  programmes: rows.map((r) => ({ id: r.id, university: r.university, programme: r.programme, status: r.programmeStatus, ruleFrom: r.source, family: r.rule.family, result: r.rule.status, evaluable: r.rule.evaluable, flagged: r.flagged, lines: r.lines, issues: r.rule.issues.map((i) => `${i.severity} ${i.code}: ${i.message}`), textStart: r.textStart })),
};

const out = arg('--out');
if (out) writeFileSync(out, JSON.stringify(report, null, 1));
const { programmes: _p, ...summary } = report;
console.log(JSON.stringify(summary, null, 1));
