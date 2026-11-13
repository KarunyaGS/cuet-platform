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
  /** Cloudflare Email Sending binding (`send_email`). Absent until email is switched on for the environment. */
  EMAIL?: { send(message: { to: string; from: { email: string; name?: string }; subject: string; text?: string; html?: string; headers?: Record<string, string> }): Promise<{ messageId: string }> };
  /** Sender address on the onboarded sending domain, e.g. no-reply@example.com. Email is off while this is unset. */
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  /** Public address of the app, used in emailed links (never taken from the request in production). */
  PUBLIC_APP_URL?: string;
  /** Standby provider (secret). */
  RESEND_API_KEY?: string;
  /** Signing secret of the Resend webhook (secret). */
  RESEND_WEBHOOK_SECRET?: string;
}

export interface Variables {
  prisma: PrismaClient;
  actor: string;
  user: { id: string; email: string; displayName: string; roles: string[]; permissions?: string[] };
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
