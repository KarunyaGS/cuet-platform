import { describe, expect, it } from 'vitest';
import pack from '../../docs/admissions-import-2026-11-16/pack.json';
import registry from '../../content-ingestion/registry/cuet-2026-official-papers.json';
import { parseRule as frontendParse } from '../../frontend/src/subject-rule';
import { describeRule, parseRequirementText, type Requirement } from '../src/services/admission-requirements';
import { CUET_UG_PAPERS, normaliseName, paperByCode, resolveSubject } from '../src/services/admission-subjects';

const DU = (combos: string, tail = 'Merit will be based on the best CUET score obtained from any of the above-mentioned combinations of subjects.') =>
  `Candidates must appear in CUET in any of the following subject combinations: ${combos} ${tail}`;

describe('canonical CUET (UG) subjects', () => {
  it('has one identifier and one code per paper, and agrees with NTA\'s 2026 paper list in the repository', () => {
    expect(new Set(CUET_UG_PAPERS.map((p) => p.id)).size).toBe(CUET_UG_PAPERS.length);
    expect(new Set(CUET_UG_PAPERS.map((p) => p.code)).size).toBe(CUET_UG_PAPERS.length);
    const official = (registry as { papers: { code: string; name: string; categoryCode: string; exam?: string }[] }).papers.filter((p) => /^(1\d\d|3\d\d|501)$/.test(p.code));
    expect(official.map((p) => [p.code, p.name]).sort()).toEqual(CUET_UG_PAPERS.map((p) => [p.code, p.name]).sort());
  });

  it('maps each official paper name to its own paper', () => {
    for (const p of CUET_UG_PAPERS) {
      const r = resolveSubject(p.name);
      expect(r).toMatchObject({ status: 'MAPPED', subjectId: p.id, paperCode: p.code, basis: 'OFFICIAL_NAME' });
    }
  });

  it('normalises spacing, punctuation and brackets, and keeps what was in the brackets', () => {
    expect(normaliseName('Accountancy / Book-Keeping').name).toBe('accountancy/book keeping');
    expect(normaliseName('Mathematics/ Applied Mathematics').name).toBe('mathematics/applied mathematics');
    expect(normaliseName('Fine Arts / Visual Arts (Sculpture/Painting)')).toEqual({ name: 'fine arts/visual arts', qualifier: 'Sculpture/Painting' });
    expect(normaliseName('Subject Test - Chemistry').name).toBe('chemistry');
  });
});

describe('subject aliases', () => {
  it('maps the wording universities really use to NTA papers', () => {
    expect(resolveSubject('Biology/Biological Studies/ Biotechnology/ Biochemistry')).toMatchObject({ status: 'MAPPED', subjectId: 'biology', paperCode: '304', basis: 'ALIAS' });
    expect(resolveSubject('Biology/ Biological Science/ Biotechnology/ Biochemistry')).toMatchObject({ status: 'MAPPED', paperCode: '304' });
    expect(resolveSubject('Computer Science/Informatics Practices')).toMatchObject({ status: 'MAPPED', paperCode: '308', basis: 'ALIAS' });
    expect(resolveSubject('Accountancy/Book Keeping')).toMatchObject({ status: 'MAPPED', paperCode: '301' });
    expect(resolveSubject('Mathematics/ Applied Mathematics')).toMatchObject({ status: 'MAPPED', paperCode: '319' });
    expect(resolveSubject('Oriya')).toMatchObject({ status: 'MAPPED', paperCode: '109' });
    expect(resolveSubject('General Test')).toMatchObject({ status: 'MAPPED', paperCode: '501' });
    expect(resolveSubject('Performing Arts')).toMatchObject({ status: 'MAPPED', paperCode: '320' });
    expect(resolveSubject('Physical Education')).toMatchObject({ status: 'MAPPED', paperCode: '321' });
  });

  it('a name for one part of a combined paper maps, but is marked so a person can confirm it', () => {
    expect(resolveSubject('Biotechnology')).toMatchObject({ status: 'MAPPED', paperCode: '304', basis: 'PART_OF_COMBINED_PAPER' });
    expect(resolveSubject('Mathematics')).toMatchObject({ status: 'MAPPED', paperCode: '319', basis: 'PART_OF_COMBINED_PAPER' });
    // with the paper code printed beside it the university has said which paper it means
    expect(resolveSubject('Mathematics', { code: '319' })).toMatchObject({ status: 'MAPPED', paperCode: '319', basis: 'PAPER_CODE' });
  });

  it('keeps a specialisation printed in brackets, and uses the printed code', () => {
    const r = resolveSubject('Fine Arts / Visual Arts (Sculpture/Painting)', { code: '312' });
    expect(r).toMatchObject({ status: 'MAPPED', paperCode: '312' });
    expect((r as { note?: string }).note).toContain('Sculpture/Painting');
  });
});

