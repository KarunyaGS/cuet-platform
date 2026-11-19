/** Virtual Practical Assessment attempt lifecycle and deterministic rubric scoring. */
import { z } from 'zod';
import { invalid, notFound, conflict } from '../lib/errors';
import { newId } from '../lib/hash';
import { recordActivity } from './student-tools';
import { ohmsLawReading } from '../../../frontend/src/visual/circuit';

export const VPA_LAB_ID = 'ohms-law';
export const OHMS_CHAPTER_ID = 'physics-current-electricity-ohms-law';
export const vpaStartSchema = z.object({
  labId: z.literal(VPA_LAB_ID).default(VPA_LAB_ID),
  chapterId: z.literal(OHMS_CHAPTER_ID).default(OHMS_CHAPTER_ID),
  mode: z.enum(['GUIDED', 'INDEPENDENT']).default('INDEPENDENT'),
  lessonId: z.string().max(100).optional(),
});
export const vpaMeasureSchema = z.object({ wires: z.array(z.string().max(60)).max(12), voltageIndex: z.number().int().min(0).max(2) });
export const vpaRecordSchema = vpaMeasureSchema.extend({ observedVoltage: z.number().finite().min(0).max(1000), observedCurrent: z.number().finite().min(0).max(1000) });
export const vpaSubmitSchema = z.object({
  wires: z.array(z.string().max(60)).max(12),
  formula: z.enum(['V_OVER_I', 'I_OVER_V', 'V_TIMES_I']),
  calculatedResistance: z.number().finite().min(0).max(10000),
  graphShape: z.enum(['LINEAR_ORIGIN', 'LINEAR_OFFSET', 'CURVED', 'NO_RELATION']),
  graphSlope: z.number().finite().min(0).max(10000),
});

type Mode = 'GUIDED' | 'INDEPENDENT';
export type VpaChallenge = { resistance: number; voltageLevels: number[]; seed: number };
type Challenge = VpaChallenge;
type Reading = { voltage: number; current: number; voltageIndex: number };
type Responses = { readings: Reading[]; meterReadings: Reading[]; mistakes: string[] };
export type VpaReport = {
  score: number; maxScore: number; passed: boolean;
  procedure: { score: number; max: number; feedback: string };
  apparatus: { score: number; max: number; feedback: string; connections: string[] };
  measurements: { score: number; max: number; feedback: string; readings: Reading[] };
  calculations: { score: number; max: number; feedback: string; expectedResistance: number; submittedResistance: number };
  graph: { score: number; max: number; feedback: string; expectedSlope: number; submittedSlope: number };
  incorrectSteps: string[]; recommendedRevision: string[];
};

export interface VpaTaskDefinition {
  labId: string; chapterId: string; subject: 'Physics'; title: string; weights: VpaScoreWeights;
  generateChallenge: () => VpaChallenge;
  measure: (challenge: VpaChallenge, voltageIndex: number) => Omit<Reading, 'voltageIndex'> | null;
  evaluateAttempt: (challenge: VpaChallenge, responses: Responses, input: z.infer<typeof vpaSubmitSchema>) => VpaReport;
}

export const OHMS_CHAPTERS = [{ id: OHMS_CHAPTER_ID, label: "Ohm's law: V–I characteristics", labId: VPA_LAB_ID }] as const;
export type VpaScoreWeights = { procedure: number; apparatus: number; measurements: number; calculations: number; graph: number };
export const OHMS_SCORE_WEIGHTS: VpaScoreWeights = { procedure: 20, apparatus: 20, measurements: 25, calculations: 20, graph: 15 };
export const REQUIRED_CONNECTIONS = ['battery+:ammeter+', 'ammeter-:resistorA', 'resistorB:battery-', 'voltmeter+:resistorA', 'voltmeter-:resistorB'] as const;

const sorted = (wires: string[]) => wires.map((wire) => wire.split(':').sort().join(':')).sort();
const expectedWires = sorted([...REQUIRED_CONNECTIONS]);
const exactCircuit = (wires: string[]) => JSON.stringify(sorted(wires)) === JSON.stringify(expectedWires);
const wireOverlap = (wires: string[]) => {
  const actual = sorted(wires);
  return expectedWires.filter((wire) => actual.includes(wire)).length;
};
const randInt = (min: number, max: number) => min + Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]! / 0x1_0000_0000 * (max - min + 1));
const parse = <T>(json: string): T => JSON.parse(json) as T;
const readAttempt = async (db: D1Database, userId: string, id: string) => {
  const row = await db.prepare('SELECT * FROM virtual_practical_attempts WHERE id = ? AND user_id = ?').bind(id, userId).first<{ id: string; user_id: string; lab_id: string; chapter_id: string; lesson_id: string | null; mode: Mode; status: string; challenge_json: string; responses_json: string; report_json: string | null; score: number | null; max_score: number; started_at: string; submitted_at: string | null }>();
  if (!row) throw notFound('Practical assessment');
  return row;
};

