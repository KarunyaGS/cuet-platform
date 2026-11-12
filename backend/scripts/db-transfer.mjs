// Full CUET database transfer: local development D1 -> production D1 (cuet-db), with backup and proof.
//
//   node scripts/db-transfer.mjs backup <dir>                    full local backup: SQL dump + raw D1/R2 state copy
//   node scripts/db-transfer.mjs export <file.sql>               every application table, parents first, INSERT OR IGNORE
//   node scripts/db-transfer.mjs load <file.sql> --target local  production config, local copy (rehearsal)
//   node scripts/db-transfer.mjs load <file.sql> --target remote production cuet-db (needs CUET_REMOTE_DATA_APPROVED=yes)
//   node scripts/db-transfer.mjs compare --target local|remote   schema, row counts and row-by-row identity vs local dev
//
// Idempotent: INSERT OR IGNORE never overwrites a row that already exists (same primary key), so re-running is safe
// and anything already reviewed in production is never replaced. `compare` proves the result is identical.
// Excluded: d1_migrations (Wrangler records applied migrations itself) and Cloudflare/SQLite internal tables.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wrangler = [join(root, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync);
// user_sessions: development sign-in tokens must not work in production (accounts are copied; people sign in again).
const EXCLUDE = new Set(['d1_migrations', '_cf_KV', '_cf_METADATA', 'sqlite_sequence', 'sqlite_stat1', 'user_sessions']);
const args = process.argv.slice(2);
const [cmd, file] = args;
const target = args.includes('--target') ? args[args.indexOf('--target') + 1] : 'local';
const DEV = ['--local'];
const TARGET = target === 'remote' ? ['--env', 'production', '--remote'] : ['--env', 'production', '--local'];
const w = (a) => execFileSync(process.execPath, [wrangler, ...a], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1_000_000_000, env: { ...process.env, TEMP: process.env.TEMP ?? 'D:/tmp' } });
const q = (where, sql) => JSON.parse(w(['d1', 'execute', 'DB', ...where, '--json', '--command', sql]))[0].results;