describe('ambiguous, conflicting and unknown names are never mapped automatically', () => {
  it('"Sanskrit" in a language list is ambiguous (NTA\'s Sanskrit is a domain paper)', () => {
    expect(resolveSubject('Sanskrit', { group: 'LIST_A' })).toMatchObject({ status: 'AMBIGUOUS' });
    // with NTA's code it is unambiguous, and outside a language list it is NTA's paper
    expect(resolveSubject('Sanskrit', { code: '325' })).toMatchObject({ status: 'MAPPED', paperCode: '325' });
    expect(resolveSubject('Sanskrit')).toMatchObject({ status: 'MAPPED', paperCode: '325' });
  });

  it('a name and a printed code that disagree are a conflict, not a choice', () => {
    expect(resolveSubject('Chemistry', { code: '322' })).toMatchObject({ status: 'CONFLICT', nameSubjectId: 'chemistry', codeSubjectId: 'physics' });
  });

  it('unknown names and unknown codes stay unknown', () => {
    for (const t of ['Astrology', 'Science', 'Computing', 'Language', '']) expect(resolveSubject(t).status).toBe('UNKNOWN');
    expect(resolveSubject('Physics', { code: '999' }).status).toBe('UNKNOWN');
    expect(paperByCode('999')).toBeUndefined();
  });

  it('similar-looking names are not guessed', () => {
    expect(resolveSubject('Biologics').status).toBe('UNKNOWN');
    expect(resolveSubject('Physic').status).toBe('UNKNOWN');
  });
});

const names = (rs: Requirement[]) => rs.map((r) => (r.kind === 'SUBJECT' && r.subject.status === 'MAPPED' ? r.subject.paperCode : r.kind));

