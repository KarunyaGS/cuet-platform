/**
 * Flashcard decks: one deck for each chapter, made from the lessons under it. A deck is not stored anywhere. It is what the
 * chapter's lessons can give (definitions, formulas, key points, figures to identify, comparison rows), set beside the cards the
 * student has already added from it. "Study now" adds the missing cards with the existing import and opens the existing review.
 * Everything is computed from stored lesson text and the student's own cards; no AI calls.
 */
import { VISIBLE_CONTENT } from './learning';
import { cardConceptsOfResources, type CardType } from './concepts';
import { chapterOf, LESSON_PAPER, MATURE_DAYS, assertDay, questionVisible } from './flashcards';

const GROUP: Record<CardType, 'definitions' | 'formulas' | 'concepts' | 'figures' | 'comparisons'> = {
  DEFINITION: 'definitions', FORMULA: 'formulas', KEY_POINT: 'concepts', IMPORTANT_FACT: 'concepts', CONCEPT: 'concepts', FIGURE: 'figures', COMPARISON: 'comparisons',
};
const blank = () => ({ total: 0, definitions: 0, formulas: 0, concepts: 0, figures: 0, comparisons: 0 });

export async function flashcardDecks(db: D1Database, preview: boolean, userId: string, dayInput: string, paperId?: string) {
  const day = assertDay(dayInput);
  const { results: lessons } = await db
    .prepare(
      `SELECT r.id, r.title, r.curriculum_node_id AS node, ${LESSON_PAPER} AS paper_id, r.verification
       FROM learning_resources r WHERE r.type = 'LESSON' AND ${VISIBLE_CONTENT('r')}`,
    )
    .bind(preview ? 1 : 0)
    .all<{ id: string; title: string; node: string | null; paper_id: string | null; verification: string }>();
  const wanted = paperId ? lessons.filter((l) => l.paper_id === paperId) : lessons;
  const concepts = await cardConceptsOfResources(db, wanted.map((l) => l.id));

  // Which chapter each lesson sits in.
  const chapterOfNode = new Map<string, string | null>();
  for (const l of wanted) if (l.node && !chapterOfNode.has(l.node)) chapterOfNode.set(l.node, await chapterOf(db, l.node));
  const decks = new Map<string, { chapterId: string; paperId: string | null; available: ReturnType<typeof blank>; lessons: number; draft: boolean }>();
  for (const l of wanted) {
    const chapterId = l.node ? chapterOfNode.get(l.node) : null;
    if (!chapterId) continue;
    const d = decks.get(chapterId) ?? { chapterId, paperId: l.paper_id, available: blank(), lessons: 0, draft: false };
    d.lessons++;
    if (l.verification !== 'VERIFIED') d.draft = true;
    for (const c of concepts.get(l.id) ?? []) {
      d.available.total++;
      d.available[GROUP[c.type]]++;
    }
    decks.set(chapterId, d);
  }
  const ids = [...decks.keys()];
  const info = new Map<string, { title: string; position: number }>();
  const paperNames = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 80) {
    const part = ids.slice(i, i + 80);
    const { results } = await db.prepare(`SELECT id, title, position FROM curriculum_nodes WHERE id IN (${part.map(() => '?').join(',')})`).bind(...part).all<{ id: string; title: string; position: number }>();
    for (const r of results) info.set(r.id, { title: r.title, position: r.position });
  }
  const paperIds = [...new Set([...decks.values()].map((d) => d.paperId).filter((x): x is string => Boolean(x)))];
  if (paperIds.length) {
    const { results } = await db.prepare(`SELECT id, name FROM test_papers WHERE id IN (${paperIds.map(() => '?').join(',')})`).bind(...paperIds).all<{ id: string; name: string }>();
    for (const r of results) paperNames.set(r.id, r.name);
  }
  // What the student has already added from each chapter (cards made from lessons, not from questions).
  const { results: mine } = await db
    .prepare(
      `SELECT f.chapter_node_id AS chapter, COUNT(*) AS added, COALESCE(SUM(f.due_on <= ?2), 0) AS due, COALESCE(SUM(f.last_reviewed_at IS NULL), 0) AS fresh,
              COALESCE(SUM(f.last_reviewed_at IS NOT NULL AND f.interval_days >= ${MATURE_DAYS}), 0) AS known
       FROM flashcards f WHERE f.user_id = ?1 AND f.question_id IS NULL AND ${questionVisible(preview)} GROUP BY f.chapter_node_id`,
    )
    .bind(userId, day)
    .all<{ chapter: string | null; added: number; due: number; fresh: number; known: number }>();
  const byChapter = new Map(mine.map((m) => [m.chapter, m]));

  const subjects = new Map<string, { paperId: string | null; paper: string; available: number; added: number; due: number; known: number; chapters: unknown[] }>();
  for (const d of decks.values()) {
    const m = byChapter.get(d.chapterId);
    const added = Number(m?.added ?? 0), due = Number(m?.due ?? 0), fresh = Number(m?.fresh ?? 0), known = Number(m?.known ?? 0);
    const key = d.paperId ?? 'other';
    const s = subjects.get(key) ?? { paperId: d.paperId, paper: (d.paperId && paperNames.get(d.paperId)) || 'Other', available: 0, added: 0, due: 0, known: 0, chapters: [] };
    s.available += d.available.total;
    s.added += added;
    s.due += due;
    s.known += known;
    const node = info.get(d.chapterId);
    s.chapters.push({
      chapterId: d.chapterId, chapter: node?.title ?? 'Chapter', position: node?.position ?? 0, lessons: d.lessons, available: d.available, draft: d.draft,
      added, due, fresh, learning: Math.max(0, added - fresh - known), known,
      // Mastery: the share of the whole deck the student knows well (next review three weeks or more away).
      mastery: d.available.total ? Math.round((100 * known) / d.available.total) : 0,
      startedPct: d.available.total ? Math.round((100 * (added - fresh)) / d.available.total) : 0,
    });
    subjects.set(key, s);
  }
  const list = [...subjects.values()].sort((a, b) => a.paper.localeCompare(b.paper));
  for (const s of list) (s.chapters as { position: number; chapter: string }[]).sort((a, b) => a.position - b.position || a.chapter.localeCompare(b.chapter));
  return {
    day,
    totals: { available: list.reduce((n, s) => n + s.available, 0), added: list.reduce((n, s) => n + s.added, 0), due: list.reduce((n, s) => n + s.due, 0), known: list.reduce((n, s) => n + s.known, 0) },
    subjects: list,
  };
}
