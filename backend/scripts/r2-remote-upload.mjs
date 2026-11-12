// Uploads every file the database references (source_documents.r2_key, media_assets.r2_key) to the PRIVATE remote
// R2 bucket of the production config, then downloads each object back and checks its SHA-256 and size against the
// key (keys are content-addressed: <prefix>/<sha256>.<ext>) and the database record. Bucket settings are not touched.
//
//   CUET_REMOTE_FILES_APPROVED=yes node scripts/r2-remote-upload.mjs [--limit N] [--verify-only]
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(root, '..');
const wrangler = [join(repo, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync);
const env = { ...process.env, TEMP: process.env.TEMP ?? 'D:/tmp', CI: 'true' };
const args = process.argv.slice(2);
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const verifyOnly = args.includes('--verify-only');
if (!verifyOnly && process.env.CUET_REMOTE_FILES_APPROVED !== 'yes') {
  console.error('Refused: uploading to the remote bucket needs explicit approval (CUET_REMOTE_FILES_APPROVED=yes).');
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(join(root, 'wrangler.jsonc'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"\\])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1'));
const bucket = cfg.env.production.r2_buckets[0].bucket_name;
const localBucket = cfg.r2_buckets[0].bucket_name;

const q = (sql) => JSON.parse(execFileSync(process.execPath, [wrangler, 'd1', 'execute', 'DB', '--local', '--json', '--command', sql], { cwd: root, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 100_000_000 }))[0].results;
const refs = [
  ...q(`SELECT 'source_documents' AS tbl, r2_key AS key, sha256, byte_size AS size, mime_type AS mime FROM source_documents WHERE r2_key IS NOT NULL`),
  ...q(`SELECT 'media_assets' AS tbl, r2_key AS key, sha256, byte_size AS size, mime_type AS mime FROM media_assets WHERE r2_key IS NOT NULL`),
];
const byKey = new Map();
for (const r of refs) byKey.set(r.key, { ...r, tables: [...(byKey.get(r.key)?.tables ?? []), r.tbl] });

// Local files by content hash.
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)])) : []);
const files = new Map();
for (const f of [...walk(join(repo, 'storage', 'cache', 'pdf')), ...walk(join(repo, 'content', 'packs')).filter((x) => x.endsWith('.svg')), ...walk(join(repo, 'storage', 'local', 'figures'))]) {
  files.set(sha(readFileSync(f)), f);
}
const tmp = 'D:/tmp/r2-verify';
mkdirSync(tmp, { recursive: true });

const results = [];
const keys = [...byKey.keys()].slice(0, limit);
async function one(key) {
  const r = byKey.get(key);
  const expected = /([0-9a-f]{64})\./.exec(key)?.[1];
  let path = expected ? files.get(expected) : undefined;
  let source = 'disk';
  if (!path) {
    path = join(tmp, `local-${expected}`);
    await run(process.execPath, [wrangler, 'r2', 'object', 'get', `${localBucket}/${key}`, '--local', '--file', path], { cwd: root, env });
    source = 'local-r2';
  }
  const body = readFileSync(path);
  const res = { key, tables: r.tables, source, expectedSha: expected, dbSha: r.sha256, size: body.length, dbSize: r.size, localOk: sha(body) === expected && (!r.sha256 || r.sha256 === expected) };
  if (!res.localOk) return { ...res, status: 'LOCAL_MISMATCH' };
  if (!verifyOnly) await run(process.execPath, [wrangler, 'r2', 'object', 'put', `${bucket}/${key}`, '--file', path, '--content-type', r.mime, '--remote'], { cwd: root, env });
  const back = join(tmp, `remote-${expected}`);
  await run(process.execPath, [wrangler, 'r2', 'object', 'get', `${bucket}/${key}`, '--file', back, '--remote'], { cwd: root, env });
  const got = readFileSync(back);
  const ok = sha(got) === expected && got.length === body.length && (r.size == null || r.size === got.length);
  return { ...res, remoteSha: sha(got), remoteSize: got.length, status: ok ? 'VERIFIED' : 'REMOTE_MISMATCH' };
}
const queue = [...keys];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const k = queue.shift();
    try { results.push(await one(k)); } catch (e) { results.push({ key: k, status: 'ERROR', error: String(e.message).split('\n')[0].slice(0, 200) }); }
  }
}));
const by = (s) => results.filter((r) => r.status === s).length;
const summary = { bucket, referencedKeys: byKey.size, processed: results.length, verified: by('VERIFIED'), remoteMismatch: by('REMOTE_MISMATCH'), localMismatch: by('LOCAL_MISMATCH'), errors: by('ERROR'),
  bySource: { disk: results.filter((r) => r.source === 'disk').length, localR2: results.filter((r) => r.source === 'local-r2').length },
  byTable: { source_documents: results.filter((r) => r.tables?.includes('source_documents')).length, media_assets: results.filter((r) => r.tables?.includes('media_assets')).length } };
writeFileSync('D:/tmp/r2-remote-upload-report.json', JSON.stringify({ summary, results }, null, 1));
console.log(JSON.stringify(summary));
for (const r of results.filter((x) => x.status !== 'VERIFIED').slice(0, 10)) console.log(' ', r.status, r.key, r.error ?? '');