describe('requirement reader: Delhi-style combinations', () => {
  it('any N of a list, with a language list', () => {
    const r = parseRequirementText(DU('Combination I: Any one Language from List A + Any three subjects from List B OR Combination II: Any two Languages from List A + Any two subjects from List B'));
    expect(r.family).toBe('DU_COMBINATIONS');
    expect(r.status).toBe('PARSED');
    expect(r.combinations).toHaveLength(2);
    expect(r.combinations[0]!.requirements).toEqual([
      { kind: 'ANY_N_OF_GROUP', n: 1, group: 'LIST_A', otherThanNamed: false },
      { kind: 'ANY_N_OF_GROUP', n: 3, group: 'LIST_B', otherThanNamed: false },
    ]);
    expect(r.combinations[1]!.requirements.map((x) => (x.kind === 'ANY_N_OF_GROUP' ? [x.n, x.group] : x))).toEqual([[2, 'LIST_A'], [2, 'LIST_B']]);
    expect(r.groupsNeeded.sort()).toEqual(['LIST_A', 'LIST_B']);
    // List A and List B members are not in the text, so this rule cannot be evaluated yet.
    expect(r.evaluable).toBe(false);
    expect(r.issues.some((i) => i.code === 'GROUP_MEMBERSHIP_NOT_IN_TEXT')).toBe(true);
  });

  it('mandatory named subjects, with alternatives written as separate combinations', () => {
    const r = parseRequirementText(DU('Combination I: Physics + Chemistry + Biology/Biological Studies/Biotechnology/Biochemistry OR Combination II: Physics + Chemistry + Mathematics/Applied Mathematics', 'Merit will be based on the best CUET score. Candidates must appear in any one language from List A in CUET'));
    expect(r.status).toBe('PARSED');
    expect(r.combinations.map((c) => c.label)).toEqual(['Combination I', 'Combination II']);
    expect(names(r.combinations[0]!.requirements)).toEqual(['322', '306', '304']);
    expect(names(r.combinations[1]!.requirements)).toEqual(['322', '306', '319']);
  });

  it('a sentence that applies to every combination is added to the ones that have no language, and only to those', () => {
    const r = parseRequirementText(DU('Combination I: Physics + Chemistry + Mathematics/Applied Mathematics', 'Candidates must appear in any one language from List A in CUET.'));
    expect(r.combinations[0]!.requirements).toHaveLength(3);
    expect(r.combinations[0]!.effective).toHaveLength(4);
    const own = parseRequirementText(DU('Combination I: Any one Language from List A + Any three subjects from List B', 'Candidates must appear in any one language from List A in CUET.'));
    expect(own.combinations[0]!.effective).toHaveLength(2); // already has a language, not added twice
  });

  it('a named subject and "one Language" means that subject plus one more language', () => {
    const r = parseRequirementText(DU('Combination I: Hindi from List A + Any three subjects from List B OR Combination II: Hindi and one Language from List A + Any two subjects from List B'));
    expect(r.combinations[0]!.requirements[0]).toMatchObject({ kind: 'SUBJECT', group: 'LIST_A', subject: { status: 'MAPPED', paperCode: '102' } });
    expect(r.combinations[1]!.requirements.slice(0, 2)).toMatchObject([{ kind: 'SUBJECT' }, { kind: 'ANY_N_OF_GROUP', n: 1, group: 'LIST_A', otherThanNamed: true }]);
  });

  it('General Aptitude Test and a named list-B subject are mandatory, the rest is any-N', () => {
    const r = parseRequirementText(DU('Combination I: Any one Language from List A + Mass Media/Mass Communication from List B + General Aptitude Test OR Combination II: Any one Language from List A + General Aptitude Test'));
    expect(r.status).toBe('PARSED');
    expect(names(r.combinations[0]!.requirements)).toEqual(['ANY_N_OF_GROUP', '318', '501']);
    expect(names(r.combinations[1]!.requirements)).toEqual(['ANY_N_OF_GROUP', '501']);
  });

  it('a test set by the university is a rule-level requirement, not a CUET paper and not tied to one combination', () => {
    const text = "Candidates must appear in both CUET and Performance-based test. Candidates must appear in CUET in any of the following subject combinations: Combination I: Any one Language from List A + Performing Arts from List B + Any two subjects from List B OR Combination II: Any two Languages from List A + Any two subjects from List B AND Performance-Based Test Merit will be calculated by considering the combined 'CUET score (50% weightage) and Performance-based test score (50% weightage)'";
    const r = parseRequirementText(text);
    expect(r.extraTests).toEqual([{ kind: 'PERFORMANCE_TEST', text: expect.any(String) }]);
    expect(r.combinations.every((c) => c.extraTests.length === 0)).toBe(true);
    expect(r.issues.some((i) => i.code === 'MERIT_FORMULA_NOT_INTERPRETED')).toBe(true);
    expect(describeRule(r).at(-1)).toContain('PERFORMANCE_TEST');
  });

  it('numbers in words and a missing space before a plus are read', () => {
    const r = parseRequirementText(DU('Combination I: Any one Language from List A + Mathematics/Applied Mathematics+ Any two subjects from List B'));
    expect(r.combinations[0]!.requirements).toHaveLength(3);
  });
});

