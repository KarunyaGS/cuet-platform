/**
 * Concepts: the individual things inside a lesson that a student can save and revise on their own: one definition,
 * one formula, one key point, one important fact or one concept statement.
 *
 * A lesson's blocks are deleted and written again every time the lesson is edited or re-imported, so a block's row id
 * cannot identify a concept. Each concept therefore gets a key worked out from the lesson and from what names the
 * concept: a definition's term, a formula's LaTeX, or the bold lead-in (or else the whole text) of a point. Re-importing
 * the same lesson, reordering its blocks or rewording a definition's explanation leaves the key unchanged.
 * Everything here is computed from stored lesson text; no AI calls.
 */
import { normaliseText, sha256Hex } from '../lib/hash';

export const CONCEPT_TYPES = ['DEFINITION', 'FORMULA', 'KEY_POINT', 'IMPORTANT_FACT', 'CONCEPT'] as const;
export type ConceptType = (typeof CONCEPT_TYPES)[number];
const IS_CONCEPT = new Set<string>(CONCEPT_TYPES);
export const CONCEPT_TYPES_SQL = CONCEPT_TYPES.map((t) => `'${t}'`).join(',');
export const CONCEPT_KEY = /^[A-Za-z0-9_-]{1,80}\.[0-9a-f]{16}$/;

const TYPE_LABEL: Record<ConceptType, string> = { DEFINITION: 'Definition', FORMULA: 'Formula', KEY_POINT: 'Key point', IMPORTANT_FACT: 'Important fact', CONCEPT: 'Concept' };

export interface RawBlock {
  position: number;
  type: string;
  body: string;
  /** Set on figure blocks. */
  mediaAssetId?: string | null;
}

export interface Concept {
  /** "<lesson id>.<16 hex>" */
  key: string;
  /** The id of the block's element on the lesson page: "c-<16 hex>". */
  anchor: string;
  type: ConceptType;
  position: number;
  /** A short name for lists and bookmarks. */
  title: string;
  /** The lesson heading the concept sits under. */
  section: string | null;
  /** Flashcard text, copied from the lesson (Markdown with inline maths). */
  front: string;
  back: string;
  latex: string | null;
}

