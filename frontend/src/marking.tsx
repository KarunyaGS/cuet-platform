import type { MarkingScheme } from './api';

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/** One line for the marks of every question: "+5 correct, −1 wrong, 0 not answered". */
export const marksLine = (m: { correct: number; incorrect: number; unattempted?: number }) => `${signed(m.correct)} correct, ${signed(m.incorrect)} wrong, ${signed(m.unattempted ?? 0)} not answered`;

/**
 * The marking scheme in words, with where it comes from. The only place the rules are written for students, so the instructions screen,
 * the in-test panel and the result all say the same thing. Nothing here is a number of its own: it all comes from the scheme kept with the test.
 */
export function SchemeDetails({ scheme, weightageNote = false, compact = false }: { scheme: MarkingScheme | null; weightageNote?: boolean; compact?: boolean }) {
  if (!scheme) return <p className="text-sm text-ink-2">This attempt was made before marking schemes were stored with tests; its marks are shown in the result.</p>;
  const simulation = scheme.kind === 'CUET_SIMULATION';
  return (
    <div className={compact ? 'space-y-1.5 text-[12px] text-ink-2' : 'space-y-2 text-sm text-ink-2'} data-marking-scheme>
      <p className="num font-medium text-ink">{marksLine(scheme)}. Every question carries the same marks.</p>
      {simulation && scheme.anyCorrectOption && <p>If more than one option is correct, choosing any one correct option earns {signed(scheme.correct)}.</p>}
      {simulation && scheme.creditDroppedQuestions && <p>If a question is found wrong or is dropped, everyone who appeared is given {signed(scheme.correct)} for it.</p>}
      {!simulation && <p>This is a practice score: the same marks, but an untimed learning set, not a CUET simulation.</p>}
      <p>
        Source: {scheme.sourceUrl ? <a href={scheme.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{scheme.sourceLabel}</a> : scheme.sourceLabel}
        {scheme.year ? ` (${scheme.year} cycle)` : ''}.
      </p>
      {weightageNote && <p>NTA does not publish fixed chapter-wise marks. Prepora chapter tests are practice by chapter; the number of questions here says nothing about how often a chapter appears in the real paper.</p>}
    </div>
  );
}
