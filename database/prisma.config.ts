import { defineConfig } from 'prisma/config';

// The Prisma CLI is used here only to validate the schema, generate the client and
// produce migration SQL (`prisma migrate diff`). It never connects to Cloudflare D1:
// migrations are applied with `wrangler d1 migrations apply` (see docs/database.md).
//
// DATABASE_URL may point at a local SQLite copy of the D1 database when diffing
// against existing state (scripts/new-migration.mjs sets it). Otherwise a throwaway
// file under database/.local is used.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'migrations',
  },
  datasource: {
    url: process.env['DATABASE_URL'] ?? 'file:./.local/prisma-cli.sqlite',
  },
});
