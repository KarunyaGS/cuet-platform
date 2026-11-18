/**
 * LOCAL, READ-ONLY. Generates every flashcard the lessons can give (concepts, figures, comparison rows) and checks each one.
 *   npx tsx scripts/audit-flashcards-2026-11-18.mts [out.json]
 * Nothing is written to the database. Problems found: empty or very short sides, very long sides, a front that does not say what is asked,
 * unbalanced maths, text that points at a figure the card does not show, duplicate fronts or backs within a chapter, and incomplete figure
 * or comparison cards.
 */
import { writeFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { chapterOf, LESSON_PAPER } from '../src/services/flashcards';
import { cardConceptsOfResources } from '../src/services/concepts';
import { VISIBLE_CONTENT } from '../src/services/learning';
import { normaliseText } from '../src/lib/hash';

const out = process.argv[2] ?? 'D:/tmp/flashcard-audit.json';
const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
try {
  const { results: lessons } = await db
    .prepare(`SELECT r.id, r.title, r.curriculum_node_id AS node, ${LESSON_PAPER} AS paper_id FROM learning_resources r WHERE r.type = 'LESSON' AND ${VISIBLE_CONTENT('r')}`)
    .bind(1)
    .all<{ id: string; title: string; node: string | null; paper_id: string | null }>();
  const papers = new Map((await db.prepare('SELECT id, code, name FROM test_papers').all<{ id: string; code: string; name: string }>()).results.map((p) => [p.id, p]));
  const byLesson = await cardConceptsOfResources(db, lessons.map((l) => l.id));
  const chapterCache = new Map<string, string | null>();
  type Issue = { code: string; id: string; subject: string; lesson: string; type: string; front: string; back: string };
  const issues: Issue[] = [];
  const counts: Record<string, Record<string, number>> = {};
  const perSubject: Record<string, number> = {};
  const seenFront = new Map<string, Issue[]>();
  const seenBack = new Map<string, Issue[]>();
  const add = (code: string, l: (typeof lessons)[number], subject: string, c: { key: string; type: string; front: string; back: string }) => issues.push({ code, id: c.key, subject, lesson: l.title.slice(0, 60), type: c.type, front: c.front.slice(0, 160), back: c.back.slice(0, 160) });
  let total = 0;
  for (const l of lessons) {
    const subject = papers.get(l.paper_id ?? '')?.code ?? '?';
    if (l.node && !chapterCache.has(l.node)) chapterCache.set(l.node, await chapterOf(db, l.node));
    const chapter = (l.node && chapterCache.get(l.node)) || 'none';
    for (const c of byLesson.get(l.id) ?? []) {
      total++;
      counts[subject] ??= {};
      counts[subject]![c.type] = (counts[subject]![c.type] ?? 0) + 1;
      perSubject[subject] = (perSubject[subject] ?? 0) + 1;
      const text = `${c.front}\n${c.back}`;
      const formula = c.type === 'FORMULA';
      if (!c.front.trim()) add('EMPTY_FRONT', l, subject, c);
      if (!formula && !c.back.trim()) add('EMPTY_BACK', l, subject, c);
      if (formula && !c.latex) add('FORMULA_WITHOUT_LATEX', l, subject, c);
      if (!formula && c.type !== 'FIGURE' && c.back.trim().length > 0 && c.back.trim().length < 12) add('VERY_SHORT_BACK', l, subject, c);
      if (c.back.length > 700) add('LONG_BACK', l, subject, c);
      if (c.front.length > 320 && c.type !== 'COMPARISON' && !(formula && c.front.length <= 600)) add('LONG_FRONT', l, subject, c);
      if ((text.match(/\$/g) ?? []).length % 2) add('UNBALANCED_MATHS', l, subject, c);
      if ((text.match(/\*\*/g) ?? []).length % 2) add('UNBALANCED_BOLD', l, subject, c);
      // A front that does not say what is asked.
      if (c.type === 'KEY_POINT' || c.type === 'IMPORTANT_FACT' || c.type === 'CONCEPT') {
        if (/^(Key point|Important fact|Concept)(:|$)/.test(c.front)) add('GENERIC_FRONT', l, subject, c);
      }
      if (formula && /^Formula(: .*)?$/.test(c.front) && c.front.length < 40) add('FORMULA_FRONT_NAMES_NOTHING', l, subject, c);
      // Text that depends on a figure or table the card does not show.
      if (c.type !== 'FIGURE' && /\b(in|from|see|shown in|as shown in|given in) (the )?(figure|diagram|table|graph|circuit shown)\b|\bthe figure (above|below)\b|\bFig\.? ?\d/i.test(text)) add('POINTS_AT_FIGURE', l, subject, c);
      if (c.type === 'FIGURE') {
        if (!c.mediaAssetId) add('FIGURE_WITHOUT_IMAGE', l, subject, c);
        if (!/\n\n/.test(c.back)) add('FIGURE_WITHOUT_NOTE', l, subject, c);
      }
      if (c.type === 'COMPARISON') {
        const vals = c.back.split('\n').map((x) => x.replace(/^- \*\*[^*]+:\*\* /, ''));
        if (new Set(vals.map((v) => normaliseText(v))).size === 1 && vals.length > 1) add('COMPARISON_SAME_VALUES', l, subject, c);
        if (vals.some((v) => v.length < 2)) add('COMPARISON_EMPTY_VALUE', l, subject, c);
      }
      const fk = `${chapter}|${normaliseText(c.front)}`;
      if (c.type !== 'FORMULA' && c.type !== 'FIGURE') {
        const prior = seenFront.get(fk);
        const rec = { code: 'DUPLICATE_FRONT', id: c.key, subject, lesson: l.title.slice(0, 60), type: c.type, front: c.front.slice(0, 160), back: c.back.slice(0, 160) };
        if (prior) prior.push(rec);
        else seenFront.set(fk, [rec]);
      }
      const bk = `${chapter}|${normaliseText(c.back)}`;
      if (c.back.trim().length > 20) {
        const prior = seenBack.get(bk);
        const rec = { code: 'DUPLICATE_BACK', id: c.key, subject, lesson: l.title.slice(0, 60), type: c.type, front: c.front.slice(0, 160), back: c.back.slice(0, 160) };
        if (prior) prior.push(rec);
        else seenBack.set(bk, [rec]);
      }
    }
  }
  for (const g of [...seenFront.values(), ...seenBack.values()]) if (g.length > 1) issues.push(...g);
  const byCode: Record<string, number> = {};
  const byCodeSubject: Record<string, Record<string, number>> = {};
  for (const i of issues) {
    byCode[i.code] = (byCode[i.code] ?? 0) + 1;
    (byCodeSubject[i.code] ??= {})[i.subject] = (byCodeSubject[i.code]![i.subject] ?? 0) + 1;
  }
  const flagged = new Set(issues.map((i) => i.id)).size;
  writeFileSync(out, JSON.stringify({ lessons: lessons.length, cards: total, perSubject, counts, flaggedCards: flagged, byCode, byCodeSubject, issues }, null, 1));
  console.log(JSON.stringify({ lessons: lessons.length, cards: total, flaggedCards: flagged, perSubject, counts, byCode }, null, 1));
} finally {
  await dispose();
}