describe('requirement reader: papers listed by code', () => {
  it('numbered papers with a choice of language paper', () => {
    const r = parseRequirementText('1. Language Test - English (101) or Hindi (102) 2. General Aptitude Test (501)');
    expect(r.family).toBe('NUMBERED_PAPERS');
    expect(r.status).toBe('PARSED');
    expect(r.combinations[0]!.requirements[0]).toMatchObject({ kind: 'ANY_N_OF_SET', n: 1, of: [{ paperCode: '101' }, { paperCode: '102' }] });
    expect(r.combinations[0]!.requirements[1]).toMatchObject({ kind: 'SUBJECT', subject: { paperCode: '501' } });
    // every paper is named and no list is needed, but the text does not say whether all papers or any one is required
    expect(r.issues.map((i) => i.code)).toContain('ALL_OR_ANY_NOT_STATED');
    expect(r.evaluable).toBe(false);
  });

  it('alternative sets of papers separated by OR', () => {
    const r = parseRequirementText('1. Subject Test - Chemistry (306) 2. Subject Test - Mathematics (319) 3. Subject Test - Physics (322) OR 1. Subject Test - Biology/ Biological Science/ Biotechnology/ Biochemistry (304) 2. Subject Test - Chemistry (306) 3. Subject Test - Physics (322)');
    expect(r.combinations).toHaveLength(2);
    expect(names(r.combinations[1]!.requirements)).toEqual(['304', '306', '322']);
    expect(r.status).toBe('PARSED');
  });

  it('a printed code that contradicts its name is reported, not resolved', () => {
    const r = parseRequirementText('1. Subject Test - Chemistry (322)');
    expect(r.status).toBe('PARTIAL');
    expect(r.issues.some((i) => i.code === 'SUBJECT_CODE_CONFLICT')).toBe(true);
    expect(r.evaluable).toBe(false);
  });

  it('"required to opt for" with codes', () => {
    const r = parseRequirementText('They are required to opt for English Test (Paper Code 101) and General Aptitude Test (Paper Code 501) for the admission in JNU. Candidates who will not appear in both will not be considered.');
    expect(r.family).toBe('OPT_FOR');
    expect(r.status).toBe('PARSED');
    expect(names(r.combinations[0]!.requirements)).toEqual(['101', '501']);
    expect(r.evaluable).toBe(true);
  });

  it('prose conditions are not interpreted: the papers are listed, the rule is partial and not evaluable', () => {
    const r = parseRequirementText('They are required to opt for Physics (Paper Code 322), Chemistry (Paper Code 306) and Biology (Paper Code 304) / Mathematics (Paper Code 319) for the admission in JNU. Out of these subjects Physics (Paper Code 322) and Chemistry (Paper Code 306) are compulsory. Candidates can choose any one subject either Biology (Paper Code 304) or Mathematics (Paper Code 319) as third subject.');
    expect(r.status).toBe('PARTIAL');
    expect(r.evaluable).toBe(false);
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['UNSUPPORTED_CLAUSE', 'SLASH_READ_AS_CHOICE']));
  });
});

describe('requirement reader: invalid, incomplete and unknown input', () => {
  it('nothing to read', () => {
    for (const t of [null, undefined, '', '   ']) {
      const r = parseRequirementText(t);
      expect(r).toMatchObject({ status: 'UNPARSED', evaluable: false, combinations: [] });
      expect(r.issues[0]!.code).toBe('NO_SUBJECT_RULE');
    }
  });

  it('text that is not a subject rule is unparsed, never guessed', () => {
    const r = parseRequirementText('The candidate must have passed the Class XII examination with at least 45% marks in aggregate.');
    expect(r.status).toBe('UNPARSED');
    expect(r.combinations).toEqual([]);
  });

  it('a combination with nothing readable in it', () => {
    const r = parseRequirementText('Candidates must appear in CUET in the following subject combination: Combination I: Merit will be based on the CUET score.');
    expect(r.status).toBe('UNPARSED');
    expect(r.issues.some((i) => i.code === 'EMPTY_COMBINATION')).toBe(true);
  });

  it('an unknown subject name makes the rule partial and unevaluable, and the name is reported', () => {
    const r = parseRequirementText(DU('Combination I: Astrology + Physics + Chemistry'));
    expect(r.status).toBe('PARTIAL');
    expect(r.evaluable).toBe(false);
    expect(r.issues.find((i) => i.code === 'UNKNOWN_SUBJECT')?.text).toBe('Astrology');
  });

  it('an ambiguous subject name makes the rule partial', () => {
    const r = parseRequirementText(DU('Combination I: Sanskrit from List A + Any three subjects from List B'));
    expect(r.status).toBe('PARTIAL');
    expect(r.issues.some((i) => i.code === 'AMBIGUOUS_SUBJECT')).toBe(true);
  });

  it('wording the reader does not understand is kept, not dropped', () => {
    const r = parseRequirementText(DU('Combination I: Any one Language from List A + Any one subject from either List B + General Aptitude Test'));
    expect(r.status).toBe('PARTIAL');
    expect(r.combinations[0]!.requirements.some((x) => x.kind === 'UNRESOLVED')).toBe(true);
  });
});

