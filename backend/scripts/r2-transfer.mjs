// Uploads every stored file (official syllabus PDFs; later, lesson diagrams) to a CUET Worker's private R2 bucket
// through its admin API. Keys are content-addressed (sources/<sha256>.pdf), so they match the D1 rows exactly and
// re-running uploads nothing new.   node scripts/r2-transfer.mjs --api http://127.0.0.1:8788
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dirname, '..', '..');
const api = process.argv[process.argv.indexOf('--api') + 1];
const token = process.env.CUET_ADMIN_TOKEN ?? /^ADMIN_API_TOKEN\s*=\s*"?([^"\r\n]+)"?/m.exec(readFileSync(join(repo, 'backend', '.dev.vars'), 'utf8'))?.[1];
if (!api || !token) throw new Error('Usage: --api <worker url>, with CUET_ADMIN_TOKEN (production) or backend/.dev.vars (local)');
const files = new Map();
for (const exam of ['CUET_UG', 'CUET_PG']) {
  const dir = join(repo, 'storage', 'local', 'extracted', exam);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const r = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    if (r.source?.localFile && existsSync(r.source.localFile)) files.set(r.source.sha256, { path: r.source.localFile, type: 'application/pdf', prefix: 'sources' });
  }
}
const packs = join(repo, 'content', 'packs');
const walk = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])) : []);
for (const f of walk(packs).filter((x) => x.endsWith('.svg'))) files.set(createHash('sha256').update(readFileSync(f)).digest('hex'), { path: f, type: 'image/svg+xml', prefix: 'media' });
let ok = 0, failed = 0, mismatch = 0;
for (const [sha, f] of files) {
  const body = readFileSync(f.path);
  if (createHash('sha256').update(body).digest('hex') !== sha) { mismatch++; continue; }
  const res = await fetch(`${api}/api/admin/files/${f.prefix}`, { method: 'PUT', headers: { 'x-admin-token': token, 'x-admin-actor': 'r2-transfer', 'content-type': f.type }, body });
  if (res.ok) ok++; else { failed++; console.log(f.path, res.status, (await res.text()).slice(0, 200)); }
}
console.log(JSON.stringify({ files: files.size, uploaded: ok, failed, checksumMismatch: mismatch }));
