/**
 * Structure checks for a syllabus tree, run before anything is imported.
 *
 * They exist because the word-level checks (is every word of the PDF stored somewhere?) passed syllabi whose
 * text was stored in the wrong place: topics inside the "Note" instruction box, a whole syllabus as hidden
 * text on a Note line, cover-page titles as rows, and printed "Unit" headings stored as topics.
 *
 * Errors stop an import. Warnings are shown for a person to judge (NTA's own numbering is sometimes irregular).
 */
export interface CheckNode {
  ref: string;
  parentRef: string | null;
  kind: string;
  label: string | null;
  title: string;
  body: string | null;
  sourcePage: number | null;
}
export interface StructureReport {
  errors: string[];
  warnings: string[];
  shape: { units: number; sections: number; topics: number; noteLines: number };
}

const GROUP = ['PART', 'SECTION', 'COURSE'];
const UNITS = ['UNIT', 'CHAPTER'];
const LEAVES = ['TOPIC', 'SUBTOPIC', 'ITEM'];
const RANK: Record<string, number> = { PART: 0, SECTION: 0, COURSE: 0, UNIT: 1, CHAPTER: 1, TOPIC: 2, SUBTOPIC: 3, ITEM: 4 };
/** The question-paper instruction box holds a handful of short lines ("75 questions", "all compulsory", the language). */
const MAX_NOTE_LINES = 8;
const MAX_NOTE_LINE_CHARS = 300;
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15 };
const PRINTED_UNIT = /^\s*unit\s*[-–—:.]?\s*([ivxlc]+|\d+)\b/i;
const short = (s: string) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);

/** A sibling's number, when its label is a plain Latin number, letter or roman numeral. */
function numberOf(label: string | null): number | null {
  if (!label) return null;
  const l = label.trim().replace(/^[([]|[.)\]]$/g, '').replace(/^(unit|chapter|part|section|course)\s*[-–—:]?\s*/i, '').toLowerCase();
  if (/^\d{1,3}$/.test(l)) return Number(l);
  if (ROMAN[l]) return ROMAN[l]!;
  if (/^[a-z]$/.test(l)) return l.charCodeAt(0) - 96;
  return null;
}

export function checkStructure(nodes: CheckNode[], opts: { pageCount?: number; allowEmpty?: boolean } = {}): StructureReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byRef = new Map(nodes.map((n) => [n.ref, n]));
  const kids = new Map<string | null, CheckNode[]>();
  for (const n of nodes) kids.set(n.parentRef, [...(kids.get(n.parentRef) ?? []), n]);
  const inNote = (n: CheckNode | undefined): boolean => {
    for (let x = n, hops = 0; x && hops < 50; x = x.parentRef ? byRef.get(x.parentRef) : undefined, hops++) if (x.kind === 'NOTE') return true;
    return false;
  };

  for (const n of nodes) {
    if (n.parentRef !== null && !byRef.has(n.parentRef)) errors.push(`row "${short(n.title)}": its parent row is missing`);
    if (opts.pageCount && n.sourcePage && n.sourcePage > opts.pageCount) errors.push(`row "${short(n.title)}" cites page ${n.sourcePage}, but the PDF has ${opts.pageCount} pages`);
  }

  // 1. The Note box holds only its own instruction lines.
  for (const note of nodes.filter((n) => n.kind === 'NOTE')) {
    const lines = kids.get(note.ref) ?? [];
    const subtree = nodes.filter((n) => n !== note && inNote(n));
    if (lines.length > MAX_NOTE_LINES) errors.push(`the Note box "${short(note.title)}" holds ${lines.length} rows; an instruction box has at most ${MAX_NOTE_LINES}, so syllabus topics were probably stored inside it`);
    for (const x of [note, ...lines]) {
      const len = (x.body ?? '').length;
      if (len > MAX_NOTE_LINE_CHARS) errors.push(`a Note line carries ${len} characters of text ("${short(x.title)}"); syllabus text was probably stored on it`);
    }
    if (subtree.some((x) => UNITS.includes(x.kind) || GROUP.includes(x.kind))) errors.push(`the Note box "${short(note.title)}" contains units or sections`);
    if (lines.some((x) => (kids.get(x.ref) ?? []).length > 0)) errors.push(`a line of the Note box "${short(note.title)}" has rows under it`);
    // 2. Cover-page title captured as a row.
    if (note.parentRef === null && !lines.length && !(note.body ?? '').trim() && note.sourcePage === 1 && note.title.trim().toLowerCase() !== 'note') {
      errors.push(`the cover-page title "${short(note.title)}" (page 1) was stored as a row`);
    }
  }

  const content = nodes.filter((n) => !inNote(n));
  const shape = {
    units: content.filter((n) => UNITS.includes(n.kind)).length,
    sections: content.filter((n) => GROUP.includes(n.kind)).length,
    topics: content.filter((n) => LEAVES.includes(n.kind)).length,
    noteLines: nodes.filter((n) => n.kind !== 'NOTE' && inNote(n)).length,
  };
  // 3. A syllabus has syllabus rows.
  if (!content.length && !opts.allowEmpty) errors.push('no syllabus rows outside the Note box: the syllabus text was not extracted, or was stored inside the Note box');

  for (const n of content) {
    const parent = n.parentRef ? byRef.get(n.parentRef) : undefined;
    // 4. Hierarchy order.
    if (parent && parent.kind !== 'NOTE' && RANK[n.kind] !== undefined && RANK[parent.kind] !== undefined && RANK[n.kind]! < RANK[parent.kind]! && !(UNITS.includes(n.kind) && parent.kind === 'TOPIC')) {
      warnings.push(`${n.kind} "${short(n.title)}" sits under ${parent.kind} "${short(parent.title)}"`);
    }
    // 5. A heading printed as "Unit …" is a unit.
    const printed = PRINTED_UNIT.test(n.title) || /^unit\b/i.test(n.label ?? '');
    if (printed && !UNITS.includes(n.kind)) warnings.push(`"${short(n.title)}" is printed as a unit but stored as ${n.kind}`);
    // 6. A unit says something.
    if (UNITS.includes(n.kind) && !(kids.get(n.ref) ?? []).length && !(n.body ?? '').trim() && n.title.trim().length < 12) warnings.push(`unit "${short(n.title)}" has no topics and no text`);
    if (n.title.length > 1000) warnings.push(`a row title is ${n.title.length} characters long ("${short(n.title)}"); a paragraph may have been stored as a heading`);
  }

  // 7. Numbering among siblings (warnings: NTA's own numbering is sometimes irregular).
  for (const [parentRef, list] of kids) {
    const sib = list.filter((n) => n.kind !== 'NOTE' && !inNote(n));
    const nums = sib.map((n) => numberOf(n.label));
    if (sib.length < 2 || nums.some((x) => x === null)) continue;
    const where = parentRef === null ? 'at the top level' : `under "${short(byRef.get(parentRef)?.title ?? '')}"`;
    const seen = new Set<number>();
    const dup = new Set<number>();
    for (const x of nums as number[]) (seen.has(x) ? dup : seen).add(x);
    if (dup.size) warnings.push(`repeated numbering ${[...dup].sort((a, b) => a - b).join(', ')} ${where}; check against the PDF`);
    else {
      const min = Math.min(...(nums as number[]));
      const max = Math.max(...(nums as number[]));
      const gaps = [];
      for (let x = min; x <= max && gaps.length < 6; x++) if (!seen.has(x)) gaps.push(x);
      if (gaps.length && max - min < 200) warnings.push(`numbering skips ${gaps.join(', ')} ${where}; a row may be missing`);
    }
  }
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], shape };
}
