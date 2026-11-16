/**
 * One-off, local only (16 Nov 2026). Corrects the PDF page cited on three groups of DRAFT admission facts that were loaded the same day,
 * where the eligibility text starts on a different page from the one first recorded:
 *   - Delhi B.Sc. (Hons.) Mathematics: the heading is at the foot of PDF p.39, the requirement text is on PDF p.40.
 *   - Delhi B.A. (Hons.) English: the text runs from PDF p.22 to p.23.
 *   - BHU B.Tech. Dairy Technology (UG0193): eligibility is on PDF p.23, the age limit and CUET papers are on p.24.
 * Only source_page, source_locator and updated_at of those draft rows change; the before and after values are printed and audited.
 *   npx tsx scripts/correct-page-references-2026-11-16.mts
 */
import { getPlatformProxy } from 'wrangler';
import { newId } from '../src/lib/hash';

const BOI = 'Bulletin of Information UG 2026-27 (https://www.du.ac.in/uploads/2026/06012026_BOI_UG_2026_27_compressed.pdf)';
const BHU = 'UG Information Bulletin 2026-27, FINAL DRAFT 23032026 (https://storage.bhu.ac.in/strapi-media/uploads/FINAL_DRAFT_BHU_UG_2026_Information_Bulletin_23032026_b86ed3fbb0.pdf)';
const fixes = [
  { slug: 'university-of-delhi', name: 'B.Sc. (Hons.) Mathematics', kind: null, page: 40, locator: `${BOI}, PDF p.40 / printed p.20 (the programme-specific eligibility heading is at the foot of PDF p.39 / printed p.19)` },
  { slug: 'university-of-delhi', name: 'B.A. (Hons.) English', kind: null, page: 22, locator: `${BOI}, PDF pp.22-23 / printed pp.2-3` },
  { slug: 'banaras-hindu-university', name: 'Bachelor of Technology in Dairy Technology (UG0193)', kind: 'ELIGIBILITY', page: 23, locator: `${BHU}, PDF pp.23-24 (eligibility on p.23, age limit on p.24)` },
  { slug: 'banaras-hindu-university', name: 'Bachelor of Technology in Dairy Technology (UG0193)', kind: 'SUBJECTS', page: 24, locator: `${BHU}, PDF p.24` },
];
const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>({ configPath: new URL('../wrangler.jsonc', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') });
const db = env.DB;
const now = new Date().toISOString();
const report: unknown[] = [];
try {
  for (const f of fixes) {
    const prog = await db.prepare('SELECT id FROM admission_programmes WHERE university_slug = ? AND programme_name = ?').bind(f.slug, f.name).first<{ id: string }>();
    if (!prog) throw new Error(`No programme ${f.name}`);
    const { results } = await db.prepare(`SELECT id, kind, status, source_page, source_locator FROM admission_facts WHERE programme_id = ? ${f.kind ? 'AND kind = ?' : ''}`).bind(...(f.kind ? [prog.id, f.kind] : [prog.id])).all<{ id: string; kind: string; status: string; source_page: number; source_locator: string }>();
    for (const r of results) {
      if (r.status !== 'DRAFT') throw new Error(`${f.name} ${r.kind} is ${r.status}, not DRAFT; refusing to change it`);
      await db.prepare('UPDATE admission_facts SET source_page = ?, source_locator = ?, updated_at = ? WHERE id = ? AND status = ?').bind(f.page, f.locator.slice(0, 300), now, r.id, 'DRAFT').run();
      report.push({ programme: f.name, kind: r.kind, pageBefore: r.source_page, pageAfter: f.page });
    }
  }
  await db.prepare('INSERT INTO audit_logs (id, actor, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(newId('aud'), 'claude-code:admissions-import-2026-11-16', 'ADMISSION_PAGE_REFERENCES_CORRECTED', 'ADMISSION_FACT', 'batch', JSON.stringify(report), now).run();
  console.log(JSON.stringify(report, null, 1));
} finally {
  await dispose();
}
