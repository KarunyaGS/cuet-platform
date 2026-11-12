import type { PrismaClient } from '@cuet/database';

/** Worker bindings. Matches wrangler.jsonc; ADMIN_API_TOKEN comes from .dev.vars locally or a Wrangler secret. */
export interface Bindings {
  DB: D1Database;
  MEDIA: R2Bucket;
  ASSETS?: Fetcher;
  APP_ENV: string;
  MAX_PAGE_SIZE: string;
  MAX_UPLOAD_BYTES: string;
  /** "true" only in local development: students may see machine-verified and draft content, clearly labelled. */
  CONTENT_PREVIEW?: string;
  SESSION_TTL_HOURS?: string;
  ADMIN_API_TOKEN?: string;
}

export interface Variables {
  prisma: PrismaClient;
  actor: string;
  user: { id: string; email: string; displayName: string; roles: string[] };
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
