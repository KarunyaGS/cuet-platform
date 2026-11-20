/**
 * CUET (UG) subject identity for admission requirements.
 *
 * A university writes a required subject in its own words ("Biology/Biological Studies/ Biotechnology/ Biochemistry", "Computer
 * Science/Informatics Practices", "Accountancy/Book Keeping"). NTA's papers have fixed names and codes. This module gives every NTA CUET (UG)
 * paper one canonical identifier and resolves a university's wording to it, or says it cannot.
 *
 * Pure code: no database, no network. Nothing here is stored or published; a mapping reaches students only after a person confirms it.
 *
 * Rules:
 *  - A name is MAPPED only when it matches one paper's official name or a listed alias. It is never guessed from similarity.
 *  - A name that could mean two things is AMBIGUOUS and is never mapped automatically (for example "Sanskrit" in a language list:
 *    NTA's paper 325 is a domain subject, so the university's language "Sanskrit" is not the same thing without a person checking).
 *  - A paper code printed beside a name is used as a cross-check. If the name and the code disagree the result is a conflict, not a choice.
 *  - Anything else is UNKNOWN.
 */

export type PaperCategory = 'LANGUAGE' | 'DOMAIN' | 'GAT';

export interface CuetPaper {
  /** Canonical identifier, stable across years. */
  id: string;
  /** NTA paper code for CUET (UG) 2026. */
  code: string;
  /** NTA's name, as printed in the 2026 paper list. */
  name: string;
  category: PaperCategory;
  /** Other wording found in university documents that means this whole paper. Matched after normalisation. */
  aliases: string[];
  /**
   * Wording that names only one part of a combined paper ("Biotechnology" is a part of paper 304). These map, but are reported
   * separately so a person can confirm that the university means the whole paper.
   */
  partNames: string[];
}

/**
 * The 37 CUET (UG) 2026 papers. Source: `content-ingestion/registry/cuet-2026-official-papers.json` (NTA's list, 12 Nov 2026).
 * A test checks that this table and that file agree, so the two cannot drift apart silently.
 */
