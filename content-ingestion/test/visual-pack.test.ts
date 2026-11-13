import { describe, expect, it } from 'vitest';
import { FLOW, FLOW_CHECK, FORMULAS, KEY_POINTS, MIND_MAP, NOTES, QUIZ, SOURCE, STEPS, type MapNode } from '../../frontend/src/visual/gravitation';
import { visualHtml } from '../src/visual-pdf';

const ideas = (n: MapNode): MapNode[] => [n, ...(n.children ?? []).flatMap(ideas)];
const SECTIONS = /^(7\.[13456]|Summary( \d+)?)$/;

describe('visual learning pack: Gravitation', () => {
  it('names its source, and every step, idea, stage, formula and note cites a section and a page of that chapter', () => {
    expect(SOURCE).toMatchObject({ publisher: 'NCERT', chapter: 'Chapter 7: Gravitation', pages: 17 });
    expect(SOURCE.sha256).toMatch(/^[0-9a-f]{64}$/);
    const cited = [...STEPS.flatMap((s) => s.src), ...ideas(MIND_MAP).map((n) => n.src), ...FLOW.map((n) => n.src), ...Object.values(FORMULAS).map((f) => f.src), ...NOTES.map((n) => n.src), QUIZ.src];
    expect(cited.length).toBeGreaterThan(30);
    for (const c of cited) {
      expect(c.section).toMatch(SECTIONS);
      // The chapter runs from book page 127 to 143.
      expect(c.page).toBeGreaterThanOrEqual(127);
      expect(c.page).toBeLessThanOrEqual(143);
    }
  });

  it('has the six story steps in order, each with something to show and say', () => {
    expect(STEPS.map((s) => s.scene)).toEqual(['tree', 'fall', 'pair', 'law', 'quiz', 'recap']);
    for (const s of STEPS.filter((x) => x.scene !== 'quiz')) expect(s.lines.join(' ').length).toBeGreaterThan(40);
  });

  it('has exactly one right answer in each check, and an explanation for every choice', () => {
    for (const q of [QUIZ, FLOW_CHECK]) {
      expect(q.choices.filter((c) => c.correct)).toHaveLength(1);
      for (const c of q.choices) expect(c.why.length).toBeGreaterThan(30);
    }
  });

  it('has a mind map whose ideas are unique, explained, and point only to steps and formulas that exist', () => {
    const all = ideas(MIND_MAP);
    expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
    for (const n of all) {
      expect(n.text.length).toBeGreaterThan(30);
      if (n.step) expect(STEPS.some((s) => s.id === n.step)).toBe(true);
      if (n.formula) expect(Object.keys(FORMULAS)).toContain(n.formula);
    }
  });

  it('has a flowchart that can be walked from the first stage to the result, with a decision whose wrong branch returns', () => {
    const by = new Map(FLOW.map((n) => [n.id, n]));
    for (const n of FLOW) for (const to of [n.next, n.yes, n.no]) if (to) expect(by.has(to)).toBe(true);
    const decision = FLOW.find((n) => n.kind === 'decision')!;
    expect(by.get(decision.yes!)!.kind).toBe('wrong');
    expect(by.get(decision.yes!)!.next).toBe(decision.id);
    let at = FLOW[0]!;
    const seen: string[] = [];
    while (at.kind !== 'result' && seen.length < 20) {
      seen.push(at.id);
      at = by.get(at.kind === 'decision' ? at.no! : at.next!)!;
    }
    expect(at.kind).toBe('result');
    expect(seen.length).toBe(FLOW.filter((n) => n.kind !== 'wrong').length - 1);
  });

  it('keeps the numbers the chapter gives', () => {
    const text = JSON.stringify([STEPS, MIND_MAP, FLOW, NOTES, FORMULAS, KEY_POINTS]);
    for (const fact of ['6.67 × 10⁻¹¹ N m² kg⁻²', '9.8 m s⁻²', '27.3 days', '3.84 × 10⁸ m', '3600']) expect(text).toContain(fact);
    // The moon's acceleration follows from the chapter's own numbers: 4π²R/T².
    const a = (4 * Math.PI ** 2 * 3.84e8) / (27.3 * 86400) ** 2;
    expect(a).toBeCloseTo(0.0027, 4);
    expect(9.8 / a).toBeGreaterThan(3500);
    expect(9.8 / a).toBeLessThan(3700);
  });

  it('typesets a PDF page with real text, vector drawings, and no symbol left as raw code', () => {
    const html = visualHtml();
    expect(html).toContain('@page { size: A4;');
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(html).not.toMatch(/<img/);
    const words = html.replace(/<style[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
    for (const heading of ['Mind map: Gravitation', 'Flowchart:', 'Points to remember', 'Check yourself', 'Answers', 'Preview: not yet reviewed']) expect(words).toContain(heading);
    expect(words).not.toMatch(/\$|R_E|M_E|R_m/);
  });
});
