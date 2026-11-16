/**
 * One-off, local only (16 Nov 2026). Records the CEO's decision to publish four Delhi University programmes (Physics, Mathematics,
 * Economics, B.Com. (Hons.)) and their seven facts, as 2026-27 historical references. It also adds one more DRAFT fact (the List A and
 * List B lists those programmes' rules refer to), which stays a draft. Everything else stays as it is. Refuses to run if the set it
 * would publish is not exactly four programmes and seven unflagged draft facts.
 *   npx tsx scripts/publish-delhi-four-2026-11-16.mts
 */
import { getPlatformProxy } from 'wrangler';
import { createFact, decideFact, decideProgramme, factInputSchema } from '../src/services/admissions';
import { newId } from '../src/lib/hash';

const APPROVER = 'ceo-decision:2026-11-16';
const NAMES = ['B.Sc. (Hons.) Physics', 'B.Sc. (Hons.) Mathematics', 'B.A. (Hons.) Economics', 'B.Com. (Hons.)'];
const BOI = 'Bulletin of Information UG 2026-27 (https://www.du.ac.in/uploads/2026/06012026_BOI_UG_2026_27_compressed.pdf)';
const LISTS =
  'List A: Languages. Assamese, Bengali, English, Gujarati, Hindi, Kannada, Malayalam, Marathi, Odia, Punjabi, Sanskrit, Tamil, Telugu, Urdu. ' +
  'Candidate must appear in at least One Language. Candidate must appear in the Language s(he) has studied in Class XII. ' +
  'List B: Domain Specific Subjects. 1 Accountancy / Book Keeping; 2 Agriculture; 3 Anthropology; 4 Biology / Biological Science / Biotechnology / Biochemistry; 5 Business Studies; 6 Chemistry; ' +
  '7 Computer Science / Information Practices; 8 Economics / Business Economics; 9 Environmental Studies/Environmental Science; 10 Fine Arts / Visual Arts (Sculpture/Painting) /Commercial Arts; ' +
  '11 Geography / Geology; 12 History; 13 Home Science; 14 Knowledge Tradition and Practices in India; 15 Mass Media / Mass Communication; 16 Mathematics/ Applied Mathematics; ' +
  '17 Performing Arts (Dance, Drama, Music); 18 Physical Education (Yoga, Sports); 19 Physics; 20 Political Science; 21 Psychology; 22 Sociology. ' +
  'Candidate must refer to the Programme-Specific Eligibility to choose the Domain Specific subjects in which s(he) should appear in CUET (UG) - 2026. ' +
  'General Aptitude Test: General Aptitude Test is considered for admission in numerous programme in the University of Delhi. Candidate must refer to Programme Specific Eligibilities for details.';

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = () => new Date().toISOString();
try {
  const src = await db.prepare("SELECT id FROM admission_sources WHERE url = 'https://admission.uod.ac.in' AND status = 'APPROVED'").first<{ id: string }>();
  if (!src) throw new Error('The Delhi source is not approved');

  // 1. The lists fact: a DRAFT only.
  const have = await db.prepare("SELECT id FROM admission_facts WHERE university_slug = 'university-of-delhi' AND label LIKE 'CUET subject lists%'").first();
  let listsFact: unknown = 'already present';
  if (!have) {
    listsFact = await createFact(db, factInputSchema.parse({
      universityName: 'University of Delhi', sourceId: src.id, kind: 'ELIGIBILITY', exam: 'CUET_UG', year: 2026, checkedOn: '2026-11-16',
      label: 'CUET subject lists used in the programme rules (List A languages, List B subjects), as printed in the Bulletin of Information 2026-27',
      valueText: LISTS, sourcePage: 20, sourceLocator: `${BOI}, PDF p.20 / printed xvi`,
    }), 'claude-code:admissions-import-2026-11-16');
  }

  // 2. The four programmes and their facts: exactly seven, none flagged.
  const marks = NAMES.map(() => '?').join(',');
  const progs = (await db.prepare(`SELECT id, programme_name, status FROM admission_programmes WHERE university_slug = 'university-of-delhi' AND academic_year = '2026-27' AND programme_name IN (${marks})`).bind(...NAMES).all<{ id: string; programme_name: string; status: string }>()).results;
  if (progs.length !== 4) throw new Error(`Expected 4 programmes, found ${progs.length}`);
  if (progs.some((p) => p.status !== 'DRAFT')) throw new Error('A programme is not a draft; stopping');
  const ids = progs.map((p) => p.id);
  const facts = (await db.prepare(`SELECT id, kind, status, review_flag, programme_id FROM admission_facts WHERE programme_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ id: string; kind: string; status: string; review_flag: string | null }>()).results;
  if (facts.length !== 7 || facts.some((f) => f.status !== 'DRAFT' || f.review_flag)) throw new Error(`Expected 7 unflagged draft facts, found ${JSON.stringify(facts.map((f) => [f.kind, f.status, !!f.review_flag]))}`);

  for (const p of progs) await decideProgramme(db, p.id, { action: 'PUBLISH', reason: 'Approved by the CEO on 16 November 2026 as a 2026-27 historical admission reference, not CUET 2027 requirements' }, APPROVER);
  for (const f of facts) await decideFact(db, f.id, { action: 'PUBLISH' }, APPROVER);
  await db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), APPROVER, 'ADMISSIONS_PUBLISHED_LOCAL', 'UNIVERSITY', 'university-of-delhi', JSON.stringify({ programmes: progs.map((p) => p.programme_name), facts: facts.length, label: 'Previous admission cycle 2026-27, historical reference', environment: 'local only' }), now()).run();
  console.log(JSON.stringify({ listsFact, published: { programmes: progs.map((p) => p.programme_name), facts: facts.length } }, null, 1));
} finally {
  await dispose();
}
