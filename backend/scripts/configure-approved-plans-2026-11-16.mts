/**
 * Local only (16 Nov 2026). Enters the approved price and usage-limit configuration (decisions 1 and 3) into the plans table.
 *  - Paid plans get their approved price and length but stay INACTIVE (decision 4: paid plans stay off until verified subject content
 *    is ready). Prices are GST-inclusive (decision 2); the GST rate, SAC code and invoice details are PENDING finance confirmation
 *    and are not stored anywhere.
 *  - The free plan gets its limits. This changes what free students can do, so run it on production only at launch, after the
 *    students have been told (decision 3). Existing cards and bookmarks are never removed.
 * Idempotent; every change is audited with its before and after values.
 *   npx tsx scripts/configure-approved-plans-2026-11-16.mts
 */
import { getPlatformProxy } from 'wrangler';
import { newId } from '../src/lib/hash';

const FREE = { practiceSets: 10, topicTests: 4, mockTests: 1, revisionCards: 25, bookmarks: 50 };
const PAID = { practiceSets: 300, topicTests: 60, mockTests: 12, revisionCards: null, bookmarks: null };
const WANT = [
  { code: 'FREE', price: 0, limits: FREE },
  { code: 'MONTHLY', price: 14900, limits: PAID },
  { code: 'QUARTERLY', price: 29900, limits: PAID },
  { code: 'YEARLY', price: 59900, limits: PAID },
];
const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = new Date().toISOString();
for (const w of WANT) {
  const cur = await db.prepare('SELECT id, price_paise, limits_json, active FROM plans WHERE code = ?').bind(w.code).first<{ id: string; price_paise: number; limits_json: string; active: number }>();
  if (!cur) throw new Error(`Plan ${w.code} not found`);
  const limitsJson = JSON.stringify(w.limits);
  if (cur.price_paise === w.price && cur.limits_json === limitsJson) { console.log(w.code, 'already configured'); continue; }
  await db.batch([
    db.prepare('UPDATE plans SET price_paise = ?, limits_json = ?, updated_at = ? WHERE id = ?').bind(w.price, limitsJson, now, cur.id),
    db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), 'ceo-decision:2026-11-16', 'PLAN_CONFIGURED_APPROVED', 'PLAN', cur.id, JSON.stringify({ code: w.code, before: { pricePaise: cur.price_paise, limitsJson: cur.limits_json, active: !!cur.active }, after: { pricePaise: w.price, limitsJson, active: !!cur.active } }), now),
  ]);
  console.log(w.code, 'configured:', w.price, limitsJson, 'active unchanged =', !!cur.active);
}
await dispose();