/**
 * One reading of a rule for comparison: the named subjects (normalised) and how many of each list are asked for. The browser's reader and
 * the server's reader describe the same text in different shapes, so both are reduced to this.
 */
function signatureFromFrontend(text: string) {
  const f = frontendParse(text);
  if (!f) return null;
  return f.combos.map((c) => {
    const named: string[] = [];
    const lists: Record<string, number> = {};
    for (const i of c.items) {
      if (i.named) { named.push(normaliseName(i.text).name); continue; }
      const m = /^(One|Two|Three|Four)(?: more)? (?:language|languages) \(List A\)$/i.exec(i.text);
      const b = /^Any (one|two|three|four) subjects? \(List B\)$/i.exec(i.text);
      const w: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
      if (m) lists.LIST_A = (lists.LIST_A ?? 0) + w[m[1]!.toLowerCase()]!;
      else if (b) lists.LIST_B = (lists.LIST_B ?? 0) + w[b[1]!.toLowerCase()]!;
      else named.push(`?${i.text}`);
    }
    return { named: named.sort(), lists, extra: f.extraTest !== null };
  });
}

function signatureFromBackend(text: string) {
  const r = parseRequirementText(text);
  return r.combinations.map((c) => {
    const named: string[] = [];
    const lists: Record<string, number> = {};
    for (const q of c.effective) {
      if (q.kind === 'SUBJECT') named.push(normaliseName(q.subject.text).name);
      else if (q.kind === 'ANY_N_OF_GROUP') lists[q.group] = (lists[q.group] ?? 0) + q.n;
      else if (q.kind === 'UNRESOLVED') named.push(`?${q.text}`);
      else named.push('?other');
    }
    return { named: named.sort(), lists, extra: r.extraTests.length > 0 };
  });
}

describe('the browser reader and the server reader agree', () => {
  const texts: string[] = [];
  for (const u of Object.values((pack as { universities: Record<string, { facts: { kind: string; valueText?: string }[] }> }).universities)) {
    for (const f of u.facts) if ((f.kind === 'SUBJECTS' || f.kind === 'ELIGIBILITY') && f.valueText && /Combination\s+[IVX]+\s*:/i.test(f.valueText)) texts.push(f.valueText);
  }

  it('the stored import pack has Delhi-style rules to compare', () => {
    expect(texts.length).toBeGreaterThanOrEqual(60);
  });

  it('every Delhi-style rule in the import pack: same combinations, same named subjects, same list counts', () => {
    const differences: string[] = [];
    for (const t of texts) {
      const a = signatureFromFrontend(t);
      const b = signatureFromBackend(t);
      if (JSON.stringify(a) !== JSON.stringify(b)) differences.push(`${t.slice(0, 140)}\n  browser: ${JSON.stringify(a)}\n  server:  ${JSON.stringify(b)}`);
    }
    expect(differences).toEqual([]);
  });

  it('where the browser reader shows text as printed (no combinations), the server reader still does not decide for it', () => {
    const t = '1. Language Test - English (101) or Hindi (102) 2. General Aptitude Test (501)';
    expect(frontendParse(t)).toBeNull();
    expect(parseRequirementText(t).status).toBe('PARSED');
  });
});

describe('the whole import pack, read without writing anything', () => {
  it('every subject or eligibility text is classified, and nothing unknown is silently mapped', () => {
    const all: { kind: string; valueText?: string }[] = [];
    for (const u of Object.values((pack as { universities: Record<string, { facts: { kind: string; valueText?: string }[] }> }).universities)) all.push(...u.facts);
    const subjectTexts = all.filter((f) => f.kind === 'SUBJECTS' && f.valueText);
    expect(subjectTexts.length).toBeGreaterThan(50);
    for (const f of subjectTexts) {
      const r = parseRequirementText(f.valueText);
      expect(['PARSED', 'PARTIAL']).toContain(r.status);
      for (const c of r.combinations) for (const q of c.effective) {
        if (q.kind === 'SUBJECT') expect(['MAPPED', 'AMBIGUOUS', 'CONFLICT', 'UNKNOWN']).toContain(q.subject.status);
      }
    }
  });
});
