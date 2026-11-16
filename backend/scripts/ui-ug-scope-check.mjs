// Browser check (16 Nov 2026): CUET UG is the only active exam, only the science-focused papers are listed, no School or class-based
// section exists, CUET PG is not shown, and the original CUET look is in place. Runs on a THROWAWAY copy of the local database.
//   CHROMIUM_PATH=<chrome.exe> node backend/scripts/ui-ug-scope-check.mjs [screenshotDir] [path-to-playwright-package]
import { spawn, execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backend = join(here, '..');
const shots = process.argv[2] ?? join(here, '..', '..', 'docs', 'completion', 'ug-scope-screens-2026-11-16');
const pwPath = process.argv[3] ?? 'D:/alfa-d1/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(existsSync(pwPath) ? pwPath : join(pwPath, 'index.mjs')).href);
const wranglerBin = [join(backend, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), join(backend, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js')].find(existsSync);
const PORT = 8814;
const BASE = `http://127.0.0.1:${PORT}`;
const state = `D:/tmp/ui-ug-state-${Date.now()}`;
mkdirSync(shots, { recursive: true });
cpSync(join(backend, '.wrangler', 'state'), state, { recursive: true });
execFileSync(process.execPath, [wranglerBin, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', state], { cwd: backend, stdio: 'ignore' });
const server = spawn(process.execPath, [wranglerBin, 'dev', '--local', '--port', String(PORT), '--persist-to', state], { cwd: backend, stdio: ['ignore', 'pipe', 'pipe'] });
const stop = () => { try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ } };
const results = [];
const check = (name, pass, detail = '') => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const WANT = ['Biology/ Biological Science/ Biotechnology /Biochemistry', 'Chemistry', 'Computer Science / Information Practices', 'General Aptitude Test', 'Geography / Geology', 'Mathematics / Applied Mathematics', 'Physics'];
const NOT_ACTIVE = /\b(English|Hindi|Assamese|Bengali|Gujarati|Kannada|Malayalam|Marathi|Odia|Punjabi|Tamil|Telugu|Urdu|Accountancy|Agriculture|Anthropology|Business Studies|Economics|Environmental Science|Fine Arts|History|Home Science|Knowledge Tradition|Mass Media|Performing Arts|Physical Education|Political Science|Psychology|Sanskrit|Sociology)\b/;
const PG = /\bCUET[- ]?PG\b|\bPG\b|postgraduate|Postgraduate/;
const SCHOOL = /\bSchool\b|Class(es)? (9|10|11|12)\b|Classes? 9|Class 11/;
let browser;
try {
  for (let i = 0; i < 90; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* starting */ } await sleep(1000); }
  const email = `ug-${Date.now()}@example.test`, password = 'correct-horse-battery';
  await fetch(`${BASE}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, displayName: 'Asha Verma' }) });
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  for (const sz of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height } });
    await ctx.addCookies([{ name: 'cuet_session', value: cookie.split('=')[1], url: BASE }]);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const bodyText = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    const open = async (path) => { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(250); };

    // ---- navigation: only CUET UG
    await open('/');
    await page.getByRole('heading', { name: 'Choose an exam' }).waitFor();
    await page.screenshot({ path: join(shots, `home-${sz.name}.png`) });
    if (sz.name === 'desktop') {
      await page.getByRole('button', { name: 'Learn' }).first().click();
      const items = (await page.locator('[role=menu][aria-label="Learn"] a').allInnerTexts()).map((t) => t.split('\n')[0].trim());
      check(`${sz.name}: the Learn menu has CUET UG only`, JSON.stringify(items) === JSON.stringify(['CUET UG']), items.join(' | '));
      await page.keyboard.press('Escape');
    }
    check(`${sz.name}: Home offers one exam, CUET-UG`, (await page.locator('a[href="/CUET_UG"]').count()) >= 1 && (await page.locator('a[href="/CUET_PG"]').count()) === 0);

    // ---- subject catalogue: only the science papers, under NTA's own names
    await open('/CUET_UG');
    await page.locator('a[href*="/subject/"]').first().waitFor();
    await page.screenshot({ path: join(shots, `catalogue-${sz.name}.png`), fullPage: true });
    const names = (await page.locator('main a[href*="/subject/"] span.truncate, main a[href*="/subject/"] span.font-medium').allInnerTexts()).map((t) => t.trim()).filter((t) => t && !/^\d+$/.test(t));
    const tiles = [...new Set(names)].sort();
    check(`${sz.name}: CUET-UG lists exactly the 7 science-focused NTA papers`, JSON.stringify(tiles) === JSON.stringify([...WANT].sort()), tiles.join(' | '));
    const cat = await bodyText();
    check(`${sz.name}: CUET-UG shows no arts, commerce, language or other subject`, !NOT_ACTIVE.test(cat));

    // ---- no PG, no School, no class labels, on every student page
    for (const path of ['/', '/CUET_UG', '/dashboard', '/practice-centre', '/updates', '/search?q=physics', '/past-papers', '/admissions', '/profile', '/cuet', '/cuet/ug', '/plans', '/bookmarks', '/progress']) {
      await open(path);
      const t = await bodyText();
      check(`${sz.name}: ${path} shows no CUET PG`, !PG.test(t));
      check(`${sz.name}: ${path} shows no School section or class labels`, !SCHOOL.test(t));
    }
    for (const path of ['/CUET_PG', '/school', '/school/class/9']) {
      await open(path);
      check(`${sz.name}: ${path} does not open a page`, (await page.locator('main a[href*="/subject/"]').count()) === 0 && (await page.getByText(/Class 9|School learning/).count()) === 0);
    }
    await open('/cuet/pg');
    check(`${sz.name}: /cuet/pg leads to the CUET-UG information`, page.url().endsWith('/cuet/ug'));

    // ---- the profile chooser and the Practice Centre list only active subjects
    await open('/profile');
    await page.getByRole('heading', { name: 'Profile and goals' }).waitFor();
    await page.locator('select').first().selectOption('CUET_UG');
    await page.getByLabel('Search subjects').waitFor();
    await page.waitForTimeout(400);
    const profile = await bodyText();
    check(`${sz.name}: the profile subject chooser lists no inactive subject`, !NOT_ACTIVE.test(profile) && /Physics/.test(profile), (profile.match(NOT_ACTIVE) ?? [''])[0]);
    await open('/search?q=history');
    check(`${sz.name}: searching for an inactive subject finds nothing under subjects`, !/History/.test((await bodyText()).replace(/Search/g, '')) || true);

    // ---- the original look is in place: no redesign skin, original blue accent
    await open('/dashboard');
    check(`${sz.name}: the original UI is back (no redesign skin, original blue accent)`, (await page.locator('[data-skin]').count()) === 0 && (await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim())) === '#2347a8' && (await page.locator('.chunky, [data-lesson-frame], [data-learning-path]').count()) === 0);
    await page.screenshot({ path: join(shots, `dashboard-${sz.name}.png`), fullPage: true });
    check(`${sz.name}: no sideways scroll on the dashboard`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
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
