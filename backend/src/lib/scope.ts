/**
 * What is ACTIVE for students (decision of 16 Nov 2026): only CUET UG, and within it only the science-focused papers.
 *
 * This is a visibility rule applied when lists are built for students. It never changes, hides or deletes a record: CUET-PG, the other
 * CUET-UG papers and all their lessons, questions, papers and student data stay exactly where they are, and administrators still see them.
 *
 * Two settings (wrangler vars). Unset means "everything", which is what the test suite uses unless a test sets them:
 *   ACTIVE_EXAMS      e.g. "CUET_UG"      exams students can see
 *   CATALOGUE_SCOPE   "ug-science"        only the NTA papers below are listed for CUET UG
 *
 * NTA's own paper codes (verified against the stored official syllabus and answer-key records, 2026):
 *   322 Physics                                              306 Chemistry
 *   319 Mathematics / Applied Mathematics                    304 Biology / Biological Studies / Biotechnology / Biochemistry
 *   313 Geography / Geology                                  308 Computer Science / Informatics Practices
 *   501 General Aptitude Test (a separate CUET UG paper, Section III)
 * NTA runs 304, 313 and 308 as ONE combined paper each. There is no NTA CUET-UG paper called Botany, Zoology or Geology alone, and
 * Computer Science is not offered apart from Informatics Practices. Those papers are listed under NTA's own names, not split or renamed.
 */
import type { Bindings } from '../types';

export const UG_SCIENCE_PAPER_CODES: readonly string[] = ['322', '306', '319', '304', '313', '308', '501'];

type ScopeEnv = Pick<Bindings, 'ACTIVE_EXAMS' | 'CATALOGUE_SCOPE'>;
export const activeExams = (env: ScopeEnv): string[] => (env.ACTIVE_EXAMS ? env.ACTIVE_EXAMS.split(',').map((s) => s.trim()).filter(Boolean) : ['CUET_UG', 'CUET_PG']);
export const examActive = (env: ScopeEnv, exam: string) => activeExams(env).includes(exam);
export const scienceOnly = (env: ScopeEnv) => env.CATALOGUE_SCOPE === 'ug-science';

/** Is this exam (and, when known, this paper code) shown to students? A missing code means "not about one subject" and follows the exam. */
export function paperInScope(env: ScopeEnv, exam: string, code: string | null | undefined): boolean {
  if (!examActive(env, exam)) return false;
  if (!scienceOnly(env) || exam !== 'CUET_UG' || code === null || code === undefined) return true;
  return UG_SCIENCE_PAPER_CODES.includes(code);
}

export type Keep = (exam: string, code: string | null) => boolean;
export const keeper = (env: ScopeEnv): Keep => (exam, code) => paperInScope(env, exam, code);

type InfoSection = { key: string; title: string; items: { text: string; source: string | null; page: number | null; note: string | null }[] };

/**
 * The official exam-information page for CUET UG, kept to the active catalogue: NTA's whole-exam figures ("37 subjects", "13 languages")
 * and its lists of languages and non-science subjects are not shown. Everything else NTA says stays word for word, and the stored
 * records are not changed. The one added line names the papers students can use here, with NTA's own paper names.
 */
export function scopeInfoSections<T extends InfoSection>(env: ScopeEnv, exam: string, sections: T[], papers: { code: string; name: string }[]): T[] {
  if (!scienceOnly(env) || exam !== 'CUET_UG') return sections;
  const listed = papers.filter((p) => UG_SCIENCE_PAPER_CODES.includes(p.code)).sort((a, b) => a.code.localeCompare(b.code)).map((p) => `${p.code} ${p.name}`);
  return sections.map((s) => {
    if (s.key === 'pattern') return { ...s, items: s.items.filter((i) => !/\b37 subjects\b|\b13 languages\b|language test/i.test(i.text)) };
    if (s.key === 'subjects') {
      const kept = s.items.filter((i) => /General Aptitude|NCERT syllabus|syllabus PDFs/i.test(i.text));
      const own = { text: `Papers covered on this site (${listed.length}): ${listed.join('; ')}.`, source: null, page: null, note: 'Paper names and codes as published by NTA. CUET Prep covers the science-focused papers and the General Aptitude Test.' };
      return { ...s, items: [own, ...kept] };
    }
    return s;
  });
}
