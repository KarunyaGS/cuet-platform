import { describe, expect, it } from 'vitest';
import { parseRule, ruleLines } from './subject-rule';

const lines = (t: string) => ruleLines(parseRule(t)!);

describe('subject rule, as printed by the university', () => {
  it('Physics: three named subjects, and the extra language the university asks for', () => {
    const r = parseRule('Candidates must appear in CUET in the following subject combination: Combination I : Physics + Chemistry + Mathematics/Applied Mathematics Merit will be based on the CUET scores obtained from the above-mentioned combination of subjects. Candidates must appear in any one language from List A in CUET')!;
    expect(r.combos).toHaveLength(1);
    expect(lines('Combination I : Physics + Chemistry + Mathematics/Applied Mathematics Candidates must appear in any one language from List A in CUET')).toEqual(['Physics + Chemistry + Mathematics/Applied Mathematics + One language (List A)']);
    expect(r.combos[0]!.items.filter((i) => i.named).map((i) => i.text)).toEqual(['Physics', 'Chemistry', 'Mathematics/Applied Mathematics']);
  });
  it('Economics: a language, Mathematics and two more subjects', () => {
    expect(lines('Combination I: Any one Language from List A + Mathematics/Applied Mathematics + Any two subjects from List B Merit will be based on the best CUET scores')).toEqual(['One language (List A) + Mathematics/Applied Mathematics + Any two subjects (List B)']);
  });
  it('B.Com. (Hons.): two alternative combinations, each with its own subjects', () => {
    const r = parseRule('Candidates must appear in CUET in any of the following subject combinations: Combination I: Any one Language from List A + Mathematics/ Applied Mathematics + Any two subjects from List B Combination II: Any one Language from List A + Accountancy/Book Keeping + Any two subjects from List B Merit will be based on the best CUET scores')!;
    expect(r.combos.map((c) => c.label)).toEqual(['Combination I', 'Combination II']);
    expect(lines('Combination I: Any one Language from List A + Mathematics/ Applied Mathematics + Any two subjects from List B Combination II: Any one Language from List A + Accountancy/Book Keeping + Any two subjects from List B')).toEqual([
      'One language (List A) + Mathematics/Applied Mathematics + Any two subjects (List B)',
      'One language (List A) + Accountancy/Book Keeping + Any two subjects (List B)',
    ]);
  });
  it('Mathematics: one or two languages, as printed with OR between the combinations', () => {
    expect(lines('Combination I:Any one Language from List A + Mathematics/Applied Mathematics + Any two subjects from List B OR Combination II:Any two Languages from List A + Mathematics/ Applied Mathematics + Any one subject from List B Merit will be based')).toEqual([
      'One language (List A) + Mathematics/Applied Mathematics + Any two subjects (List B)',
      'Two languages (List A) + Mathematics/Applied Mathematics + Any one subject (List B)',
    ]);
  });
  it('a language programme names its own language and asks for one more', () => {
    expect(lines('Combination I: Bengali from List A + Any three subjects from List B OR Combination II: Bengali and one Language from List A + Any two subjects from List B')).toEqual([
      'Bengali + Any three subjects (List B)',
      'Bengali + One more language (List A) + Any two subjects (List B)',
    ]);
  });
  it('keeps the General Aptitude Test, and notes a performance or practical test', () => {
    expect(lines('Combination I: Any one Language from List A + Performing Arts from List B + Any two subjects from List B OR Combination II: Any one Language from List A + General Aptitude Test')).toEqual([
      'One language (List A) + Performing Arts + Any two subjects (List B)',
      'One language (List A) + General Aptitude Test',
    ]);
    expect(parseRule('Candidates must appear in both CUET and Performance-based test. Combination I: Any one Language from List A + Performing Arts from List B AND Performance-Based Test')!.extraTest).toMatch(/performance-based test/);
    expect(parseRule('Combination I : Any one Language from List A + General Aptitude Test AND Practical-Based Test (to be conducted by College of Art)')!.extraTest).toMatch(/practical test/);
  });
  it('gives nothing back for text that is not a subject rule, so the page shows it as printed', () => {
    expect(parseRule('Passed 10+2 or equivalent examination securing a minimum of 50% marks in the aggregate.')).toBeNull();
    expect(parseRule(null)).toBeNull();
  });
});
