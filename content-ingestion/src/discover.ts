/**
 * DISCOVER: read the official NTA syllabus pages and list every paper with its official PDF link.
 * Then cross-check the paper codes against the Information Bulletin for the same cycle.
 */
import type { ExamCode, OfficialPaper, Registry } from './types';
import { fetchBytes } from './download';
import { readPdf } from './pdf';

export const OFFICIAL_PAGES = {
  CUET_UG: { pages: ['https://cuet.nta.nic.in/cuetug-2026-syllabus/'], year: 2026 },
  CUET_PG: {
    pages: ['science', 'm-tech', 'language', 'humanities', 'common', 'acharya'].map((f) => `https://exams.nta.nic.in/cuet-pg/syllabus/${f}/`),
    year: 2026,
  },
} as const;

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#0?38;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** Each table row that links a PDF: its cell texts and the PDF link. */
export function tableRowsWithPdf(html: string): { cells: string[]; pdf: string }[] {
  const out: { cells: string[]; pdf: string }[] = [];
  for (const row of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const pdf = /href="([^"]+\.pdf)"/i.exec(row)?.[1];
    if (!pdf) continue;
    const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? []).map(decode);
    out.push({ cells, pdf });
  }
  return out;
}

/** The first link labelled "Information Bulletin" on a page. */
export function bulletinLink(html: string): string | null {
  const m = /<a[^>]+href="([^"]+\.pdf)"[^>]*>\s*Information Bulletin\s*<\/a>/i.exec(html);
  return m?.[1] ?? null;
}

export function parseUgRows(rows: { cells: string[]; pdf: string }[], page: string, year: number): OfficialPaper[] {
  return rows
    .filter((r) => r.cells.length >= 3 && /^\d{3}$/.test(r.cells[1]!))
    .map((r) => {
      const code = r.cells[1]!;
      const categoryCode = code.startsWith('1') ? 'LANGUAGE' : code.startsWith('3') ? 'DOMAIN' : 'GAT';
      return { exam: 'CUET_UG' as ExamCode, year, code, name: r.cells[2]!, categoryCode, officialSyllabusUrl: r.pdf, listedOnUrl: page };
    });
}

export function parsePgRows(rows: { cells: string[]; pdf: string }[], page: string, year: number): OfficialPaper[] {
  return rows
    .filter((r) => r.cells.length >= 3 && /^[A-Z]{4}\d{2}$/.test(r.cells[1]!))
    .map((r) => {
      const code = r.cells[1]!;
      const name = r.cells[2]!.replace(new RegExp(`\\s*\\(${code}\\)\\s*$`), '').trim();
      return { exam: 'CUET_PG' as ExamCode, year, code, name, categoryCode: code.slice(0, 4), officialSyllabusUrl: r.pdf, listedOnUrl: page };
    });
}

export interface PaperListCheck {
  exam: ExamCode;
  bulletinUrl: string | null;
  codesOnSyllabusPages: number;
  codesInBulletin: number;
  missingFromSyllabusPages: string[];
  notInBulletin: string[];
  matches: boolean;
}

export async function discover(): Promise<{ registry: Registry; checks: PaperListCheck[] }> {
  const papers: OfficialPaper[] = [];
  const sources: Registry['sources'] = [];
  const checks: PaperListCheck[] = [];
  for (const exam of ['CUET_UG', 'CUET_PG'] as const) {
    const cfg = OFFICIAL_PAGES[exam];
    let bulletin: string | null = null;
    const examPapers: OfficialPaper[] = [];
    for (const page of cfg.pages) {
      const html = new TextDecoder().decode(await fetchBytes(page));
      bulletin ??= bulletinLink(html);
      const rows = tableRowsWithPdf(html);
      examPapers.push(...(exam === 'CUET_UG' ? parseUgRows(rows, page, cfg.year) : parsePgRows(rows, page, cfg.year)));
    }
    papers.push(...examPapers);
    sources.push({ exam, pages: [...cfg.pages], bulletinUrl: bulletin ?? '' });
    checks.push(await checkAgainstBulletin(exam, examPapers, bulletin));
  }
  return { registry: { generatedAt: new Date().toISOString(), year: 2026, sources, papers }, checks };
}

/** Compare discovered paper codes with the codes printed in the Information Bulletin. */
export async function checkAgainstBulletin(exam: ExamCode, papers: OfficialPaper[], bulletinUrl: string | null): Promise<PaperListCheck> {
  const found = new Set(papers.map((p) => p.code));
  if (!bulletinUrl) {
    return { exam, bulletinUrl, codesOnSyllabusPages: found.size, codesInBulletin: 0, missingFromSyllabusPages: [], notInBulletin: [...found], matches: false };
  }
  const pdf = await readPdf(await fetchBytes(bulletinUrl));
  const text = pdf.lines.map((l) => l.text).join('\n');
  const codes = new Set<string>();
  if (exam === 'CUET_PG') for (const m of text.matchAll(/\b([A-Z]{2}QP\d{2})\b/g)) codes.add(m[1]!);
  else {
    // Only the bulletin page(s) that hold the subject list; other pages number exam cities the same way.
    const listPages = new Set(pdf.lines.filter((l) => /List of Languages\s*\/\s*Domain/i.test(l.text)).map((l) => l.page));
    for (const line of pdf.lines.filter((l) => listPages.has(l.page)))
      for (const m of line.text.matchAll(/\b(1(?:0[1-9]|1[0-3])|3(?:0[1-9]|1\d|2[0-6])|501)\s+[A-Z][a-z]/g)) codes.add(m[1]!);
  }
  const missing = [...codes].filter((c) => !found.has(c)).sort();
  const extra = [...found].filter((c) => !codes.has(c)).sort();
  return {
    exam,
    bulletinUrl,
    codesOnSyllabusPages: found.size,
    codesInBulletin: codes.size,
    missingFromSyllabusPages: missing,
    notInBulletin: extra,
    matches: missing.length === 0 && extra.length === 0,
  };
}