export const CUET_UG_PAPERS: readonly CuetPaper[] = [
  { id: 'english', code: '101', name: 'English', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'hindi', code: '102', name: 'Hindi', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'assamese', code: '103', name: 'Assamese', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'bengali', code: '104', name: 'Bengali', category: 'LANGUAGE', aliases: ['Bangla'], partNames: [] },
  { id: 'gujarati', code: '105', name: 'Gujarati', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'kannada', code: '106', name: 'Kannada', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'malayalam', code: '107', name: 'Malayalam', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'marathi', code: '108', name: 'Marathi', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'odia', code: '109', name: 'Odia', category: 'LANGUAGE', aliases: ['Oriya'], partNames: [] },
  { id: 'punjabi', code: '110', name: 'Punjabi', category: 'LANGUAGE', aliases: ['Panjabi'], partNames: [] },
  { id: 'tamil', code: '111', name: 'Tamil', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'telugu', code: '112', name: 'Telugu', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'urdu', code: '113', name: 'Urdu', category: 'LANGUAGE', aliases: [], partNames: [] },
  { id: 'accountancy-book-keeping', code: '301', name: 'Accountancy / Book-Keeping', category: 'DOMAIN', aliases: ['Accountancy/Book Keeping', 'Accountancy/Bookkeeping'], partNames: ['Accountancy', 'Book Keeping', 'Bookkeeping'] },
  { id: 'agriculture', code: '302', name: 'Agriculture', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'anthropology', code: '303', name: 'Anthropology', category: 'DOMAIN', aliases: [], partNames: [] },
  {
    id: 'biology', code: '304', name: 'Biology/ Biological Science/ Biotechnology /Biochemistry', category: 'DOMAIN',
    aliases: ['Biology/Biological Studies/Biotechnology/Biochemistry'],
    partNames: ['Biology', 'Biological Science', 'Biological Studies', 'Biotechnology', 'Biochemistry'],
  },
  { id: 'business-studies', code: '305', name: 'Business Studies', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'chemistry', code: '306', name: 'Chemistry', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'environmental-science', code: '307', name: 'Environmental Science', category: 'DOMAIN', aliases: ['Environmental Studies/Environmental Science'], partNames: ['Environmental Studies'] },
  {
    id: 'computer-science-informatics-practices', code: '308', name: 'Computer Science / Information Practices', category: 'DOMAIN',
    aliases: ['Computer Science/Informatics Practices'], partNames: ['Computer Science', 'Informatics Practices', 'Information Practices'],
  },
  { id: 'economics-business-economics', code: '309', name: 'Economics / Business Economics', category: 'DOMAIN', aliases: [], partNames: ['Economics', 'Business Economics'] },
  { id: 'fine-arts-visual-arts', code: '312', name: 'Fine Arts/Visual Arts/Commercial Arts', category: 'DOMAIN', aliases: ['Fine Arts/Visual Arts'], partNames: ['Fine Arts', 'Visual Arts', 'Commercial Arts'] },
  { id: 'geography-geology', code: '313', name: 'Geography / Geology', category: 'DOMAIN', aliases: [], partNames: ['Geography', 'Geology'] },
  { id: 'history', code: '314', name: 'History', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'home-science', code: '315', name: 'Home Science', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'knowledge-tradition-practices-india', code: '316', name: 'Knowledge Tradition-Practices in India', category: 'DOMAIN', aliases: ['Knowledge Tradition and Practices in India'], partNames: [] },
  { id: 'mass-media-mass-communication', code: '318', name: 'Mass Media / Mass Communication', category: 'DOMAIN', aliases: [], partNames: ['Mass Media', 'Mass Communication'] },
  { id: 'mathematics-applied-mathematics', code: '319', name: 'Mathematics / Applied Mathematics', category: 'DOMAIN', aliases: [], partNames: ['Mathematics', 'Applied Mathematics', 'Maths'] },
  { id: 'performing-arts', code: '320', name: 'Performing Arts - (Dance, Drama and Music)', category: 'DOMAIN', aliases: [], partNames: ['Dance', 'Drama', 'Music'] },
  { id: 'physical-education', code: '321', name: 'Physical Education (Yoga, Sports)', category: 'DOMAIN', aliases: ['Physical Education/Yoga/Sports'], partNames: [] },
  { id: 'physics', code: '322', name: 'Physics', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'political-science', code: '323', name: 'Political Science', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'psychology', code: '324', name: 'Psychology', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'sanskrit', code: '325', name: 'Sanskrit', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'sociology', code: '326', name: 'Sociology', category: 'DOMAIN', aliases: [], partNames: [] },
  { id: 'general-aptitude-test', code: '501', name: 'General Aptitude Test', category: 'GAT', aliases: ['GAT', 'General Test'], partNames: [] },
];

export const paperByCode = (code: string): CuetPaper | undefined => CUET_UG_PAPERS.find((p) => p.code === code);
export const paperById = (id: string): CuetPaper | undefined => CUET_UG_PAPERS.find((p) => p.id === id);

/** A group a university names but does not list in the same sentence ("List A", "List B"). Its members come from the university's own bulletin. */
export type GroupId = 'LIST_A' | 'LIST_B';

export type SubjectBasis = 'OFFICIAL_NAME' | 'ALIAS' | 'PART_OF_COMBINED_PAPER' | 'PAPER_CODE';

export type SubjectRef =
  | { status: 'MAPPED'; text: string; subjectId: string; paperCode: string; basis: SubjectBasis; note?: string }
  | { status: 'AMBIGUOUS'; text: string; candidates: string[]; reason: string }
  | { status: 'CONFLICT'; text: string; nameSubjectId: string; codeSubjectId: string; reason: string }
  | { status: 'UNKNOWN'; text: string };

/** Lower case, one spacing, no punctuation noise. Parentheses are removed here and returned separately (they hold specialisations). */
export function normaliseName(raw: string): { name: string; qualifier: string | null } {
  let s = raw.replace(/\s+/g, ' ').trim();
  const qualifiers: string[] = [];
  s = s.replace(/\(([^()]*)\)/g, (_m, q: string) => (qualifiers.push(q.trim()), ' '));
  s = s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[–—‐-]/g, ' ')
    .replace(/[.,;:]/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/^(subject|language) test\b\s*/, '')
    .trim();
  return { name: s, qualifier: qualifiers.length ? qualifiers.join('; ') : null };
}

