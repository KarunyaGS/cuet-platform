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

export interface EvaluateOptions {
  /**
   * CUET-UG bulletin rule: where more than one option is correct, a response selecting a correct option earns the full marks.
   * With it, a multi-select question counts as correct when every option chosen is a correct one. Without it (plain learning
   * practice), the student must choose exactly the full set.
   */
  anyCorrectOption?: boolean;
}

export function evaluateResponse(type: QuestionType, key: AnswerKeyData, response: StudentResponse, marking: Marking, options: EvaluateOptions = {}): { outcome: Outcome; score: number } {
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
    if (options.anyCorrectOption) return score(selected.every((p) => correct.includes(p)) ? 'CORRECT' : 'INCORRECT');
    return score(selected.length === correct.length && selected.every((p, i) => p === correct[i]) ? 'CORRECT' : 'INCORRECT');
  }
  // Single-answer formats: one option must be chosen. If the key lists more than one correct option
  // (an answer-key anomaly accepted by NTA), choosing any of them earns the marks, as the bulletins state.
  if (selected.length !== 1) return score('INCORRECT');
  return score(correct.includes(selected[0]!) ? 'CORRECT' : 'INCORRECT');
}

/**
 * The marking scheme of one exam cycle, in one place. Every test reads it from here (nothing else in the code carries +5 or −1),
 * and a copy is stored with each attempt so a later change to the rules cannot alter an old result.
 */
export interface MarkingScheme extends Marking {
  /** What kind of attempt this scheme was applied to: a CUET-style simulation, or untimed learning practice. */
  kind: 'CUET_SIMULATION' | 'PRACTICE';
  exam: string | null;
  year: number | null;
  /** Human label, e.g. "NTA CUET (UG) 2026 Information Bulletin". */
  sourceLabel: string;
  sourceUrl: string | null;
  /** A response selecting any correct option earns the marks when several options are correct. */
  anyCorrectOption: boolean;
  /** A wrong or dropped question: every candidate who appeared is credited the full marks for it. */
  creditDroppedQuestions: boolean;
}

interface RuleFields { marksCorrect?: number; marksIncorrect?: number; marksUnattempted?: number; source?: string }

export function markingFromRules(rulesJson: string | null): Marking {
  const r = JSON.parse(rulesJson ?? '{}') as RuleFields;
  // No silent default: a test with no recorded scheme must fail loudly rather than be scored with made-up marks.
  if (typeof r.marksCorrect !== 'number' || typeof r.marksIncorrect !== 'number') throw new Error('This exam cycle has no marking scheme recorded');
  return { correct: r.marksCorrect, incorrect: r.marksIncorrect, unattempted: r.marksUnattempted ?? 0 };
}

export function buildScheme(rulesJson: string | null, ctx: { kind: MarkingScheme['kind']; exam?: string | null; year?: number | null; sourceLabel?: string; useCycleSource?: boolean }): MarkingScheme {
  const marking = markingFromRules(rulesJson);
  const r = JSON.parse(rulesJson ?? '{}') as RuleFields;
  const exam = ctx.exam ?? null;
  const year = ctx.year ?? null;
  const cycleLabel = exam && year ? `NTA ${exam.replace('_', '-')} ${year} Information Bulletin` : 'NTA Information Bulletin';
  return {
    ...marking, kind: ctx.kind, exam, year,
    sourceLabel: ctx.sourceLabel ?? cycleLabel,
    sourceUrl: ctx.useCycleSource === false ? null : (r.source ?? null),
    anyCorrectOption: ctx.kind === 'CUET_SIMULATION',
    creditDroppedQuestions: true,
  };
}

export interface AttemptQuestion { id: string; dropped: boolean }
export interface AttemptAnswer { questionId: string; outcome: Outcome }

/**
 * The one place a finished attempt is totalled. Maximum marks come from the questions actually in the attempt. A dropped or wrong
 * question is credited to everyone who appeared, whatever they answered; otherwise correct earns marks, incorrect loses marks,
 * unanswered scores nothing. Counts always add up: correct + incorrect + credited + unattempted = number of questions.
 */
export function scoreAttempt(questions: AttemptQuestion[], answers: AttemptAnswer[], scheme: Marking & { creditDroppedQuestions?: boolean }) {
  const given = new Map(answers.map((a) => [a.questionId, a.outcome]));
  let correct = 0, incorrect = 0, unattempted = 0, credited = 0;
  for (const q of questions) {
    if (q.dropped && scheme.creditDroppedQuestions !== false) { credited++; continue; }
    const o = given.get(q.id) ?? 'UNATTEMPTED';
    if (o === 'CORRECT') correct++;
    else if (o === 'INCORRECT') incorrect++;
    else unattempted++;
  }
  const score = correct * scheme.correct + incorrect * scheme.incorrect + credited * scheme.correct + unattempted * scheme.unattempted;
  return { score, maxScore: questions.length * scheme.correct, correct, incorrect, unattempted, credited };
}
