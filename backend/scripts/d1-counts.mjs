// Print the row count of every table in the LOCAL D1 database as JSON. Read-only.
// Usage: node scripts/d1-counts.mjs [out.json]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run Wrangler's own script with Node (no shell), so SQL with spaces and quotes reaches it intact.
const here = dirname(fileURLToPath(import.meta.url));
const wranglerBin = [join(here, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(here, '..', '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync);
if (!wranglerBin) throw new Error('wrangler is not installed (npm install)');
process.chdir(join(here, '..'));
const wrangler = (sql) =>
  JSON.parse(
    execFileSync(process.execPath, [wranglerBin, 'd1', 'execute', 'DB', '--local', '--json', '--command', sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 50_000_000,
    }),
  );

const tables = wrangler("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")[0].results.map((r) => r.name);
const counts = {};
for (let i = 0; i < tables.length; i += 40) {
  const chunk = tables.slice(i, i + 40);
  const row = wrangler(`SELECT ${chunk.map((t) => `(SELECT COUNT(*) FROM "${t}") AS "${t}"`).join(', ')}`)[0].results[0];
  Object.assign(counts, row);
}
const out = { takenAt: new Date().toISOString(), tables: tables.length, counts };
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
