/**
 * Deterministic rules that turn reading-order lines into a syllabus tree.
 * No language model is involved: headings are recognised by their wording ("Unit 3:", "Chapter 2",
 * "Section A"), numbering ("1.", "(ii)", "b."), bullets, and - flagged as inferred - by formatting
 * (ALL CAPS lines, short title lines). Original wording is kept; nothing is rephrased.
 */
import type { ExtractedNode, NodeKind, SourceLine } from './types';

const BULLETS = '•●▪■◦‣⁃·➢✓✔*�❖◆→➤►';
const ROMAN = '[IVXLC]+';
const DASH = '[-:\\u2013\\u2014]?';
const TAIL = '\\b[\\s:.)\\-\\u2013\\u2014]*(.*)$';

interface Rule {
  kind: NodeKind;
  rank: number;
  re: RegExp;
}

const RULES: Rule[] = [
  { kind: 'PART', rank: 1, re: new RegExp(`^(?:PART|Part)\\s*${DASH}\\s*([A-Z]|${ROMAN}|\\d+)${TAIL}`) },
  { kind: 'SECTION', rank: 1, re: new RegExp(`^(?:SECTION|Section)\\s*${DASH}\\s*([A-Z]\\d*|${ROMAN}|\\d+)${TAIL}`) },
  { kind: 'COURSE', rank: 1, re: new RegExp(`^(?:COURSE|Course|PAPER|Paper)\\s*${DASH}\\s*(${ROMAN}|\\d+|[A-Z])${TAIL}`) },
  { kind: 'SECTION', rank: 1, re: /^([A-H])\.\s+([A-Z].*)$/ },
  { kind: 'UNIT', rank: 2, re: new RegExp(`^(?:UNIT|Unit|unit|MODULE|Module|module|THEME|Theme|BLOCK|Block)\\s*${DASH}\\s*(${ROMAN}|\\d+)${TAIL}`) },
  // "Unit"/"Module" in Indian languages: Hindi/Sanskrit इकाई, Marathi घटक, Urdu/Kashmiri اکائی, Bengali/Assamese
  // একক, Malayalam മൊഡ്യൂൾ (both chillu spellings), Tamil அலகு, Telugu యూనిట్/విభాగం, Kannada ಘಟಕ, Gujarati એકમ,
  // Odia ଏକକ, Punjabi ਇਕਾਈ; followed by Latin, Roman or local digits.
  {
    kind: 'UNIT',
    rank: 2,
    re: /^(?:इकाई|ईकाई|इकाइ|घटक|اکائی|اکائي|একক|മൊഡ്യൂള്‍|മൊഡ്യൂൾ|மொட்யூல்|அலகு|యూనిట్|విభాగం|ಘಟಕ|એકમ|ଏକକ|ਇਕਾਈ)\s*[-:–—]?\s*(\p{Nd}+|[IVX]+)[\s:.)\-–—]*(.*)$/u,
  },
  { kind: 'CHAPTER', rank: 2, re: new RegExp(`^(?:CHAPTER|Chapter)\\s*${DASH}\\s*(\\d+|${ROMAN})${TAIL}`) },
  { kind: 'TOPIC', rank: 3, re: /^(\d{1,2})\s*[.):]\s*(\S.*)$/ },
  // Numbered topics in other scripts: Devanagari १., Bengali ১., Tibetan ༡༽, Arabic-Indic ۱. and so on.
  { kind: 'TOPIC', rank: 3, re: /^(\p{Nd}{1,3})\s*[.):༽།।۔]\s*(\S.*)$/u },
  // "2 हिंदी साहित्य ..." : a number, a space, then a non-Latin letter (Latin text after a bare number is too often arithmetic).
  { kind: 'TOPIC', rank: 3, re: /^(\p{Nd}{1,2})\s+((?![A-Za-z])\p{L}.*)$/u },
  { kind: 'TOPIC', rank: 3, re: /^(\d{1,2})\s+([A-Z][A-Za-z].*)$/ },
  { kind: 'ITEM', rank: 4, re: /^\(?((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii|xiii|xiv|xv)|[a-z])\)\s*\.?\s*(\S.*)$/ },
  { kind: 'ITEM', rank: 4, re: /^((?:i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)|[a-z])\.\s+(\S.*)$/ },
  // Items labelled with a letter of another script, e.g. Gujarati (અ) (બ) (ક), Hindi (क) (ख).
  { kind: 'ITEM', rank: 4, re: /^\(((?:(?![A-Za-z])\p{L}\p{M}*){1,2}|\p{Nd}{1,2})\)\s*(\S.*)$/u },
];

