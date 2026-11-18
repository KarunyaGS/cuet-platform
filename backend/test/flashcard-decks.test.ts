import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { cardConceptsOf, comparisonTable } from '../src/services/concepts';
import { flashcardDecks } from '../src/services/decks';

const table = (caption: string, columns: string[], rows: string[][]) => JSON.stringify({ caption, columns, rows });

describe('flashcards from figures and comparison tables', () => {
  const blocks = [
    { position: 0, type: 'HEADING', body: 'Heading' },
    { position: 1, type: 'DIAGRAM', body: 'A circuit with one cell', mediaAssetId: 'media1' },
    { position: 2, type: 'CALLOUT', body: 'What to learn from this figure: the current is the same everywhere in a series circuit.' },
    { position: 3, type: 'TABLE', body: table('Series and parallel compared', ['Feature', 'Series', 'Parallel'], [['Current', 'same', 'splits'], ['Voltage', 'splits', 'same']]) },
    { position: 4, type: 'TABLE', body: table('Formula sheet', ['Name', 'Formula', 'Unit'], [['Charge', 'q = ne', 'C'], ['Force', 'F = ma', 'N']]) },
    { position: 5, type: 'DEFINITION', body: '**Current**: the rate of flow of charge.' },
  ];

  it('makes one figure card per figure, one card per comparison row, keeps formula sheets out, and gives stable keys', async () => {
    const a = await cardConceptsOf('lesson1', blocks);
    const fig = a.filter((c) => c.type === 'FIGURE');
    expect(fig).toHaveLength(1);
    expect(fig[0]).toMatchObject({ mediaAssetId: 'media1', front: 'What does this figure show?' });
    expect(fig[0]!.back).toContain('A circuit with one cell');
    expect(fig[0]!.back).toContain('the current is the same everywhere');
    const cmp = a.filter((c) => c.type === 'COMPARISON');
    expect(cmp).toHaveLength(2);
    expect(cmp[0]!.front).toContain('Current');
    expect(cmp[0]!.back).toContain('**Series:** same');
    expect(a.some((c) => c.type === 'DEFINITION')).toBe(true);
    const b = await cardConceptsOf('lesson1', blocks);
    expect(b.map((c) => c.key)).toEqual(a.map((c) => c.key));
    expect(new Set(a.map((c) => c.key)).size).toBe(a.length);
  });

  it('only treats real comparisons as comparisons', () => {
    expect(comparisonTable(table('Formula sheet', ['Name', 'Formula', 'Unit'], [['a', 'bb', 'cc'], ['d', 'ee', 'ff']]))).toBeNull();
    expect(comparisonTable(table('Two columns', ['A', 'B'], [['x', 'yy'], ['z', 'ww']]))).toBeNull();
    expect(comparisonTable(table('Same values', ['Feature', 'P', 'Q'], [['row', 'same', 'same'], ['row2', 'same', 'same']]))).toBeNull();
    expect(comparisonTable(table('X versus Y', ['Thing', 'X', 'Y'], [['size', 'big', 'small'], ['mass', 'heavy', 'light']]))?.rows).toHaveLength(2);
  });

  it('lists decks per chapter with no cards for a student who has none', async () => {
    const d = await flashcardDecks(env.DB, true, 'nobody', '2026-11-18');
    expect(d.totals.added).toBe(0);
    expect(d.totals.due).toBe(0);
    expect(Array.isArray(d.subjects)).toBe(true);
  });
});