/** Starts a chapter-registry task. The unknown resistance is persisted privately and never returned to the browser. */
export async function startVpa(db: D1Database, userId: string, input: z.infer<typeof vpaStartSchema>) {
  if (input.lessonId) {
    const lesson = await db.prepare(`SELECT p.code AS paper_code FROM learning_resources r
      JOIN curriculum_nodes n ON n.id = r.curriculum_node_id
      JOIN syllabus_versions v ON v.id = n.syllabus_version_id
      JOIN test_papers p ON p.id = v.test_paper_id WHERE r.id = ?`).bind(input.lessonId).first<{ paper_code: string }>();
    if (!lesson || lesson.paper_code !== '322') throw invalid('This assessment can only be linked to a Physics lesson');
  }
  const definition = VPA_TASKS[input.chapterId];
  if (!definition || definition.labId !== input.labId) throw invalid('This chapter does not have a practical assessment yet');
  const challenge: Challenge = definition.generateChallenge();
  const id = newId('vpa');
  const now = new Date().toISOString();
  const maxScore = Object.values(definition.weights).reduce((sum, weight) => sum + weight, 0);
  await db.prepare(`INSERT INTO virtual_practical_attempts
    (id, user_id, lab_id, chapter_id, lesson_id, mode, status, challenge_json, responses_json, max_score, started_at)
    VALUES (?, ?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?)`)
    .bind(id, userId, input.labId, input.chapterId, input.lessonId ?? null, input.mode, JSON.stringify(challenge), JSON.stringify({ readings: [], meterReadings: [], mistakes: [] } satisfies Responses), maxScore, now).run();
  return { attemptId: id, labId: input.labId, chapterId: input.chapterId, lessonId: input.lessonId ?? null, mode: input.mode, voltageLevels: challenge.voltageLevels, status: 'IN_PROGRESS' as const, readings: [] as Reading[], meterReadings: [] as Reading[], report: null };
}

export async function vpaDetails(db: D1Database, userId: string, id: string) {
  const row = await readAttempt(db, userId, id);
  return {
    attemptId: row.id, labId: row.lab_id, chapterId: row.chapter_id, lessonId: row.lesson_id, mode: row.mode,
    voltageLevels: parse<Challenge>(row.challenge_json).voltageLevels,
    status: row.status, readings: parse<Responses>(row.responses_json).readings, meterReadings: parse<Responses>(row.responses_json).meterReadings,
    report: row.report_json ? parse<VpaReport>(row.report_json) : null,
  };
}

