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
  /** For the source registry: what kind of data it is and how far it is trusted. */
  dataType: string;
  reliability: string;
}

/** Exam-specific pages come first, so the same notice found again on the general board is recorded as a duplicate. */
export const SOURCES: Source[] = [
  { key: 'cuet-ug-public-notices', name: 'NTA, CUET (UG) public notices', url: 'https://cuet.nta.nic.in/document-category/public-notice/', morePages: ['page/2/'], parser: 'S3WAAS_TABLE', authority: 'NTA', exam: 'CUET_UG', dataType: 'Notice listing (table of PDFs)', reliability: 'Official: NTA\'s own CUET (UG) website' },
  { key: 'cuet-pg-website', name: 'NTA, CUET (PG) website', url: 'https://exams.nta.nic.in/cuet-pg/', parser: 'PDF_LINKS', authority: 'NTA', exam: 'CUET_PG', dataType: 'Notice links on a web page', reliability: 'Official: NTA\'s own CUET (PG) website' },
  { key: 'nta-notice-board', name: 'NTA notice board', url: 'https://nta.ac.in/NoticeBoardArchive', parser: 'NTA_ARCHIVE', authority: 'NTA', exam: null, dataType: 'Notice board (rows)', reliability: 'Official: NTA\'s own notice board; only rows naming CUET are kept' },
  // UGC publishes on its own home page (Notices, Circulars, International Cooperation), each entry with its date. UGC states that its
  // official notifications appear only on ugc.gov.in and, for distance and online learning, deb.ugc.ac.in.
  { key: 'ugc-home-notices', name: 'UGC, notices on the home page', url: 'https://www.ugc.gov.in/', parser: 'UGC_HOME', authority: 'UGC', exam: null, dataType: 'Home-page notice blocks (title, date, PDF)', reliability: 'Official: UGC\'s own website; the home page is the only confirmed feed' },
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

// ---------------------------------------------------------------- revisions and corrigenda

export type RevisionKind = 'CORRIGENDUM' | 'ADDENDUM' | 'EXTENSION' | 'RESCHEDULED' | 'AMENDMENT' | 'REVISED';
const REVISION_RULES: [RevisionKind, RegExp][] = [
  ['CORRIGENDUM', /corrigend(um|a)/i],
  ['ADDENDUM', /addend(um|a)/i],
  ['EXTENSION', /\b(extension\s+of|extended)\b/i],
  ['RESCHEDULED', /re-?schedul|postpone/i],
  ['AMENDMENT', /\bamend(ment|ed)\b/i],
  ['REVISED', /\b(revised|revision|modified|updated)\b/i],
];
/** Does the title say it corrects, extends or replaces an earlier notice? */
export const revisionKindOf = (title: string): RevisionKind | null => REVISION_RULES.find(([, re]) => re.test(title))?.[0] ?? null;

/** The title without the words that mark a revision, so "Corrigendum to X" and "X" share a key. Too short a key is no key. */
export function baseKey(title: string): string {
  const k = title
    .toLowerCase()
    .normalize('NFKC')
    .replace(/corrigend(um|a)|addend(um|a)|\b(revised|revision|modified|updated|amended|amendment)\b|extension\s+of|\bextended\b|re-?schedul\w*|postpone\w*/g, ' ')
    .replace(/\b(to|in|of|the|for|regarding|reg|on|and|a|an)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
  return k.length >= 12 ? k : '';
}

/** In words, why the source counts as official: https, the document's host, the page it was listed on, and where the date came from. */
function authenticityNote(f: Found, src: Source, published: string | null): string {
  let host = '';
  try {
    host = new URL(f.documentUrl).host;
  } catch {
    /* reported below */
  }
  const own = isOfficialUrl(f.documentUrl, src.authority);
  return [
    f.documentUrl.startsWith('https://') ? 'Secure (https) link' : 'NOT a secure link',
    `document on ${host || 'an unreadable address'}, ${own ? `${src.authority}'s own website` : `NOT ${src.authority}'s website`}`,
    `listed on ${src.name} (${new URL(src.url).host})`,
    published ? `date ${f.publishedOn ? 'printed beside the entry' : 'stamped in the file name'}` : 'date not readable',
  ].join('; ');
}

const eventStmt = (db: D1Database, noticeId: string, action: string, actor: string, from: string | null, to: string | null, note: string | null, at: string) =>
  db.prepare('INSERT INTO gov_notice_events (id, notice_id, action, actor, from_status, to_status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(newId('gne'), noticeId, action, actor, from, to, note?.slice(0, 500) ?? null, at);

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
  authority: string;
  revision_kind: string | null;
  authenticity_note: string | null;
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
async function checkSource(db: D1Database, src: Source, known: Map<string, Existing>, byDup: Map<string, string>, byBase: Map<string, string>) {
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
              `UPDATE gov_notices SET title = ?, description = ?, category = ?, published_on = ?, content_hash = ?, changed_at = ?, last_checked_at = ?, updated_at = ?, version_count = version_count + 1${demote ? ", verification_status = 'NEEDS_REVIEW', auto_published = 0, status_note = ?" : ''} WHERE id = ?`,
            )
            .bind(f.title, f.description, category, published, hash, now, now, now, ...(demote ? [`Changed at the source and no longer passes the checks: ${again.join('; ')}.`] : []), cur.id),
        );
        // History: the new version as the page shows it (its number is the notice's new count), and what changed.
        const changes = [cur.title !== f.title ? 'title' : '', cur.published_on !== published ? 'date' : ''].filter(Boolean);
        statements.push(
          db
            .prepare(`INSERT INTO gov_notice_versions (id, notice_id, version, title, description, published_on, document_url, content_hash, reason, detected_at) SELECT ?, id, version_count, ?, ?, ?, document_url, ?, ?, ? FROM gov_notices WHERE id = ?`)
            .bind(newId('gnv'), f.title, f.description, published, hash, changes.length ? `Changed at the source: ${changes.join(' and ')}` : 'Changed at the source', now, cur.id),
          eventStmt(db, cur.id, 'CHANGED_AT_SOURCE', 'system:notice-reader', cur.verification_status, demote ? 'NEEDS_REVIEW' : cur.verification_status, changes.length ? `Changed: ${changes.join(' and ')}` : 'Changed', now),
        );
        if (demote) statements.push(eventStmt(db, cur.id, 'AUTO_WITHDRAWN', 'system:notice-reader', 'PUBLISHED', 'NEEDS_REVIEW', `No longer passes the checks: ${again.join('; ')}`, now));
        // A title that now says it corrects or revises something is linked to what it corrects.
        const rk = revisionKindOf(f.title);
        if (rk && !cur.revision_kind) {
          const origin = byBase.get(`${src.authority}|${baseKey(f.title)}`);
          statements.push(db.prepare('UPDATE gov_notices SET revision_kind = ?, revision_of_id = ? WHERE id = ?').bind(rk, origin && origin !== cur.id ? origin : null, cur.id));
          cur.revision_kind = rk;
        }
        cur.content_hash = hash;
        cur.title = f.title;
        if (demote) cur.verification_status = 'NEEDS_REVIEW';
      }
      // A notice held from before authenticity notes and revision links were recorded gets them the next time it is seen.
      if (cur.authenticity_note === null) {
        statements.push(db.prepare('UPDATE gov_notices SET authenticity_note = ? WHERE id = ? AND authenticity_note IS NULL').bind(authenticityNote(f, src, published), cur.id));
        cur.authenticity_note = 'recorded';
      }
      if (!cur.revision_kind && !cur.duplicate_of_id) {
        const rk0 = revisionKindOf(cur.title);
        if (rk0) {
          const origin = baseKey(cur.title) ? byBase.get(`${src.authority}|${baseKey(cur.title)}`) : undefined;
          statements.push(db.prepare('UPDATE gov_notices SET revision_kind = ?, revision_of_id = ? WHERE id = ? AND revision_kind IS NULL').bind(rk0, origin && origin !== cur.id ? origin : null, cur.id));
          cur.revision_kind = rk0;
        }
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
    const rk = revisionKindOf(f.title);
    const base = baseKey(f.title);
    const origin = rk && base ? (byBase.get(`${src.authority}|${base}`) ?? null) : null;
    known.set(f.documentUrl, { id, document_url: f.documentUrl, title: f.title, content_hash: hash, published_on: published, duplicate_of_id: duplicateOf, verification_status: doubts.length ? 'NEEDS_REVIEW' : 'PUBLISHED', auto_published: doubts.length ? 0 : 1, exam_code: exam, authority: src.authority, revision_kind: rk, authenticity_note: null });
    // An original notice can be found by its later corrigendum; a corrigendum is never the thing later ones attach to.
    if (!rk && base && !duplicateOf && !byBase.has(`${src.authority}|${base}`)) byBase.set(`${src.authority}|${base}`, id);
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
    // Authenticity evidence, the revision link, version 1 and the first events (written only if this row was really inserted).
    statements.push(
      db.prepare('UPDATE gov_notices SET authenticity_note = ?, revision_kind = ?, revision_of_id = ? WHERE id = ?').bind(authenticityNote(f, src, published), rk, origin, id),
      db
        .prepare(`INSERT INTO gov_notice_versions (id, notice_id, version, title, description, published_on, document_url, content_hash, reason, detected_at) SELECT ?, id, 1, title, description, published_on, document_url, content_hash, 'First detected', ? FROM gov_notices WHERE id = ? AND first_detected_at = ?`)
        .bind(newId('gnv'), now, id, now),
      eventStmt(db, id, 'DETECTED', 'system:notice-reader', null, doubts.length ? 'NEEDS_REVIEW' : 'PUBLISHED', `${duplicateOf ? 'Duplicate of another official listing. ' : ''}${rk ? `Says it is a ${rk.toLowerCase()}${origin ? ' of an earlier notice we hold' : ', but the original was not found'}. ` : ''}${doubts.length ? `Waiting for a check: ${doubts.join('; ')}` : 'Passed every check and published on its own'}`, now),
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
  const all = (await db.prepare('SELECT id, document_url, title, content_hash, published_on, duplicate_of_id, verification_status, auto_published, exam_code, authority, revision_kind, authenticity_note FROM gov_notices').all<Existing>()).results;
  const known = new Map(all.map((r) => [r.document_url, r]));
  const byDup = new Map(all.filter((r) => !r.duplicate_of_id).map((r) => [dupKey(r.title, r.published_on), r.id]));
  // Original notices by their base title, so a later corrigendum can be linked to what it corrects.
  const byBase = new Map<string, string>();
  for (const r of all) if (!r.revision_kind && !r.duplicate_of_id && baseKey(r.title) && !byBase.has(`${r.authority}|${baseKey(r.title)}`)) byBase.set(`${r.authority}|${baseKey(r.title)}`, r.id);
  const report: SourceReport[] = [];
  for (const src of SOURCES) {
    const st = state.get(src.key);
    const now = new Date();
    if (!opts.force && st?.next_check_at && st.next_check_at > now.toISOString()) {
      report.push({ key: src.key, ok: true, skipped: true });
      continue;
    }
    try {
      const c = await checkSource(db, src, known, byDup, byBase);
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
  versionCount: Number(r.version_count ?? 1),
  /** CORRIGENDUM, ADDENDUM, EXTENSION, RESCHEDULED, AMENDMENT or REVISED when the title says it changes an earlier notice. */
  revisionKind: (r.revision_kind as RevisionKind | null) ?? null,
  revisionOfId: (r.revision_of_id as string | null) ?? null,
  /** Filled in by withRevisions: the notice this one corrects, and the later notices that correct this one. */
  revisionOf: null as { id: string; title: string } | null,
  revisions: [] as { id: string; title: string; kind: RevisionKind | null; publishedOn: string | null }[],
});
type NoticeOut = ReturnType<typeof noticeOut>;

/** Adds, to each notice, the earlier notice it corrects and the published notices that correct it. Only published notices are named. */
async function withRevisions(db: D1Database, items: NoticeOut[]): Promise<NoticeOut[]> {
  if (!items.length) return items;
  const ids = items.map((i) => i.id);
  const parents = [...new Set(items.map((i) => i.revisionOfId).filter((x): x is string => Boolean(x)))];
  // D1 accepts at most 100 bound values in one statement, so a long page is looked up in parts.
  const inParts = async (list: string[], sql: (ph: string) => string) => {
    const out: Row[] = [];
    for (let i = 0; i < list.length; i += 80) {
      const part = list.slice(i, i + 80);
      out.push(...(await db.prepare(sql(part.map(() => '?').join(','))).bind(...part).all<Row>()).results);
    }
    return out;
  };
  const [kidRows, upRows] = await Promise.all([
    inParts(ids, (ph) => `SELECT id, title, revision_of_id, revision_kind, published_on FROM gov_notices WHERE revision_of_id IN (${ph}) AND verification_status = 'PUBLISHED' AND duplicate_of_id IS NULL ORDER BY published_on`),
    inParts(parents, (ph) => `SELECT id, title FROM gov_notices WHERE id IN (${ph}) AND verification_status = 'PUBLISHED' AND duplicate_of_id IS NULL`),
  ]);
  const kids = { results: kidRows };
  const ups = { results: upRows };
  return items.map((i) => ({
    ...i,
    revisionOf: ups.results.find((u) => u.id === i.revisionOfId) ? { id: i.revisionOfId!, title: String(ups.results.find((u) => u.id === i.revisionOfId)!.title) } : null,
    revisions: kids.results.filter((k) => k.revision_of_id === i.id).map((k) => ({ id: String(k.id), title: String(k.title), kind: (k.revision_kind as RevisionKind | null) ?? null, publishedOn: (k.published_on as string | null) ?? null })),
  }));
}

/** Published notices, newest first. The same for every visitor: nothing here belongs to a student. */
/**
 * Words that make a notice relevant to CUET-UG students: the exam itself and its steps (registration, admit card, answer key, result)
 * and admissions / counselling. Used only to choose which notices students see; the stored notices are not changed.
 */
export const RELEVANT_NOTICE_WORDS = ['cuet', 'common university entrance', 'entrance test', 'entrance exam', 'admission', 'counsel', 'admit card', 'answer key', 'scorecard', 'merit list', 'seat allot'];

/**
 * The one rule for which notices students may see (list, single notice, digest email): notices of the active exams (or of no single exam),
 * and, when the catalogue is limited, only those of the exam itself plus other-authority notices that mention CUET or admissions.
 * It selects rows; it never changes them.
 */
export function studentNoticeScope(activeExams: string[] | undefined, relevantOnly: boolean, col = ''): { sql: string; binds: unknown[] } {
  const binds: unknown[] = [];
  let sql = '';
  if (activeExams) {
    sql += ` AND (${col}exam_code IS NULL OR ${col}exam_code IN (${activeExams.map(() => '?').join(',')}))`;
    binds.push(...activeExams);
  }
  if (relevantOnly) {
    sql += ` AND (${col}exam_code IS NOT NULL OR ${RELEVANT_NOTICE_WORDS.map(() => `LOWER(${col}title || ' ' || COALESCE(${col}description, '')) LIKE ?`).join(' OR ')})`;
    binds.push(...RELEVANT_NOTICE_WORDS.map((w) => `%${w}%`));
  }
  return { sql, binds };
}

export async function listNotices(db: D1Database, q: z.infer<typeof noticeQuery>, activeExams?: string[], relevantOnly = false) {
  const binds: unknown[] = [];
  let where = `verification_status = 'PUBLISHED' AND duplicate_of_id IS NULL`;
  const scope = studentNoticeScope(activeExams, relevantOnly);
  where += scope.sql;
  binds.push(...scope.binds);
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
  return { total: total?.n ?? 0, lastCheckedAt: checked?.at ?? null, categories: cats.results.map((c) => ({ category: c.category, count: c.n })), notices: await withRevisions(db, rows.results.map(noticeOut)) };
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
           COALESCE(SUM(verification_status = 'NEEDS_REVIEW' AND duplicate_of_id IS NULL), 0) AS waiting, COALESCE(SUM(changed_at >= ?1), 0) AS updated_7d,
           COALESCE(SUM(verification_status = 'WITHDRAWN'), 0) AS withdrawn, COALESCE(SUM(revision_kind IS NOT NULL AND duplicate_of_id IS NULL AND verification_status = 'PUBLISHED'), 0) AS revisions
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
    withdrawn: totals?.withdrawn ?? 0,
    publishedRevisions: totals?.revisions ?? 0,
    // A source that has not been read successfully for three times its interval (only counted while scheduled fetching is on).
    staleSources: settings.enabled ? list.filter((s) => !s.last_success_at || Date.now() - Date.parse(String(s.last_success_at)) > settings.intervalMinutes * 3 * 60_000).length : 0,
    failedSources: list.filter((s) => Number(s.consecutive_failures) > 0).length,
    sources: list.map((s) => ({
      key: s.key, name: s.name, url: s.url, authority: s.authority, dataType: SOURCES.find((x) => x.key === s.key)?.dataType ?? null, reliability: SOURCES.find((x) => x.key === s.key)?.reliability ?? null, lastCheckedAt: s.last_checked_at, lastSuccessAt: s.last_success_at, lastError: s.last_error, lastErrorAt: s.last_error_at,
      consecutiveFailures: Number(s.consecutive_failures), nextCheckAt: s.next_check_at, found: Number(s.last_found), added: Number(s.last_new), updated: Number(s.last_updated),
      duplicates: Number(s.last_duplicates), queued: Number(s.last_queued),
    })),
  };
}

export async function noticeQueue(db: D1Database) {
  const { results } = await db.prepare(`SELECT * FROM gov_notices WHERE verification_status = 'NEEDS_REVIEW' AND duplicate_of_id IS NULL ORDER BY first_detected_at DESC LIMIT 200`).all<Row>();
  return results.map((r) => ({ ...noticeOut(r), statusNote: r.status_note as string | null }));
}

export const noticeDecisionSchema = z.object({
  action: z.enum(['PUBLISH', 'REJECT', 'FLAG', 'WITHDRAW']),
  exam: z.enum(EXAMS).optional(),
  category: z.enum(NOTICE_CATEGORIES).optional(),
  /** Why. Required to flag or withdraw a notice; optional otherwise. Recorded in the notice's history. */
  reason: z.string().trim().min(5).max(500).optional(),
});

/**
 * A member of staff settles a notice, or takes back one that is showing.
 *   PUBLISH  a queued, rejected or withdrawn notice goes on show (its checks are made again)
 *   REJECT   a queued notice is turned down
 *   FLAG     a showing notice is taken off show and put back in the queue for a second look (a reason is needed)
 *   WITHDRAW a showing notice is taken off show for good, until someone publishes it again (a reason is needed)
 * Every decision is written to the notice's history with who made it. The reader never publishes a notice staff have rejected or withdrawn.
 */
export async function decideNotice(db: D1Database, id: string, input: z.infer<typeof noticeDecisionSchema>, actor: string) {
  const cur = await db
    .prepare('SELECT id, exam_code, document_url, verification_status, authority, title FROM gov_notices WHERE id = ?')
    .bind(id)
    .first<{ id: string; exam_code: string | null; document_url: string; verification_status: string; authority: Authority; title: string }>();
  if (!cur) throw notFound('Notice');
  const from = cur.verification_status;
  const now = nowIso();
  const settled = () => new ApiError(409, 'CONFLICT', 'This notice has already been settled');
  const move = async (to: string, note: string, action: string, set = '', bind: (string | null)[] = []) => {
    await db.batch([
      db.prepare(`UPDATE gov_notices SET verification_status = ?, auto_published = 0, status_note = ?, updated_at = ?${set} WHERE id = ?`).bind(to, note, now, ...bind, id),
      eventStmt(db, id, action, actor, from, to, input.reason ?? note, now),
    ]);
    return { id, status: to };
  };
  if (input.action === 'REJECT') {
    if (from !== 'NEEDS_REVIEW') throw settled();
    return move('REJECTED', `Rejected by ${actor}${input.reason ? `: ${input.reason}` : ''}`, 'REJECTED');
  }
  if (input.action === 'FLAG' || input.action === 'WITHDRAW') {
    if (from !== 'PUBLISHED') throw new ApiError(409, 'CONFLICT', `Only a notice that is showing can be ${input.action === 'FLAG' ? 'flagged' : 'withdrawn'}`);
    if (!input.reason) throw invalid(`Say why you are ${input.action === 'FLAG' ? 'flagging' : 'withdrawing'} it (reason)`);
    return input.action === 'FLAG'
      ? move('NEEDS_REVIEW', `Flagged by ${actor}: ${input.reason}`, 'FLAGGED')
      : move('WITHDRAWN', `Withdrawn by ${actor}: ${input.reason}`, 'WITHDRAWN');
  }
  // PUBLISH
  if (!['NEEDS_REVIEW', 'REJECTED', 'WITHDRAWN'].includes(from)) throw settled();
  const exam = cur.authority === 'UGC' ? null : (input.exam ?? cur.exam_code);
  if (cur.authority === 'NTA' && !exam) throw invalid('Say whether this notice is for CUET (UG) or CUET (PG)');
  if (!isOfficialUrl(cur.document_url, cur.authority)) throw invalid(`This document is not on ${cur.authority}'s own website, so it cannot be published`);
  if (titleProblem(cur.title)) throw invalid(`This notice cannot be published: ${titleProblem(cur.title)}`);
  return move('PUBLISHED', `Checked and published by ${actor}`, 'PUBLISHED', ', exam_code = ?, category = COALESCE(?, category)', [exam, input.category ?? null]);
}

// ---------------------------------------------------------------- staff: every notice, and the history of one

export const adminNoticeQuery = z.object({
  status: z.enum(['PUBLISHED', 'NEEDS_REVIEW', 'REJECTED', 'WITHDRAWN', 'DUPLICATE']).optional(),
  authority: z.enum(AUTHORITIES).optional(),
  revisions: z.enum(['1']).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(20000).default(0),
});

export async function adminNotices(db: D1Database, q: z.infer<typeof adminNoticeQuery>) {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (q.status === 'DUPLICATE') where.push('duplicate_of_id IS NOT NULL');
  else if (q.status) (where.push('verification_status = ? AND duplicate_of_id IS NULL'), binds.push(q.status));
  if (q.authority) (where.push('authority = ?'), binds.push(q.authority));
  if (q.revisions) where.push('revision_kind IS NOT NULL');
  if (q.q) (where.push("title LIKE '%' || ? || '%' COLLATE NOCASE"), binds.push(q.q));
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows, total] = await Promise.all([
    db.prepare(`SELECT * FROM gov_notices ${clause} ORDER BY COALESCE(published_on, substr(first_detected_at, 1, 10)) DESC, first_detected_at DESC, id LIMIT ? OFFSET ?`).bind(...binds, q.limit, q.offset).all<Row>(),
    db.prepare(`SELECT COUNT(*) AS n FROM gov_notices ${clause}`).bind(...binds).first<{ n: number }>(),
  ]);
  const items = await withRevisions(db, rows.results.map(noticeOut));
  return {
    total: total?.n ?? 0,
    notices: items.map((n, i) => ({ ...n, status: rows.results[i]!.verification_status as string, statusNote: rows.results[i]!.status_note as string | null, authenticityNote: rows.results[i]!.authenticity_note as string | null, autoPublished: rows.results[i]!.auto_published === 1, duplicateOfId: rows.results[i]!.duplicate_of_id as string | null })),
  };
}

/** Every version the official page has shown, and everything that has happened to the notice, newest first. */
export async function noticeHistory(db: D1Database, id: string) {
  const n = await db.prepare('SELECT id, title, authority, verification_status, status_note, authenticity_note, document_url, source_url, revision_kind, revision_of_id FROM gov_notices WHERE id = ?').bind(id).first<Row>();
  if (!n) throw notFound('Notice');
  const [versions, events] = await Promise.all([
    db.prepare('SELECT version, title, description, published_on, document_url, reason, detected_at FROM gov_notice_versions WHERE notice_id = ? ORDER BY version DESC').bind(id).all<Row>(),
    db.prepare('SELECT action, actor, from_status, to_status, note, created_at FROM gov_notice_events WHERE notice_id = ? ORDER BY created_at DESC, rowid DESC').bind(id).all<Row>(),
  ]);
  return {
    notice: { id: n.id, title: n.title, authority: n.authority, status: n.verification_status, statusNote: n.status_note, authenticityNote: n.authenticity_note, documentUrl: n.document_url, sourceUrl: n.source_url, revisionKind: n.revision_kind, revisionOfId: n.revision_of_id },
    versions: versions.results.map((v) => ({ version: Number(v.version), title: v.title, description: v.description, publishedOn: v.published_on, documentUrl: v.document_url, reason: v.reason, detectedAt: v.detected_at })),
    events: events.results.map((e) => ({ action: e.action, actor: e.actor, from: e.from_status, to: e.to_status, note: e.note, at: e.created_at })),
  };
}

/** For students: one notice with its earlier and later versions as the official page showed them, and the notices that correct it. */
export async function publicNoticeDetail(db: D1Database, id: string, activeExams?: string[], relevantOnly = false) {
  // A notice hidden from the lists is not reachable by its own link either (same rule, so nothing hidden leaks through a bookmark).
  const scope = studentNoticeScope(activeExams, relevantOnly);
  const row = await db.prepare(`SELECT * FROM gov_notices WHERE id = ? AND verification_status = 'PUBLISHED' AND duplicate_of_id IS NULL${scope.sql}`).bind(id, ...scope.binds).first<Row>();
  if (!row) throw notFound('Notice');
  const [[notice], versions] = await Promise.all([
    withRevisions(db, [noticeOut(row)]),
    db.prepare('SELECT version, title, published_on, reason, detected_at FROM gov_notice_versions WHERE notice_id = ? ORDER BY version DESC').bind(id).all<Row>(),
  ]);
  return { notice: notice!, versions: versions.results.map((v) => ({ version: Number(v.version), title: v.title as string, publishedOn: v.published_on as string | null, reason: v.reason as string, detectedAt: v.detected_at as string })) };
}

// ---------------------------------------------------------------- the notice half of the source registry

/** The pages the reader checks, as registry rows: what they are, how far they are trusted, how often they are read, and when they last were. */
export async function noticeSourceRegistry(db: D1Database, env: { NOTICE_FETCH?: string; NOTICE_FETCH_MINUTES?: string }) {
  await ensureSources(db);
  const settings = fetchSettings(env);
  const { results } = await db.prepare('SELECT key, last_success_at, last_checked_at, consecutive_failures, last_error FROM gov_notice_sources').all<Row>();
  return SOURCES.map((s) => {
    const st = results.find((r) => r.key === s.key);
    const last = (st?.last_success_at as string | null) ?? null;
    return {
      registry: 'NOTICES' as const,
      key: s.key, name: s.name, url: s.url, authority: s.authority, dataType: s.dataType, reliability: s.reliability,
      updateFrequency: settings.enabled ? `Read every ${settings.intervalMinutes >= 60 ? `${Math.round((settings.intervalMinutes / 60) * 10) / 10} hours` : `${settings.intervalMinutes} minutes`}` : 'Scheduled reading is switched off',
      lastCheckedOn: last ? last.slice(0, 10) : null,
      state: !st || !last ? 'NEVER_READ' : Number(st.consecutive_failures) > 0 ? 'FAILING' : 'OK',
      lastError: (st?.last_error as string | null) ?? null,
    };
  });
}
