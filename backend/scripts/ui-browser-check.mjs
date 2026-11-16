// Browser check of the student navigation and the pages touched by the 16 Nov 2026 duplicate cleanup.
// Runs on a THROWAWAY copy of the local database (deleted afterwards), against the built frontend (npm run build -w frontend first).
//   node backend/scripts/ui-browser-check.mjs <screenshotDir> [path-to-playwright-package]
// Needs Playwright with a Chromium installed (the path of an installed `playwright` package may be given as the second argument).
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..');
const shots = process.argv[2] ?? join(here, '..', '..', 'docs', 'ui-cleanup', 'after-2026-11-16');
const pwPath = process.argv[3] ?? 'D:/alfa-d1/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(existsSync(pwPath) ? pwPath : join(pwPath, 'index.mjs')).href);
const wranglerBin = [join(backend, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(backend, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync);
const PORT = 8811;
const BASE = `http://127.0.0.1:${PORT}`;
const state = `D:/tmp/ui-check-state-${Date.now()}`;
mkdirSync(shots, { recursive: true });
cpSync(join(backend, '.wrangler', 'state'), state, { recursive: true });
execFileSync(process.execPath, [wranglerBin, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], { cwd: backend, stdio: 'ignore' });
const server = spawn(process.execPath, [wranglerBin, 'dev', '--local', '--port', String(PORT), '--persist-to', state], { cwd: backend, stdio: ['ignore', 'pipe', 'pipe'] });
const stop = () => { try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ } };
const results = [];
const check = (name, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
try {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ } await sleep(1000); }
  // A student with some real activity, made through the API.
  const email = `ui-${Date.now()}@example.test`, password = 'correct-horse-battery';
  await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, displayName: 'Asha Verma' }) });
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const api = async (method, path, body) => { const r = await fetch(BASE + path, { method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }); const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
  const PAPER = 'paper_cuet_ug_2026_322';
  await api('PUT', '/api/student/preferences', { examCode: 'CUET_UG', targetYear: 2027, paperIds: [PAPER] });
  const s = await api('POST', '/api/student/practice/daily', { count: 10 });
  for (const q of s.questions.slice(0, 5)) await api('POST', `/api/student/practice/${s.session.id}/answers`, { questionId: q.id, selectedPositions: [1] });
  await api('POST', `/api/student/practice/${s.session.id}/submit`);
  await api('POST', '/api/student/practice/daily', { count: 10 }); // leaves an unfinished test

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  const sizes = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'tablet', width: 820, height: 1100 }, { name: 'phone', width: 390, height: 844 }];
  for (const sz of sizes) {
    const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height } });
    await ctx.addCookies([{ name: 'cuet_session', value: cookie.split('=')[1], url: BASE }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const open = async (path, ready) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); if (ready) await page.getByRole('heading', { name: ready }).first().waitFor({ timeout: 15000 }); };
    const noSideScroll = async (label) => check(`${sz.name}: ${label} has no sideways scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

    // ---- Today
    await open('/dashboard', 'Today');
    await page.screenshot({ path: join(shots, `today-${sz.name}.png`), fullPage: true });
    check(`${sz.name}: Today has no Weekly report button`, (await page.getByRole('link', { name: 'Weekly report' }).count()) === 0);
    check(`${sz.name}: Today has no duplicate Subjects table`, (await page.getByRole('heading', { name: /^Subjects$/ }).count()) === 0);
    check(`${sz.name}: Today keeps the government updates panel with its All updates link`, (await page.getByRole('link', { name: 'All updates' }).count()) === 1);
    await noSideScroll('Today');

    // ---- Home
    await open('/', null);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    await page.screenshot({ path: join(shots, `home-${sz.name}.png`), fullPage: true });
    check(`${sz.name}: Home no longer repeats the goal meter`, (await page.getByText('Questions today').count()) === 0);
    check(`${sz.name}: Home still offers the unfinished test`, (await page.getByText('Unfinished test').count()) === 1);
    await noSideScroll('Home');

    // ---- Profile
    await open('/profile', 'Profile and goals');
    await page.screenshot({ path: join(shots, `profile-${sz.name}.png`), fullPage: true });
    await noSideScroll('Profile');

    // ---- Progress keeps the one Weekly report entry
    await open('/progress', 'Progress');
    check(`${sz.name}: Progress has the Weekly report button`, (await page.getByRole('link', { name: 'Weekly report' }).count()) === 1);
    await page.getByRole('link', { name: 'Weekly report' }).click();
    await page.getByRole('heading', { name: 'Weekly report' }).first().waitFor({ timeout: 15000 });
    check(`${sz.name}: Weekly report opens`, true);
    await page.goBack();

    // ---- Updates page reachable from Today
    await open('/dashboard', 'Today');
    await page.getByRole('link', { name: 'All updates' }).click();
    await page.getByRole('heading', { name: /updates/i }).first().waitFor({ timeout: 15000 });
    check(`${sz.name}: Government updates page opens from Today`, page.url().includes('/updates'));

    // ---- Navigation
    await open('/', null);
    if (sz.name !== 'phone') {
      check(`${sz.name}: header has no separate bookmark icon`, (await page.locator('header a[href="/bookmarks"]').count()) === 0);
      await page.getByRole('button', { name: 'My Learning' }).first().click();
      await page.screenshot({ path: join(shots, `nav-my-learning-${sz.name}.png`) });
      const items = await page.locator('[role=menu][aria-label="My Learning"] a').allInnerTexts();
      check(`${sz.name}: My Learning menu lists 6 distinct entries`, items.length === 6 && new Set(items).size === 6, items.map((t) => t.split('\n')[0]).join(' | '));
      await page.keyboard.press('Escape');
    } else {
      await page.getByRole('button', { name: 'My Learning' }).last().click();
      await page.screenshot({ path: join(shots, `nav-my-learning-${sz.name}.png`) });
      await page.keyboard.press('Escape');
    }
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.screenshot({ path: join(shots, `nav-account-menu-${sz.name}.png`) });
    const acct = (await page.locator('[role=menu] a, [role=menu] button').allInnerTexts()).map((t) => t.trim());
    check(`${sz.name}: account menu has only account items`, acct.some((t) => t.startsWith('Profile')) && acct.some((t) => t.startsWith('University admissions')) && acct.some((t) => t.startsWith('Plans')) && !acct.some((t) => /Government updates|Weekly report|Practice Centre|Official exam information/.test(t)), acct.join(' | '));
    await page.keyboard.press('Escape');

    // ---- every retained link opens a real page
    const targets = [['/CUET_UG', /CUET/i], ['/practice-centre', 'Practice Centre'], ['/bookmarks', /bookmarks/i], ['/bookmarks?tab=notes', /bookmarks/i], ['/bookmarks/review', null], ['/planner', /planner|plan/i], ['/progress', 'Progress'], ['/dashboard', 'Today'], ['/profile', 'Profile and goals'], ['/admissions', /admissions|programmes/i], ['/plans', 'Plans and payments'], ['/updates', /updates/i], ['/cuet', null], ['/search', null]];
    for (const [path, name] of targets) {
      const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' });
      const body = (await page.locator('body').innerText()).slice(0, 4000);
      const notFound = /page not found|404/i.test(body) && !/updates/i.test(path);
      if (name) await page.getByRole('heading', { name }).first().waitFor({ timeout: 15000 }).catch(() => {});
      check(`${sz.name}: ${path} opens`, resp.ok() && !notFound && body.length > 80 && (await page.locator('main, #root').count()) > 0);
    }
    check(`${sz.name}: no script errors`, errors.length === 0, errors.slice(0, 2).join(' / '));
    await ctx.close();
  }
} finally {
  await browser?.close().catch(() => {});
  stop();
  await sleep(3000);
  try { rmSync(state, { recursive: true, force: true }); } catch { console.log('Throwaway copy left in', state); }
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed} of ${results.length} browser checks passed`);
process.exit(passed === results.length ? 0 : 1);
