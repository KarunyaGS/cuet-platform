import { describe, expect, it, vi } from 'vitest';
import { evaluateOhmsAttempt, measureVpa, recordVpaObservation, REQUIRED_CONNECTIONS, startVpa, submitVpa, vpaStartSchema, vpaSubmitSchema } from '../src/services/vpa';
import { ohmsLawReading } from '../../frontend/src/visual/circuit';

const correctSubmit = (r = 8) => vpaSubmitSchema.parse({
  wires: [...REQUIRED_CONNECTIONS], formula: 'V_OVER_I', calculatedResistance: r,
  graphShape: 'LINEAR_ORIGIN', graphSlope: r,
});

describe('Virtual Practical Assessment: Ohm’s law', () => {
  it('reuses the circuit Ohm’s-law meter model and rejects impossible apparatus values', () => {
    expect(ohmsLawReading(6, 8)).toEqual({ voltage: 6, current: 0.75, resistance: 8 });
    expect(() => ohmsLawReading(6, 0)).toThrow(RangeError);
  });

  it('randomizes chapter task resistance and voltage readings without exposing the unknown resistance', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    let bound: unknown[] = [];
    const db = { prepare: vi.fn(() => ({ bind: vi.fn((...args: unknown[]) => { bound = args; return { run }; }) })) } as unknown as D1Database;
    const task = await startVpa(db, 'user-1', vpaStartSchema.parse({ mode: 'INDEPENDENT' }));
    expect(task.voltageLevels).toHaveLength(3);
    expect(new Set(task.voltageLevels).size).toBe(3);
    expect(task.voltageLevels).toEqual([...task.voltageLevels].sort((a, b) => a - b));
    expect(task.voltageLevels.every((v) => v >= 2 && v <= 8)).toBe(true);
    expect(task).not.toHaveProperty('resistance');
    const privateChallenge = JSON.parse(String(bound[6]));
    expect(privateChallenge.resistance).toBeGreaterThanOrEqual(6);
    expect(privateChallenge.resistance).toBeLessThanOrEqual(24);
    expect(task).not.toHaveProperty('resistance');
  });

  it('awards full marks for a complete valid procedure and gives partial marks for wrong apparatus and answers', () => {
    const challenge = { resistance: 8, voltageLevels: [2, 4, 6], seed: 11 };
    const values = [0.25, 0.5, 0.75].map((current, i) => ({ voltage: [2, 4, 6][i]!, current, voltageIndex: i }));
    const complete = { readings: values, meterReadings: values, mistakes: [] };
    const full = evaluateOhmsAttempt(challenge, complete, correctSubmit(8));
    expect(full).toMatchObject({ score: 100, passed: true, apparatus: { score: 20 }, measurements: { score: 25 }, calculations: { score: 20 }, graph: { score: 15 } });

    const partial = evaluateOhmsAttempt(challenge, { readings: [complete.readings[0]!], meterReadings: [complete.meterReadings[0]!], mistakes: ['Invalid wiring attempt.'] }, {
      ...correctSubmit(8), wires: ['battery+:ammeter+', 'ammeter-:resistorA'], formula: 'I_OVER_V', calculatedResistance: 12, graphShape: 'CURVED', graphSlope: 12,
    });
    expect(partial.score).toBeLessThan(full.score);
    expect(partial.score).toBeGreaterThan(0);
    expect(partial.passed).toBe(false);
    expect(partial.incorrectSteps.length).toBeGreaterThan(0);
    expect(partial.recommendedRevision).toContain('Review ammeter series and voltmeter parallel connections.');
  });

  it('grades a bad circuit configuration as an apparatus error', () => {
    const report = evaluateOhmsAttempt({ resistance: 10, voltageLevels: [3, 5, 7], seed: 5 }, { readings: [], meterReadings: [], mistakes: [] }, {
      ...correctSubmit(), wires: ['battery+:resistorA', 'battery-:resistorB'],
    });
    expect(report.apparatus.score).toBeLessThan(20);
    expect(report.incorrectSteps).toContain('The final circuit was not wired correctly.');
  });

  it('deducts apparatus marks for extra or duplicate wiring', () => {
    const report = evaluateOhmsAttempt({ resistance: 10, voltageLevels: [3, 5, 7], seed: 5 }, { readings: [], meterReadings: [], mistakes: [] }, {
      ...correctSubmit(), wires: [...REQUIRED_CONNECTIONS, 'battery+:resistorA'],
    });
    expect(report.apparatus.score).toBeLessThan(20);
    expect(report.passed).toBe(false);
  });

  it('awards measurement marks from student-entered observations rather than generated meter values', () => {
    const challenge = { resistance: 8, voltageLevels: [2, 4, 6], seed: 5 };
    const meterReadings = [0.25, 0.5, 0.75].map((current, i) => ({ voltage: [2, 4, 6][i]!, current, voltageIndex: i }));
    const accurate = evaluateOhmsAttempt(challenge, { readings: meterReadings, meterReadings, mistakes: [] }, correctSubmit());
    const inaccurate = evaluateOhmsAttempt(challenge, { readings: [{ ...meterReadings[0]!, current: 0.7 }, ...meterReadings.slice(1)], meterReadings, mistakes: [] }, correctSubmit());
    expect(accurate.measurements.score).toBe(25);
    expect(inaccurate.measurements.score).toBeLessThan(accurate.measurements.score);
  });

  it('rejects invalid meter readings and records the procedure mistake', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    let updateBindings: unknown[] = [];
    const first = vi.fn().mockResolvedValue({ id: 'vpa_1', user_id: 'u1', lab_id: 'ohms-law', chapter_id: 'physics-current-electricity-ohms-law', lesson_id: null, mode: 'INDEPENDENT', status: 'IN_PROGRESS', challenge_json: JSON.stringify({ resistance: 8, voltageLevels: [2, 4, 6], seed: 9 }), responses_json: JSON.stringify({ readings: [], meterReadings: [], mistakes: [] }), report_json: null, score: null, max_score: 100, started_at: '', submitted_at: null });
    const db = { prepare: vi.fn((sql: string) => ({ bind: vi.fn((...args: unknown[]) => { updateBindings = args; return sql.startsWith('SELECT') ? { first } : { run }; }) })) } as unknown as D1Database;
    const result = await measureVpa(db, 'u1', 'vpa_1', { wires: ['battery+:resistorA'], voltageIndex: 0 });
    expect(result).toMatchObject({ valid: false });
    expect(run).toHaveBeenCalledOnce();
    expect(JSON.parse(String(updateBindings[0])).mistakes[0]).toContain('not valid');
  });

  it('returns a server-computed reading only for the correctly built circuit', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    let updateBindings: unknown[] = [];
    const first = vi.fn().mockResolvedValue({ id: 'vpa_2', user_id: 'u1', lab_id: 'ohms-law', chapter_id: 'physics-current-electricity-ohms-law', lesson_id: null, mode: 'INDEPENDENT', status: 'IN_PROGRESS', challenge_json: JSON.stringify({ resistance: 8, voltageLevels: [2, 4, 6], seed: 9 }), responses_json: JSON.stringify({ readings: [], meterReadings: [], mistakes: [] }), report_json: null, score: null, max_score: 100, started_at: '', submitted_at: null });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn((...args: unknown[]) => { updateBindings = args; return updateBindings.length === 2 ? { first } : { run }; }) })) } as unknown as D1Database;
    const result = await measureVpa(db, 'u1', 'vpa_2', { wires: [...REQUIRED_CONNECTIONS], voltageIndex: 0 });
    expect(result).toMatchObject({ valid: true, reading: { voltage: 2, current: 0.25, voltageIndex: 0 } });
    expect(JSON.parse(String(updateBindings[0])).meterReadings).toHaveLength(1);
  });

  it('stores the student-entered observation for deterministic measurement scoring', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    let bindings: unknown[] = [];
    const first = vi.fn().mockResolvedValue({ id: 'vpa_3', user_id: 'u1', lab_id: 'ohms-law', chapter_id: 'physics-current-electricity-ohms-law', lesson_id: null, mode: 'INDEPENDENT', status: 'IN_PROGRESS', challenge_json: JSON.stringify({ resistance: 8, voltageLevels: [2, 4, 6], seed: 9 }), responses_json: JSON.stringify({ readings: [], meterReadings: [{ voltage: 2, current: 0.25, voltageIndex: 0 }], mistakes: [] }), report_json: null, score: null, max_score: 100, started_at: '', submitted_at: null });
    const db = { prepare: vi.fn((sql: string) => ({ bind: vi.fn((...args: unknown[]) => { bindings = args; return sql.startsWith('SELECT') ? { first } : { run }; }) })) } as unknown as D1Database;
    const result = await recordVpaObservation(db, 'u1', 'vpa_3', { wires: [...REQUIRED_CONNECTIONS], voltageIndex: 0, observedVoltage: 2, observedCurrent: 0.3 });
    expect(result.recorded).toBe(true);
    expect(JSON.parse(String(bindings[0])).readings[0]).toMatchObject({ voltage: 2, current: 0.3, voltageIndex: 0 });
  });

  it('accepts different attempts independently with new private challenge state', async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const db = { prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run })) })) } as unknown as D1Database;
    const a = await startVpa(db, 'user-1', vpaStartSchema.parse({ mode: 'GUIDED' }));
    const b = await startVpa(db, 'user-1', vpaStartSchema.parse({ mode: 'GUIDED' }));
    expect(a.attemptId).not.toBe(b.attemptId);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('marks the existing lab milestone only after a passing submitted assessment', async () => {
    const values = [{ voltage: 2, current: 0.25, voltageIndex: 0 }, { voltage: 4, current: 0.5, voltageIndex: 1 }, { voltage: 6, current: 0.75, voltageIndex: 2 }];
    const readings = { readings: values, meterReadings: values, mistakes: [] };
    const sqlSeen: string[] = [];
    const attempt = { id: 'vpa_1', user_id: 'u1', lab_id: 'ohms-law', chapter_id: 'physics-current-electricity-ohms-law', lesson_id: 'lesson-1', mode: 'INDEPENDENT', status: 'IN_PROGRESS', challenge_json: JSON.stringify({ resistance: 8, voltageLevels: [2, 4, 6], seed: 8 }), responses_json: JSON.stringify(readings), report_json: null, score: null, max_score: 100, started_at: '', submitted_at: null };
    const db = { prepare: vi.fn((sql: string) => {
      sqlSeen.push(sql);
      return { bind: vi.fn(() => ({
        first: vi.fn(async () => sql.includes('virtual_practical_attempts') ? attempt : sql.includes('learning_resources') ? { node_id: 'node-1', paper_id: 'paper-322' } : null),
        run: vi.fn(async () => ({ success: true })),
      })) };
    }) } as unknown as D1Database;
    const passed = await submitVpa(db, 'u1', 'vpa_1', correctSubmit());
    expect(passed.report.passed).toBe(true);
    expect(sqlSeen.some((sql) => sql.includes('INSERT INTO learning_activity'))).toBe(true);

    sqlSeen.length = 0;
    const incompleteDb = { prepare: vi.fn((sql: string) => {
      sqlSeen.push(sql);
      return { bind: vi.fn(() => ({
        first: vi.fn(async () => sql.includes('virtual_practical_attempts') ? { ...attempt, responses_json: JSON.stringify({ readings: [readings.readings[0]], meterReadings: [readings.meterReadings[0]], mistakes: [] }) } : sql.includes('learning_resources') ? { node_id: 'node-1', paper_id: 'paper-322' } : null),
        run: vi.fn(async () => ({ success: true })),
      })) };
    }) } as unknown as D1Database;
    const incomplete = await submitVpa(incompleteDb, 'u1', 'vpa_2', correctSubmit());
    expect(incomplete.report.passed).toBe(false);
    expect(sqlSeen.some((sql) => sql.includes('INSERT INTO learning_activity'))).toBe(false);
  });
});
