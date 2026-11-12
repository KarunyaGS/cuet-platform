import { applyD1Migrations, env } from 'cloudflare:test';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      MEDIA: R2Bucket;
      TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
      ADMIN_API_TOKEN: string;
      APP_ENV: string;
      MAX_PAGE_SIZE: string;
      MAX_UPLOAD_BYTES: string;
    }
  }
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
