/**
 * One-off, local only: loads an admissions import pack (programmes and facts, all as DRAFT) into the LOCAL development database
 * through the same service functions and validation the admin console uses. It never touches production, never publishes
 * anything, and never changes an existing row: every statement it makes is an INSERT of a new record (plus the source approvals
 * named in the pack).
 *
 *   npx tsx scripts/import-admissions-pack.mts <pack.json> [--check]    --check validates the pack and writes nothing
 *
 * Run from `backend/`. The database is the local one that `wrangler dev` uses (.wrangler/state).
 */
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { factInputSchema, factProblems, programmeProblems, programmeInputSchema, sourceInputSchema, createSource, decideSource, importFacts, importProgrammes, universitySlug } from '../src/services/admissions';
import { newId } from '../src/lib/hash';

interface Pack {
  actor: string;
  approver: string;
  checkedOn: string;
  sources: Record<string, { url: string; title: string; universityName: string; approvalNote: string } & Record<string, unknown>>;
  universities: Record<string, { source: string; programmes: Record<string, unknown>[]; facts: Record<string, unknown>[] }>;
}

const [packPath, flag] = process.argv.slice(2);
if (!packPath) throw new Error('Usage: tsx scripts/import-admissions-pack.mts <pack.json> [--check]');
const pack = JSON.parse(readFileSync(packPath, 'utf8')) as Pack;
const checkOnly = flag === '--check';

// 1. Validate every record against the real schemas before anything is written.
const problems: string[] = [];
for (const [key, s] of Object.entries(pack.sources)) {
  const r = sourceInputSchema.safeParse(s);
  if (!r.success) problems.push(`source ${key}: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
}
for (const [uni, u] of Object.entries(pack.universities)) {
  for (const [i, p] of u.programmes.entries()) {
    const r = programmeInputSchema.safeParse({ ...p, sourceId: 'x' });
    if (!r.success) problems.push(`${uni} programme ${i + 1} (${String(p['programmeName'])}): ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
    else for (const m of programmeProblems(r.data)) problems.push(`${uni} programme ${i + 1} (${String(p['programmeName'])}): ${m}`);
  }
  for (const [i, f] of u.facts.entries()) {
    const r = factInputSchema.safeParse({ ...f, universityName: String(u.programmes[0]!['universityName']), sourceId: 'x', programmeId: f['programmeName'] ? 'x' : null, exam: 'CUET_UG', year: 2026, checkedOn: pack.checkedOn });
    if (!r.success) problems.push(`${uni} fact ${i + 1} (${String(f['programmeName'])} ${String(f['kind'])}): ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
    else for (const m of factProblems(r.data)) problems.push(`${uni} fact ${i + 1} (${String(f['programmeName'])} ${String(f['kind'])}): ${m}`);
  }
}
if (problems.length) {
  console.error(`${problems.length} problems in the pack:\n` + problems.slice(0, 30).join('\n'));
  process.exit(1);
}
const counts = Object.fromEntries(Object.entries(pack.universities).map(([k, u]) => [k, { programmes: u.programmes.length, facts: u.facts.length }]));
console.log('Pack is valid:', JSON.stringify(counts));
if (checkOnly) process.exit(0);

// 2. Open the local database.
const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const audit = (action: string, entity: string, id: string, detail: unknown) =>
  db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), pack.approver, action, entity, id, JSON.stringify(detail), new Date().toISOString()).run();

const summary: Record<string, unknown> = {};
try {
  // 3. Sources: add each (as PROPOSED), then record the approval the CEO gave. An existing source is reused, never changed.
  const sourceIds: Record<string, string> = {};
  for (const [key, s] of Object.entries(pack.sources)) {
    const existing = await db.prepare('SELECT id, status FROM admission_sources WHERE url = ?').bind(s.url).first<{ id: string; status: string }>();
    if (existing) {
      sourceIds[key] = existing.id;
      summary[`source ${key}`] = `already in the register (${existing.status}); left as it is`;
      if (existing.status !== 'APPROVED') throw new Error(`Source ${key} exists but is ${existing.status}; stopping so nothing existing is changed.`);
      continue;
    }
    const { approvalNote: _n, ...input } = s;
    const made = await createSource(db, sourceInputSchema.parse(input), pack.actor);
    await decideSource(db, made.id, { action: 'APPROVE', checkedOn: pack.checkedOn, note: s.approvalNote }, pack.approver);
    await audit('ADMISSION_SOURCE_APPROVED', 'ADMISSION_SOURCE', made.id, { url: s.url, classification: 'Official - Use with Care', basis: pack.approver });
    sourceIds[key] = made.id;
    summary[`source ${key}`] = 'added and approved';
  }

  // 4. Programmes then facts, per university, each call all-or-nothing and DRAFT only.
  for (const [uni, u] of Object.entries(pack.universities)) {
    const sourceId = sourceIds[u.source]!;
    const programmes = u.programmes.map((p) => programmeInputSchema.parse({ ...p, sourceId }));
    const dry = await importProgrammes(db, { programmes }, pack.actor, true);
    const made = await importProgrammes(db, { programmes }, pack.actor, false);
    const slug = universitySlug(String(u.programmes[0]!['universityName']));
    const { results } = await db.prepare(`SELECT id, programme_name FROM admission_programmes WHERE university_slug = ? AND academic_year = '2026-27' AND exam_code = 'CUET_UG'`).bind(slug).all<{ id: string; programme_name: string }>();
    const idOf = new Map(results.map((r) => [r.programme_name, r.id]));
    const facts = u.facts.map((f) => {
      const name = f['programmeName'] as string | null;
      const programmeId = name ? idOf.get(name) : null;
      if (name && !programmeId) throw new Error(`No programme row for ${name}`);
      const { programmeName: _p, ...rest } = f;
      return factInputSchema.parse({ ...rest, universityName: String(u.programmes[0]!['universityName']), sourceId, exam: 'CUET_UG', year: 2026, checkedOn: pack.checkedOn, programmeId: programmeId ?? null });
    });
    const factDry = await importFacts(db, { facts }, pack.actor, true);
    const factMade = await importFacts(db, { facts }, pack.actor, false);
    await audit('ADMISSION_PACK_IMPORTED', 'UNIVERSITY', slug, { programmes: made, facts: factMade, status: 'DRAFT', cycle: '2026-27' });
    summary[uni] = { programmesDryRun: dry, programmes: made, factsDryRun: factDry, facts: factMade };
  }
  console.log(JSON.stringify(summary, null, 1));
} finally {
  await dispose();
}