function parse<T>(body: string): T | null {
  try {
    const j = JSON.parse(body) as T;
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

/** "**Coulomb's law:** the force between ..." gives { lead: "Coulomb's law", rest: "the force between ..." }. */
export function leadIn(body: string): { lead: string; rest: string } | null {
  const m = /^\s*\*\*([^*\n]{2,120}?)\*\*\s*[:.]?\s*([\s\S]*)$/.exec(body);
  if (!m) return null;
  const lead = m[1]!.replace(/[\s:.]+$/, '').trim();
  const rest = m[2]!.trim();
  return lead && rest.length >= 10 ? { lead, rest } : null;
}

const plain = (md: string) =>
  md
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*-\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The front of a point that has no name of its own: the opening words as a cue to finish from memory, so fronts differ from one another. */
function cueFront(type: ConceptType, section: string | null, body: string, fallback: string): string {
  const words = plain(body).split(' ').filter((w) => /[A-Za-z0-9]/.test(w));
  if (words.length < 10) return fallback;
  const where = section ? ` (${section})` : '';
  return `Complete the ${TYPE_LABEL[type].toLowerCase()}${where}: \u201c${words.slice(0, 7).join(' ')} \u2026\u201d`;
}

/** What names a concept, and the text of its card. */
function describe(type: ConceptType, body: string, section: string | null): { identity: string; title: string; front: string; back: string; latex: string | null } {
  if (type === 'DEFINITION') {
    const j = parse<{ term?: string; text?: string }>(body);
    if (j?.term && j.text) return { identity: `term:${normaliseText(j.term)}`, title: j.term, front: j.term, back: j.text, latex: null };
  }
  if (type === 'FORMULA') {
    const j = parse<{ latex?: string; text?: string | null }>(body);
    if (j?.latex) {
      const where = section ? `Formula: ${section}` : 'Formula';
      return { identity: `latex:${j.latex.replace(/\s+/g, '')}`, title: where, front: j.text?.trim() || where, back: '', latex: j.latex };
    }
  }
  const l = leadIn(body);
  if (l) return { identity: `lead:${normaliseText(l.lead)}`, title: l.lead, front: l.lead, back: l.rest, latex: null };
  const name = section ? `${TYPE_LABEL[type]}: ${section}` : clip(plain(body), 80) || TYPE_LABEL[type];
  return { identity: `body:${normaliseText(body)}`, title: section ? name : clip(plain(body), 80) || name, front: cueFront(type, section, body, name), back: body, latex: null };
}

/** The concepts of one lesson, in reading order. `blocks` must be every block of the lesson. */
export async function conceptsOf(resourceId: string, blocks: RawBlock[]): Promise<Concept[]> {
  const out: Concept[] = [];
  const seen = new Map<string, number>();
  let section: string | null = null;
  for (const b of [...blocks].sort((x, y) => x.position - y.position)) {
    if (b.type === 'HEADING') {
      section = b.body.trim() || section;
      continue;
    }
    if (!IS_CONCEPT.has(b.type)) continue;
    const type = b.type as ConceptType;
    const d = describe(type, b.body, section);
    // Two concepts of a lesson with the same name (rare) are told apart by their order.
    const base = `${type}|${d.identity}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const hash = (await sha256Hex(n === 1 ? base : `${base}|#${n}`)).slice(0, 16);
    out.push({ key: `${resourceId}.${hash}`, anchor: `c-${hash}`, type, position: b.position, title: clip(d.title, 160), section, front: d.front, back: d.back, latex: d.latex });
  }
  return out;
}

export const resourceOfKey = (key: string) => key.slice(0, key.lastIndexOf('.'));

/** Concepts of several lessons at once, keyed by lesson id. */
export async function conceptsOfResources(db: D1Database, resourceIds: string[]): Promise<Map<string, Concept[]>> {
  const ids = [...new Set(resourceIds)];
  const blocks = new Map<string, RawBlock[]>(ids.map((id) => [id, []]));
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { results } = await db
      .prepare(`SELECT resource_id, position, type, body FROM content_blocks WHERE resource_id IN (${part.map(() => '?').join(',')}) AND type IN ('HEADING',${CONCEPT_TYPES_SQL})`)
      .bind(...part)
      .all<RawBlock & { resource_id: string }>();
    for (const r of results) blocks.get(r.resource_id)!.push({ position: r.position, type: r.type, body: r.body });
  }
  const out = new Map<string, Concept[]>();
  for (const [id, list] of blocks) out.set(id, await conceptsOf(id, list));
  return out;
}

// ---------------------------------------------------------------- flashcards: figures and comparison tables

/** A flashcard made from a lesson: a concept as above, a figure to identify, or one row of a comparison table. */
export const CARD_ONLY_TYPES = ['FIGURE', 'COMPARISON'] as const;
export const CARD_TYPES = [...CONCEPT_TYPES, ...CARD_ONLY_TYPES] as const;
export type CardType = (typeof CARD_TYPES)[number];
export interface CardConcept extends Omit<Concept, 'type'> {
  type: CardType;
  /** Figure cards: the image on the front. */
  mediaAssetId: string | null;
}

const COMPARE_WORDS = /compar|versus|\bvs\b|differen|distinguish|contrast/i;
const LABEL_HEADERS = /^(feature|property|basis|point|aspect|criterion|criteria|parameter|characteristic)s?\b/i;
const SUMMARY_WORDS = /revision|summary|recap|quick|checklist|strategy|to remember/i;
const NOT_COMPARISON = /formula sheet|formulae|constants?\b|units\b|signs? of|sign convention|values? of|list of|steps?\b/i;

/** A lesson table that sets two or more things side by side: its caption says so, or its first column names what is compared. */
export function comparisonTable(body: string): { caption: string; columns: string[]; rows: { label: string; values: string[] }[] } | null {
  const j = parse<{ caption?: string | null; columns?: string[]; rows?: string[][] }>(body);
  if (!j || !Array.isArray(j.columns) || !Array.isArray(j.rows)) return null;
  const caption = (j.caption ?? '').trim();
  const columns = j.columns.map((c) => String(c).trim());
  if (!caption || columns.length < 3 || j.rows.length < 2 || j.rows.length > 12 || NOT_COMPARISON.test(caption)) return null;
  if (!COMPARE_WORDS.test(caption) && !LABEL_HEADERS.test(columns[0] ?? '')) return null;
  const rows = j.rows
    .map((r) => r.map((c) => String(c).trim()))
    .filter((r) => r.length === columns.length && r.every((c) => c.length >= 2 && !/^[-\u2013\u2014]+$/.test(c)) && r[0]!.length <= 90 && r.every((c) => c.length <= 360))
    // A row whose values are all the same is not a comparison.
    .filter((r) => new Set(r.slice(1).map((c) => normaliseText(c))).size > 1)
    .map((r) => ({ label: r[0]!, values: r.slice(1) }));
  return rows.length >= 2 ? { caption, columns, rows } : null;
}

const joinAnd = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * The flashcards a lesson can give: its concepts (definitions, formulas, key points, facts), one card for each figure (identify it)
 * and one card for each row of each comparison table (recall how the things differ). Computed from stored lesson text; no AI calls.
 */
export async function cardConceptsOf(resourceId: string, blocks: RawBlock[]): Promise<CardConcept[]> {
  const sorted = [...blocks].sort((x, y) => x.position - y.position);
  const out: CardConcept[] = (await conceptsOf(resourceId, sorted.filter((b) => b.type === 'HEADING' || IS_CONCEPT.has(b.type))))
    .filter((c) => !(c.back.length > 450 && c.type !== 'FORMULA' && c.type !== 'DEFINITION' && SUMMARY_WORDS.test(`${c.section ?? ''} ${c.title}`)))
    .map((c) => ({ ...c, mediaAssetId: null }));
  let section: string | null = null;
  const seen = new Map<string, number>();
  const make = async (type: CardType, position: number, identity: string, title: string, front: string, back: string, mediaAssetId: string | null) => {
    const base = `${type}|${identity}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const hash = (await sha256Hex(n === 1 ? base : `${base}|#${n}`)).slice(0, 16);
    out.push({ key: `${resourceId}.${hash}`, anchor: `c-${hash}`, type, position, title: clip(title, 160), section, front, back, latex: null, mediaAssetId });
  };
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]!;
    if (b.type === 'HEADING') section = b.body.trim() || section;
    else if (b.type === 'DIAGRAM' && b.mediaAssetId) {
      const caption = b.body.trim();
      if (!caption) continue;
      const next = sorted[i + 1];
      const learn = next?.type === 'CALLOUT' && /^What to learn from this figure/.test(next.body) ? next.body.replace(/^What to learn from this figure:\s*/, '').trim() : '';
      await make('FIGURE', b.position, `media:${b.mediaAssetId}`, caption, 'What does this figure show?', learn ? `**${caption}**\n\n${learn}` : `**${caption}**`, b.mediaAssetId);
    } else if (b.type === 'TABLE') {
      const t = comparisonTable(b.body);
      if (!t) continue;
      for (const row of t.rows) {
        const front = `**${t.caption}**\n\nFor **${row.label}**, compare ${joinAnd(t.columns.slice(1).map((c) => `**${c}**`))}.`;
        const back = row.values.map((v, k) => `- **${t.columns[k + 1]}:** ${v}`).join('\n');
        await make('COMPARISON', b.position, `cmp:${normaliseText(t.caption)}|${normaliseText(row.label)}`, `${t.caption}: ${row.label}`, front, back, null);
      }
    }
  }
  return out.sort((a, b) => a.position - b.position);
}

/** The card concepts of several lessons at once, keyed by lesson id. */
export async function cardConceptsOfResources(db: D1Database, resourceIds: string[]): Promise<Map<string, CardConcept[]>> {
  const ids = [...new Set(resourceIds)];
  const blocks = new Map<string, RawBlock[]>(ids.map((id) => [id, []]));
  for (let i = 0; i < ids.length; i += 60) {
    const part = ids.slice(i, i + 60);
    const { results } = await db
      .prepare(`SELECT resource_id, position, type, body, media_asset_id FROM content_blocks WHERE resource_id IN (${part.map(() => '?').join(',')}) AND type IN ('HEADING','DIAGRAM','TABLE','CALLOUT',${CONCEPT_TYPES_SQL})`)
      .bind(...part)
      .all<{ resource_id: string; position: number; type: string; body: string; media_asset_id: string | null }>();
    for (const r of results) blocks.get(r.resource_id)!.push({ position: r.position, type: r.type, body: r.body, mediaAssetId: r.media_asset_id });
  }
  const out = new Map<string, CardConcept[]>();
  for (const [id, list] of blocks) out.set(id, await cardConceptsOf(id, list));
  return out;
}
