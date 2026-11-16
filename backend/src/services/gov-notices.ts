/**
 * Government updates: official notices about CUET and admissions, fetched from NTA's and UGC's own public pages on a schedule.
 *
 * What is read: the public listing pages named in SOURCES, with a client name that says what it is. Nothing behind a
 * login is read and no access control is worked around; each site's robots rules allow these pages.
 * What is stored: the notice's title, its date, its category and its official addresses. The document is never copied.
 * What is shown: a notice is published on its own only when it came from one of these pages, its document sits on an
 * official host of the SAME authority, its issuing authority is certain (and, for NTA, its exam), its date could be read and its
 * title is a real title. Anything else waits for a member of staff, with the reasons recorded.
 * Everything is worked out by fixed rules; no AI calls.
 */
import { z } from 'zod';
import { ApiError, invalid, notFound } from '../lib/errors';
import { newId, sha256Hex } from '../lib/hash';
import { nowIso } from '../lib/sql';

export const NOTICE_CATEGORIES = ['ADMIT_CARD', 'RESULT', 'ANSWER_KEY', 'EXAM_SCHEDULE', 'CITY_INTIMATION', 'APPLICATION', 'SYLLABUS', 'ADMISSION', 'SCHOLARSHIP', 'REGULATION', 'ADVISORY', 'GENERAL'] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];
const EXAMS = ['CUET_UG', 'CUET_PG'] as const;
type Exam = (typeof EXAMS)[number];
export const AUTHORITIES = ['NTA', 'UGC'] as const;
export type Authority = (typeof AUTHORITIES)[number];

const USER_AGENT = 'cuet-prep-notice-monitor/0.1 (reads public notice listings; automated)';
const MAX_PAGE_BYTES = 6_000_000;
const FETCH_TIMEOUT_MS = 25_000;
/** Notices older than this are not collected. */
const MAX_AGE_DAYS = 400;
const NEW_DAYS = 7;
const UPDATED_DAYS = 14;

interface Source {
  key: string;
  name: string;
  url: string;
  /** Further pages of the same listing, relative to url. */
  morePages?: string[];
  parser: 'S3WAAS_TABLE' | 'PDF_LINKS' | 'NTA_ARCHIVE' | 'UGC_HOME';
  /** Who issues what this page lists. A notice's document must sit on this authority's own website. */
  authority: Authority;
  /** The exam this page is about; null for a general notice board, where each notice is classified by its title. */
  exam: Exam | null;
}

/** Exam-specific pages come first, so the same notice found again on the general board is recorded as a duplicate. */
export const SOURCES: Source[] = [
  { key: 'cuet-ug-public-notices', name: 'NTA, CUET (UG) public notices', url: 'https://cuet.nta.nic.in/document-category/public-notice/', morePages: ['page/2/'], parser: 'S3WAAS_TABLE', authority: 'NTA', exam: 'CUET_UG' },
  { key: 'cuet-pg-website', name: 'NTA, CUET (PG) website', url: 'https://exams.nta.nic.in/cuet-pg/', parser: 'PDF_LINKS', authority: 'NTA', exam: 'CUET_PG' },
  { key: 'nta-notice-board', name: 'NTA notice board', url: 'https://nta.ac.in/NoticeBoardArchive', parser: 'NTA_ARCHIVE', authority: 'NTA', exam: null },
  // UGC publishes on its own home page (Notices, Circulars, International Cooperation), each entry with its date. UGC states that its
  // official notifications appear only on ugc.gov.in and, for distance and online learning, deb.ugc.ac.in.
  { key: 'ugc-home-notices', name: 'UGC, notices on the home page', url: 'https://www.ugc.gov.in/', parser: 'UGC_HOME', authority: 'UGC', exam: null },
];

/** Each authority's own websites. A UGC notice must be on UGC's site, an NTA notice on NTA's or the government's. */
const OFFICIAL_HOST: Record<Authority, RegExp> = {
  NTA: /(^|\.)(nta\.ac\.in|nta\.nic\.in|gov\.in|nic\.in)$/i,
  UGC: /(^|\.)(ugc\.gov\.in|ugc\.ac\.in)$/i,
};
export const isOfficialUrl = (url: string, authority: Authority = 'NTA') => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && OFFICIAL_HOST[authority].test(u.hostname);
  } catch {
    return false;
  }
};

