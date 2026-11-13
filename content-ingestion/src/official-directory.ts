/**
 * Official paper directory: which papers were held, on which date and shift, read from the exam body's own
 * final answer-key file. Only facts are kept (subject, date, shift, the page of the key, dropped questions);
 * the file itself is read from a temporary copy and is never stored on the platform or in the repository.
 *
 *   npm run ingest -- official-directory-build --exam CUET_UG --year 2026 --url <official key URL> --title "<title as printed>"
 *        -> content/official-papers/directory/<EXAM>-<year>.json
 *   npm run ingest -- official-directory-import      sends every directory file to the local API
 *
 * Nothing here invents an entry: a page whose heading cannot be read is reported and left out.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadPdf } from './download';

export interface DirectorySession { date: string; shift: string; subjectCode: string; subjectName: string; keyPage: number; keyPages: number; dropped: number }
export interface DirectoryFile {
  schema: 'cuet-official-directory/1';
  exam: 'CUET_UG' | 'CUET_PG';
  year: number;
  key: { title: string; url: string; version: 'FINAL' | 'PROVISIONAL'; sha256: string; pages: number; retrievedAt: string };
  paper: { status: 'NOT_PUBLISHED'; note: string; evidenceUrl?: string };
  unreadPages: number[];
  sessions: DirectorySession[];
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const SHIFT_WORDS: Record<string, string> = { first: 'Shift 1', second: 'Shift 2', third: 'Shift 3' };

/** Reads one page heading. Two layouts are known: CUET (UG) "Exam Date: 11-05-2026 (First) … Subject : 101 - English" and CUET (PG) "Subject: ACQP01 - … / Exam Shift: 3 … Exam Date: 27.03.2025". */
export function parseKeyPage(text: string): { date: string; shift: string; subjectCode: string; subjectName: string } | null {
  const head = text.split('\n').slice(0, 14).join('\n');
  const d = /Exam Date\s*:\s*(\d{2})[-.](\d{2})[-.](\d{4})(?:\s*\(\s*(\w+)\s*\))?/i.exec(head);
  const s = /Subject\s*:\s*([A-Z0-9]{3,8})\s*-\s*([^\n]+?)(?:\s{3,}|\n|$)/.exec(head);
  if (!d || !s) return null;
  const shiftWord = d[4]?.toLowerCase();
  const shiftNum = /Exam Shift\s*:\s*(?:Shift-)?(\d+)/i.exec(head)?.[1];
  // Some years' keys print no shift at all (CUET (UG) 2024, computer-based). That is recorded as it is, never guessed.
  const shift = shiftWord ? SHIFT_WORDS[shiftWord] ?? `Shift ${d[4]}` : shiftNum ? `Shift ${shiftNum}` : 'Shift not stated';
  return { date: `${d[3]}-${d[2]}-${d[1]}`, shift, subjectCode: s[1]!, subjectName: clean(s[2]!) };
}

/** Sessions of a whole key file. Pages of the same subject, date and shift are merged; the first page is the one linked. */
export function parseKeyText(pages: string[]): { sessions: DirectorySession[]; unreadPages: number[] } {
  const byKey = new Map<string, DirectorySession>();
  const unread: number[] = [];
  pages.forEach((text, i) => {
    if (!text.trim()) return;
    const h = parseKeyPage(text);
    if (!h) return void unread.push(i + 1);
    const key = `${h.subjectCode}|${h.date}|${h.shift}`;
    // "Drop" in the key column marks a dropped question. The legend line some files print on every page is not counted.
    const dropped = text.split('\n').filter((l) => !/marks awarded|legend|note\s*:/i.test(l)).join('\n').match(/(?<![A-Za-z])Drop(?:ped)?(?![A-Za-z])/gi)?.length ?? 0;
    const cur = byKey.get(key);
    if (cur) (cur.keyPages++, (cur.dropped += dropped));
    else byKey.set(key, { ...h, keyPage: i + 1, keyPages: 1, dropped });
  });
  // The same subject code is sometimes printed with a differently typed name on a later page ("Legal_Studies",
  // or a name cut short). One code keeps one name: the cleanest one the file itself prints for it.
  const names = new Map<string, string>();
  for (const s of byKey.values()) {
    const cur = names.get(s.subjectCode);
    const tidy = (n: string) => !/_/.test(n);
    if (!cur || (tidy(s.subjectName) && !tidy(cur)) || (tidy(s.subjectName) === tidy(cur) && s.subjectName.length > cur.length)) names.set(s.subjectCode, s.subjectName);
  }
  for (const s of byKey.values()) s.subjectName = names.get(s.subjectCode)!.replace(/_/g, ' ').trim();
  const sessions = [...byKey.values()].sort((a, b) => a.subjectCode.localeCompare(b.subjectCode, undefined, { numeric: true }) || a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift));
  return { sessions, unreadPages: unread };
}

export async function buildDirectory(opts: { exam: 'CUET_UG' | 'CUET_PG'; year: number; url: string; title: string; version: 'FINAL' | 'PROVISIONAL'; paperNote: string; evidenceUrl?: string; outDir: string }): Promise<DirectoryFile> {
  // A temporary working copy, deleted when the facts have been read.
  const work = join(process.env['TEMP'] ?? tmpdir(), `cuet-official-key-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  try {
    const pdf = await downloadPdf(opts.url, join(work, 'key.pdf'), true);
    const txt = join(work, 'key.txt');
    execFileSync('pdftotext', ['-layout', pdf.localFile, txt], { stdio: 'ignore' });
    const pages = readFileSync(txt, 'utf8').split('\f');
    while (pages.length && !pages.at(-1)!.trim()) pages.pop();
    const { sessions, unreadPages } = parseKeyText(pages);
    if (!sessions.length) throw new Error('No session heading could be read from this file; nothing was written');
    const file: DirectoryFile = {
      schema: 'cuet-official-directory/1', exam: opts.exam, year: opts.year,
      key: { title: opts.title, url: opts.url, version: opts.version, sha256: pdf.sha256, pages: pages.length, retrievedAt: pdf.retrievedAt },
      paper: { status: 'NOT_PUBLISHED', note: opts.paperNote, ...(opts.evidenceUrl ? { evidenceUrl: opts.evidenceUrl } : {}) },
      unreadPages, sessions,
    };
    mkdirSync(opts.outDir, { recursive: true });
    writeFileSync(join(opts.outDir, `${opts.exam}-${opts.year}.json`), JSON.stringify(file, null, 1) + '\n');
    return file;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export async function importDirectory(dir: string, api: string, token: string, endpoint = '/api/admin/official-directory') {
  const out: { file: string; ok: boolean; result: unknown }[] = [];
  for (const name of existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []) {
    const res = await fetch(`${api}${endpoint}`, { method: 'POST', headers: { 'x-admin-token': token, 'x-admin-actor': 'official-directory-cli', 'content-type': 'application/json' }, body: readFileSync(join(dir, name), 'utf8') });
    out.push({ file: name, ok: res.ok, result: await res.json().catch(() => null) });
  }
  return out;
}
