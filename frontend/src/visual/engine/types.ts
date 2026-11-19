/**
 * Chapter-lab specification: one small, typed description of a dedicated practical lab for ONE chapter.
 * The shared engine (SpecLab) turns it into the standard guided lab: live controls, a chapter-specific picture,
 * live readouts and graphs, Predict -> Experiment -> Measure -> Analyse -> Understand -> Apply, completion saved once.
 * Every number the student sees comes from the functions in the spec, and the engine test recomputes every
 * prediction and practice answer from those same functions, so a key can never disagree with the model.
 * Status of all lab content: Draft - unverified.
 */
import type { ReactNode } from 'react';
import type { LabSubject } from '../labs';

export type Values = Record<string, number>;
export type Outs = Record<string, number>;

export interface VarDef {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  start: number;
  /** slider moves on a log scale (min and max must be above 0) */
  log?: boolean;
  /** decimals to show */
  digits?: number;
}
export interface OutDef {
  id: string;
  label: string;
  unit: string;
  fn: (v: Values) => number;
  digits?: number;
  /** show in scientific notation */
  sci?: boolean;
}
export interface GraphDef {
  id: string;
  title: string;
  /** the variable swept along the x axis (every other variable stays at its current value) */
  x: string;
  /** the output drawn on the y axis */
  y: string;
  logX?: boolean;
  logY?: boolean;
}
export interface Ctx {
  base: Values;
  test: Values;
  outs: (v: Values) => Outs;
}
export interface PredDef {
  id: string;
  title: string;
  prompt: string;
  /** values that differ from the starting values for the "before" bench */
  base: Partial<Values>;
  /** values for the "after" bench, applied on top of base */
  test: Partial<Values>;
  options: string[];
  answer: number;
  /** recomputes the correct option index from the model; must equal `answer` */
  verify: (c: Ctx) => number;
  /** explanation using the real numbers of the two benches */
  why: (c: Ctx) => string;
}
export interface FitDef {
  xLabel: string;
  yLabel: string;
  x: (v: Values, o: Outs) => number;
  y: (v: Values, o: Outs) => number;
  /** what the straight-line slope and intercept mean, in a sentence using the fitted numbers */
  interpret: (slope: number, intercept: number, v: Values) => string;
}
export interface MeasureDef {
  instruction: string;
  /** the variable the student changes between readings (at least three distinct values are needed) */
  vary: string;
  /** outputs listed in the readings table (the varied variable is always listed) */
  record: string[];
  fit?: FitDef;
}
export interface QuestionDef {
  id: string;
  q: string;
  options: string[];
  answer: number;
  why: string;
  /** recomputes the correct option index from the model; must equal `answer` */
  verify: () => number;
}
export interface SceneProps {
  v: Values;
  o: Outs;
}
export interface Spec {
  /** unique, lowercase, e.g. 'phys-capacitors' */
  id: string;
  subject: LabSubject;
  /** the lesson (chapter) this lab belongs to: the lesson title starts with this */
  lessonTitleStartsWith: string;
  /** exact heading of the lesson section after which the card appears */
  afterHeading: string;
  title: string;
  format: string;
  blurb: string;
  can: string[];
  minutes: number;
  vars: VarDef[];
  outs: OutDef[];
  graphs: GraphDef[];
  /** SVG content drawn in a 0 0 400 230 box; it must change with the values (not decorative) */
  scene?: (p: SceneProps) => ReactNode;
  /** alt text for the picture */
  sceneAlt?: string;
  discover: string[];
  experiment: string[];
  understand: string[];
  preds: PredDef[];
  measure: MeasureDef;
  questions: QuestionDef[];
}
