// Loads content/official-info/<EXAM>.json and universities-<EXAM>.csv into the database through the admin API
// (PUT /api/admin/official-info/:exam), replacing that exam's information for the cycle.
//
//   node scripts/import-official-info.mjs                 # local server on http://127.0.0.1:8787, token from .dev.vars
//   CUET_API_BASE=https://... CUET_ADMIN_TOKEN=... CUET_REMOTE_DATA_APPROVED=yes node scripts/import-official-info.mjs
//
// A non-local address is refused unless CUET_REMOTE_DATA_APPROVED=yes (the owner's explicit approval).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '..', 'content', 'official-info');
const base = (process.env.CUET_API_BASE ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base);
if (!local && process.env.CUET_REMOTE_DATA_APPROVED !== 'yes') {
  console.error(`Refused: ${base} is not local. Importing to a live database needs explicit approval (CUET_REMOTE_DATA_APPROVED=yes).`);
  process.exit(1);
}
const devVars = join(root, '.dev.vars');
const token = process.env.CUET_ADMIN_TOKEN ?? (existsSync(devVars) ? /ADMIN_API_TOKEN\s*=\s*"?([^"\r\n]+)"?/.exec(readFileSync(devVars, 'utf8'))?.[1] : undefined);
if (!token) {
  console.error('No admin token: set CUET_ADMIN_TOKEN or ADMIN_API_TOKEN in backend/.dev.vars.');
  process.exit(1);
}

/** Minimal RFC 4180 CSV reader (quoted fields, doubled quotes, commas and newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(field), (field = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += ch;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  return body.map((r) => Object.fromEntries(head.map((h, k) => [h.trim(), (r[k] ?? '').trim()])));
}

for (const exam of ['CUET_UG', 'CUET_PG']) {
  const info = JSON.parse(readFileSync(join(dataDir, `${exam}.json`), 'utf8'));
  const csvPath = join(dataDir, `universities-${exam}.csv`);
  const universities = existsSync(csvPath) ? parseCsv(readFileSync(csvPath, 'utf8')).map((u) => ({ name: u.name, type: u.type, state: u.state || null, sourceUrl: u.source_url })) : [];
  const res = await fetch(`${base}/api/admin/official-info/${exam}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-token': token },
    body: JSON.stringify({ ...info, universities }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`${exam}: ${res.status} ${body.slice(0, 600)}`);
    process.exit(1);
  }
  console.log(`${exam}: ${body}`);
}
