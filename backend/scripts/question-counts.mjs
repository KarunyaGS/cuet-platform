// Unique question counts, and how every number a student sees is made up. READ-ONLY.
//
//   node backend/scripts/question-counts.mjs [path-to-local-d1.sqlite] [paperCode ...]
//
// Without a path it opens the local D1 file with the most migrations applied. Default papers: 322 (Physics) and 306 (Chemistry).
// It never writes. See docs/question-counts.md for what each number means.
import { DatabaseSync } from 'node:sqlite';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
const args = process.argv.slice(2);
const given = args.find((a) => a.endsWith('.sqlite'));
const codes = args.filter((a) => !a.endsWith('.sqlite'));
const papers = codes.length ? codes : ['322', '306'];

function pick() {
  if (given) return given;
  let best = null;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')) {
    const p = join(dir, f);
    try {
      const d = new DatabaseSync(p, { readOnly: true });
      const n = d.prepare('SELECT COUNT(*) AS n FROM d1_migrations').get().n;
      d.close();
      if (!best || n > best.n || (n === best.n && statSync(p).size > best.size)) best = { p, n, size: statSync(p).size };
    } catch {
      /* not a Prepora database */
    }
  }
  if (!best) throw new Error('No local D1 database found');
  return best.p;
}

const file = pick();
const db = new DatabaseSync(file, { readOnly: true });
const all = (s, ...p) => db.prepare(s).all(...p);
const one = (s, ...p) => db.prepare(s).get(...p);
console.log(`Database: ${file}\n`);

for (const code of papers) {
  const paper = one(
    `SELECT tp.id, tp.name FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE tp.code = ? AND e.code = 'CUET_UG' ORDER BY ec.year DESC`,
    code,
  );
  if (!paper) {
    console.log(`Paper ${code}: not found\n`);
    continue;
  }
  const total = one('SELECT COUNT(*) AS n, COUNT(DISTINCT id) AS u FROM questions WHERE test_paper_id = ?', paper.id);
  console.log(`== ${paper.name} (${code})`);
  console.log(`Unique questions (rows in "questions" for this paper): ${total.u}${total.n !== total.u ? ` (rows ${total.n})` : ''}`);

  const by = all(
    `SELECT status, verification, is_demonstration AS demo, COUNT(*) AS n FROM questions WHERE test_paper_id = ? GROUP BY 1, 2, 3 ORDER BY 1, 2`,
    paper.id,
  );
  console.log('By status / verification:');
  for (const r of by) console.log(`  ${r.status.padEnd(9)} ${r.verification.padEnd(11)} demonstration=${r.demo}: ${r.n}`);
  const bulk = one(`SELECT COUNT(DISTINCT i.question_id) AS n FROM bulk_approval_items i JOIN questions q ON q.id = i.question_id WHERE i.state = 'ACTIVE' AND q.test_paper_id = ?`, paper.id);
  console.log(`  of which VERIFIED only through a bulk management approval: ${bulk.n}`);

  // Is any question shared between topics, or tagged to none?
  const tagged = one(
    `SELECT COUNT(DISTINCT qt.question_id) AS n, COUNT(*) AS tags FROM question_topics qt JOIN questions q ON q.id = qt.question_id WHERE q.test_paper_id = ?`,
    paper.id,
  );
  const multi = one(`SELECT COUNT(*) AS n FROM (SELECT qt.question_id FROM question_topics qt JOIN questions q ON q.id = qt.question_id WHERE q.test_paper_id = ? GROUP BY 1 HAVING COUNT(*) > 1)`, paper.id);
  console.log(`Topic tags: ${tagged.tags} tags on ${tagged.n} questions; questions with more than one topic: ${multi.n}; questions with no topic: ${total.u - tagged.n}`);

  // Duplicates: same text more than once (not removed; reported only).
  const dups = all(`SELECT stem, COUNT(*) AS n FROM questions WHERE test_paper_id = ? GROUP BY stem HAVING COUNT(*) > 1`, paper.id);
  console.log(`Questions whose exact text appears more than once: ${dups.length ? dups.map((d) => `${d.n}x "${String(d.stem).slice(0, 70)}"`).join('; ') : 'none'}`);

  // What each card in the student view adds up to (latest syllabus version).
  const ver = one(`SELECT id FROM syllabus_versions WHERE test_paper_id = ? AND status != 'ARCHIVED' ORDER BY version_number DESC`, paper.id);
  const nodes = all(
    `SELECT n.id, n.parent_id, n.kind, n.depth, n.title, (SELECT COUNT(*) FROM question_topics qt JOIN questions q ON q.id = qt.question_id WHERE qt.curriculum_node_id = n.id) AS direct FROM curriculum_nodes n WHERE n.syllabus_version_id = ? ORDER BY n.depth, n.position`,
    ver.id,
  );
  const kids = new Map();
  for (const n of nodes) (kids.get(n.parent_id) ?? kids.set(n.parent_id, []).get(n.parent_id)).push(n);
  const sub = (n) => n.direct + (kids.get(n.id) ?? []).reduce((a, c) => a + sub(c), 0);
  const roots = nodes.filter((n) => !n.parent_id);
  console.log(`Cards: chapters/units = ${roots.length}; each shows the questions in its whole subtree:`);
  for (const r of roots) console.log(`  ${String(sub(r)).padStart(4)}  ${r.title.slice(0, 70)}${(kids.get(r.id) ?? []).length ? `  (${(kids.get(r.id) ?? []).length} topics inside)` : ''}`);
  const sumRoots = roots.reduce((a, r) => a + sub(r), 0);
  const directSum = nodes.reduce((a, n) => a + n.direct, 0);
  console.log(`  chapters add up to ${sumRoots}; topic-level cards (direct tags) add up to ${directSum}; unique questions ${total.u}`);
  console.log(`  ${sumRoots === total.u && directSum === total.u ? 'OK: every question is counted exactly once, so the cards add up to the unique total.' : 'MISMATCH: investigate.'}`);
  console.log(`  Adding a chapter card AND the topic cards inside it counts those questions twice (that is a reading error, not duplicate data).\n`);

  const files = one(`SELECT COUNT(*) AS n FROM pyq_documents WHERE subject_code = ? AND kind = 'PRACTICE_PAPER'`, code);
  console.log(`Prepora practice papers/question banks recorded for this subject: ${files.n} (they reuse questions from the bank; they add none)\n`);
}