export async function measureVpa(db: D1Database, userId: string, id: string, input: z.infer<typeof vpaMeasureSchema>) {
  const row = await readAttempt(db, userId, id);
  if (row.status !== 'IN_PROGRESS') throw conflict('This assessment has already been submitted');
  const challenge = parse<Challenge>(row.challenge_json);
  const definition = VPA_TASKS[row.chapter_id];
  if (!definition) throw invalid('The assessment meter model for this attempt is no longer available');
  const responses = parse<Responses>(row.responses_json);
  if (!exactCircuit(input.wires)) {
    const message = 'Circuit connections are not valid. Put the ammeter in series and the voltmeter across the unknown resistor.';
    responses.mistakes.push(message);
    await db.prepare('UPDATE virtual_practical_attempts SET responses_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(responses), id, userId).run();
    return { valid: false as const, message };
  }
  const priorMeter = responses.meterReadings.find((reading) => reading.voltageIndex === input.voltageIndex);
  if (priorMeter) return { valid: true as const, reading: priorMeter, alreadyRecorded: true };
  const voltage = challenge.voltageLevels[input.voltageIndex];
  if (voltage === undefined) throw invalid('Select one of the available battery settings');
  // Digital meters are displayed to 0.01 A, just as the shared circuit simulator does.
  const meterReading = definition.measure(challenge, input.voltageIndex);
  if (!meterReading) throw invalid('The selected voltage setting is not part of this assessment');
  const reading = { ...meterReading, voltageIndex: input.voltageIndex };
  responses.meterReadings.push(reading);
  await db.prepare('UPDATE virtual_practical_attempts SET responses_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(responses), id, userId).run();
  return { valid: true as const, reading, alreadyRecorded: false };
}

export async function recordVpaObservation(db: D1Database, userId: string, id: string, input: z.infer<typeof vpaRecordSchema>) {
  const row = await readAttempt(db, userId, id);
  if (row.status !== 'IN_PROGRESS') throw conflict('This assessment has already been submitted');
  const responses = parse<Responses>(row.responses_json);
  if (!exactCircuit(input.wires)) {
    const message = 'The circuit changed after the meter reading. Check your connections and measure again.';
    responses.mistakes.push(message);
    await db.prepare('UPDATE virtual_practical_attempts SET responses_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(responses), id, userId).run();
    return { recorded: false as const, message };
  }
  const meter = responses.meterReadings.find((reading) => reading.voltageIndex === input.voltageIndex);
  if (!meter) return { recorded: false as const, message: 'Read the meters at this voltage setting before recording an observation.' };
  const observation = { voltage: input.observedVoltage, current: input.observedCurrent, voltageIndex: input.voltageIndex };
  const prior = responses.readings.findIndex((reading) => reading.voltageIndex === input.voltageIndex);
  if (prior >= 0) responses.readings[prior] = observation;
  else responses.readings.push(observation);
  await db.prepare('UPDATE virtual_practical_attempts SET responses_json = ? WHERE id = ? AND user_id = ?').bind(JSON.stringify(responses), id, userId).run();
  return { recorded: true as const, reading: observation };
}

export function evaluateOhmsAttempt(challenge: Challenge, responses: Responses, input: z.infer<typeof vpaSubmitSchema>, weights: VpaScoreWeights = OHMS_SCORE_WEIGHTS): VpaReport {
  const maxScore = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  if (maxScore <= 0 || Object.values(weights).some((weight) => weight < 0)) throw new RangeError('Assessment scoring weights must be positive and non-negative');
  const expectedR = challenge.resistance;
  const correctWires = wireOverlap(input.wires);
  const extraWires = Math.max(0, sorted(input.wires).length - correctWires);
  const appScore = Math.max(0, Math.round((weights.apparatus * correctWires) / REQUIRED_CONNECTIONS.length - Math.min(weights.apparatus * 0.4, extraWires * weights.apparatus * 0.08)));
  const circuitOk = exactCircuit(input.wires);
  const readings = responses.readings;
  const readingIndexes = new Set(readings.map((r) => r.voltageIndex));
  const measurementQuality = readings.reduce((sum, reading) => {
    const meter = responses.meterReadings.find((value) => value.voltageIndex === reading.voltageIndex);
    if (!meter) return sum;
    const band = (error: number, full: number, partial: number, minimal: number) => error <= full ? 1 : error <= partial ? 0.65 : error <= minimal ? 0.3 : 0;
    const voltageQuality = band(Math.abs(reading.voltage - meter.voltage), 0.01, 0.05, 0.15);
    const currentQuality = band(Math.abs(reading.current - meter.current), 0.01, 0.03, 0.08);
    return sum + (voltageQuality + currentQuality) / 2;
  }, 0);
  const measurementScore = Math.round(weights.measurements * Math.min(1, measurementQuality / 3));
  const procedureScore = Math.max(0, Math.round(weights.procedure * Math.min(1, readingIndexes.size / 3) - Math.min(weights.procedure * 0.4, responses.mistakes.length * weights.procedure * 0.1)));
  const relR = Math.abs(input.calculatedResistance - expectedR) / expectedR;
  const calcScore = (input.formula === 'V_OVER_I' ? Math.round(weights.calculations * 0.4) : 0) + Math.round(weights.calculations * (relR <= 0.03 ? 0.6 : relR <= 0.08 ? 0.4 : relR <= 0.15 ? 0.2 : 0));
  const slopeError = Math.abs(input.graphSlope - expectedR) / expectedR;
  const graphScore = (input.graphShape === 'LINEAR_ORIGIN' ? Math.round(weights.graph * 0.47) : 0) + (readingIndexes.size >= 2 ? Math.round(weights.graph * (slopeError <= 0.05 ? 0.53 : slopeError <= 0.12 ? 0.33 : 0)) : 0);
  const incorrectSteps: string[] = [];
  if (!circuitOk) incorrectSteps.push('The final circuit was not wired correctly.');
  if (responses.mistakes.length) incorrectSteps.push(...responses.mistakes);
  if (readingIndexes.size < 3) incorrectSteps.push('Record a reading at each of the three voltage settings.');
  if (input.formula !== 'V_OVER_I') incorrectSteps.push('Use R = V / I and report resistance in ohms.');
  if (measurementScore < weights.measurements * 0.85) incorrectSteps.push('Check each observation against the voltmeter and ammeter before recording it.');
  if (relR > 0.08) incorrectSteps.push('The calculated resistance is outside the accepted tolerance.');
  if (input.graphShape !== 'LINEAR_ORIGIN') incorrectSteps.push('For an ohmic resistor, plot V against I: the graph is a straight line through the origin.');
  if (readingIndexes.size < 2 || slopeError > 0.12) incorrectSteps.push('Use the V–I graph slope to estimate resistance.');
  const score = procedureScore + appScore + measurementScore + calcScore + graphScore;
  const recommendedRevision = [...new Set([
    !circuitOk || responses.mistakes.length ? 'Review ammeter series and voltmeter parallel connections.' : '',
    measurementScore < weights.measurements * 0.85 ? 'Practise recording meter values carefully, including the decimal places.' : '',
    readingIndexes.size < 3 || measurementScore < 22 ? 'Practise taking repeatable V and I readings at multiple settings.' : '',
    calcScore < 16 ? 'Revise Ohm’s law, R = V/I, and significant figures.' : '',
    graphScore < 12 ? 'Review how the gradient of a V–I graph represents resistance.' : '',
  ].filter(Boolean))];
  const passed = score >= maxScore * 0.6 && circuitOk && readingIndexes.size === 3 && measurementScore >= weights.measurements * 0.6 && procedureScore >= weights.procedure * 0.5;
  return {
    score, maxScore, passed,
    procedure: { score: procedureScore, max: weights.procedure, feedback: procedureScore >= weights.procedure * 0.8 ? 'You recorded a useful set of readings with few invalid attempts.' : 'Complete all three settings and check the circuit before measuring.' },
    apparatus: { score: appScore, max: weights.apparatus, feedback: circuitOk ? 'Correct series ammeter and parallel voltmeter arrangement.' : `${correctWires} of 5 required connections matched.`, connections: [...input.wires] },
    measurements: { score: measurementScore, max: weights.measurements, feedback: readings.length === 3 && measurementScore >= weights.measurements * 0.88 ? 'Readings are consistent with the apparatus.' : 'More valid, accurate readings are needed.', readings },
    calculations: { score: calcScore, max: weights.calculations, feedback: calcScore >= weights.calculations * 0.8 ? 'Correct relationship and resistance estimate.' : 'Check the formula, units and calculated value.', expectedResistance: expectedR, submittedResistance: input.calculatedResistance },
    graph: { score: graphScore, max: weights.graph, feedback: graphScore >= weights.graph * 0.8 ? 'The graph interpretation and gradient are consistent.' : 'Use a straight V against I graph; its gradient is R.', expectedSlope: expectedR, submittedSlope: input.graphSlope },
    incorrectSteps, recommendedRevision,
  };
}

function generateOhmsChallenge(): VpaChallenge {
  const resistance = randInt(3, 12) * 2;
  const voltageLevels = [2, 3, 4, 5, 6, 7, 8].map((value) => ({ value, order: randInt(1, 0x7fffffff) })).sort((a, b) => a.order - b.order).slice(0, 3).map((entry) => entry.value).sort((a, b) => a - b);
  return { resistance, voltageLevels, seed: randInt(1, 0x7fffffff) };
}

/** Register a chapter here to add its challenge generator, meter model and rubric without changing attempt storage. */
export const VPA_TASKS: Record<string, VpaTaskDefinition> = {
  [OHMS_CHAPTER_ID]: {
    labId: VPA_LAB_ID, chapterId: OHMS_CHAPTER_ID, subject: 'Physics', title: "Ohm's law: V–I characteristics",
    weights: OHMS_SCORE_WEIGHTS,
    generateChallenge: generateOhmsChallenge,
    measure: (challenge, voltageIndex) => {
      const voltage = challenge.voltageLevels[voltageIndex];
      return voltage === undefined ? null : ohmsLawReading(voltage, challenge.resistance);
    },
    evaluateAttempt: (challenge, responses, input) => evaluateOhmsAttempt(challenge, responses, input, OHMS_SCORE_WEIGHTS),
  },
};

export async function submitVpa(db: D1Database, userId: string, id: string, input: z.infer<typeof vpaSubmitSchema>) {
  const row = await readAttempt(db, userId, id);
  if (row.status !== 'IN_PROGRESS') throw conflict('This assessment has already been submitted');
  const challenge = parse<Challenge>(row.challenge_json);
  const responses = parse<Responses>(row.responses_json);
  const definition = VPA_TASKS[row.chapter_id];
  if (!definition) throw invalid('The assessment rubric for this attempt is no longer available');
  const report = definition.evaluateAttempt(challenge, responses, input);
  const now = new Date().toISOString();
  await db.prepare(`UPDATE virtual_practical_attempts SET status = 'SUBMITTED', report_json = ?, score = ?, submitted_at = ? WHERE id = ? AND user_id = ? AND status = 'IN_PROGRESS'`)
    .bind(JSON.stringify(report), report.score, now, id, userId).run();
  let progressRecorded = false;
  if (report.passed && row.lesson_id) progressRecorded = (await recordActivity(db, userId, { kind: 'LAB_COMPLETE', resourceId: row.lesson_id })).recorded;
  return { report, progressRecorded };
}
