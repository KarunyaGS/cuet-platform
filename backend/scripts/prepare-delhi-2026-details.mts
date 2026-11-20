/**
 * Prepare source-linked DU 2026-27 process and sample allocation-score facts as local DRAFTs.
 *
 * Dry-run by default. `--write-local` inserts only missing draft facts into Wrangler's LOCAL D1 database.
 * This script never approves sources, publishes facts, or accepts a remote database configuration.
 * Run from `backend/`: npx tsx scripts/prepare-delhi-2026-details.mts [--write-local]
 */
import { getPlatformProxy } from 'wrangler';
import { factInputSchema, importFacts, type FactInput } from '../src/services/admissions';
import { newId } from '../src/lib/hash';

const WRITE_LOCAL = process.argv.includes('--write-local');
const CHECKED_ON = '2026-11-20';
const UNIVERSITY = 'University of Delhi';
const FAQ = 'https://admission.uod.ac.in/userfiles/downloads/2026/17052026_Updated_FAQsUG%202026-final.pdf';
const ROUND_III = 'https://admission.uod.ac.in/userfiles/downloads/2026/09082026_Minimum_Allocation_Score_RoundThree.pdf';
const SPOT = 'https://admission.uod.ac.in/userfiles/downloads/27-08-2026CutOff_UG_SpotRound.pdf';

const processFacts: Array<{ programme: string; kind: 'PROCEDURE' | 'COUNSELLING'; label: string; valueText: string; locator: string; page: number | null }> = [];
const programmeNames = [
  'B.A. (Hons.) Economics',
  'B.Com. (Hons.)',
  'B.Sc. (Hons.) Mathematics',
  'B.Sc. (Hons.) Physics',
];

for (const programme of programmeNames) {
  processFacts.push({
    programme, kind: 'PROCEDURE', label: 'DU application path · 2026–27',
    valueText: 'DU required a CUET (UG) application and a separate DU CSAS (UG) application. In CSAS, applicants entered their programme and college preferences. DU used CUET scores for merit; Class XII marks were used for minimum eligibility and tie-breaking.',
    locator: `Updated DU UG FAQ 2026–27, Questions 11, 16 and 27 (${FAQ})`, page: 3,
  });
  processFacts.push({
    programme, kind: 'COUNSELLING', label: 'CSAS allocation rounds · 2026–27',
    valueText: 'DU published separate CSAS allocation and admission notices for each round, including upgraded and spot rounds. Allocation depended on programme eligibility, merit, category and seat availability. Round scores are independent references; follow the notice for the exact round and action dates.',
    locator: `DU UG Admissions 2026–27 official notices and revised CSAS schedules (https://admission.uod.ac.in/)`, page: null,
  });
}

