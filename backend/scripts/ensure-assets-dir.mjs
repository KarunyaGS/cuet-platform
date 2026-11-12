// Wrangler refuses to start if the static assets directory is missing.
// The API can run before the frontend has been built, so create an empty one.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'dist');
if (!existsSync(dist)) {
  mkdirSync(dist, { recursive: true });
  writeFileSync(
    join(dist, 'index.html'),
    '<!doctype html><title>CUET Platform</title><p>Frontend not built yet. Run <code>npm run dev:web</code> or <code>npm run build</code>.</p>',
  );
}