function tablesInOrder(where) {
  const tables = q(where, `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).map((r) => r.name).filter((t) => !EXCLUDE.has(t) && !t.startsWith('sqlite_') && !t.startsWith('_cf_'));
  const deps = new Map(tables.map((t) => [t, new Set(q(where, `SELECT "table" AS parent FROM pragma_foreign_key_list('${t}')`).map((r) => r.parent).filter((p) => p !== t && tables.includes(p)))]));
  const out = [];
  const seen = new Set();
  const visit = (t, path = []) => {
    if (seen.has(t)) return;
    if (path.includes(t)) throw new Error(`Foreign-key cycle: ${[...path, t].join(' -> ')}`);
    for (const p of deps.get(t)) visit(p, [...path, t]);
    seen.add(t);
    out.push(t);
  };
  tables.forEach((t) => visit(t));
  return out;
}

function exportData(where, outFile, tables) {
  const tmp = `${outFile}.raw`;
  w(['d1', 'export', 'DB', ...where, '--no-schema', '--output', tmp, ...tables.flatMap((t) => ['--table', t])]);
  const byTable = new Map(tables.map((t) => [t, []]));
  for (const line of readFileSync(tmp, 'utf8').split('\n')) {
    const m = /^INSERT INTO "?([A-Za-z_]+)"?/.exec(line);
    if (m && byTable.has(m[1])) byTable.get(m[1]).push(line);
    else if (line.trim() && !/^(PRAGMA|BEGIN|COMMIT)/i.test(line.trim())) throw new Error(`Unexpected statement in export: ${line.slice(0, 120)}`);
  }
  return byTable;
}

const schemaOf = (where) =>
  q(where, `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations' ORDER BY type, name`)
    .map((r) => `${r.type}|${r.name}|${r.tbl_name}|${(r.sql ?? '').replace(/\s+/g, ' ')}`);

if (cmd === 'backup') {
  const dir = file;
  mkdirSync(dir, { recursive: true });
  w(['d1', 'export', 'DB', '--local', '--output', join(dir, 'local-d1-full.sql')]);
  for (const part of ['d1', 'r2']) {
    const src = join(root, '.wrangler', 'state', 'v3', part);
    if (existsSync(src)) cpSync(src, join(dir, 'wrangler-state', part), { recursive: true });
  }
  const sql = readFileSync(join(dir, 'local-d1-full.sql'));
  writeFileSync(join(dir, 'MANIFEST.txt'), [
    `CUET local backup ${new Date().toISOString()}`,
    `local-d1-full.sql  sha256 ${createHash('sha256').update(sql).digest('hex')}  ${sql.length} bytes (schema + data, consistent export)`,
    'wrangler-state/    raw copy of backend/.wrangler/state/v3/{d1,r2} (local D1 file and local R2 objects)',
    'Restore local D1: stop wrangler dev, then copy wrangler-state/d1 back to backend/.wrangler/state/v3/d1',
    'Contains password hashes of local accounts: keep private, never commit.',
  ].join('\n') + '\n');
  console.log(`Backup written to ${dir}`);
} else if (cmd === 'export') {
  const tables = tablesInOrder(DEV);
  const byTable = exportData(DEV, file, tables);
  const lines = ['PRAGMA defer_foreign_keys = true;', ...tables.flatMap((t) => byTable.get(t).map((l) => l.replace(/^INSERT INTO /, 'INSERT OR IGNORE INTO ')))];
  writeFileSync(file, lines.join('\n') + '\n');
  const counts = Object.fromEntries(tables.map((t) => [t, byTable.get(t).length]));
  writeFileSync(`${file}.manifest.json`, JSON.stringify({ exportedAt: new Date().toISOString(), tables, counts, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }, null, 1));
  console.log(`${tables.length} tables, ${Object.values(counts).reduce((a, b) => a + b, 0)} rows -> ${file}`);
  console.log(JSON.stringify(counts));
} else if (cmd === 'load') {
  if (target === 'remote' && process.env.CUET_REMOTE_DATA_APPROVED !== 'yes') {
    console.error('Refused: importing into the remote production database (cuet-db) needs explicit approval. Set CUET_REMOTE_DATA_APPROVED=yes only after approval.');
    process.exit(1);
  }
  const out = w(['d1', 'execute', 'DB', ...TARGET, '--file', file, '--yes']);
  console.log(out.split('\n').filter((l) => /executed|rows|error|Imported|Processed/i.test(l)).join('\n'));
} else if (cmd === 'compare') {
  const report = { target, schema: null, tables: {}, foreignKeyViolations: null, identical: true };
  const a = schemaOf(DEV);
  const b = schemaOf(TARGET);
  const onlyDev = a.filter((x) => !b.includes(x));
  const onlyTarget = b.filter((x) => !a.includes(x));
  report.schema = { objects: a.length, identical: !onlyDev.length && !onlyTarget.length, onlyInDev: onlyDev.map((x) => x.split('|')[1]), onlyInTarget: onlyTarget.map((x) => x.split('|')[1]) };
  const tables = tablesInOrder(DEV);
  const dev = exportData(DEV, 'D:/tmp/cuet-compare-dev.sql', tables);
  const tgt = exportData(TARGET, 'D:/tmp/cuet-compare-target.sql', tables);
  for (const t of tables) {
    const x = dev.get(t).slice().sort();
    const y = tgt.get(t).slice().sort();
    const same = x.length === y.length && x.every((l, i) => l === y[i]);
    report.tables[t] = { dev: x.length, target: y.length, rowsIdentical: same };
    if (!same) {
      // Reference rows inserted by migrations carry their own creation time in each database. Compare every
      // other column; only a difference outside created_at/updated_at counts as a mismatch.
      const cols = q(DEV, `SELECT name FROM pragma_table_info('${t}') ORDER BY cid`).map((r) => r.name).filter((c) => c !== 'created_at' && c !== 'updated_at');
      const sql = `SELECT ${cols.map((c) => `"${c}"`).join(', ')} FROM "${t}" ORDER BY ${cols.map((c) => `"${c}"`).join(', ')}`;
      const sameApartFromTimestamps = JSON.stringify(q(DEV, sql)) === JSON.stringify(q(TARGET, sql));
      report.tables[t].identicalApartFromTimestamps = sameApartFromTimestamps;
      if (!sameApartFromTimestamps) report.identical = false;
    }
  }
  report.foreignKeyViolations = q(TARGET, 'PRAGMA foreign_key_check').length;
  if (report.foreignKeyViolations || !report.schema.identical) report.identical = false;
  writeFileSync(`D:/tmp/cuet-compare-${target}.json`, JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ schema: report.schema, foreignKeyViolations: report.foreignKeyViolations, identical: report.identical, tablesCompared: tables.length, timestampOnly: Object.entries(report.tables).filter(([, v]) => !v.rowsIdentical && v.identicalApartFromTimestamps).map(([k]) => k), mismatched: Object.entries(report.tables).filter(([, v]) => !v.rowsIdentical && !v.identicalApartFromTimestamps) }, null, 1));
} else {
  console.log('Usage: backup <dir> | export <file> | load <file> --target local|remote | compare --target local|remote');
}
