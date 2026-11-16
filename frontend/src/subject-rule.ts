/**
 * Turns the text of a university's CUET subject rule ("Combination I: Physics + Chemistry + Mathematics ... OR Combination II: ...")
 * into the list a student needs: which subjects, how many languages, how many other subjects, and whether a separate test applies.
 * It only rearranges what the university printed; it adds nothing. When the text is not in that shape it returns null and the page
 * shows the text as printed.
 */
export interface RuleItem { text: string; named: boolean }
export interface RuleCombo { label: string; items: RuleItem[] }
export interface Rule { combos: RuleCombo[]; extraTest: string | null }

const COUNT: Record<string, string> = { one: 'One', two: 'Two', three: 'Three', four: 'Four' };

function toItems(part: string): RuleItem[] {
  const x = part.replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim();
  if (!x) return [];
  let m = /^Any (one|two|three|four) Languages? from List A$/i.exec(x);
  if (m) return [{ text: `${COUNT[m[1]!.toLowerCase()]} ${m[1]!.toLowerCase() === 'one' ? 'language' : 'languages'} (List A)`, named: false }];
  m = /^Any (one|two|three|four) subjects? from List B$/i.exec(x);
  if (m) return [{ text: `Any ${m[1]!.toLowerCase()} ${m[1]!.toLowerCase() === 'one' ? 'subject' : 'subjects'} (List B)`, named: false }];
  m = /^(.+?) and one Language from List A$/i.exec(x);
  if (m) return [{ text: m[1]!.trim(), named: true }, { text: 'One more language (List A)', named: false }];
  m = /^(.+?) from List [AB]$/i.exec(x);
  if (m) return [{ text: m[1]!.replace(/\s*\/\s*/g, '/').trim(), named: true }];
  if (/^Any\b/i.test(x)) return [{ text: x, named: false }];
  return [{ text: x.replace(/\s*\/\s*/g, '/'), named: true }];
}

export function parseRule(text: string | null | undefined): Rule | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ').trim();
  const re = /Combination ([IVX]+)\s*:\s*(.+?)(?=\s+(?:OR|AND)\s|\s+Combination [IVX]+\s*:|\s+Merit will|\s+Candidates? must appear|\s+Note:|$)/g;
  const combos: RuleCombo[] = [];
  for (const m of t.matchAll(re)) combos.push({ label: `Combination ${m[1]}`, items: m[2]!.split('+').flatMap(toItems) });
  if (!combos.length) return null;
  // "Candidates must appear in any one language from List A in CUET" after the combination adds a language to every combination that has none.
  if (/Candidates? must appear in any one language from List A in CUET/i.test(t)) {
    for (const c of combos) if (!c.items.some((i) => /language|\(List A\)/i.test(i.text))) c.items.push({ text: 'One language (List A)', named: false });
  }
  const extraTest = /Practical-Based Test/i.test(t) ? 'a practical test set by the university (not a CUET paper)' : /Performance-Based Test/i.test(t) ? 'a performance-based test set by the university (not a CUET paper)' : null;
  return { combos, extraTest };
}

/** One line per combination, for a compact card. */
export const ruleLines = (r: Rule) => r.combos.map((c) => c.items.map((i) => i.text).join(' + '));
