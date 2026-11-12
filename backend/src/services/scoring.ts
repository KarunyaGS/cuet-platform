/**
 * Deterministic answer evaluation. No model, no network: compares the response with the stored
 * answer key and applies the cycle's marking scheme.
 */
export type QuestionType =
  | 'MCQ_SINGLE' | 'MCQ_MULTI' | 'ASSERTION_REASON' | 'MATCH_THE_FOLLOWING' | 'STATEMENT_BASED' | 'PASSAGE_BASED' | 'DIAGRAM_BASED' | 'NUMERICAL';

export interface AnswerKeyData {
  correctOptionPositions: number[] | null;
  numericAnswer: number | null;
  numericTolerance: number | null;
}

export interface StudentResponse {
  selectedPositions?: number[];
  numericAnswer?: number | null;
}

export interface Marking {
  correct: number;
  incorrect: number;
  unattempted: number;
}

export type Outcome = 'CORRECT' | 'INCORRECT' | 'UNATTEMPTED';

export function evaluateResponse(type: QuestionType, key: AnswerKeyData, response: StudentResponse, marking: Marking): { outcome: Outcome; score: number } {
  const score = (o: Outcome) => ({ outcome: o, score: o === 'CORRECT' ? marking.correct : o === 'INCORRECT' ? marking.incorrect : marking.unattempted });
  if (type === 'NUMERICAL') {
    if (response.numericAnswer === undefined || response.numericAnswer === null || Number.isNaN(response.numericAnswer)) return score('UNATTEMPTED');
    if (key.numericAnswer === null) throw new Error('Numerical question has no numeric answer key');
    const tol = Math.abs(key.numericTolerance ?? 0);
    return score(Math.abs(response.numericAnswer - key.numericAnswer) <= tol + 1e-12 ? 'CORRECT' : 'INCORRECT');
  }
  const selected = [...new Set(response.selectedPositions ?? [])].sort((a, b) => a - b);
  if (!selected.length) return score('UNATTEMPTED');
  const correct = [...new Set(key.correctOptionPositions ?? [])].sort((a, b) => a - b);
  if (!correct.length) throw new Error('Question has no answer key');
  if (type === 'MCQ_MULTI') {
    return score(selected.length === correct.length && selected.every((p, i) => p === correct[i]) ? 'CORRECT' : 'INCORRECT');
  }
  // Single-answer formats: one option must be chosen. If the key lists more than one correct option
  // (an answer-key anomaly accepted by NTA), choosing any of them earns the marks, as the bulletins state.
  if (selected.length !== 1) return score('INCORRECT');
  return score(correct.includes(selected[0]!) ? 'CORRECT' : 'INCORRECT');
}

export function markingFromRules(rulesJson: string | null): Marking {
  const r = JSON.parse(rulesJson ?? '{}') as { marksCorrect?: number; marksIncorrect?: number; marksUnattempted?: number };
  return { correct: r.marksCorrect ?? 1, incorrect: r.marksIncorrect ?? 0, unattempted: r.marksUnattempted ?? 0 };
}
