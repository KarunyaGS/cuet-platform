import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// API tests run inside workerd (the real Workers runtime) with a throwaway in-memory D1 and R2.
// They never touch the persistent local D1 in .wrangler/state, and never touch Cloudflare.
export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL('../database/migrations', import.meta.url)));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, ADMIN_API_TOKEN: 'test-admin-token', OFFICIAL_IN_APP_VIEWING: 'on' } },
      }),
    ],
    // Password hashing (PBKDF2, 100k iterations) makes sign-in tests slow on a busy machine.
    test: { setupFiles: ['./test/setup.ts'], testTimeout: 30_000 },
  };
});
