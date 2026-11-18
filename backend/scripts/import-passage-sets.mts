/**
 * LOCAL ONLY. Imports reading-passage question sets (content/special/passage-sets/*.json) into the local database.
 *   npx tsx scripts/import-passage-sets.mts <file.json> [--dry-run]
 * Each set is one passage and its questions. The passage is stored once (by its text) and each question refers to it; a question is added
 * or updated by its key, so running this again changes nothing. Everything arrives as an UNVERIFIED DRAFT: nothing is verified, approved
 * or published by this script, and an existing question that a reviewer has touched is never overwritten (upsertQuestion's own rule).
 */
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { upsertQuestion } from '../src/services/content-packs';
import { upsertPassage } from '../src/services/questions';

const file = process.argv[2];
if (!file) throw new Error('Usage: import-passage-sets.mts <file.json> [--dry-run]');
const dry = process.argv.includes('--dry-run');

interface Q { key: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; objective: string; stem: string; options: string[]; answer: number; explanation: string; optionRationale: Record<string, string> }
interface PassageSet { key: string; topicNodeId: string; topicTitle: string; passage: { title: string; body: string }; questions: Q[] }
const pack = JSON.parse(readFileSync(file, 'utf8')) as { exam: string; year: number; paperCode: string; origin: 'AI_ASSISTED'; sets: PassageSet[] };

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const out: Record<string, number> = { passagesCreated: 0, passagesUnchanged: 0, questionsCreated: 0, questionsUnchanged: 0, questionsUpdated: 0, questionsLeftAlone: 0 };
try {
  const paper = await db
    .prepare('SELECT tp.id FROM test_papers tp JOIN exam_cycles ec ON ec.id = tp.exam_cycle_id JOIN exams e ON e.id = ec.exam_id WHERE e.code = ? AND ec.year = ? AND tp.code = ?')
    .bind(pack.exam, pack.year, pack.paperCode)
    .first<{ id: string }>();
  if (!paper) throw new Error(`Paper ${pack.exam} ${pack.year} ${pack.paperCode} not found`);
  for (const set of pack.sets) {
    const node = await db.prepare('SELECT n.id, n.title, v.test_paper_id AS paper FROM curriculum_nodes n JOIN syllabus_versions v ON v.id = n.syllabus_version_id WHERE n.id = ?').bind(set.topicNodeId).first<{ id: string; title: string; paper: string }>();
    if (!node || node.paper !== paper.id) throw new Error(`${set.key}: topic ${set.topicNodeId} is not a topic of paper ${pack.paperCode}`);
    if (!node.title.startsWith(set.topicTitle.slice(0, 20))) throw new Error(`${set.key}: topic title mismatch (database says "${node.title}")`);
    for (const q of set.questions) {
      if (q.options.length !== 4 || !Number.isInteger(q.answer) || q.answer < 1 || q.answer > 4) throw new Error(`${set.key}.${q.key}: four options and an answer 1-4 are required`);
      if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) throw new Error(`${set.key}.${q.key}: options must differ`);
      const wrong = [1, 2, 3, 4].filter((n) => n !== q.answer).map(String).sort().join(',');
      if (Object.keys(q.optionRationale).sort().join(',') !== wrong) throw new Error(`${set.key}.${q.key}: option notes must cover exactly the wrong options (${wrong})`);
    }
    if (dry) { console.log(`DRY ${set.key}: ${set.questions.length} questions on "${node.title}"`); continue; }
    const passage = await upsertPassage(db, { title: set.passage.title, body: set.passage.body, language: 'en', origin: pack.origin, usagePermissionId: 'perm_owned' }, 'admin:passage-import');
    out[passage.outcome === 'CREATED' ? 'passagesCreated' : 'passagesUnchanged']!++;
    for (const q of set.questions) {
      const body = {
        testPaperId: paper.id, type: 'PASSAGE_BASED', passageId: passage.id, stem: q.stem, language: 'en', difficulty: q.difficulty, learningObjective: q.objective,
        origin: pack.origin, usagePermissionId: 'perm_owned', isDemonstration: false,
        options: q.options.map((text, i) => ({ label: 'ABCD'[i]!, text })),
        answer: { correctOptionPositions: [q.answer] }, explanation: { body: q.explanation, optionRationale: q.optionRationale }, topicNodeIds: [node.id],
      };
      const r = await upsertQuestion(db, `${set.key}-${q.key}`, body, 'admin:passage-import');
      const k = r.outcome === 'CREATED' ? 'questionsCreated' : r.outcome === 'UNCHANGED' ? 'questionsUnchanged' : r.outcome === 'UPDATED' ? 'questionsUpdated' : 'questionsLeftAlone';
      out[k]!++;
    }
  }
  console.log(JSON.stringify(dry ? { dryRun: true, sets: pack.sets.length } : out, null, 1));
} finally {
  await dispose();
}