interface AliasEntry { id: string; basis: SubjectBasis; note?: string }
const index = new Map<string, AliasEntry[]>();
function addAlias(raw: string, entry: AliasEntry) {
  const key = normaliseName(raw).name;
  const list = index.get(key) ?? [];
  if (!list.some((e) => e.id === entry.id)) list.push(entry);
  index.set(key, list);
}
for (const p of CUET_UG_PAPERS) {
  addAlias(p.name, { id: p.id, basis: 'OFFICIAL_NAME' });
  for (const a of p.aliases) addAlias(a, { id: p.id, basis: 'ALIAS', note: 'Wording differs from NTA\'s paper name' });
  for (const a of p.partNames) addAlias(a, { id: p.id, basis: 'PART_OF_COMBINED_PAPER', note: `Names one part of NTA paper ${p.code} (${p.name}); confirm the university means the whole paper` });
}

/**
 * Names that mean one thing in NTA's list and may mean another where the university uses them. They are never mapped without a person.
 * "Sanskrit" in a language list ("Sanskrit from List A") is a language of the university's List A, but NTA offers Sanskrit as a domain subject (325).
 */
const AMBIGUOUS_IN_GROUP: Record<string, { group: GroupId; reason: string }> = {
  sanskrit: { group: 'LIST_A', reason: 'Named in a language list (List A) but NTA offers Sanskrit as a domain paper (325). The university\'s List A must be checked before this is mapped.' },
};

export interface ResolveContext {
  /** The paper code printed beside the name, if any. */
  code?: string | null;
  /** The group the university printed the name under ("... from List A"). */
  group?: GroupId | null;
}

export function resolveSubject(text: string, ctx: ResolveContext = {}): SubjectRef {
  const { name, qualifier } = normaliseName(text);
  const printed = text.replace(/\s+/g, ' ').trim();
  const byCode = ctx.code ? paperByCode(ctx.code) : undefined;
  if (ctx.code && !byCode) return { status: 'UNKNOWN', text: printed };

  const ambiguous = AMBIGUOUS_IN_GROUP[name];
  if (ambiguous && ctx.group === ambiguous.group && !byCode) {
    const candidate = index.get(name)?.map((e) => e.id) ?? [];
    return { status: 'AMBIGUOUS', text: printed, candidates: [...candidate, 'language-in-university-list'], reason: ambiguous.reason };
  }

  const hits = index.get(name);
  if (hits && hits.length > 1) {
    return { status: 'AMBIGUOUS', text: printed, candidates: hits.map((h) => h.id), reason: 'The name belongs to more than one paper' };
  }
  const hit = hits?.[0];

  if (byCode) {
    if (hit && hit.id !== byCode.id) {
      return { status: 'CONFLICT', text: printed, nameSubjectId: hit.id, codeSubjectId: byCode.id, reason: `The name points to one paper and the printed code ${byCode.code} to another` };
    }
    if (!hit) {
      // A code with a name that is not in our list: the code is NTA's own identifier, so it is used, and the unfamiliar wording is reported.
      return { status: 'MAPPED', text: printed, subjectId: byCode.id, paperCode: byCode.code, basis: 'PAPER_CODE', note: `Name "${printed}" is not a known alias; mapped by the printed paper code${qualifier ? `; specialisation as printed: ${qualifier}` : ''}` };
    }
    // Name and printed code agree, so the university has said which paper it means (even when the name is only one part of a combined paper).
    return { status: 'MAPPED', text: printed, subjectId: byCode.id, paperCode: byCode.code, basis: 'PAPER_CODE', note: qualifier ? `Specialisation as printed: ${qualifier}` : undefined };
  }

  if (!hit) return { status: 'UNKNOWN', text: printed };
  const paper = paperById(hit.id)!;
  return {
    status: 'MAPPED', text: printed, subjectId: paper.id, paperCode: paper.code, basis: hit.basis,
    note: [hit.note, qualifier ? `Specialisation as printed: ${qualifier}` : null].filter(Boolean).join('. ') || undefined,
  };
}
