import { describe, expect, it } from 'vitest';
import { checkStructure, type CheckNode } from '../src/structure-checks';

const n = (ref: string, parentRef: string | null, kind: string, title: string, label: string | null = null, body: string | null = null, sourcePage = 2): CheckNode => ({ ref, parentRef, kind, label, title, body, sourcePage });
const note = [n('note', null, 'NOTE', 'Note'), n('i', 'note', 'ITEM', 'The Question Paper will have 75 questions.', 'i'), n('ii', 'note', 'ITEM', 'All questions are compulsory.', 'ii')];

describe('syllabus structure checks', () => {
  it('accepts a flat topic list with the usual Note box, and reports its shape', () => {
    const r = checkStructure([...note, n('t1', null, 'TOPIC', 'Metaphysics', '1'), n('t2', null, 'TOPIC', 'Logic', '2')]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.shape).toEqual({ units: 0, sections: 0, topics: 2, noteLines: 2 });
  });

  it('refuses syllabus topics stored inside the Note box', () => {
    const topics = Array.from({ length: 12 }, (_, i) => n(`x${i}`, 'note', 'ITEM', `History of dance ${i}`));
    const r = checkStructure([...note, ...topics]);
    expect(r.errors.some((e) => e.includes('holds 14 rows'))).toBe(true);
    expect(r.errors.some((e) => e.includes('no syllabus rows outside the Note box'))).toBe(true);
  });

  it('refuses a whole syllabus stored as text on a Note line', () => {
    const r = checkStructure([n('note', null, 'NOTE', 'Note'), n('iv', 'note', 'ITEM', 'The Questions will be Bilingual.', 'iv', 'Plant propagation. '.repeat(40)), n('t', null, 'TOPIC', 'Horticulture', '1')]);
    expect(r.errors.some((e) => e.includes('characters of text'))).toBe(true);
  });

  it('refuses a cover-page title stored as a row', () => {
    const r = checkStructure([n('c', null, 'NOTE', 'Baudha Darshan/Buddhist', null, null, 1), ...note, n('t', null, 'TOPIC', 'Ethics', '1')]);
    expect(r.errors).toEqual(['the cover-page title "Baudha Darshan/Buddhist" (page 1) was stored as a row']);
  });

  it('warns when a printed unit is stored as a topic, and accepts units under a topic heading', () => {
    const base = [n('h', null, 'TOPIC', 'Molecular Spectroscopy')];
    expect(checkStructure([...base, n('u', 'h', 'SUBTOPIC', 'Unit-I', 'I', 'Interaction of radiation with molecules')]).warnings).toEqual(['"Unit-I" is printed as a unit but stored as SUBTOPIC']);
    expect(checkStructure([...base, n('u', 'h', 'UNIT', 'Unit-I', 'I', 'Interaction of radiation with molecules')]).warnings).toEqual([]);
  });

  it('warns about skipped and repeated numbering without failing (NTA numbering can be irregular)', () => {
    const skip = checkStructure([n('a', null, 'TOPIC', 'One', '1'), n('b', null, 'TOPIC', 'Two', '2'), n('c', null, 'TOPIC', 'Four', '4')]);
    expect(skip.errors).toEqual([]);
    expect(skip.warnings).toEqual(['numbering skips 3 at the top level; a row may be missing']);
    const rep = checkStructure([n('a', null, 'TOPIC', 'One', '1'), n('b', null, 'TOPIC', 'Two', '2'), n('c', null, 'TOPIC', 'Again', '1')]);
    expect(rep.warnings).toEqual(['repeated numbering 1 at the top level; check against the PDF']);
  });

  it('refuses rows whose parent is missing or whose page is beyond the PDF', () => {
    const r = checkStructure([n('t', 'gone', 'TOPIC', 'Orphan'), n('p', null, 'TOPIC', 'Far page', null, null, 9)], { pageCount: 3 });
    expect(r.errors).toHaveLength(2);
  });
});
