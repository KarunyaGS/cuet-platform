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
  /**
   * "on" lets official documents be shown inside the platform's own viewer. Anything else (the default) keeps that
   * switched off: every official document opens on the exam body's own site. Turn on only when the exam body has
   * granted permission to display or reproduce its documents.
   */
  OFFICIAL_IN_APP_VIEWING?: string;
  /**
   * "on" lets a previous-year paper be shown inside the platform's viewer when the file's own host allows other websites
   * to read it (the student's browser loads it straight from that host). Anything else: every paper opens on its source.
   */
  PYQ_IN_APP_VIEWING?: string;
  /**
   * Previous-year papers are shown to students only when verified as English-medium. "on" also shows NTA's bilingual
   * papers that print every question in English and in Hindi (labelled "English and Hindi"). Anything else: English only.
   */
  PYQ_ENGLISH_HINDI?: string;
  /** "on" lets the scheduled job read the official notice pages. Anything else (the default) keeps it switched off. */
  NOTICE_FETCH?: string;
  /** Minutes between checks of each official notice page (15 to 1440; default 180). */
  NOTICE_FETCH_MINUTES?: string;
  /** "off" (default), "mock" (local development only), "test" (Razorpay test keys) or "live" (needs PAYMENTS_LIVE_APPROVED=yes). */
  PAYMENTS_MODE?: string;
  /** Must be exactly "yes" before live keys are accepted. Set only with the owner's written approval. */
  PAYMENTS_LIVE_APPROVED?: string;
  /** Razorpay key id (public; shown to the browser at checkout). */
  RAZORPAY_KEY_ID?: string;
  /** Razorpay key secret (secret). */
  RAZORPAY_KEY_SECRET?: string;
  /** Razorpay webhook signing secret (secret). */
  RAZORPAY_WEBHOOK_SECRET?: string;
}

export interface Variables {
  prisma: PrismaClient;
  actor: string;
  user: { id: string; email: string; displayName: string; roles: string[]; permissions?: string[] };
}

export type AppEnv = { Bindings: Bindings; Variables: Variables };
