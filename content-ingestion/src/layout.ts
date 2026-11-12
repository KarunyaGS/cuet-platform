/**
 * Page layout handling for text-layer PDFs: put two-column pages into reading order and
 * pull out tables (rows of 3+ aligned cells that contain words). Deterministic geometry only.
 */
import type { TextLine } from './pdf';
import type { SourceLine } from './types';

export interface LayoutResult {
  lines: SourceLine[];
  tables: { page: number; afterLineIndex: number; rows: string[][] }[];
  twoColumnPages: number[];
}

/** Cells of a line (text pieces separated by gaps wider than minGap), with the x where each starts. */
export function cellsWithX(line: Pick<TextLine, 'runs'>, minGap: number): { text: string; x: number }[] {
  const out: { text: string; x: number }[] = [];
  let cur = '';
  let curX = 0;
  let prevEnd = -Infinity;
  for (const r of [...line.runs].filter((r) => r.text.trim() !== '').sort((a, b) => a.x - b.x)) {
    if (cur && r.x - prevEnd > minGap) {
      out.push({ text: cur.trim(), x: curX });
      cur = '';
    }
    if (!cur) curX = r.x;
    cur += (cur && !cur.endsWith(' ') ? ' ' : '') + r.text;
    prevEnd = r.x + r.width;
  }
  if (cur.trim()) out.push({ text: cur.trim(), x: curX });
  return out;
}

export function cells(line: Pick<TextLine, 'runs'>, minGap: number): string[] {
  return cellsWithX(line, minGap).map((c) => c.text);
}

/** Two rows belong to one table when they have the same number of cells starting at the same x positions. */
export function alignedRows(a: { x: number }[], b: { x: number }[], tolerance = 15): boolean {
  return a.length === b.length && a.every((c, i) => Math.abs(c.x - b[i]!.x) <= tolerance);
}

/** Letters outside the Mathematical Alphanumeric Symbols block (so formulas do not count as words). */
const wordLetters = (s: string) => [...s].filter((c) => /\p{L}/u.test(c) && !(c.codePointAt(0)! >= 0x1d400 && c.codePointAt(0)! <= 0x1d7ff)).length;

/** A table row has 3+ cells and most cells contain real words, not formula fragments. */
export function isTableRow(c: string[]): boolean {
  return c.length >= 3 && c.filter((cell) => wordLetters(cell) >= 2).length >= Math.ceil(c.length * 0.6);
}

/** Left edge of the text that follows the widest gap in a line (a candidate right-column edge). */
function rightEdgeAfterGap(line: TextLine, minGap: number): number | null {
  const runs = [...line.runs].filter((r) => r.text.trim() !== '').sort((a, b) => a.x - b.x);
  let best: { gap: number; start: number } | null = null;
  for (let i = 1; i < runs.length; i++) {
    const gap = runs[i]!.x - (runs[i - 1]!.x + runs[i - 1]!.width);
    if (gap > minGap && (!best || gap > best.gap)) best = { gap, start: runs[i]!.x };
  }
  return best?.start ?? null;
}

/**
 * For a two-column page, the x where the right column starts (many lines restart text at the same x
 * in the middle of the page). Null for single-column pages.
 */
export function columnSplit(pageLines: TextLine[], width: number): number | null {
  const starts = pageLines
    .map((l) => rightEdgeAfterGap(l, 10))
    .filter((s): s is number => s !== null && s > width * 0.35 && s < width * 0.7)
    .map((s) => Math.round(s / 4) * 4);
  if (starts.length < 6) return null;
  const counts = new Map<number, number>();
  for (const s of starts) counts.set(s, (counts.get(s) ?? 0) + 1);
  const [edge, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
  const aligned = starts.filter((s) => Math.abs(s - edge) <= 6).length;
  return n >= 3 && aligned >= 6 && aligned >= pageLines.length * 0.2 ? edge - 2 : null;
}

/** Text in the left column comes before text in the right column (lines that span both stay whole). */
function splitColumns(pageLines: TextLine[], split: number): SourceLine[] {
  const left: SourceLine[] = [];
  const right: SourceLine[] = [];
  const toLine = (l: TextLine, runs: TextLine['runs']): SourceLine => ({
    page: l.page, y: l.y, x: runs[0]!.x, text: runs.map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim(), runs,
  });
  for (const l of pageLines) {
    // A run that bridges the gap with a stretch of spaces is really two pieces of text, one per column.
    const runs = [...l.runs]
      .filter((r) => r.text.trim() !== '')
      .flatMap((r) => {
        const m = /^(.*?\S)\s{3,}(\S.*)$/.exec(r.text);
        if (!m || !(r.x < split && r.x + r.width > split + 5)) return [r];
        const leftShare = m[1]!.length / r.text.length;
        return [
          { x: r.x, width: r.width * leftShare, text: m[1]! },
          { x: Math.max(split + 1, r.x + r.width * (1 - m[2]!.length / r.text.length)), width: r.width * (m[2]!.length / r.text.length), text: m[2]! },
        ];
      })
      .sort((a, b) => a.x - b.x);
    const spans = runs.some((r) => r.x < split && r.x + r.width > split + 8);
    if (spans) {
      left.push(toLine(l, runs));
      continue;
    }
    const lr = runs.filter((r) => r.x < split);
    const rr = runs.filter((r) => r.x >= split);
    if (lr.length) left.push(toLine(l, lr));
    if (rr.length) right.push(toLine(l, rr));
  }
  return [...left, ...right].filter((l) => l.text);
}

export function arrangePages(lines: TextLine[], streamLines: TextLine[], pageWidths: number[]): LayoutResult {
  const out: SourceLine[] = [];
  const tables: LayoutResult['tables'] = [];
  const twoColumnPages: number[] = [];
  const pages = [...new Set(lines.map((l) => l.page))].sort((a, b) => a - b);
  for (const p of pages) {
    const pageLines = lines.filter((l) => l.page === p).sort((a, b) => a.y - b.y || a.x - b.x);
    const width = pageWidths[p - 1] ?? 595;
    const split = columnSplit(pageLines, width);
    if (split !== null) {
      twoColumnPages.push(p);
      out.push(...splitColumns(pageLines, split));
      continue;
    }
    void streamLines;
    let i = 0;
    while (i < pageLines.length) {
      const first = cellsWithX(pageLines[i]!, 12);
      if (isTableRow(first.map((c) => c.text))) {
        const rows: string[][] = [first.map((c) => c.text)];
        let j = i + 1;
        while (j < pageLines.length) {
          const next = cellsWithX(pageLines[j]!, 12);
          if (!isTableRow(next.map((c) => c.text)) || !alignedRows(first, next)) break;
          rows.push(next.map((c) => c.text));
          j++;
        }
        if (rows.length >= 2) {
          tables.push({ page: p, afterLineIndex: out.length - 1, rows });
          i = j;
          continue;
        }
      }
      const l = pageLines[i]!;
      out.push({ page: p, y: l.y, x: l.x, text: l.text, runs: l.runs });
      i++;
    }
  }
  return { lines: out, tables, twoColumnPages };
}
