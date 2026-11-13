import { createExecutionContext, env, waitOnExecutionContext } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import app from '../src/index';
import { classifyCategory, classifyExam, isOfficialUrl, parseListing, publishedDate, setNoticeFetchForTests, syncNotices } from '../src/services/gov-notices';

const ADMIN = { 'x-admin-token': 'test-admin-token', 'content-type': 'application/json' };
const JSON_H = { 'content-type': 'application/json' };

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = JSON_H) {
  const ctx = createExecutionContext();
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx);
  await waitOnExecutionContext(ctx);
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') };
}
async function account(role?: string) {
  const email = `gov-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  await call('POST', '/api/auth/register', { email, password: 'correct-horse-battery', displayName: 'Gov' });
  if (role) await call('POST', '/api/admin/users/roles', { email, role }, ADMIN);
  const s = await call('POST', '/api/auth/login', { email, password: 'correct-horse-battery' });
  return { cookie: s.cookie!.split(';')[0]! };
}

/** YYYYMMDD for a day some days back, as the official sites stamp their file names. */
const stamp = (daysBack: number) => new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10).replace(/-/g, '');
const iso = (daysBack: number) => new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);
const CDN_UG = 'https://cdnbbsr.s3waas.gov.in/s3d1a21da7bca4abff8b0b61b87597de73/uploads';
const CDN_PG = 'https://cdnbbsr.s3waas.gov.in/s388a839f2f6f1427879fc33ee4acf4f66/uploads';
const ugFile = (daysBack: number, n: string) => `${CDN_UG}/${stamp(daysBack).slice(0, 4)}/${stamp(daysBack).slice(4, 6)}/${stamp(daysBack)}${n}.pdf`;
const pgFile = (daysBack: number, n: string) => `${CDN_PG}/${stamp(daysBack).slice(0, 4)}/${stamp(daysBack).slice(4, 6)}/${stamp(daysBack)}${n}.pdf`;

const ugRow = (title: string, url: string) => `<tr><td><a target="_blank" href="${url}" aria-label="${title} PDF 159 KB - opens in a new window" title="Click here to view">${title}</a></td><td> </td>
  <td><div><span class="pdf-downloads"><a target="_blank" href="${url}" aria-label="${title} PDF 159 KB - opens in a new window"> View(159 KB) </a></span></div></td></tr>`;
const ugPage = (rows: string[]) => `<html><body><table><thead><tr><th>Title</th><th>Date</th><th>View / Download</th></tr></thead><tbody>${rows.join('\n')}</tbody></table><a class="next page-numbers" href="page/2/">Next</a></body></html>`;
const pgPage = (links: [string, string][]) => `<html><body><ul>${links.map(([t, u]) => `<li><a href="${u}" target="_blank">${t}</a></li>`).join('')}</ul><a href="https://exams.nta.nic.in/cuet-pg/nta-helpdesk/">Helpdesk</a></body></html>`;
const boardRow = (n: number, title: string, href: string) => `<tr> <td class="align_centre">${n}</td> <td> <i class="fa"></i> <content style="color:#012B55">${title}&nbsp;</content> </td> <td class="align_centre"> <a href="${href}" class="orange-text" target="_blank"> <strong>Read More&nbsp;</strong> </a> </td> </tr>`;
const boardPage = (rows: string[]) => `<html><body><table>${rows.join('\n')}</table></body></html>`;

type Pages = Record<string, string | number>;
let requests: string[] = [];
function serve(pages: Pages) {
  requests = [];
  setNoticeFetchForTests((async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push(`${url} | ${new Headers(init?.headers).get('user-agent')}`);
    const page = pages[url];
    if (page === undefined) return new Response('not found', { status: 404, headers: { 'content-type': 'text/html' } });
    if (typeof page === 'number') return new Response('error', { status: page, headers: { 'content-type': 'text/html' } });
    return new Response(page, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } });
  }) as typeof fetch);
}
const UG = 'https://cuet.nta.nic.in/document-category/public-notice/';
const UG2 = `${UG}page/2/`;
const PG = 'https://exams.nta.nic.in/cuet-pg/';
const BOARD = 'https://nta.ac.in/NoticeBoardArchive';
const ON = { DB: env.DB, NOTICE_FETCH: 'on', NOTICE_FETCH_MINUTES: '180' };
const reset = async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM gov_notices'), env.DB.prepare('DELETE FROM gov_notice_sources')]);
};
const rows = async () => (await env.DB.prepare('SELECT * FROM gov_notices ORDER BY document_url').all<Record<string, string | number | null>>()).results;
const source = async (key: string) => (await env.DB.prepare('SELECT * FROM gov_notice_sources WHERE key = ?').bind(key).first<Record<string, string | number | null>>())!;
const makeDue = () => env.DB.prepare(`UPDATE gov_notice_sources SET next_check_at = '2000-01-01T00:00:00.000Z'`).run();

afterEach(() => setNoticeFetchForTests(null));

const admitUg = ugFile(2, '268704934');
const resultUg = ugFile(40, '716111016');
const keyPg = pgFile(3, '1399769113');
const standard = (): Pages => ({
  [UG]: ugPage([ugRow('Release of Admit Cards for CUET (UG) &#8211; 2027', admitUg), ugRow('NTA Declares the Result of Common University Entrance Test (UG) &#8211; 2026', resultUg)]),
  [UG2]: ugPage([ugRow('Advisory for Candidates Regarding Dress Code', ugFile(60, '1997185883'))]),
  [PG]: pgPage([['Display of provisional answer key(s) for CUET (PG) 2027 Examination', keyPg]]),
  [BOARD]: boardPage([
    boardRow(1, 'Publication of Vacancy Notification for Various Posts in the NTA', `/Download/Notice/Notice_${stamp(1)}175300.pdf`),
    boardRow(2, 'Release of Admit Cards for CUET (UG)- 2027', `/Download/Notice/Notice_${stamp(2)}193509.pdf`),
    boardRow(3, 'Important notice regarding CUET 2027 registration', `/Download/Notice/Notice_${stamp(5)}101010.pdf`),
    boardRow(4, 'Schedule of CUET (PG) 2027 examination', `/Download/Notice/Notice_${stamp(6)}111111.pdf`),
    boardRow(5, 'Old CUET (UG) notice from years ago', '/Download/Notice/Notice_20220101101010.pdf'),
  ]),
});

describe('reading official pages', () => {
  it('reads titles, addresses and dates from the three page layouts', () => {
    const ug = parseListing('S3WAAS_TABLE', String(standard()[UG]), UG);
    expect(ug).toEqual([
      { title: 'Release of Admit Cards for CUET (UG) – 2027', documentUrl: admitUg, description: 'PDF 159 KB document' },
      { title: 'NTA Declares the Result of Common University Entrance Test (UG) – 2026', documentUrl: resultUg, description: 'PDF 159 KB document' },
    ]);
    const board = parseListing('NTA_ARCHIVE', String(standard()[BOARD]), BOARD);
    expect(board).toHaveLength(5);
    expect(board[1]).toEqual({ title: 'Release of Admit Cards for CUET (UG)- 2027', documentUrl: `https://nta.ac.in/Download/Notice/Notice_${stamp(2)}193509.pdf`, description: null });
    expect(parseListing('PDF_LINKS', String(standard()[PG]), PG)).toEqual([{ title: 'Display of provisional answer key(s) for CUET (PG) 2027 Examination', documentUrl: keyPg, description: null }]);
    expect(parseListing('S3WAAS_TABLE', '<html><body>Under maintenance</body></html>', UG)).toEqual([]);
  });

  it('works out the date, exam and category by fixed rules, and knows an official address', () => {
    expect(publishedDate('https://cdnbbsr.s3waas.gov.in/s3x/uploads/2026/06/20260623268704934.pdf')).toBe('2026-06-23');
    expect(publishedDate('https://nta.ac.in/Download/Notice/Notice_20260623193509.pdf')).toBe('2026-06-23');
    expect(publishedDate('https://nta.ac.in/Download/Notice/Notice_20261399193509.pdf')).toBeNull();
    expect(publishedDate('https://nta.ac.in/Download/Notice/other.pdf')).toBeNull();
    expect(classifyExam('Final Answer Keys for CUET(UG) – 2026')).toBe('CUET_UG');
    expect(classifyExam('Common University Entrance Test for Postgraduate Programmes')).toBe('CUET_PG');
    expect(classifyExam('Important notice regarding CUET 2027')).toBeNull();
    expect(classifyExam('CUET (UG) and CUET (PG) combined notice')).toBeNull();
    expect(classifyCategory('Release of Admit Cards for CUET (UG)')).toBe('ADMIT_CARD');
    expect(classifyCategory('Display of Provisional Answer Keys')).toBe('ANSWER_KEY');
    expect(classifyCategory('List of toppers of CUET (UG)')).toBe('RESULT');
    expect(classifyCategory('Advance Intimation for Allotment of Examination City')).toBe('CITY_INTIMATION');
    expect(classifyCategory('Rescheduling of CUET (UG) 2026')).toBe('EXAM_SCHEDULE');
    expect(classifyCategory('Something else entirely')).toBe('GENERAL');
    expect(isOfficialUrl('https://nta.ac.in/Download/x.pdf')).toBe(true);
    expect(isOfficialUrl('https://cdnbbsr.s3waas.gov.in/x.pdf')).toBe(true);
    expect(isOfficialUrl('http://nta.ac.in/x.pdf')).toBe(false);
    expect(isOfficialUrl('https://nta.ac.in.example.com/x.pdf')).toBe(false);
    expect(isOfficialUrl('https://fake-gov.in/x.pdf')).toBe(false);
  });
});