const cutoffs = [
  { programme: 'B.A. (Hons.) Economics', college: 'Ramjas College', round: 'Round III', score: 807.1652, url: ROUND_III, page: 23 },
  { programme: 'B.Com. (Hons.)', college: 'Ramjas College', round: 'Round III', score: 889.7461, url: ROUND_III, page: 23 },
  { programme: 'B.Sc. (Hons.) Mathematics', college: 'Ramjas College', round: 'Round III', score: 715.7681, url: ROUND_III, page: 23 },
  { programme: 'B.Sc. (Hons.) Physics', college: 'Ramjas College', round: 'Round III', score: 446.2456, url: ROUND_III, page: 23 },
  { programme: 'B.A. (Hons.) Economics', college: 'Ramjas College', round: 'Spot round', score: 802.757, url: SPOT, page: 22 },
  { programme: 'B.Com. (Hons.)', college: 'Ramjas College', round: 'Spot round', score: 878.8513, url: SPOT, page: 22 },
  { programme: 'B.Sc. (Hons.) Mathematics', college: 'Ramjas College', round: 'Spot round', score: 700.0825, url: SPOT, page: 22 },
  { programme: 'B.Sc. (Hons.) Physics', college: 'Ramjas College', round: 'Spot round', score: 443.5761, url: SPOT, page: 22 },
];

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
try {
  const db = env.DB;
  const source = await db.prepare(`SELECT id FROM admission_sources WHERE url = 'https://admission.uod.ac.in' AND status = 'APPROVED'`).first<{ id: string }>();
  if (!source) throw new Error('The approved University of Delhi source is missing locally. No records were written.');

  const programmes = await db.prepare(`SELECT id, programme_name FROM admission_programmes WHERE university_slug = 'university-of-delhi' AND academic_year = '2026-27' AND exam_code = 'CUET_UG' AND status = 'PUBLISHED'`).all<{ id: string; programme_name: string }>();
  const idByName = new Map(programmes.results.map((p) => [p.programme_name, p.id]));
  for (const name of programmeNames) if (!idByName.has(name)) throw new Error(`Published programme not found: ${name}. No records were written.`);

  const facts: FactInput[] = [];
  for (const item of processFacts) {
    facts.push(factInputSchema.parse({
      universityName: UNIVERSITY, sourceId: source.id, kind: item.kind, exam: 'CUET_UG', year: 2026,
      programme: item.programme, programmeId: idByName.get(item.programme), label: item.label, valueText: item.valueText,
      sourcePage: item.page, sourceLocator: item.locator, checkedOn: CHECKED_ON,
    }));
  }
  for (const item of cutoffs) {
    facts.push(factInputSchema.parse({
      universityName: UNIVERSITY, sourceId: source.id, kind: 'CUTOFF', exam: 'CUET_UG', year: 2026,
      programme: item.programme, programmeId: idByName.get(item.programme), label: `${item.college} · minimum allocation score`,
      valueNumber: item.score, basis: 'ALLOCATION_SCORE', category: 'UR', round: item.round,
      sourcePage: item.page, sourceLocator: `DU UG Admissions 2026–27 · ${item.round} minimum allocation score · ${item.college}, ${item.programme} (${item.url})`,
      checkedOn: CHECKED_ON,
    }));
  }

  const pending: FactInput[] = [];
  for (const fact of facts) {
    const existing = await db.prepare(`SELECT 1 FROM admission_facts WHERE programme_id = ? AND kind = ? AND cycle_year = ? AND label = ? AND COALESCE(round, '') = COALESCE(?, '') AND COALESCE(value_number, -1) = COALESCE(?, -1) LIMIT 1`)
      .bind(fact.programmeId ?? null, fact.kind, fact.year, fact.label, fact.round ?? null, fact.valueNumber ?? null).first();
    if (!existing) pending.push(fact);
  }
  const dry = pending.length
    ? await importFacts(db, { facts: pending }, 'script:du-2026-admissions-draft-import', true)
    : { outcome: 'NOOP', facts: 0 };
  console.log(JSON.stringify({ mode: WRITE_LOCAL ? 'LOCAL DRAFT IMPORT' : 'DRY RUN', proposed: facts.length, alreadyPresent: facts.length - pending.length, toAdd: pending.length, validation: dry, cutoffNote: 'Only the UR (first score column) Ramjas College rows are included; they are historical examples, not guarantees.' }, null, 2));
  if (WRITE_LOCAL && pending.length) {
    const added = await importFacts(db, { facts: pending }, 'script:du-2026-admissions-draft-import', false);
    const byKind = Object.fromEntries(['PROCEDURE', 'COUNSELLING', 'CUTOFF'].map((kind) => [kind, pending.filter((fact) => fact.kind === kind).length]));
    await db.prepare(`INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(newId('aud'), 'script:du-2026-admissions-draft-import', 'ADMISSION_FACTS_DRAFT_IMPORTED', 'UNIVERSITY', 'university-of-delhi', JSON.stringify({ added: pending.length, byKind, cycle: '2026-27', status: 'DRAFT', source: 'https://admission.uod.ac.in' }), new Date().toISOString()).run();
    console.log('Inserted facts as DRAFT; none were approved or published:', JSON.stringify(added));
  }
} finally {
  await dispose();
}
