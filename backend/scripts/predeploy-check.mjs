// Refuses a production deploy of the CUET Worker unless every precondition in docs/deployment.md holds.
// Run by `npm run deploy:production -w @cuet/api`. It never contacts Cloudflare itself.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"\\])\/\/.*$/gm, '$1').replace(/,(\s*[}\]])/g, '$1');
const cfg = JSON.parse(strip(readFileSync(join(root, 'wrangler.jsonc'), 'utf8')));
const prod = cfg.env?.production ?? {};
const problems = [];
const db = (prod.d1_databases ?? [])[0];
const bucket = (prod.r2_buckets ?? [])[0];

if (prod.name !== 'cuet') problems.push(`env.production.name must be "cuet" (the CUET Worker; Wrangler requires lower case) (is ${JSON.stringify(prod.name)})`);
if (!db || db.binding !== 'DB') problems.push('env.production needs the D1 binding "DB"');
else if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(db.database_id) || /^(0{8}|f{8})-/.test(db.database_id)) {
  problems.push('env.production D1 database_id is still a placeholder: create the database (approved) and put its id in wrangler.jsonc');
}
if (!bucket || bucket.binding !== 'MEDIA' || !bucket.bucket_name) problems.push('env.production needs the R2 binding "MEDIA"');
// CONTENT_PREVIEW="true" in production is the owner's decision of 2026-11-12 (see docs/deployment.md); it must be set explicitly.
if (!['true', 'false'].includes(prod.vars?.CONTENT_PREVIEW)) problems.push('CONTENT_PREVIEW must be set explicitly to "true" or "false" in production');
if (prod.vars?.APP_ENV !== 'production') problems.push('APP_ENV must be "production"');
if (!existsSync(join(root, '..', 'frontend', 'dist', 'index.html'))) problems.push('frontend/dist is missing: run npm run build -w @cuet/web first');
const migrations = readdirSync(join(root, '..', 'database', 'migrations')).filter((f) => f.endsWith('.sql'));
if (!migrations.length) problems.push('no D1 migrations found');
if (process.env.CUET_DEPLOY_APPROVED !== 'yes') problems.push('set CUET_DEPLOY_APPROVED=yes only after the release has been explicitly approved');

if (problems.length) {
  console.error('Production deploy of the CUET Worker refused:\n' + problems.map((p) => ` - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`Pre-deploy checks passed for Worker "${prod.name}" (${migrations.length} migrations; apply them remotely first: npm run migrate:production -w @cuet/api).`);
