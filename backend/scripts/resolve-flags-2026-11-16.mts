/**
 * One-off, local only (16 Nov 2026). Applies the flag resolutions the CEO asked for, to DRAFT facts only:
 *  - JNU: the 10 B.A. (Hons.) language facts and the 6 COP language facts held an extract of the eligibility text. They now hold the
 *    complete wording from the prospectus (pp.10-12), taken from the eligibility column of the PDF, and their flag is cleared.
 *  - BHU: every flag is narrowed to what is still true. The tie-break year is resolved by two official documents (bulletin p.21 and
 *    the CAP UG 2026 document, section 11); the B.Voc duration conflict does not apply to any held programme (no B.Voc programme is held).
 *    The "papers listed without any/all" question and the draft status of the bulletin stay flagged.
 * Nothing is published. Every change is audited with its before and after values.
 *   npx tsx scripts/resolve-flags-2026-11-16.mts <jnu-ug-elig-columns.json>
 */
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { factProblems, factInputSchema } from '../src/services/admissions';
import { newId } from '../src/lib/hash';

const cols = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Record<string, string>;
const CLAUSE_I = '(i) Senior School Certificate (10+2) or equivalent examination from a recognised Board/University with minimum of 45% marks. The candidates who are due to appear in Senior School Certificate (10+2) or equivalent examination are eligible to apply.';
const BA_FULL = `${CLAUSE_I} ${cols['11']!.trim()}`;
const COP_A_FULL = "At least Senior School Certificate (10+2) or an examination recognized as equivalent thereto with a minimum of 45% marks in aggregate. Candidates who have obtained their Higher Secondary Certificate under the 10+1 pattern of education will be eligible for admission to the COP programmes if they have successfully completed the First-Year of Bachelor's degree examination of a University under 10+1+3 pattern of education with the prescribed percentage of marks, i.e., 45%.";
const BHU_COMMON = "The only source is BHU's UG bulletin, which is a draft ('FINAL DRAFT'); no second BHU document repeats this text and no final bulletin is published. Resolved 16 Nov 2026: the tie-break year (the bulletin body and BHU's CAP UG 2026 section 11 both say 2026). Not applicable: the B.Voc duration conflict (no B.Voc programme is held).";
const BHU_SUBJECTS = `${BHU_COMMON} Still to verify: whether all or any of the listed papers are required (CAP UG 2026 says only "test paper(s) required for registered course").`;
if (BHU_COMMON.length > 500 || BHU_SUBJECTS.length > 500) throw new Error(`BHU flag too long: ${BHU_COMMON.length}, ${BHU_SUBJECTS.length}`);

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = new Date().toISOString();
const log: Record<string, unknown>[] = [];
try {
  // 1. JNU full text
  const jnu = (await db.prepare(`SELECT f.id, f.status, f.review_flag, f.value_text, p.programme_name FROM admission_facts f JOIN admission_programmes p ON p.id = f.programme_id
                                  WHERE f.university_slug = 'jawaharlal-nehru-university' AND f.kind = 'ELIGIBILITY' AND f.review_flag IS NOT NULL`).all<{ id: string; status: string; review_flag: string; value_text: string; programme_name: string }>()).results;
  if (jnu.length !== 16) throw new Error(`Expected 16 flagged JNU eligibility facts, found ${jnu.length}`);
  for (const r of jnu) {
    if (r.status !== 'DRAFT') throw new Error(`${r.programme_name} is ${r.status}, not DRAFT`);
    const text = r.programme_name.startsWith('B.A. (Hons.)') ? BA_FULL : r.programme_name.startsWith('Certificate of Proficiency') ? COP_A_FULL : null;
    if (!text) throw new Error(`Unexpected programme ${r.programme_name}`);
    const probe = factProblems(factInputSchema.parse({ universityName: 'Jawaharlal Nehru University', sourceId: 'x', kind: 'ELIGIBILITY', exam: 'CUET_UG', year: 2026, checkedOn: '2026-11-16', label: 'Eligibility', valueText: text, sourcePage: 10, programmeId: 'x' }));
    if (probe.length) throw new Error(`${r.programme_name}: ${probe.join('; ')}`);
    const locator = r.programme_name.startsWith('B.A.') ? 'e-Prospectus for UG & COP Programmes 2026-27 (https://jnuee.jnu.ac.in/2026/e-Prospectus for UG programme 2026-27.pdf), PDF pp.10-11' : 'e-Prospectus for UG & COP Programmes 2026-27 (https://jnuee.jnu.ac.in/2026/e-Prospectus for UG programme 2026-27.pdf), PDF p.12';
    await db.prepare("UPDATE admission_facts SET value_text = ?, review_flag = NULL, source_locator = ?, label = 'Eligibility, complete wording as printed in the e-Prospectus', updated_at = ? WHERE id = ? AND status = 'DRAFT'").bind(text, locator, now, r.id).run();
    log.push({ programme: r.programme_name, change: 'full eligibility text', charsBefore: r.value_text.length, charsAfter: text.length, flagCleared: r.review_flag.slice(0, 60) });
  }
  // 2. BHU flags narrowed
  const bhu = (await db.prepare("SELECT id, kind, status, review_flag FROM admission_facts WHERE university_slug = 'banaras-hindu-university' AND review_flag IS NOT NULL").all<{ id: string; kind: string; status: string; review_flag: string }>()).results;
  if (bhu.length !== 22) throw new Error(`Expected 22 flagged BHU facts, found ${bhu.length}`);
  for (const r of bhu) {
    if (r.status !== 'DRAFT') throw new Error(`BHU fact ${r.id} is ${r.status}`);
    await db.prepare("UPDATE admission_facts SET review_flag = ?, updated_at = ? WHERE id = ? AND status = 'DRAFT'").bind(r.kind === 'SUBJECTS' ? BHU_SUBJECTS : BHU_COMMON, now, r.id).run();
    log.push({ bhuFact: r.id, kind: r.kind, flagBefore: r.review_flag.slice(0, 70), flagAfter: (r.kind === 'SUBJECTS' ? BHU_SUBJECTS : BHU_COMMON).slice(0, 70) });
  }
  await db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId('aud'), 'ceo-decision:2026-11-16', 'ADMISSION_FLAGS_RESOLVED', 'ADMISSION_FACT', 'batch', JSON.stringify({ jnuFullText: jnu.length, bhuFlagsNarrowed: bhu.length, stillDraft: true, entries: log }), now).run();
  console.log(JSON.stringify({ jnuFactsUpdated: jnu.length, bhuFlagsNarrowed: bhu.length, baChars: BA_FULL.length, copChars: COP_A_FULL.length }, null, 1));
} finally {
  await dispose();
}