const NOISE = /^(?:for the year 20\d\d\b.*|syllabus for\b.*|cuet\s*\((?:ug|pg)\).*|\((?:ug|pg)\)|(?:\d+\s*\|\s*)?p\s*a\s*g\s*e(?:\s*\d+)?|page\s*\|?\s*\d+(?:\s*of\s*\d+)?|\d{1,3}|[()]|syllabus|for)$/i;

/** Page footers such as "2 | P a g e" that the PDF layout merged into the middle of a text line. */
export const INLINE_FOOTER = /(?:^|\s)\d{1,3}\s*\|\s*P\s?a\s?g\s?e(?=\s|$)/gi;
export const stripInlineFooter = (text: string) => text.replace(INLINE_FOOTER, ' ').replace(/\s{2,}/g, ' ').trim();

export function isNoise(line: string, paperCode: string, paperName: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (t.length <= 70 && NOISE.test(t)) return true;
  const squashed = t.replace(/\W/g, '').toLowerCase();
  if (squashed.includes(paperCode.toLowerCase()) && t.length <= paperName.length + 30) return true;
  return false;
}

function looksAllCaps(line: string): boolean {
  const letters = [...line].filter((c) => /\p{L}/u.test(c));
  if (line.length < 4 || line.length > 70 || letters.length < 4 || /[.,]$/.test(line)) return false;
  const latin = letters.filter((c) => /[A-Za-z]/.test(c));
  if (latin.length < letters.length * 0.8) return false; // only judge case for Latin script
  return latin.filter((c) => c === c.toUpperCase()).length / latin.length > 0.85;
}

function looksTitle(line: string, prev: string, next: string): boolean {
  if (line.length < 3 || line.length > 70 || line.split(/\s+/).length > 10) return false;
  if (!/^\p{Lu}/u.test(line) || /[.,;]$/.test(line) || /\d{3,}/.test(line)) return false;
  if (prev && prev.length >= 70 && !/[.:;]$/.test(prev)) return false; // previous line wraps into this one
  return Boolean(next) && (next.length >= 60 || BULLETS.includes(next[0]!));
}

export interface StructureResult {
  nodes: ExtractedNode[];
  unparsedLines: number;
  /** Anchor key -> ref of the heading that was open where the anchor line sat. */
  anchors: Map<string, string | null>;
}

/** A line with this prefix marks where a table or figure sits; it is not text. */
export const ANCHOR_PREFIX = '\u0000ANCHOR:';

