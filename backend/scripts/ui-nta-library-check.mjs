// Checks the hosted NTA library end to end on a THROWAWAY copy of the local database and storage (deleted afterwards):
//  - every hosted file is served from our own storage and its SHA-256 equals the recorded one;
//  - flagged files are not listed or served; third-party copies are not listed where NTA's verified file is hosted;
//  - a student can open a paper and an answer key in the viewer, see its provenance, and download it, without a request to NTA or any other site.
//   CHROMIUM_PATH=<chrome.exe> node backend/scripts/ui-nta-library-check.mjs [screenshotDir] [path-to-playwright-package]
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..');
const shots = process.argv[2] ?? join(here, '..', '..', 'docs', 'completion', 'nta-library-screens-2026-11-16');
const pwPath = process.argv[3] ?? 'D:/alfa-d1/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(existsSync(pwPath) ? pwPath : join(pwPath, 'index.mjs')).href);
const wranglerBin = [join(backend, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(backend, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync);
const PORT = 8815;
const BASE = `http://127.0.0.1:${PORT}`;
const state = `D:/tmp/ui-nta-state-${Date.now()}`;
mkdirSync(shots, { recursive: true });
cpSync(join(backend, '.wrangler', 'state'), state, { recursive: true });
execFileSync(process.execPath, [wranglerBin, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], { cwd: backend, stdio: 'ignore' });
const server = spawn(process.execPath, [wranglerBin, 'dev', '--local', '--port', String(PORT), '--persist-to', state], { cwd: backend, stdio: ['ignore', 'pipe', 'pipe'] });
const stop = () => { try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ } };
const results = [];
const check = (name, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCIENCE = ['322', '306', '319', '304', '313', '308', '501'];
let browser;
try {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ } await sleep(1000); }
  const j = async (p) => (await fetch(BASE + p)).json();
  const tree = await j('/api/learn/pyq?exam=CUET_UG');
  check('the paper index lists only active science papers', tree.years.every((y) => y.subjects.every((s) => SCIENCE.includes(s.code))), tree.years.map((y) => `${y.year}:${y.subjects.length}`).join(' '));

  // every hosted file: served from our storage, intact
  const hosted = [];
  const keys = new Set();
  for (const y of tree.years) for (const s of y.subjects) {
    const sub = await j(`/api/learn/pyq/${y.year}/${s.slug}`);
    for (const d of [...sub.papers, ...sub.answerKeys]) if (d.hosted) hosted.push({ ...d, subject: s.code });
    for (const k of sub.answerKeys) keys.add(k.id);
  }
  let intact = 0, notOurs = 0, wrongType = 0;
  const seen = new Set();
  for (const d of hosted) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const r = await fetch(BASE + d.fileUrl);
    const buf = Buffer.from(await r.arrayBuffer());
    if (!d.fileUrl.startsWith('/api/learn/pyq/documents/')) notOurs++;
    if (r.headers.get('content-type') !== 'application/pdf' || buf.subarray(0, 5).toString() !== '%PDF-') wrongType++;
    if (r.status === 200 && createHash('sha256').update(buf).digest('hex') === d.hosted.sha256) intact++;
  }
  check(`all ${seen.size} hosted science files are served from our own storage and match their recorded SHA-256`, seen.size > 0 && intact === seen.size && notOurs === 0 && wrongType === 0, `${intact}/${seen.size}`);
  check('every hosted document keeps its original address, a verified status, and the right source label (NTA, or SelfStudys with its permission)', hosted.every((d) => d.hosted.verification === 'VERIFIED' && (d.classification === 'OFFICIAL' ? /^https:\/\/(nta\.ac\.in|cdnbbsr\.s3waas\.gov\.in|cuet\.nta\.nic\.in)\//.test(d.originalUrl ?? d.hosted.sourceUrl) : d.sourceSite === 'SelfStudys' && /^https:\/\/www\.selfstudys\.com\//.test(d.originalUrl ?? ''))))
  check('a third-party copy is not listed beside NTA’s file for the same session (a copy of another session is a different paper and stays)', (await Promise.all(tree.years.flatMap((y) => y.subjects.map(async (s) => { const sub = await j(`/api/learn/pyq/${y.year}/${s.slug}`); const nta = sub.papers.filter((p) => p.native && p.official && p.examDate); return !sub.papers.some((p) => !p.official && p.examDate && nta.some((n) => n.examDate === p.examDate && (n.shift ?? '') === (p.shift ?? ''))); })))).every(Boolean));
  const flagged = (await j('/api/learn/pyq?exam=CUET_UG')).years.length;
  check('answer keys are listed for the years that have a verified hosted key', keys.size >= 3, `${keys.size} keys`);

  // the student's view
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  const email = `nta-${Date.now()}@example.test`, password = 'correct-horse-battery';
  await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, displayName: 'Asha Verma' }) });
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  for (const sz of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height } });
    await ctx.addCookies([{ name: 'cuet_session', value: cookie.split('=')[1], url: BASE }]);
    const page = await ctx.newPage();
    const hostsSeen = new Set();
    const errors = [];
    page.on('request', (r) => { try { hostsSeen.add(new URL(r.url()).host); } catch { /* data: */ } });
    page.on('pageerror', (e) => errors.push(e.message));
    const popups = [];
    ctx.on('page', (p) => popups.push(p.url()));

    const paper = hosted.find((d) => d.official && d.kind === 'QUESTION_PAPER' && d.subject === '322') ?? hosted.find((d) => d.official && d.kind === 'QUESTION_PAPER');
    await page.goto(BASE + `/pyq?year=${paper.year}&subject=${paper.subjectSlug}`, { waitUntil: 'networkidle' });
    await page.locator(`[data-paper="${paper.id}"]`).waitFor({ timeout: 20000 });
    await page.screenshot({ path: join(shots, `library-list-${sz.name}.png`), fullPage: true });
    const row = await page.locator(`[data-paper="${paper.id}"]`).innerText();
    check(`${sz.name}: the paper row says it is hosted here, with its facts`, /Hosted here exactly as NTA published it/.test(row) && /NTA/.test(row));
    const copy = hosted.find((d) => !d.official && d.kind === 'QUESTION_PAPER' && d.year === paper.year && d.subjectSlug === paper.subjectSlug);
    if (copy) check(`${sz.name}: a hosted SelfStudys copy is labelled as a copy from SelfStudys, not as NTA's file`, await page.locator(`[data-paper="${copy.id}"]`).count() === 1 && /SelfStudys/.test(await page.locator(`[data-paper="${copy.id}"]`).innerText()) && !/exactly as NTA published/.test(await page.locator(`[data-paper="${copy.id}"]`).innerText()));
    check(`${sz.name}: the row opens the paper inside CUET Prep`, (await page.locator(`[data-paper="${paper.id}"] [data-open="in-app"]`).count()) === 1);
    await page.locator(`[data-paper="${paper.id}"] [data-open="in-app"]`).click();
    await page.waitForURL(/\/pyq\/view\//);
    await page.locator('canvas').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    check(`${sz.name}: the PDF page is drawn in our viewer`, await page.evaluate(() => { const c = document.querySelector('canvas'); return c && c.width > 100 && c.height > 100; }));
    check(`${sz.name}: the viewer shows provenance, original NTA address and check status`, /National Testing Agency/.test(await page.locator('[data-provenance]').innerText()) && /verified/.test(await page.locator('[data-provenance]').innerText()));
    check(`${sz.name}: a download link is offered`, (await page.locator('a[data-download]').count()) >= 1);
    await page.screenshot({ path: join(shots, `library-viewer-${sz.name}.png`) });
    const ownOrigin = [...hostsSeen].every((h) => h === new URL(BASE).host);
    check(`${sz.name}: reading the paper makes no request to NTA or any other website`, ownOrigin, [...hostsSeen].join(', '));
    check(`${sz.name}: no new tab or redirect to NTA`, popups.length === 0 && page.url().startsWith(BASE));

    const key = hosted.find((d) => d.kind === 'ANSWER_KEY');
    await page.goto(BASE + `/pyq/view/${key.id}?page=2`, { waitUntil: 'networkidle' });
    await page.locator('canvas').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
    check(`${sz.name}: an official answer key opens in the viewer`, await page.evaluate(() => { const c = document.querySelector('canvas'); return c && c.width > 100; }));
    check(`${sz.name}: still only our own origin after opening a key`, [...hostsSeen].every((h) => h === new URL(BASE).host), [...hostsSeen].join(', '));
    check(`${sz.name}: no script errors`, errors.length === 0, errors.slice(0, 2).join(' / '));
    await ctx.close();
  }
  console.log('hosted documents by year:', JSON.stringify(Object.fromEntries([...new Set(hosted.map((d) => d.year))].map((y) => [y, hosted.filter((d) => d.year === y && seen.has(d.id)).length]))));
} finally {
  await browser?.close().catch(() => {});
  stop();
  await sleep(3000);
  try { rmSync(state, { recursive: true, force: true }); } catch { console.log('Throwaway copy left in', state); }
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed} of ${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
