/**
 * Validates EVERY chapter-lab spec in visual/specs/: structure, model sanity, and that every prediction and practice answer
 * recomputed from the model equals the keyed answer. Also checks that each lab's lesson and heading really exist in the
 * content packs, so the lesson card will appear. Add a spec and this test covers it automatically.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAB_SUBJECTS } from '../labs';
import { linearFit, startValues, toPos, fromPos, withValues } from './kit';
import { SPECS } from './specs';
import type { Outs, Spec, Values } from './types';

const PACKS = join(process.cwd(), '..', 'content', 'packs', 'CUET_UG');
const lessons: { title: string; headings: string[]; paper: string }[] = [];
if (existsSync(PACKS)) {
  for (const paper of readdirSync(PACKS)) {
    for (const f of readdirSync(join(PACKS, paper)).filter((x) => x.endsWith('.json'))) {
      const d = JSON.parse(readFileSync(join(PACKS, paper, f), 'utf8')) as { lesson?: { title: string; blocks: { type: string; text?: string }[] } | null };
      if (d.lesson?.blocks) lessons.push({ title: d.lesson.title, paper, headings: d.lesson.blocks.filter((b) => b.type === 'HEADING').map((b) => b.text ?? '') });
    }
  }
}
const PAPER_OF: Record<string, string> = { Physics: '322', Chemistry: '306', Biology: '304', Mathematics: '319', 'Computer Science': '308', Geography: '313', 'General Aptitude Test': '501' };
const outsOf = (s: Spec, v: Values): Outs => Object.fromEntries(s.outs.map((o) => [o.id, o.fn(v)]));

describe('chapter-lab engine helpers', () => {
  it('slider positions round-trip on linear and log scales', () => {
    const lin = { id: 'a', label: 'a', unit: '', min: 0, max: 10, step: 0.5, start: 5 };
    const log = { id: 'b', label: 'b', unit: '', min: 1, max: 1000, step: 1, start: 10, log: true };
    expect(fromPos(lin, toPos(lin, 7.5))).toBe(7.5);
    expect(Math.abs(fromPos(log, toPos(log, 100)) / 100 - 1)).toBeLessThan(0.01);
    expect(withValues([lin], { a: 3 }).a).toBe(3);
    expect(startValues([lin]).a).toBe(5);
  });
  it('least-squares fit recovers a line', () => {
    const f = linearFit([1, 2, 3, 4].map((x) => ({ x, y: 3 * x + 2 })));
    expect(f.slope).toBeCloseTo(3, 12);
    expect(f.intercept).toBeCloseTo(2, 12);
    expect(f.r2).toBeCloseTo(1, 12);
  });
});

describe('every chapter lab spec', () => {
  it('there is at least one spec and ids are unique', () => {
    expect(SPECS.length).toBeGreaterThan(0);
    expect(new Set(SPECS.map((s) => s.id)).size).toBe(SPECS.length);
  });

  for (const s of SPECS) {
    describe(s.id, () => {
      it('has complete, sensible metadata', () => {
        expect(s.id).toMatch(/^[a-z0-9-]{4,60}$/);
        expect(LAB_SUBJECTS).toContain(s.subject);
        for (const t of [s.title, s.format, s.blurb, s.lessonTitleStartsWith, s.afterHeading]) expect(t.trim().length).toBeGreaterThan(3);
        expect(s.can.length).toBeGreaterThanOrEqual(3);
        expect(s.discover.length).toBeGreaterThanOrEqual(2);
        expect(s.experiment.length).toBeGreaterThanOrEqual(2);
        expect(s.understand.length).toBeGreaterThanOrEqual(3);
        expect(s.minutes).toBeGreaterThan(2);
        expect(s.vars.length).toBeGreaterThanOrEqual(2);
        expect(s.outs.length).toBeGreaterThanOrEqual(2);
        expect(s.graphs.length).toBeGreaterThanOrEqual(1);
      });
      it('its lesson and heading exist in the content packs of its subject', () => {
        const les = lessons.filter((l) => l.paper === PAPER_OF[s.subject] && l.title.startsWith(s.lessonTitleStartsWith));
        expect(les.length, `lesson starting "${s.lessonTitleStartsWith}" in paper ${PAPER_OF[s.subject]}`).toBeGreaterThanOrEqual(1);
        expect(les.some((l) => l.headings.includes(s.afterHeading)), `heading "${s.afterHeading}"`).toBe(true);
      });
      it('variables are well formed and the model is finite everywhere on the sliders', () => {
        for (const v of s.vars) {
          expect(v.min).toBeLessThan(v.max);
          expect(v.start).toBeGreaterThanOrEqual(v.min);
          expect(v.start).toBeLessThanOrEqual(v.max);
          expect(v.step).toBeGreaterThan(0);
          if (v.log) expect(v.min).toBeGreaterThan(0);
        }
        const start = startValues(s.vars);
        const corners: Values[] = [start];
        for (const v of s.vars) {
          corners.push({ ...start, [v.id]: v.min }, { ...start, [v.id]: v.max });
        }
        for (const c of corners) for (const o of s.outs) expect(Number.isFinite(o.fn(c)), `${o.id} at ${JSON.stringify(c)}`).toBe(true);
        expect(new Set([...s.vars.map((v) => v.id), ...s.outs.map((o) => o.id)]).size).toBe(s.vars.length + s.outs.length);
      });
      it('every output responds to at least one slider (nothing is decorative)', () => {
        const start = startValues(s.vars);
        for (const o of s.outs) {
          const base = o.fn(start);
          const moves = s.vars.some((v) => Math.abs(o.fn({ ...start, [v.id]: v.max }) - base) > 1e-9 * Math.max(1, Math.abs(base)) || Math.abs(o.fn({ ...start, [v.id]: v.min }) - base) > 1e-9 * Math.max(1, Math.abs(base)));
          expect(moves, `output ${o.id} never changes`).toBe(true);
        }
      });
      it('graphs refer to real variables and outputs and the curve is not flat', () => {
        const start = startValues(s.vars);
        for (const g of s.graphs) {
          const xv = s.vars.find((v) => v.id === g.x);
          const yo = s.outs.find((o) => o.id === g.y);
          expect(xv, `graph ${g.id} x`).toBeDefined();
          expect(yo, `graph ${g.id} y`).toBeDefined();
          const y0 = yo!.fn({ ...start, [g.x]: xv!.min });
          const y1 = yo!.fn({ ...start, [g.x]: xv!.max });
          expect(Math.abs(y1 - y0)).toBeGreaterThan(0);
          if (g.logX) expect(xv!.min).toBeGreaterThan(0);
          if (g.logY) expect(Math.min(y0, y1)).toBeGreaterThan(0);
        }
      });
      it('has four predictions whose keyed answers match the model', () => {
        expect(s.preds.length).toBeGreaterThanOrEqual(4);
        for (const p of s.preds) {
          expect(p.options.length).toBe(4);
          expect(new Set(p.options).size).toBe(4);
          expect(p.answer).toBeGreaterThanOrEqual(0);
          expect(p.answer).toBeLessThan(4);
          const base = withValues(s.vars, p.base);
          const test = withValues(s.vars, p.base, p.test);
          for (const [id, val] of Object.entries({ ...p.base, ...p.test })) {
            const d = s.vars.find((x) => x.id === id);
            expect(d, `prediction ${p.id} sets unknown variable ${id}`).toBeDefined();
            expect(val).toBeGreaterThanOrEqual(d!.min);
            expect(val).toBeLessThanOrEqual(d!.max);
          }
          const ctx = { base, test, outs: (vals: Values) => outsOf(s, vals) };
          expect(p.verify(ctx), `prediction ${p.id}: the model says option ${p.verify(ctx)}, the key says ${p.answer}`).toBe(p.answer);
          expect(p.why(ctx).length).toBeGreaterThan(40);
          expect(Object.keys(p.test).length).toBeGreaterThan(0);
        }
      });
      it('has five practice questions whose keyed answers match the model', () => {
        expect(s.questions.length).toBeGreaterThanOrEqual(5);
        for (const q of s.questions) {
          expect(q.options.length).toBe(4);
          expect(new Set(q.options).size).toBe(4);
          expect(q.q.length).toBeGreaterThan(20);
          expect(q.why.length).toBeGreaterThan(30);
          expect(q.verify(), `question ${q.id}: the model says option ${q.verify()}, the key says ${q.answer}`).toBe(q.answer);
        }
        const share = (n: number) => s.questions.filter((q) => q.answer === n).length / s.questions.length;
        for (const n of [0, 1, 2, 3]) expect(share(n)).toBeLessThanOrEqual(0.6);
      });
      it('the measurement can be done: varied variable exists, readings differ, and the fit is finite', () => {
        const m = s.measure;
        const vd = s.vars.find((v) => v.id === m.vary);
        expect(vd).toBeDefined();
        for (const id of m.record) expect(s.outs.some((o) => o.id === id)).toBe(true);
        expect(m.instruction.length).toBeGreaterThan(30);
        if (m.fit) {
          const start = startValues(s.vars);
          const pts = [0.2, 0.5, 0.8].map((t) => {
            const v = { ...start, [m.vary]: vd!.min + t * (vd!.max - vd!.min) };
            const o = outsOf(s, v);
            return { x: m.fit!.x(v, o), y: m.fit!.y(v, o) };
          });
          for (const p of pts) {
            expect(Number.isFinite(p.x)).toBe(true);
            expect(Number.isFinite(p.y)).toBe(true);
          }
          const f = linearFit(pts);
          expect(Number.isFinite(f.slope)).toBe(true);
          expect(m.fit.interpret(f.slope, f.intercept, start).length).toBeGreaterThan(30);
        }
      });
      it('the scene (when present) changes with the values', () => {
        if (!s.scene) return;
        const start = startValues(s.vars);
        const render = (v: Values) => JSON.stringify(s.scene!({ v, o: outsOf(s, v) }), (_k, val) => (typeof val === 'function' ? undefined : val));
        const a = render(start);
        const changed = s.vars.some((vd) => render({ ...start, [vd.id]: vd.max }) !== a);
        expect(changed, 'scene never changes with any slider').toBe(true);
        expect((s.sceneAlt ?? '').length).toBeGreaterThan(30);
      });
    });
  }
});
