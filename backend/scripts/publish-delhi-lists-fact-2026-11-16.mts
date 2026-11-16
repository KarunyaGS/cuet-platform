/**
 * One-off, local only (16 Nov 2026). Publishes the single Delhi University draft fact that holds the List A (languages) and List B
 * (subjects) lists, which the CEO approved after its wording was checked item by item against a fresh download of the bulletin
 * (page 20 / printed xvi: 14 languages, 22 subjects and 5 sentences, all identical). Refuses to run if the fact is not exactly one
 * unflagged draft.
 *   npx tsx scripts/publish-delhi-lists-fact-2026-11-16.mts
 */
import { getPlatformProxy } from 'wrangler';
import { decideFact } from '../src/services/admissions';
import { newId } from '../src/lib/hash';

const APPROVER = 'ceo-decision:2026-11-16';
const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
try {
  const { results } = await db.prepare("SELECT id, status, review_flag, source_page FROM admission_facts WHERE university_slug = 'university-of-delhi' AND label LIKE 'CUET subject lists%'").all<{ id: string; status: string; review_flag: string | null; source_page: number }>();
  if (results.length !== 1 || results[0]!.status !== 'DRAFT' || results[0]!.review_flag || results[0]!.source_page !== 20) throw new Error(`Expected exactly one unflagged draft on page 20, found ${JSON.stringify(results)}`);
  const id = results[0]!.id;
  await decideFact(db, id, { action: 'PUBLISH' }, APPROVER);
  await db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), APPROVER, 'ADMISSIONS_PUBLISHED_LOCAL', 'ADMISSION_FACT', id, JSON.stringify({ what: 'List A and List B, University of Delhi bulletin 2026-27, PDF p.20 / printed xvi', verified: 'fresh download, 14 languages, 22 subjects, 5 sentences identical', environment: 'local only' }), new Date().toISOString()).run();
  console.log(JSON.stringify({ published: id }));
} finally {
  await dispose();
}