/** Why a title cannot be trusted as a notice title, or null. Link texts such as "click here" or a bare file name are not titles. */
export function titleProblem(title: string): string | null {
  const t = title.trim();
  if (t.length < 8) return 'its title is too short';
  if ((t.match(/\p{L}/gu) ?? []).length < 6) return 'its title has too few letters to be a title';
  // "Click here", "Read more" and the like, alone or with a couple of words; or a single link word.
  if (/^(click here|read more|view more)\b/i.test(t) && t.split(/\s+/).length <= 4) return 'its title is only a link label';
  if (/^(view|download|more|pdf|notice|link|details?)\b[\s.:>-]*$/i.test(t)) return 'its title is only a link label';
  if (/^[\w\-. ()]+\.(pdf|docx?|xlsx?)$/i.test(t)) return 'its title is a file name';
  return null;
}

// ---------------------------------------------------------------- reading a page

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export const decode = (s: string) =>
  s
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();

export interface Found {
  title: string;
  documentUrl: string;
  description: string | null;
  /** A date printed next to the entry on the listing (ISO, YYYY-MM-DD), when the page prints one. */
  publishedOn?: string | null;
}

const absolute = (href: string, base: string) => {
  try {
    const u = new URL(decode(href), base);
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
};

/** Reads the notices listed on one page. Returns nothing when the page does not have the expected layout. */
export function parseListing(parser: Source['parser'], html: string, base: string): Found[] {
  const out: Found[] = [];
  const add = (title: string, href: string, description: string | null = null) => {
    const url = absolute(href, base);
    const t = decode(title).slice(0, 500);
    if (url && t.length >= 8) out.push({ title: t, documentUrl: url, description });
  };
  if (parser === 'S3WAAS_TABLE') {
    const body = /<tbody[\s\S]*?<\/tbody>/i.exec(html)?.[0] ?? '';
    for (const row of body.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const a = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(row);
      if (!a) continue;
      const size = /aria-label="[^"]*?\b(PDF\s+[\d.]+\s*[KMG]B)\b/i.exec(row)?.[1] ?? null;
      add(a[2]!, a[1]!, size ? `${size.replace(/\s+/g, ' ')} document` : null);
    }
  } else if (parser === 'UGC_HOME') {
    // Each entry is  <a href=URL>title</a>  followed, before the next link, by  "Published on : DD/MM/YYYY".  Some hrefs have no quotes.
    const re = /<a\s+href=(["']?)([^\s>"']+)\1[^>]*>((?:(?!<\/a>)[\s\S])*)<\/a>(?:(?!<a\b)[\s\S]){0,500}?Published\s+on\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/gi;
    for (let m = re.exec(html); m; m = re.exec(html)) {
      const day = `${m[6]}-${m[5]}-${m[4]}`;
      const ok = Number.isFinite(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
      const url = absolute(m[2]!, base);
      const t = decode(m[3]!).slice(0, 500);
      if (url && t.length >= 8) out.push({ title: t, documentUrl: url, description: null, publishedOn: ok ? day : null });
    }
  } else if (parser === 'NTA_ARCHIVE') {
    for (const row of html.match(/<tr>[\s\S]*?<\/tr>/gi) ?? []) {
      const title = /<content\b[^>]*>([\s\S]*?)<\/content>/i.exec(row)?.[1];
      const href = /<a\b[^>]*href="([^"]+)"/i.exec(row)?.[1];
      if (title && href) add(title, href);
    }
  } else {
    const re = /<a\b[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (let m = re.exec(html); m; m = re.exec(html)) if (decode(m[2]!).length >= 15) add(m[2]!, m[1]!);
  }
  // The same document listed twice on a page counts once.
  const seen = new Set<string>();
  return out.filter((f) => (seen.has(f.documentUrl) ? false : (seen.add(f.documentUrl), true)));
}

// ---------------------------------------------------------------- understanding a notice

const CUET = /\bCUET\b|Common\s+Universit(y|ies)\s+Entrance\s+Test/i;
const UG = /\(\s*UG\s*\)|\bUG\b|under-?\s?graduat/i;
const PG = /\(\s*PG\s*\)|\bPG\b|post-?\s?graduat/i;

export function classifyExam(title: string): Exam | null {
  const ug = UG.test(title);
  const pg = PG.test(title);
  return ug === pg ? null : ug ? 'CUET_UG' : 'CUET_PG';
}

const CATEGORY_RULES: [NoticeCategory, RegExp][] = [
  ['ANSWER_KEY', /answer\s*key|recorded\s+responses?|challenge/i],
  ['RESULT', /result|score\s*card|scorecard|nta\s+scores?|toppers?|merit/i],
  ['ADMIT_CARD', /admit\s*card|hall\s*ticket/i],
  ['CITY_INTIMATION', /city\s+(intimation|slip)|allotment\s+of\s+examination\s+cit|exam(ination)?\s+cit(y|ies)/i],
  // Before the exam-schedule rule, so "Admission schedule" is an admission notice and not an examination date sheet.
  ['ADMISSION', /\badmissions?\b|counselling|\bcsas\b|seat\s+(matrix|allot)/i],
  ['EXAM_SCHEDULE', /date\s*sheet|schedule|re-?schedul|postpone|exam(ination)?\s+dates?|conduct\s+of|commencement|re-?exam/i],
  ['APPLICATION', /application|registration|correction|apply|last\s+date|extension|fee/i],
  ['SYLLABUS', /syllabus|information\s+bulletin|pattern|eligibility/i],
  ['SCHOLARSHIP', /scholarship|fellowship|stipend/i],
  ['REGULATION', /regulations?|guidelines?|gazette|amendment|notification|ordinance|statute/i],
  ['ADVISORY', /advisory|caution|clarification|fake|dress\s+code|instructions?|helpdesk|press/i],
];
/**
 * UGC's letters are not examination notices, so NTA's keywords (answer key, result, fee ...) would misfile them: a hackathon
 * "challenge" is not an answer-key challenge. UGC notices get their own short list, and anything else is general.
 */
const UGC_CATEGORY_RULES: [NoticeCategory, RegExp][] = [
  ['ADMISSION', /\badmissions?\b|counselling|\bcsas\b|\bcuet\b|entrance\s+test/i],
  ['SCHOLARSHIP', /scholarship|fellowship|stipend/i],
  ['REGULATION', /regulations?|gazette|amendment|\bnotification\b|guidelines?|statute|ordinance/i],
  ['APPLICATION', /(call|invitation|invited?)\s+(for|of)\s+(applications?|nominations?)|applications?\s+(are\s+)?invited/i],
  ['ADVISORY', /advisory|caution|fake\s+universit|non-?compliance/i],
];
export const classifyCategory = (title: string, authority: Authority = 'NTA'): NoticeCategory =>
  (authority === 'UGC' ? UGC_CATEGORY_RULES : CATEGORY_RULES).find(([, re]) => re.test(title))?.[0] ?? 'GENERAL';

/** The date stamped in the official file's own name: ".../uploads/2026/06/20260623…pdf" or "Notice_20260623193509.pdf". */
export function publishedDate(url: string): string | null {
  const m = /\/(?:Notice_|uploads\/\d{4}\/\d{2}\/)(\d{4})(\d{2})(\d{2})\d*[^/]*$/i.exec(url);
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === day && t > Date.parse('2015-01-01') && t < Date.now() + 2 * 86_400_000 ? day : null;
}

const examYear = (title: string, published: string | null) => {
  const years = (title.match(/\b20[2-4]\d\b/g) ?? []).map(Number);
  return years.length ? Math.max(...years) : published ? Number(published.slice(0, 4)) : null;
};

const dupKey = (title: string, published: string | null) => `${published ?? ''}|${title.toLowerCase().normalize('NFKC').replace(/[^a-z0-9]+/g, '')}`;

// ---------------------------------------------------------------- fetching

let upstream: typeof fetch = (...a) => fetch(...a);
/** Tests only: replaces the requests to the official sites. */
export function setNoticeFetchForTests(f: typeof fetch | null) {
  upstream = f ?? ((...a) => fetch(...a));
}

async function readPage(url: string, authority: Authority): Promise<string> {
  if (!isOfficialUrl(url, authority)) throw new Error('Not an official address');
  const res = await upstream(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status !== 200) throw new Error(`The page answered ${res.status}`);
  if (res.url && !isOfficialUrl(res.url, authority)) throw new Error('The page redirected away from the official site');
  if (!/html/i.test(res.headers.get('content-type') ?? '')) throw new Error('The page is not a web page');
  const text = await res.text();
  if (text.length > MAX_PAGE_BYTES) throw new Error('The page is larger than expected');
  return text;
}

export const fetchSettings = (env: { NOTICE_FETCH?: string; NOTICE_FETCH_MINUTES?: string }) => ({
  enabled: env.NOTICE_FETCH === 'on',
  intervalMinutes: Math.min(1440, Math.max(15, Number(env.NOTICE_FETCH_MINUTES) || 180)),
});

interface Existing {
  id: string;
  document_url: string;
  title: string;
  content_hash: string;
  published_on: string | null;
  duplicate_of_id: string | null;
  verification_status: string;
  auto_published: number;
  exam_code: string | null;
}

async function ensureSources(db: D1Database) {
  const now = nowIso();
  await db.batch(
    SOURCES.map((s) =>
      db.prepare('INSERT INTO gov_notice_sources (key, name, url, authority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET name = excluded.name, url = excluded.url, authority = excluded.authority').bind(s.key, s.name, s.url, s.authority, now, now),
    ),
  );
}

/** Checks one source and stores what changed. Throws when the source could not be read. */
async function checkSource(db: D1Database, src: Source, known: Map<string, Existing>, byDup: Map<string, string>) {
  const found: Found[] = [];
  for (const page of ['', ...(src.morePages ?? [])]) {
    const url = new URL(page, src.url).toString();
    const items = parseListing(src.parser, await readPage(url, src.authority), url);
    // The first page must list something: an empty first page means the site changed its layout.
    if (!page && !items.length) throw new Error('No notices could be read from the page. Its layout may have changed.');
    found.push(...items);
  }
  const cutoff = new Date(Date.now() - MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const now = nowIso();
  const statements: D1PreparedStatement[] = [];
  const counts = { found: 0, added: 0, updated: 0, duplicates: 0, queued: 0 };
  const seenHere = new Set<string>();
  for (const f of found) {
    if (seenHere.has(f.documentUrl)) continue;
    seenHere.add(f.documentUrl);
    // NTA's general notice board carries every exam: only CUET notices are of interest. (UGC's page is read in full.)
    if (!src.exam && src.authority === 'NTA' && !CUET.test(f.title)) continue;
    const published = f.publishedOn ?? publishedDate(f.documentUrl);
    if (published && published < cutoff) continue;
    counts.found++;
    // UGC is not an examination body, so a UGC notice has no exam; NTA's must say which exam it is for.
    const exam = src.authority === 'UGC' ? null : (src.exam ?? classifyExam(f.title));
    const category = classifyCategory(f.title, src.authority);
    const hash = await sha256Hex([f.title, f.documentUrl, published ?? '', f.description ?? ''].join('|'));
    // Why a notice cannot be published on its own. The same rules apply the first time and whenever a published notice changes.
    const doubtsFor = (title: string, day: string | null) => {
      const d: string[] = [];
      if (!isOfficialUrl(f.documentUrl, src.authority)) d.push(`its document is not on ${src.authority === 'UGC' ? "UGC's" : 'an official'} website`);
      if (src.authority === 'NTA' && !exam) d.push('the title does not say whether it is for CUET (UG) or CUET (PG)');
      if (!day) d.push('its date could not be read');
      const tp = titleProblem(title);
      if (tp) d.push(tp);
      return d;
    };
    const cur = known.get(f.documentUrl);
    if (cur) {
      if (cur.content_hash !== hash) {
        counts.updated++;
        const again = doubtsFor(f.title, published);
        // A notice the reader published on its own is checked again when it changes; one a person published is left to that person.
        const demote = cur.auto_published === 1 && cur.verification_status === 'PUBLISHED' && again.length > 0;
        if (demote) counts.queued++;
        statements.push(
          db
            .prepare(
              `UPDATE gov_notices SET title = ?, description = ?, category = ?, published_on = ?, content_hash = ?, changed_at = ?, last_checked_at = ?, updated_at = ?${demote ? ", verification_status = 'NEEDS_REVIEW', auto_published = 0, status_note = ?" : ''} WHERE id = ?`,
            )
            .bind(f.title, f.description, category, published, hash, now, now, now, ...(demote ? [`Changed at the source and no longer passes the checks: ${again.join('; ')}.`] : []), cur.id),
        );
        cur.content_hash = hash;
        cur.title = f.title;
        if (demote) cur.verification_status = 'NEEDS_REVIEW';
      }
      continue;
    }
    const doubts = doubtsFor(f.title, published);
    const key = dupKey(f.title, published);
    const duplicateOf = byDup.get(key) ?? null;
    const id = newId('gn');
    if (duplicateOf) counts.duplicates++;
    else {
      byDup.set(key, id);
      if (doubts.length) counts.queued++;
      counts.added++;
    }
    known.set(f.documentUrl, { id, document_url: f.documentUrl, title: f.title, content_hash: hash, published_on: published, duplicate_of_id: duplicateOf, verification_status: doubts.length ? 'NEEDS_REVIEW' : 'PUBLISHED', auto_published: doubts.length ? 0 : 1, exam_code: exam });
    statements.push(
      db
        .prepare(
          `INSERT INTO gov_notices (id, source_key, source_name, source_url, document_url, is_pdf, title, description, category, exam_code, exam_year, published_on,
             verification_status, status_note, duplicate_of_id, content_hash, first_detected_at, last_checked_at, updated_at, authority, auto_published)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (document_url) DO NOTHING`,
        )
        .bind(
          id, src.key, src.name, src.url, f.documentUrl, /\.pdf($|\?)/i.test(f.documentUrl) ? 1 : 0, f.title, f.description, category, exam, examYear(f.title, published), published,
          doubts.length ? 'NEEDS_REVIEW' : 'PUBLISHED',
          doubts.length ? `Waiting for a check: ${doubts.join('; ')}.` : `Published automatically: listed on ${src.authority}'s own page, on ${src.authority}'s own website, ${src.authority === 'UGC' ? 'date and title read' : 'exam certain'}.`,
          duplicateOf, hash, now, now, now, src.authority, doubts.length ? 0 : 1,
        ),
    );
  }
  statements.push(db.prepare('UPDATE gov_notices SET last_checked_at = ? WHERE source_key = ?').bind(now, src.key));
  for (let i = 0; i < statements.length; i += 40) await db.batch(statements.slice(i, i + 40));
  return counts;
}

export interface SourceReport {
  key: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
  found?: number;
  added?: number;
  updated?: number;
  duplicates?: number;
  queued?: number;
}

/**
 * The scheduled job. Checks every source that is due. A source that fails is tried again sooner than the normal
 * interval (15 minutes, then 30, 60 … up to a day), and one failing source never stops the others.
 */
export async function syncNotices(env: { DB: D1Database; NOTICE_FETCH?: string; NOTICE_FETCH_MINUTES?: string }, opts: { force?: boolean } = {}) {
  const settings = fetchSettings(env);
  if (!settings.enabled && !opts.force) return { ran: false, reason: 'Fetching is switched off', sources: [] as SourceReport[] };
  const db = env.DB;
  await ensureSources(db);
  const state = new Map((await db.prepare('SELECT key, next_check_at, consecutive_failures FROM gov_notice_sources').all<{ key: string; next_check_at: string | null; consecutive_failures: number }>()).results.map((r) => [r.key, r]));
  const all = (await db.prepare('SELECT id, document_url, title, content_hash, published_on, duplicate_of_id, verification_status, auto_published, exam_code FROM gov_notices').all<Existing>()).results;
  const known = new Map(all.map((r) => [r.document_url, r]));
  const byDup = new Map(all.filter((r) => !r.duplicate_of_id).map((r) => [dupKey(r.title, r.published_on), r.id]));
  const report: SourceReport[] = [];
  for (const src of SOURCES) {
    const st = state.get(src.key);
    const now = new Date();
    if (!opts.force && st?.next_check_at && st.next_check_at > now.toISOString()) {
      report.push({ key: src.key, ok: true, skipped: true });
      continue;
    }
    try {
      const c = await checkSource(db, src, known, byDup);
      const next = new Date(now.getTime() + settings.intervalMinutes * 60_000).toISOString();
      await db
        .prepare('UPDATE gov_notice_sources SET last_checked_at = ?1, last_success_at = ?1, last_error = NULL, consecutive_failures = 0, next_check_at = ?2, last_found = ?3, last_new = ?4, last_updated = ?5, last_duplicates = ?6, last_queued = ?7, updated_at = ?1 WHERE key = ?8')
        .bind(now.toISOString(), next, c.found, c.added, c.updated, c.duplicates, c.queued, src.key)
        .run();
      report.push({ key: src.key, ok: true, ...c });
    } catch (e) {
      const failures = (st?.consecutive_failures ?? 0) + 1;
      const wait = Math.min(1440, 15 * 2 ** (failures - 1));
      const message = String((e as Error).message ?? e).slice(0, 300);
      await db
        .prepare('UPDATE gov_notice_sources SET last_checked_at = ?1, last_error = ?2, last_error_at = ?1, consecutive_failures = ?3, next_check_at = ?4, updated_at = ?1 WHERE key = ?5')
        .bind(now.toISOString(), message, failures, new Date(now.getTime() + wait * 60_000).toISOString(), src.key)
        .run();
      report.push({ key: src.key, ok: false, error: message });
    }
  }
  return { ran: true, sources: report };
}

// ---------------------------------------------------------------- students

export const noticeQuery = z.object({
  exam: z.enum(EXAMS).optional(),
  category: z.enum(NOTICE_CATEGORIES).optional(),
  authority: z.enum(AUTHORITIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});

type Row = Record<string, string | number | null>;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const noticeOut = (r: Row) => ({
  id: r.id as string,
  title: r.title as string,
  description: r.description as string | null,
  category: r.category as NoticeCategory,
  exam: r.exam_code as Exam | null,
  examYear: r.exam_year as number | null,
  publishedOn: r.published_on as string | null,
  /** NTA or UGC: who issued it. */
  authority: r.authority as Authority,
  sourceName: r.source_name as string,
  /** The official page the notice is listed on, and the notice itself. Both are the exam body's own addresses. */
  sourceUrl: r.source_url as string,
  documentUrl: r.document_url as string,
  isPdf: Boolean(r.is_pdf),
  isNew: r.published_on !== null && String(r.published_on) >= daysAgo(NEW_DAYS).slice(0, 10),
  isUpdated: r.changed_at !== null && String(r.changed_at) >= daysAgo(UPDATED_DAYS),
  firstDetectedAt: r.first_detected_at as string,
  lastCheckedAt: r.last_checked_at as string,
});

/** Published notices, newest first. The same for every visitor: nothing here belongs to a student. */
export async function listNotices(db: D1Database, q: z.infer<typeof noticeQuery>) {
  const binds: unknown[] = [];
  let where = `verification_status = 'PUBLISHED' AND duplicate_of_id IS NULL`;
  if (q.exam) {
    where += ' AND exam_code = ?';
    binds.push(q.exam);
  }
  if (q.authority) {
    where += ' AND authority = ?';
    binds.push(q.authority);
  }
  const forCounts = [...binds];
  const whereCounts = where;
  if (q.category) {
    where += ' AND category = ?';
    binds.push(q.category);
  }
  const [rows, total, cats, checked] = await Promise.all([
    db.prepare(`SELECT * FROM gov_notices WHERE ${where} ORDER BY published_on DESC, first_detected_at DESC, id LIMIT ? OFFSET ?`).bind(...binds, q.limit, q.offset).all<Row>(),
    db.prepare(`SELECT COUNT(*) AS n FROM gov_notices WHERE ${where}`).bind(...binds).first<{ n: number }>(),
    db.prepare(`SELECT category, COUNT(*) AS n FROM gov_notices WHERE ${whereCounts} GROUP BY category ORDER BY n DESC`).bind(...forCounts).all<{ category: string; n: number }>(),
    db.prepare('SELECT MAX(last_success_at) AS at FROM gov_notice_sources').first<{ at: string | null }>(),
  ]);
  return { total: total?.n ?? 0, lastCheckedAt: checked?.at ?? null, categories: cats.results.map((c) => ({ category: c.category, count: c.n })), notices: rows.results.map(noticeOut) };
}

// ---------------------------------------------------------------- staff

export async function noticeOverview(db: D1Database, env: { NOTICE_FETCH?: string; NOTICE_FETCH_MINUTES?: string }) {
  await ensureSources(db);
  const settings = fetchSettings(env);
  const [sources, totals] = await Promise.all([
    db.prepare('SELECT * FROM gov_notice_sources ORDER BY key').all<Row>(),
    db
      .prepare(
        `SELECT COUNT(*) AS collected, COALESCE(SUM(verification_status = 'PUBLISHED' AND duplicate_of_id IS NULL), 0) AS published,
           COALESCE(SUM(first_detected_at >= ?1 AND duplicate_of_id IS NULL), 0) AS new_7d, COALESCE(SUM(duplicate_of_id IS NOT NULL), 0) AS duplicates,
           COALESCE(SUM(verification_status = 'NEEDS_REVIEW' AND duplicate_of_id IS NULL), 0) AS waiting, COALESCE(SUM(changed_at >= ?1), 0) AS updated_7d
         FROM gov_notices`,
      )
      .bind(daysAgo(7))
      .first<Record<string, number>>(),
  ]);
  const known = new Set(SOURCES.map((s) => s.key));
  const list = sources.results.filter((s) => known.has(String(s.key)));
  const success = list.map((s) => s.last_success_at as string | null).filter(Boolean) as string[];
  const next = list.map((s) => s.next_check_at as string | null).filter(Boolean) as string[];
  return {
    enabled: settings.enabled,
    intervalMinutes: settings.intervalMinutes,
    lastSuccessfulFetch: success.length ? success.sort().at(-1)! : null,
    nextScheduledFetch: settings.enabled && next.length ? next.sort()[0]! : null,
    collected: totals?.collected ?? 0,
    published: totals?.published ?? 0,
    newInSevenDays: totals?.new_7d ?? 0,
    updatedInSevenDays: totals?.updated_7d ?? 0,
    duplicates: totals?.duplicates ?? 0,
    awaitingVerification: totals?.waiting ?? 0,
    failedSources: list.filter((s) => Number(s.consecutive_failures) > 0).length,
    sources: list.map((s) => ({
      key: s.key, name: s.name, url: s.url, authority: s.authority, lastCheckedAt: s.last_checked_at, lastSuccessAt: s.last_success_at, lastError: s.last_error, lastErrorAt: s.last_error_at,
      consecutiveFailures: Number(s.consecutive_failures), nextCheckAt: s.next_check_at, found: Number(s.last_found), added: Number(s.last_new), updated: Number(s.last_updated),
      duplicates: Number(s.last_duplicates), queued: Number(s.last_queued),
    })),
  };
}

export async function noticeQueue(db: D1Database) {
  const { results } = await db.prepare(`SELECT * FROM gov_notices WHERE verification_status = 'NEEDS_REVIEW' AND duplicate_of_id IS NULL ORDER BY first_detected_at DESC LIMIT 200`).all<Row>();
  return results.map((r) => ({ ...noticeOut(r), statusNote: r.status_note as string | null }));
}

export const noticeDecisionSchema = z.object({ action: z.enum(['PUBLISH', 'REJECT']), exam: z.enum(EXAMS).optional(), category: z.enum(NOTICE_CATEGORIES).optional() });

/** A member of staff settles a notice that could not be published on its own. */
export async function decideNotice(db: D1Database, id: string, input: z.infer<typeof noticeDecisionSchema>, actor: string) {
  const cur = await db.prepare('SELECT id, exam_code, document_url, verification_status, authority, title FROM gov_notices WHERE id = ?').bind(id).first<{ id: string; exam_code: string | null; document_url: string; verification_status: string; authority: Authority; title: string }>();
  if (!cur) throw notFound('Notice');
  if (cur.verification_status !== 'NEEDS_REVIEW') throw new ApiError(409, 'CONFLICT', 'This notice has already been settled');
  const now = nowIso();
  if (input.action === 'REJECT') {
    await db.prepare(`UPDATE gov_notices SET verification_status = 'REJECTED', status_note = ?, updated_at = ? WHERE id = ?`).bind(`Rejected by ${actor}`, now, id).run();
    return { id, status: 'REJECTED' };
  }
  const exam = cur.authority === 'UGC' ? null : (input.exam ?? cur.exam_code);
  if (cur.authority === 'NTA' && !exam) throw invalid('Say whether this notice is for CUET (UG) or CUET (PG)');
  if (!isOfficialUrl(cur.document_url, cur.authority)) throw invalid(`This document is not on ${cur.authority}'s own website, so it cannot be published`);
  if (titleProblem(cur.title)) throw invalid(`This notice cannot be published: ${titleProblem(cur.title)}`);
  await db
    .prepare(`UPDATE gov_notices SET verification_status = 'PUBLISHED', auto_published = 0, exam_code = ?, category = COALESCE(?, category), status_note = ?, updated_at = ? WHERE id = ?`)
    .bind(exam, input.category ?? null, `Checked and published by ${actor}`, now, id)
    .run();
  return { id, status: 'PUBLISHED' };
}