export function buildTree(lines: SourceLine[], paperCode: string, paperName: string): StructureResult {
  const all = lines.map((l) =>
    l.text.startsWith(ANCHOR_PREFIX) ? l : { ...l, text: stripInlineFooter(l.text.normalize('NFC').replace(/\s+/g, ' ')) },
  );
  const entries = all.filter((l) => l.text.startsWith(ANCHOR_PREFIX) || !isNoise(l.text, paperCode, paperName));
  const textOnly = entries.filter((l) => !l.text.startsWith(ANCHOR_PREFIX));
  const indexInText = new Map(textOnly.map((l, i) => [l, i]));
  const anchors = new Map<string, string | null>();
  const nodes: ExtractedNode[] = [];
  const stack: { rank: number; node: ExtractedNode }[] = [];
  const childCount = new Map<string | null, number>();
  let unparsed = 0;
  let pendingTitle: ExtractedNode | null = null;

  entries.forEach((line) => {
    if (line.text.startsWith(ANCHOR_PREFIX)) {
      anchors.set(line.text.slice(ANCHOR_PREFIX.length), stack.at(-1)?.node.ref ?? null);
      return;
    }
    const i = indexInText.get(line)!;
    const text = line.text;
    const prev = textOnly[i - 1]?.text ?? '';
    const next = textOnly[i + 1]?.text ?? '';
    const lowConf = line.ocrConfidence !== undefined && line.ocrConfidence < 75;
    if (pendingTitle) {
      const nextIsHeading = BULLETS.includes(text[0]!) || RULES.some((r) => r.re.test(text));
      if (nextIsHeading) {
        // A bare "Section A1" followed by "1. Algebra": the section keeps its own label as its title.
        pendingTitle.title = `${pendingTitle.kind.charAt(0)}${pendingTitle.kind.slice(1).toLowerCase()} ${pendingTitle.label ?? ''}`.trim();
        pendingTitle.flags.push('title_is_label_only');
        pendingTitle = null;
      } else {
        pendingTitle.title = text;
        pendingTitle.sourceText = `${pendingTitle.sourceText ?? ''} ${text}`.trim();
        pendingTitle.flags.push('title_taken_from_next_line');
        if (lowConf) pendingTitle.flags.push(`ocr_low_confidence(${Math.round(line.ocrConfidence!)})`);
        pendingTitle = null;
        return;
      }
    }
    let kind: NodeKind | null = null;
    let rank = 0;
    let label: string | null = null;
    let title = '';
    const flags: string[] = [];
    if (/^(?:Note|NOTE|Notes)\s*:?\s*$/.test(text)) {
      kind = 'NOTE';
      rank = 3.5; // holds its own (i)-(iv) items; any unit, topic or section that follows closes it
      title = 'Note';
    } else if (BULLETS.includes(text[0]!) && text.length > 1) {
      kind = 'ITEM';
      rank = 4;
      title = text.replace(new RegExp(`^[${BULLETS}\\s\\-\\u2013]+`), '').trim();
    } else {
      for (const r of RULES) {
        const m = r.re.exec(text);
        if (m) {
          kind = r.kind;
          rank = r.rank;
          label = m[1] ?? null;
          title = (m[2] ?? '').trim();
          break;
        }
      }
    }
    if (!kind && looksAllCaps(text)) {
      kind = 'SECTION';
      rank = 1;
      title = text;
      flags.push('heading_inferred_from_formatting');
    } else if (!kind && looksTitle(text, prev, next)) {
      kind = 'TOPIC';
      rank = 3;
      title = text.replace(/:$/, '');
      flags.push('heading_inferred_from_formatting');
    }
    if (!kind) {
      let top = stack.at(-1)?.node;
      if (!top) {
        // Text before the first heading (e.g. "Questions from the Language Section will be from the
        // following topics..."): keep it word for word as an introductory note instead of dropping it.
        top = {
          ref: `n${nodes.length + 1}`, parentRef: null, kind: 'NOTE', label: null, title: text, body: null,
          position: childCount.get(null) ?? 0, depth: 1, sourcePage: line.page, endPage: line.page,
          flags: ['introductory_text', ...(line.ocrConfidence !== undefined ? ['ocr'] : [])],
        };
        childCount.set(null, top.position + 1);
        nodes.push(top);
        stack.push({ rank: 99, node: top }); // closed by the next heading of any kind
        return;
      }
      top.body = top.body ? `${top.body} ${text}` : text;
      top.endPage = Math.max(top.endPage ?? line.page, line.page);
      if (lowConf && !top.flags.some((f) => f.startsWith('ocr_low_confidence'))) top.flags.push(`ocr_low_confidence(${Math.round(line.ocrConfidence!)})`);
      return;
    }
    // Bullets and lettered items directly under a TOPIC become SUBTOPICs; elsewhere they stay ITEMs.
    while (stack.length && stack.at(-1)!.rank >= rank) stack.pop();
    const parent = stack.at(-1)?.node ?? null;
    if (kind === 'ITEM' && parent && (parent.kind === 'TOPIC' || parent.kind === 'UNIT' || parent.kind === 'CHAPTER')) kind = 'SUBTOPIC';
    if (line.ocrConfidence !== undefined) {
      flags.push('ocr');
      if (lowConf) flags.push(`ocr_low_confidence(${Math.round(line.ocrConfidence)})`);
    }
    const parentRef = parent?.ref ?? null;
    const position = childCount.get(parentRef) ?? 0;
    childCount.set(parentRef, position + 1);
    const node: ExtractedNode = {
      ref: `n${nodes.length + 1}`,
      parentRef,
      kind,
      label,
      title,
      body: null,
      position,
      depth: stack.length + 1,
      sourcePage: line.page,
      endPage: line.page,
      sourceText: text,
      flags,
    };
    if (kind !== 'ITEM' && kind !== 'SUBTOPIC' && !title) pendingTitle = node;
    nodes.push(node);
    stack.push({ rank, node });
  });
  if (pendingTitle) (pendingTitle as ExtractedNode).title = (pendingTitle as ExtractedNode).label ?? 'Untitled';
  for (const n of nodes) if (!n.title) n.title = n.label ?? 'Untitled';
  return { nodes, unparsedLines: unparsed, anchors };
}