describe('the scheduled fetch', () => {
  it('collects new notices, publishes the certain ones, queues the uncertain ones and records duplicates', async () => {
    await reset();
    serve(standard());
    const run = await syncNotices(ON);
    expect(run.ran).toBe(true);
    expect(run.sources.map((s) => [s.key, s.ok, s.added, s.duplicates, s.queued])).toEqual([
      ['cuet-ug-public-notices', true, 3, 0, 0],
      ['cuet-pg-website', true, 1, 0, 0],
      // The board: the vacancy notice is not about CUET and the 2022 one is too old. Of the other three, the admit-card
      // notice is the one already held from the CUET (UG) page, and the one that names no exam waits for a check.
      ['nta-notice-board', true, 2, 1, 1],
    ]);
    // Every request named itself honestly and went only to the official pages.
    expect(requests.map((r) => r.split(' | ')[0])).toEqual([UG, UG2, PG, BOARD]);
    expect(requests.every((r) => /cuet-prep-notice-monitor/.test(r))).toBe(true);

    const all = await rows();
    expect(all).toHaveLength(7);
    const admit = all.find((r) => r.document_url === admitUg)!;
    expect(admit).toMatchObject({
      source_key: 'cuet-ug-public-notices', source_name: 'NTA, CUET (UG) public notices', source_url: UG, title: 'Release of Admit Cards for CUET (UG) – 2027', description: 'PDF 159 KB document', category: 'ADMIT_CARD',
      exam_code: 'CUET_UG', exam_year: 2027, published_on: iso(2), verification_status: 'PUBLISHED', duplicate_of_id: null, is_pdf: 1, changed_at: null,
    });
    expect(admit.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(admit.first_detected_at).toBeTruthy();
    expect(admit.last_checked_at).toBeTruthy();
    const dup = all.find((r) => String(r.document_url).endsWith(`Notice_${stamp(2)}193509.pdf`))!;
    expect(dup).toMatchObject({ source_key: 'nta-notice-board', duplicate_of_id: admit.id, document_url: `https://nta.ac.in/Download/Notice/Notice_${stamp(2)}193509.pdf` });
    const unsure = all.find((r) => String(r.title).startsWith('Important notice regarding CUET 2027'))!;
    expect(unsure).toMatchObject({ verification_status: 'NEEDS_REVIEW', exam_code: null, category: 'APPLICATION' });
    expect(unsure.status_note).toMatch(/does not say whether it is for CUET \(UG\) or CUET \(PG\)/);
    expect(all.find((r) => String(r.title).startsWith('Schedule of CUET (PG) 2027'))).toMatchObject({ verification_status: 'PUBLISHED', exam_code: 'CUET_PG', category: 'EXAM_SCHEDULE', published_on: iso(6) });
    expect(all.some((r) => /Vacancy|years ago/.test(String(r.title)))).toBe(false);
    expect(await source('cuet-ug-public-notices')).toMatchObject({ consecutive_failures: 0, last_error: null, last_found: 3, last_new: 3 });
  });

  it('adds nothing on a second run, waits for the interval, and then detects one new and one changed notice', async () => {
    await reset();
    serve(standard());
    await syncNotices(ON);
    const before = await rows();

    // Not due yet: no page is read at all.
    serve(standard());
    const early = await syncNotices(ON);
    expect(early.sources.every((s) => s.skipped)).toBe(true);
    expect(requests).toEqual([]);

    // Due, nothing changed: no new rows, no "updated".
    await makeDue();
    const same = await syncNotices(ON);
    expect(same.sources.map((s) => [s.added, s.updated, s.duplicates])).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(await rows()).toHaveLength(before.length);

    // The source corrects a title and publishes one more notice.
    const pages = standard();
    const fresh = ugFile(0, '555');
    pages[UG] = ugPage([ugRow('Final Answer Keys for CUET (UG) &#8211; 2027', fresh), ugRow('Release of Admit Cards for CUET (UG) &#8211; 2027 (Revised)', admitUg), ugRow('NTA Declares the Result of Common University Entrance Test (UG) &#8211; 2026', resultUg)]);
    serve(pages);
    await makeDue();
    const next = await syncNotices(ON);
    expect(next.sources[0]).toMatchObject({ key: 'cuet-ug-public-notices', added: 1, updated: 1, duplicates: 0 });
    const after = await rows();
    expect(after).toHaveLength(before.length + 1);
    const admit = after.find((r) => r.document_url === admitUg)!;
    const was = before.find((r) => r.document_url === admitUg)!;
    expect(admit).toMatchObject({ id: was.id, title: 'Release of Admit Cards for CUET (UG) – 2027 (Revised)', first_detected_at: was.first_detected_at });
    expect(admit.changed_at).not.toBeNull();
    expect(admit.content_hash).not.toBe(was.content_hash);
    expect(after.find((r) => r.document_url === fresh)).toMatchObject({ category: 'ANSWER_KEY', verification_status: 'PUBLISHED', published_on: iso(0) });
    // One row per official address, always.
    expect(new Set(after.map((r) => r.document_url)).size).toBe(after.length);
  });

  it('keeps going when one source fails, retries it sooner, and recovers', async () => {
    await reset();
    const pages = standard();
    pages[PG] = 503;
    serve(pages);
    const run = await syncNotices(ON);
    expect(run.sources.map((s) => [s.key, s.ok])).toEqual([['cuet-ug-public-notices', true], ['cuet-pg-website', false], ['nta-notice-board', true]]);
    expect(run.sources[1]!.error).toMatch(/503/);
    let pg = await source('cuet-pg-website');
    expect(pg).toMatchObject({ consecutive_failures: 1, last_success_at: null });
    expect(pg.last_error).toMatch(/503/);
    // Tried again in about 15 minutes, not after the full 3 hours.
    const wait = (Date.parse(String(pg.next_check_at)) - Date.now()) / 60_000;
    expect(wait).toBeGreaterThan(10);
    expect(wait).toBeLessThan(20);
    expect((await rows()).filter((r) => r.source_key === 'cuet-pg-website')).toHaveLength(0);

    // A page that loads but has lost its layout is a failure too, never an empty success.
    pages[PG] = '<html><body>Site under maintenance</body></html>';
    serve(pages);
    await makeDue();
    await syncNotices(ON);
    pg = await source('cuet-pg-website');
    expect(pg.consecutive_failures).toBe(2);
    expect(pg.last_error).toMatch(/layout may have changed/);
    expect((Date.parse(String(pg.next_check_at)) - Date.now()) / 60_000).toBeGreaterThan(25);

    // Back to normal.
    serve(standard());
    await makeDue();
    const ok = await syncNotices(ON);
    expect(ok.sources[1]).toMatchObject({ ok: true, added: 1 });
    expect(await source('cuet-pg-website')).toMatchObject({ consecutive_failures: 0, last_error: null });
  });

  it('queues a notice whose document is not on an official website, and never follows a page off the official sites', async () => {
    await reset();
    const pages = standard();
    pages[UG] = ugPage([ugRow('Revised Schedule for CUET (UG) &#8211; 2027', `https://files.example.com/uploads/${stamp(1).slice(0, 4)}/${stamp(1).slice(4, 6)}/${stamp(1)}99.pdf`), ugRow('Release of Admit Cards for CUET (UG) &#8211; 2027', admitUg)]);
    serve(pages);
    await syncNotices(ON);
    const odd = (await rows()).find((r) => String(r.document_url).startsWith('https://files.example.com/'))!;
    expect(odd).toMatchObject({ verification_status: 'NEEDS_REVIEW', exam_code: 'CUET_UG' });
    expect(odd.status_note).toMatch(/not on an official website/);
    expect(requests.every((r) => /^https:\/\/(cuet\.nta\.nic\.in|exams\.nta\.nic\.in|nta\.ac\.in)\//.test(r))).toBe(true);
  });

  it('does nothing while fetching is switched off, and runs from the Worker\'s scheduled handler when it is on', async () => {
    await reset();
    serve(standard());
    expect(await syncNotices({ DB: env.DB, NOTICE_FETCH: 'off' })).toMatchObject({ ran: false });
    expect(requests).toEqual([]);
    expect(await rows()).toHaveLength(0);

    const worker = app as unknown as { scheduled(c: { cron: string; scheduledTime: number }, e: unknown, ctx: ExecutionContext): Promise<void> };
    // The test environment has it off: a cron tick reads nothing.
    let ctx = createExecutionContext();
    await worker.scheduled({ cron: '*/30 * * * *', scheduledTime: Date.now() }, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(requests).toEqual([]);
    // Switched on: the same cron tick fetches and stores.
    ctx = createExecutionContext();
    await worker.scheduled({ cron: '*/30 * * * *', scheduledTime: Date.now() }, { ...env, NOTICE_FETCH: 'on' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(requests.map((r) => r.split(' | ')[0])).toEqual([UG, UG2, PG, BOARD]);
    expect((await rows()).length).toBe(7);
    // The next tick, 30 minutes later, finds nothing due.
    serve(standard());
    ctx = createExecutionContext();
    await worker.scheduled({ cron: '*/30 * * * *', scheduledTime: Date.now() }, { ...env, NOTICE_FETCH: 'on' }, ctx);
    await waitOnExecutionContext(ctx);
    expect(requests).toEqual([]);
  });
});

describe('what students and staff see', () => {
  it('shows only published, non-duplicate notices, with filters, flags and official links', async () => {
    await reset();
    serve(standard());
    await syncNotices(ON);
    const all = (await call('GET', '/api/public/notices')).json;
    expect(all.total).toBe(5);
    expect(all.lastCheckedAt).toBeTruthy();
    const titles = all.notices.map((n: { title: string }) => n.title);
    expect(titles.some((t: string) => t.startsWith('Important notice regarding CUET 2027'))).toBe(false); // waiting for a check
    expect(titles.filter((t: string) => /Admit Cards for CUET \(UG\)/.test(t))).toHaveLength(1); // the duplicate is hidden
    // Newest first.
    const dates = all.notices.map((n: { publishedOn: string }) => n.publishedOn);
    expect([...dates].sort().reverse()).toEqual(dates);
    const first = all.notices[0];
    expect(first).toMatchObject({ title: 'Release of Admit Cards for CUET (UG) – 2027', category: 'ADMIT_CARD', exam: 'CUET_UG', examYear: 2027, publishedOn: iso(2), isNew: true, isUpdated: false, isPdf: true, sourceName: 'NTA, CUET (UG) public notices', sourceUrl: UG, documentUrl: admitUg });
    expect(all.notices.find((n: { publishedOn: string }) => n.publishedOn === iso(40)).isNew).toBe(false);

    const ug = (await call('GET', '/api/public/notices?exam=CUET_UG')).json;
    expect(ug.total).toBe(3);
    expect(ug.notices.every((n: { exam: string }) => n.exam === 'CUET_UG')).toBe(true);
    expect(ug.categories).toEqual(expect.arrayContaining([{ category: 'ADMIT_CARD', count: 1 }, { category: 'RESULT', count: 1 }, { category: 'ADVISORY', count: 1 }]));
    const pg = (await call('GET', '/api/public/notices?exam=CUET_PG')).json;
    expect(pg.notices.map((n: { category: string }) => n.category).sort()).toEqual(['ANSWER_KEY', 'EXAM_SCHEDULE']);
    expect((await call('GET', '/api/public/notices?exam=CUET_PG&category=ANSWER_KEY')).json.total).toBe(1);
    expect((await call('GET', '/api/public/notices?limit=2&offset=1')).json.notices).toHaveLength(2);
    expect((await call('GET', '/api/public/notices?exam=JEE')).status).toBe(400);
    expect((await call('GET', '/api/public/notices?category=NOPE')).status).toBe(400);

    // An updated notice is flagged.
    const pages = standard();
    pages[UG] = ugPage([ugRow('Release of Admit Cards for CUET (UG) &#8211; 2027 (Revised)', admitUg)]);
    serve(pages);
    await makeDue();
    await syncNotices(ON);
    expect((await call('GET', '/api/public/notices?exam=CUET_UG&category=ADMIT_CARD')).json.notices[0]).toMatchObject({ title: 'Release of Admit Cards for CUET (UG) – 2027 (Revised)', isUpdated: true });
  });

  it('gives staff the monitoring figures and the verification queue; students cannot reach either', async () => {
    await reset();
    const pages = standard();
    pages[PG] = 500;
    serve(pages);
    await syncNotices(ON);
    const staff = await account('SUPER_ADMIN');
    const student = await account();

    for (const path of ['/api/console/notices/overview', '/api/console/notices/queue']) {
      expect((await call('GET', path)).status).toBe(401);
      expect((await call('GET', path, undefined, student)).status).toBe(403);
    }
    expect((await call('POST', '/api/console/notices/fetch', {}, student)).status).toBe(403);

    const o = (await call('GET', '/api/console/notices/overview', undefined, staff)).json;
    expect(o).toMatchObject({ enabled: false, intervalMinutes: 180, collected: 6, published: 4, newInSevenDays: 5, duplicates: 1, awaitingVerification: 1, failedSources: 1, nextScheduledFetch: null });
    expect(o.lastSuccessfulFetch).toBeTruthy();
    expect(o.sources.map((s: { key: string; consecutiveFailures: number }) => [s.key, s.consecutiveFailures])).toEqual([['cuet-pg-website', 1], ['cuet-ug-public-notices', 0], ['nta-notice-board', 0]]);
    expect(o.sources[0].lastError).toMatch(/500/);

    const queue = (await call('GET', '/api/console/notices/queue', undefined, staff)).json;
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ title: 'Important notice regarding CUET 2027 registration', exam: null });
    expect(queue[0].statusNote).toMatch(/Waiting for a check/);
    const id = queue[0].id as string;
    expect((await call('POST', `/api/console/notices/${id}/decision`, { action: 'PUBLISH' }, student)).status).toBe(403);
    expect((await call('POST', `/api/console/notices/${id}/decision`, { action: 'PUBLISH' }, staff)).status).toBe(422); // which exam?
    expect((await call('POST', `/api/console/notices/${id}/decision`, { action: 'PUBLISH', exam: 'CUET_UG' }, staff)).json).toEqual({ id, status: 'PUBLISHED' });
    expect((await call('POST', `/api/console/notices/${id}/decision`, { action: 'REJECT' }, staff)).status).toBe(409);
    expect((await call('GET', '/api/public/notices?exam=CUET_UG')).json.notices.some((n: { id: string }) => n.id === id)).toBe(true);
    expect((await call('GET', '/api/console/notices/queue', undefined, staff)).json).toEqual([]);

    // "Fetch now" from the console works even though the schedule is off in this environment, and clears the failure.
    serve(standard());
    const now = await call('POST', '/api/console/notices/fetch', {}, staff);
    expect(now.json.ran).toBe(true);
    expect((await call('GET', '/api/console/notices/overview', undefined, staff)).json).toMatchObject({ failedSources: 0, collected: 7 });
    // The notice a person published is not overwritten or duplicated by later fetches.
    expect((await env.DB.prepare('SELECT verification_status, exam_code FROM gov_notices WHERE id = ?').bind(id).first())).toEqual({ verification_status: 'PUBLISHED', exam_code: 'CUET_UG' });
  });
});
