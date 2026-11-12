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
  // --exclude-users id1,id2: local test accounts that must not exist in production. Their credentials, roles,
  // sessions, answers and progress are left out too. Recorded in the manifest; nothing else is filtered.
  const excludeUsers = args.includes('--exclude-users') ? args[args.indexOf('--exclude-users') + 1].split(',').filter(Boolean) : [];
  const excluded = {};
  if (excludeUsers.length) {
    const sessions = q(DEV, `SELECT id FROM practice_sessions WHERE user_id IN (${excludeUsers.map((u) => `'${u.replace(/'/g, '')}'`).join(',')})`).map((r) => r.id);
    const drop = (table, ids) => {
      const before = byTable.get(table)?.length ?? 0;
      if (!before) return;
      byTable.set(table, byTable.get(table).filter((l) => !ids.some((id) => l.includes(`'${id}'`))));
      if (before !== byTable.get(table).length) excluded[table] = before - byTable.get(table).length;
    };
    for (const t of ['users', 'user_credentials', 'user_roles', 'practice_sessions', 'topic_progress']) drop(t, excludeUsers);
    drop('practice_answers', sessions);
  }
  const lines = ['PRAGMA defer_foreign_keys = true;', ...tables.flatMap((t) => byTable.get(t).map((l) => l.replace(/^INSERT INTO /, 'INSERT OR IGNORE INTO ')))];
  writeFileSync(file, lines.join('\n') + '\n');
  const counts = Object.fromEntries(tables.map((t) => [t, byTable.get(t).length]));
  writeFileSync(`${file}.manifest.json`, JSON.stringify({ exportedAt: new Date().toISOString(), tables, counts, excludedTables: [...EXCLUDE], excludedTestAccounts: excludeUsers, excludedRows: excluded, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }, null, 1));
  if (Object.keys(excluded).length) console.log(`excluded (test accounts): ${JSON.stringify(excluded)}`);
  console.log(`${tables.length} tables, ${Object.values(counts).reduce((a, b) => a + b, 0)} rows -> ${file}`);
  console.log(JSON.stringify(counts));
} else if (cmd === 'load') {
  if (target === 'remote' && process.env.CUET_REMOTE_DATA_APPROVED !== 'yes') {
    console.error('Refused: importing into the remote production database (cuet-db) needs explicit approval. Set CUET_REMOTE_DATA_APPROVED=yes only after approval.');
    process.exit(1);
  }
  // Remote file execution stops after 15,000 statements, so load in chunks well below that. Every statement is
  // INSERT OR IGNORE, so re-running a chunk never changes a row that is already there.
  const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l.startsWith('INSERT'));
  const CHUNK = 5000;
  let executed = 0;
  for (let i = 0; i < lines.length; i += CHUNK) {
    const n = Math.floor(i / CHUNK) + 1;
    const slice = lines.slice(i, i + CHUNK);
    const part = `${file}.part${n}.sql`;
    writeFileSync(part, ['PRAGMA defer_foreign_keys = true;', ...slice].join('\n') + '\n');
    const out = w(['d1', 'execute', 'DB', ...TARGET, '--file', part, '--yes']);
    // Wrangler's "Executed N" count is not a statement count for remote imports, so it proves nothing.
    // Success is proven only by the row-by-row `delta` / `compare` afterwards.
    if (/error/i.test(out) && !/"success":\s*true/.test(out)) throw new Error(`Chunk ${n} reported an error; stopping`);
    executed += slice.length;
    console.log(`chunk ${n}: ${slice.length} inserts sent`);
  }
  console.log(`statements sent ${executed}; verify with: node scripts/db-transfer.mjs delta <export> <out> --target ${target}`);
} else if (cmd === 'delta') {
  // delta <localExport.sql> <out.sql> --target remote|local
  // Splits a local export into: rows already in the target (identical), seed rows that differ only in
  // created_at/updated_at, rows missing from the target (written to <out.sql>), and CONFLICTS (same primary key,
  // different content). Any conflict stops the run with a non-zero exit. Never prints row content.
  const out = args[2];
  const parseTuple = (sql) => {
    const m = /^INSERT(?: OR IGNORE)? INTO "?([A-Za-z_]+)"? \(([^)]*)\) VALUES\((.*)\);$/.exec(sql.trim());
    if (!m) throw new Error('Unparseable INSERT');
    const cols = m[2].split(',').map((c) => c.trim().replace(/"/g, ''));
    const vals = [];
    let i = 0;
    const s = m[3];
    while (i < s.length) {
      if (s[i] === "'") {
        let v = '';
        i++;
        for (;;) {
          if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; } else if (s[i] === "'") { i++; break; } else { v += s[i]; i++; }
        }
        vals.push(v);
      } else {
        let j = i;
        while (j < s.length && s[j] !== ',') j++;
        const raw = s.slice(i, j).trim();
        vals.push(raw === 'NULL' ? null : raw);
        i = j;
      }
      while (i < s.length && (s[i] === ',' || s[i] === ' ')) i++;
    }
    return { table: m[1], cols, row: Object.fromEntries(cols.map((c, k) => [c, vals[k]])) };
  };
  const localLines = readFileSync(file, 'utf8').split('\n').filter((l) => l.startsWith('INSERT'));
  const tables = [...new Set(localLines.map((l) => parseTuple(l).table))];
  const remote = exportData(TARGET, 'D:/tmp/cuet-delta-target.sql', tables);
  const pkOf = new Map(tables.map((t) => [t, q(DEV, `SELECT name FROM pragma_table_info('${t}') WHERE pk > 0 ORDER BY pk`).map((r) => r.name)]));
  const summary = {};
  const missing = [];
  const conflicts = [];
  for (const t of tables) {
    const pk = pkOf.get(t);
    const key = (row) => pk.map((c) => String(row[c])).join('\u0001');
    const there = new Map(remote.get(t).map((l) => { const p = parseTuple(l); return [key(p.row), p.row]; }));
    const s = { local: 0, identical: 0, seedTimestampOnly: 0, missing: 0, conflicts: 0 };
    for (const l of localLines.filter((x) => x.includes(`INTO "${t}" `) || x.includes(`INTO ${t} `))) {
      const p = parseTuple(l);
      if (p.table !== t) continue;
      s.local++;
      const r = there.get(key(p.row));
      if (!r) { s.missing++; missing.push(l); continue; }
      const diff = p.cols.filter((c) => String(p.row[c]) !== String(r[c]));
      if (!diff.length) s.identical++;
      else if (diff.every((c) => c === 'created_at' || c === 'updated_at')) s.seedTimestampOnly++;
      else { s.conflicts++; conflicts.push(`${t} [${pk.join(',')}=${key(p.row).replace(/\u0001/g, '|')}] differs in: ${diff.join(', ')}`); }
    }
    s.extraInTarget = there.size - s.identical - s.seedTimestampOnly - s.conflicts;
    summary[t] = s;
  }
  writeFileSync(out, ['PRAGMA defer_foreign_keys = true;', ...missing].join('\n') + '\n');
  const totals = Object.values(summary).reduce((a, s) => ({ local: a.local + s.local, identical: a.identical + s.identical, seed: a.seed + s.seedTimestampOnly, missing: a.missing + s.missing, conflicts: a.conflicts + s.conflicts, extra: a.extra + s.extraInTarget }), { local: 0, identical: 0, seed: 0, missing: 0, conflicts: 0, extra: 0 });
  writeFileSync(`${out}.summary.json`, JSON.stringify({ totals, summary, conflicts }, null, 1));
  console.log(JSON.stringify(totals));
  for (const [t, s] of Object.entries(summary)) if (s.missing || s.conflicts || s.extraInTarget) console.log(`  ${t}: ${JSON.stringify(s)}`);
  if (conflicts.length) {
    console.error(`STOP: ${conflicts.length} conflicting row(s) (same key, different content):\n` + conflicts.slice(0, 20).join('\n'));
    process.exit(2);
  }
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
