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
  return { identity: `body:${normaliseText(body)}`, title: section ? name : clip(plain(body), 80) || name, front: name, back: body, latex: null };
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
