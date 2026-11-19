/**
 * Pure logic of the Data Structures and Algorithms Visualiser (CUET-UG Computer Science, paper 308).
 * What is modelled: a bounded stack, queue and deque on a Python list; bubble, selection and insertion sort;
 * linear and binary search; the counts that the lessons use (comparisons, swaps, passes).
 * Every algorithm returns an explicit list of steps, so the page only draws step k and the tests can check every step.
 * Nothing here runs user-typed code: the Python shown on the page is read-only text that mirrors these functions.
 * Status of all lab content: Draft - unverified.
 */

// ---------------------------------------------------------------- small helpers

export const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from) }, (_, k) => from + k);
export const isSorted = (a: number[]) => a.every((v, i) => i === 0 || a[i - 1]! <= v);
export const sameElements = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i]);

/** Small seeded random numbers (mulberry32), so a "random" array can be shown again and tested. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** n different whole numbers from 1..max, in random order. */
export function randomDistinct(n: number, seed: number, max = 99): number[] {
  const r = rng(seed);
  const pool = range(1, max + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}
export const permutation = (n: number, seed: number) => randomDistinct(n, seed, n);

export const ARRAY_LIMITS = { min: 2, max: 12, lo: 1, hi: 99 };
/** Reads "5, 1, 4, 2" into numbers. Returns null with a plain reason when the text is not usable. */
export function parseArray(text: string): { ok: true; a: number[] } | { ok: false; why: string } {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  if (parts.length < ARRAY_LIMITS.min) return { ok: false, why: `Type at least ${ARRAY_LIMITS.min} numbers, separated by commas.` };
  if (parts.length > ARRAY_LIMITS.max) return { ok: false, why: `Use at most ${ARRAY_LIMITS.max} numbers so the bars stay readable.` };
  const a = parts.map(Number);
  if (a.some((v) => !Number.isInteger(v) || v < ARRAY_LIMITS.lo || v > ARRAY_LIMITS.hi)) return { ok: false, why: `Use whole numbers from ${ARRAY_LIMITS.lo} to ${ARRAY_LIMITS.hi}.` };
  return { ok: true, a };
}

// ---------------------------------------------------------------- stack, queue and deque

export type Struct = 'stack' | 'queue' | 'deque';
export type Item = string | number;
/** items[0] is the bottom of a stack and the front of a queue or deque; the last item is the top or the rear. */
export interface DS { kind: Struct; cap: number; items: Item[] }
export type Op = 'push' | 'pop' | 'peek' | 'isEmpty' | 'enqueue' | 'dequeue' | 'front' | 'rear' | 'insertFront' | 'insertRear' | 'deletionFront' | 'deletionRear';

export const OPS: Record<Struct, Op[]> = {
  stack: ['push', 'pop', 'peek', 'isEmpty'],
  queue: ['enqueue', 'dequeue', 'front', 'rear', 'isEmpty'],
  deque: ['insertFront', 'insertRear', 'deletionFront', 'deletionRear', 'front', 'rear', 'isEmpty'],
};
export const LIST_NAME: Record<Struct, string> = { stack: 'st', queue: 'q', deque: 'dq' };
export const STACK_LIMITS = { minCap: 2, maxCap: 8 };

export interface OpResult {
  ds: DS;
  ok: boolean;
  error?: 'overflow' | 'underflow' | 'invalid';
  value?: Item | boolean;
  /** The Python that does this on a list. */
  code: string;
  message: string;
  /** Which slot changed, for the animation. */
  changed: { kind: 'in' | 'out'; index: number } | null;
}

export const newDS = (kind: Struct, cap = 5, items: Item[] = []): DS => ({ kind, cap, items: [...items] });
export const pythonList = (items: Item[]) => `[${items.map((v) => (typeof v === 'string' ? `'${v}'` : String(v))).join(', ')}]`;

/** Performs one operation on a bounded structure. The Python on the page is what a list does; the capacity is the lab's own limit. */
export function applyOp(ds: DS, op: Op, item?: Item): OpResult {
  const n = LIST_NAME[ds.kind];
  const items = [...ds.items];
  const out = (p: Partial<OpResult> & { code: string; message: string }): OpResult => ({ ds: { ...ds, items }, ok: true, changed: null, ...p });
  if (!OPS[ds.kind].includes(op)) return out({ ok: false, error: 'invalid', code: '', message: `${op} is not an operation of a ${ds.kind}.` });
  const full = items.length >= ds.cap;
  const empty = items.length === 0;
  const word = ds.kind === 'stack' ? 'stack' : ds.kind === 'queue' ? 'queue' : 'deque';
  const overflow = (code: string) => out({ ok: false, error: 'overflow', code, message: `Overflow: the ${word} already holds ${ds.cap} items, which is its capacity, so nothing is added. (A plain Python list would simply grow; a fixed-size ${word} cannot.)` });
  const underflow = (code: string) => out({ ok: false, error: 'underflow', code, message: `Underflow: the ${word} is empty, so there is nothing to remove or read. ${code} on an empty list raises IndexError.` });
  switch (op) {
    case 'push':
    case 'enqueue':
    case 'insertRear':
      if (full) return overflow(`${n}.append(${JSON.stringify(item)})`);
      items.push(item as Item);
      return out({ code: `${n}.append(${typeof item === 'string' ? `'${item}'` : item})`, message: `${op === 'push' ? 'Pushed' : op === 'enqueue' ? 'Enqueued' : 'Inserted at the rear:'} ${item}. ${op === 'push' ? 'It is now the top.' : 'It is now the rear.'}`, changed: { kind: 'in', index: items.length - 1 } });
    case 'insertFront':
      if (full) return overflow(`${n}.insert(0, ${JSON.stringify(item)})`);
      items.unshift(item as Item);
      return out({ code: `${n}.insert(0, ${typeof item === 'string' ? `'${item}'` : item})`, message: `Inserted ${item} at the front. It is now the front.`, changed: { kind: 'in', index: 0 } });
    case 'pop':
    case 'deletionRear': {
      if (empty) return underflow(`${n}.pop()`);
      const v = items.pop() as Item;
      return out({ code: `${n}.pop()`, value: v, message: `${op === 'pop' ? 'Popped' : 'Deleted at the rear:'} ${v}. ${items.length === 0 ? 'The ' + word + ' is now empty.' : `The ${op === 'pop' ? 'top' : 'rear'} is now ${items[items.length - 1]}.`}`, changed: { kind: 'out', index: items.length } });
    }
    case 'dequeue':
    case 'deletionFront': {
      if (empty) return underflow(`${n}.pop(0)`);
      const v = items.shift() as Item;
      return out({ code: `${n}.pop(0)`, value: v, message: `${op === 'dequeue' ? 'Dequeued' : 'Deleted at the front:'} ${v}. ${items.length === 0 ? 'The ' + word + ' is now empty.' : `Every other item shifts one place left; the front is now ${items[0]}.`}`, changed: { kind: 'out', index: 0 } });
    }
    case 'peek':
      if (empty) return underflow(`${n}[-1]`);
      return out({ code: `${n}[-1]`, value: items[items.length - 1], message: `Peek: the top is ${items[items.length - 1]}. Nothing is removed.` });
    case 'front':
      if (empty) return underflow(`${n}[0]`);
      return out({ code: `${n}[0]`, value: items[0], message: `Front: ${items[0]}. Nothing is removed.` });
    case 'rear':
      if (empty) return underflow(`${n}[-1]`);
      return out({ code: `${n}[-1]`, value: items[items.length - 1], message: `Rear: ${items[items.length - 1]}. Nothing is removed.` });
    case 'isEmpty':
      return out({ code: `len(${n}) == 0`, value: empty, message: `isEmpty: ${empty ? 'True' : 'False'} (the ${word} holds ${items.length} item${items.length === 1 ? '' : 's'}).` });
  }
}

/** Runs a list of operations in order and returns the final structure plus what each one returned. */
export function runOps(start: DS, ops: [Op, Item?][]): { ds: DS; results: OpResult[] } {
  let ds = start;
  const results: OpResult[] = [];
  for (const [op, item] of ops) {
    const r = applyOp(ds, op, item);
    results.push(r);
    ds = r.ds;
  }
  return { ds, results };
}

// ---------------------------------------------------------------- hand-executed tasks on a stack

export type TaskKind = 'brackets' | 'reverse';
export type TaskAction = 'push' | 'pop' | 'yes' | 'no';
export interface TaskState {
  kind: TaskKind;
  text: string;
  /** Index of the next character to read. */
  pos: number;
  stack: string[];
  /** Reverse task: letters popped so far. */
  out: string;
  mistakes: number;
  phase: 'work' | 'verdict' | 'done';
  /** Brackets task: the final answer once the task is done. */
  balanced?: boolean;
  /** How many correct actions the student has made. */
  moves: number;
}
export const OPEN = '([{';
export const CLOSE = ')]}';
export const matches = (open: string, close: string) => OPEN.indexOf(open) >= 0 && OPEN.indexOf(open) === CLOSE.indexOf(close);
/** The textbook answer, computed on its own (used by the tests to check the step-by-step task). */
export function isBalanced(text: string): boolean {
  const st: string[] = [];
  for (const c of text) {
    if (OPEN.includes(c)) st.push(c);
    else if (CLOSE.includes(c)) {
      const t = st.pop();
      if (t === undefined || !matches(t, c)) return false;
    }
  }
  return st.length === 0;
}
/** Brackets task: letters, digits and operators are not brackets, so the student does not act on them. */
const skipPlain = (t: TaskState): TaskState => {
  if (t.kind !== 'brackets' || t.phase !== 'work') return t;
  let pos = t.pos;
  while (pos < t.text.length && !OPEN.includes(t.text[pos]!) && !CLOSE.includes(t.text[pos]!)) pos++;
  return { ...t, pos, phase: pos >= t.text.length ? 'verdict' : 'work' };
};
export const newTask = (kind: TaskKind, text: string): TaskState => skipPlain({ kind, text, pos: 0, stack: [], out: '', mistakes: 0, phase: text.length === 0 ? 'done' : 'work', moves: 0 });

/** The action the algorithm needs next. */
export function expectedAction(t: TaskState): TaskAction | null {
  if (t.phase === 'done') return null;
  if (t.kind === 'reverse') return t.pos < t.text.length ? 'push' : 'pop';
  if (t.phase === 'verdict') return t.stack.length === 0 ? 'yes' : 'no';
  const c = t.text[t.pos]!;
  return OPEN.includes(c) ? 'push' : 'pop';
}

export function taskAct(t: TaskState, action: TaskAction): { task: TaskState; correct: boolean; message: string } {
  const want = expectedAction(t);
  if (want === null) return { task: t, correct: false, message: 'This task is finished. Press Restart to try again.' };
  if (action !== want) {
    let why: string;
    if (t.kind === 'reverse') why = want === 'push' ? `Not yet: first push every letter in order. ${t.text.length - t.pos} letter${t.text.length - t.pos === 1 ? '' : 's'} still to push.` : 'All letters are in the stack: now pop them one by one. The last letter in is the first out.';
    else if (want === 'yes' || want === 'no') why = `The whole string is read. ${t.stack.length === 0 ? 'The stack is empty, so every bracket was matched: the string is balanced.' : `The stack still holds ${t.stack.join(' ')}: these opening brackets were never closed, so it is not balanced.`}`;
    else why = want === 'push' ? `'${t.text[t.pos]}' is an opening bracket: push it.` : `'${t.text[t.pos]}' is a closing bracket: pop the top and check that it is the matching opening bracket.`;
    return { task: { ...t, mistakes: t.mistakes + 1 }, correct: false, message: why };
  }
  const next: TaskState = { ...t, stack: [...t.stack], moves: t.moves + 1 };
  if (t.kind === 'reverse') {
    if (action === 'push') {
      next.stack.push(t.text[t.pos]!);
      next.pos++;
      return { task: next, correct: true, message: `Pushed ${t.text[t.pos]}.` };
    }
    const c = next.stack.pop()!;
    next.out += c;
    if (next.stack.length === 0) next.phase = 'done';
    return { task: next, correct: true, message: `Popped ${c}. Output so far: ${next.out}.${next.phase === 'done' ? ' The stack is empty: the string is reversed.' : ''}` };
  }
  if (t.phase === 'verdict') {
    next.phase = 'done';
    next.balanced = action === 'yes';
    return { task: next, correct: true, message: next.balanced ? 'Correct: balanced.' : 'Correct: not balanced.' };
  }
  const c = t.text[t.pos]!;
  if (action === 'push') {
    next.stack.push(c);
    next.pos++;
    const moved = skipPlain(next);
    return { task: moved, correct: true, message: `Pushed ${c}.${moved.phase === 'verdict' ? ' End of the string: is the stack empty?' : ''}` };
  }
  const top = next.stack.pop();
  next.pos++;
  if (top === undefined) {
    next.phase = 'done';
    next.balanced = false;
    return { task: next, correct: true, message: `Underflow: ${c} closes a bracket that was never opened (the stack was empty). Not balanced.` };
  }
  if (!matches(top, c)) {
    next.phase = 'done';
    next.balanced = false;
    return { task: next, correct: true, message: `Popped ${top}, but ${c} does not match it. Not balanced.` };
  }
  const moved = skipPlain(next);
  return { task: moved, correct: true, message: `Popped ${top}: it matches ${c}.${moved.phase === 'verdict' ? ' End of the string: is the stack empty?' : ''}` };
}

export const BRACKET_STRINGS = ['{[()]}', '(a+b)*[c-d]', '([)]', '((x)', 'a+b)'];
export const REVERSE_WORDS = ['STACK', 'QUEUE', 'PYTHON'];
export const TASK_TEXT_MAX = 12;
export const cleanTaskText = (kind: TaskKind, raw: string) => (kind === 'brackets' ? raw.replace(/[^()[\]{}a-zA-Z0-9+\-*/ ]/g, '') : raw.replace(/[^a-zA-Z0-9]/g, '')).slice(0, TASK_TEXT_MAX);

// ---------------------------------------------------------------- sorting

export type SortAlg = 'bubble' | 'selection' | 'insertion';
export interface SortStep {
  kind: 'start' | 'pick' | 'compare' | 'swap' | 'passEnd' | 'done';
  /** The list after this step. */
  a: number[];
  /** The two positions being compared or swapped. */
  pair: [number, number] | null;
  /** Bubble: -. Selection: the position of the smallest so far. Insertion: the position of the key. */
  marked: number | null;
  /** Positions that are already fixed (bubble, selection: final places; insertion: the sorted left part). */
  settled: number[];
  cmp: number;
  /** Swaps (insertion sort: shifts of the key by one place). */
  swp: number;
  /** 1-based pass number (0 before the first pass). */
  pass: number;
  /** Index of the Python line that is executing, in CODE[alg]. */
  line: number;
  text: string;
}

export const CODE: Record<SortAlg | 'bubblePlain', string[]> = {
  bubble: [
    'def bubble_sort(a):',
    '    n = len(a)',
    '    for i in range(n - 1):',
    '        swapped = False',
    '        for j in range(n - 1 - i):',
    '            if a[j] > a[j + 1]:',
    '                a[j], a[j + 1] = a[j + 1], a[j]',
    '                swapped = True',
    '        if not swapped:',
    '            break',
  ],
  bubblePlain: [
    'def bubble_sort(a):',
    '    n = len(a)',
    '    for i in range(n - 1):',
    '        for j in range(n - 1 - i):',
    '            if a[j] > a[j + 1]:',
    '                a[j], a[j + 1] = a[j + 1], a[j]',
  ],
  selection: [
    'def selection_sort(a):',
    '    n = len(a)',
    '    for i in range(n - 1):',
    '        m = i',
    '        for j in range(i + 1, n):',
    '            if a[j] < a[m]:',
    '                m = j',
    '        a[i], a[m] = a[m], a[i]',
  ],
  insertion: [
    'def insertion_sort(a):',
    '    for i in range(1, len(a)):',
    '        key = a[i]',
    '        j = i - 1',
    '        while j >= 0 and a[j] > key:',
    '            a[j + 1] = a[j]',
    '            j -= 1',
    '        a[j + 1] = key',
  ],
};
export const codeFor = (alg: SortAlg, early = true) => (alg === 'bubble' && !early ? CODE.bubblePlain : CODE[alg]);

type Draft = Omit<SortStep, 'a' | 'cmp' | 'swp'>;

export function sortSteps(alg: SortAlg, input: number[], early = true): SortStep[] {
  const a = [...input];
  const n = a.length;
  let cmp = 0;
  let swp = 0;
  const steps: SortStep[] = [];
  const emit = (d: Draft) => steps.push({ ...d, a: [...a], cmp, swp, pair: d.pair ? [...d.pair] : null });
  const all = range(0, n);
  emit({ kind: 'start', pair: null, marked: null, settled: [], pass: 0, line: 0, text: `Start: the list is ${JSON.stringify(a)}.` });

  if (alg === 'bubble') {
    const L = early ? { forJ: 4, ifc: 5, swap: 6, passEnd: 2, stop: 9 } : { forJ: 3, ifc: 4, swap: 5, passEnd: 2, stop: 2 };
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - 1 - i; j++) {
        cmp++;
        emit({ kind: 'compare', pair: [j, j + 1], marked: null, settled: range(n - i, n), pass: i + 1, line: L.ifc, text: `Pass ${i + 1}: compare a[${j}] = ${a[j]} with a[${j + 1}] = ${a[j + 1]}. ${a[j]! > a[j + 1]! ? `${a[j]} > ${a[j + 1]}, so they are in the wrong order.` : `${a[j]} <= ${a[j + 1]}, so they stay.`}` });
        if (a[j]! > a[j + 1]!) {
          const x = a[j]!, y = a[j + 1]!;
          [a[j], a[j + 1]] = [y, x];
          swp++;
          swapped = true;
          emit({ kind: 'swap', pair: [j, j + 1], marked: null, settled: range(n - i, n), pass: i + 1, line: L.swap, text: `Swap ${x} and ${y}: the list is now ${JSON.stringify(a)}.` });
        }
      }
      if (early && !swapped) {
        emit({ kind: 'passEnd', pair: null, marked: null, settled: all, pass: i + 1, line: L.stop, text: `Pass ${i + 1} made no swap, so the list is already sorted: the loop stops early.` });
        break;
      }
      emit({ kind: 'passEnd', pair: null, marked: null, settled: range(n - 1 - i, n), pass: i + 1, line: L.passEnd, text: `End of pass ${i + 1}: the ${i + 1} largest element${i === 0 ? ' is' : 's are'} now in final place at the right end, ${JSON.stringify(a)}.` });
    }
  } else if (alg === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let m = i;
      emit({ kind: 'pick', pair: null, marked: m, settled: range(0, i), pass: i + 1, line: 3, text: `Pass ${i + 1}: assume the smallest of positions ${i} to ${n - 1} is a[${i}] = ${a[i]}.` });
      for (let j = i + 1; j < n; j++) {
        cmp++;
        const smaller = a[j]! < a[m]!;
        const before = m;
        if (smaller) m = j;
        emit({ kind: 'compare', pair: [j, before], marked: m, settled: range(0, i), pass: i + 1, line: 5, text: `Compare a[${j}] = ${a[j]} with the smallest so far a[${before}] = ${a[before]}. ${smaller ? `${a[j]} is smaller: the smallest is now at position ${j}.` : 'No change.'}` });
      }
      if (m !== i) {
        const x = a[i]!, y = a[m]!;
        [a[i], a[m]] = [y, x];
        swp++;
        emit({ kind: 'swap', pair: [i, m], marked: i, settled: range(0, i + 1), pass: i + 1, line: 7, text: `Swap a[${i}] = ${x} with the smallest, a[${m}] = ${y}: the list is now ${JSON.stringify(a)}.` });
      }
      emit({ kind: 'passEnd', pair: null, marked: null, settled: range(0, i + 1), pass: i + 1, line: 2, text: `End of pass ${i + 1}: ${m === i ? `a[${i}] = ${a[i]} was already the smallest, so no swap is made. ` : ''}the ${i + 1} smallest element${i === 0 ? ' is' : 's are'} in final place at the left end.` });
    }
  } else {
    for (let i = 1; i < n; i++) {
      const key = a[i]!;
      let kp = i;
      let j = i - 1;
      emit({ kind: 'pick', pair: null, marked: kp, settled: range(0, i), pass: i, line: 2, text: `Pass ${i}: take key = a[${i}] = ${key} and insert it into the sorted part, positions 0 to ${i - 1}.` });
      while (j >= 0) {
        cmp++;
        const move = a[j]! > key;
        emit({ kind: 'compare', pair: [j, kp], marked: kp, settled: range(0, i), pass: i, line: 4, text: `Compare a[${j}] = ${a[j]} with the key ${key}. ${move ? `${a[j]} > ${key}: shift ${a[j]} one place right.` : `${a[j]} <= ${key}: the key stays here.`}` });
        if (!move) break;
        [a[j], a[kp]] = [a[kp]!, a[j]!];
        swp++;
        kp = j;
        emit({ kind: 'swap', pair: [j, j + 1], marked: kp, settled: range(0, i), pass: i, line: 5, text: `The key ${key} moves one place left: the list is now ${JSON.stringify(a)}.` });
        j--;
      }
      emit({ kind: 'passEnd', pair: null, marked: kp, settled: range(0, i + 1), pass: i, line: 7, text: `End of pass ${i}: the key ${key} is placed at position ${kp}. The first ${i + 1} elements are sorted: ${JSON.stringify(a)}.` });
    }
  }
  emit({ kind: 'done', pair: null, marked: null, settled: all, pass: steps[steps.length - 1]!.pass, line: 0, text: `Sorted: ${JSON.stringify(a)}. ${cmp} comparison${cmp === 1 ? '' : 's'} and ${swp} ${alg === 'insertion' ? 'shift' : 'swap'}${swp === 1 ? '' : 's'}.` });
  return steps;
}

/** Counts only (no steps), written separately from sortSteps so the tests can compare the two. */
export function countSort(alg: SortAlg, input: number[], early = true): { cmp: number; swp: number; passes: number } {
  const a = [...input];
  const n = a.length;
  let cmp = 0, swp = 0, passes = 0;
  if (alg === 'bubble') {
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      passes++;
      for (let j = 0; j < n - 1 - i; j++) {
        cmp++;
        if (a[j]! > a[j + 1]!) { [a[j], a[j + 1]] = [a[j + 1]!, a[j]!]; swp++; swapped = true; }
      }
      if (early && !swapped) break;
    }
  } else if (alg === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      passes++;
      let m = i;
      for (let j = i + 1; j < n; j++) { cmp++; if (a[j]! < a[m]!) m = j; }
      if (m !== i) { [a[i], a[m]] = [a[m]!, a[i]!]; swp++; }
    }
  } else {
    for (let i = 1; i < n; i++) {
      passes++;
      const key = a[i]!;
      let j = i - 1;
      while (j >= 0) {
        cmp++;
        if (a[j]! > key) { a[j + 1] = a[j]!; swp++; j--; } else break;
      }
      a[j + 1] = key;
    }
  }
  return { cmp, swp, passes };
}

export const inversions = (a: number[]) => { let c = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i]! > a[j]!) c++; return c; };

/** Student mode: the list the student sees is the state before the next swap; this returns that swap's step index, or -1. */
export function nextSwapIndex(steps: SortStep[], from: number): number {
  for (let k = from + 1; k < steps.length; k++) if (steps[k]!.kind === 'swap') return k;
  return -1;
}

/**
 * Student mode: the student clicks two bars to swap. Returns whether that is the algorithm's next swap, and the step to show next.
 * On success the lab jumps to the swap step (every comparison before it is counted).
 */
export function checkStudentSwap(steps: SortStep[], cur: number, p: number, q: number, alg: SortAlg): { correct: boolean; to: number; message: string } {
  const k = nextSwapIndex(steps, cur);
  const here = steps[cur]!.a;
  if (p === q) return { correct: false, to: cur, message: 'Choose two different bars.' };
  if (k < 0) return { correct: false, to: cur, message: 'Nothing is left to swap: the list is sorted.' };
  const want = steps[k]!.pair!;
  const hit = (want[0] === p && want[1] === q) || (want[0] === q && want[1] === p);
  const pair = `positions ${Math.min(...want)} and ${Math.max(...want)}`;
  if (hit) return { correct: true, to: k, message: `Correct. ${steps[k]!.text}` };
  const lo = Math.min(p, q), hi = Math.max(p, q);
  if (alg === 'bubble') {
    if (hi - lo !== 1) return { correct: false, to: cur, message: `Bubble sort only compares and swaps neighbours, and ${lo} and ${hi} are not neighbours. The next swap is at ${pair}.` };
    if (here[lo]! <= here[hi]!) return { correct: false, to: cur, message: `${here[lo]} and ${here[hi]} are already in order, so bubble sort leaves them. The next swap is at ${pair}.` };
    return { correct: false, to: cur, message: `${here[lo]} > ${here[hi]} is out of order, but bubble sort works left to right and reaches ${pair} first.` };
  }
  if (alg === 'selection') return { correct: false, to: cur, message: `Selection sort swaps the first unsorted position with the smallest element of the unsorted part. That is ${pair}.` };
  return { correct: false, to: cur, message: `Insertion sort moves the key one place left past a larger neighbour. The next move is ${pair}.` };
}

/** A pointer for the student, not the answer: where the algorithm will look next. */
export function studentPointer(steps: SortStep[], cur: number, alg: SortAlg): string {
  const k = nextSwapIndex(steps, cur);
  if (k < 0) return steps[steps.length - 1]!.kind === 'done' ? 'No swap is left. Press Finish to see the totals.' : '';
  const target = steps[k]!;
  if (alg === 'selection') return `Pass ${target.pass}: find the smallest element of positions ${target.pass - 1} to ${steps[cur]!.a.length - 1} and swap it to position ${target.pass - 1}.`;
  const nxt = steps[cur + 1];
  if (nxt && nxt.kind === 'compare' && nxt.pair) return `Pass ${nxt.pass}: the algorithm continues comparing positions ${Math.min(...nxt.pair)} and ${Math.max(...nxt.pair)}. Which two bars does it swap next?`;
  return `Pass ${target.pass}: which two bars does the algorithm swap next?`;
}

// ---------------------------------------------------------------- searching

export interface SearchStep {
  kind: 'start' | 'compare' | 'found' | 'notfound';
  /** Linear: the position being compared. */
  i: number | null;
  low: number;
  high: number;
  mid: number | null;
  cmp: number;
  line: number;
  text: string;
  /** Binary: where the key lies relative to a[mid]. */
  outcome?: 'eq' | 'right' | 'left' | 'ne';
}

export const SEARCH_CODE = {
  linear: ['def linear_search(a, key):', '    for i in range(len(a)):', '        if a[i] == key:', '            return i', '    return -1'],
  binary: ['def binary_search(a, key):', '    low = 0', '    high = len(a) - 1', '    while low <= high:', '        mid = (low + high) // 2', '        if a[mid] == key:', '            return mid', '        elif a[mid] < key:', '            low = mid + 1', '        else:', '            high = mid - 1', '    return -1'],
};

export function linearSteps(a: number[], key: number): SearchStep[] {
  const n = a.length;
  const s: SearchStep[] = [{ kind: 'start', i: null, low: 0, high: n - 1, mid: null, cmp: 0, line: 0, text: `Search for ${key} one element at a time from the start.` }];
  let cmp = 0;
  for (let i = 0; i < n; i++) {
    cmp++;
    const eq = a[i] === key;
    s.push({ kind: 'compare', i, low: 0, high: n - 1, mid: null, cmp, line: 2, outcome: eq ? 'eq' : 'ne', text: `Compare a[${i}] = ${a[i]} with ${key}: ${eq ? 'equal.' : 'not equal.'}` });
    if (eq) {
      s.push({ kind: 'found', i, low: 0, high: n - 1, mid: null, cmp, line: 3, text: `Found ${key} at index ${i} after ${cmp} comparison${cmp === 1 ? '' : 's'}.` });
      return s;
    }
  }
  s.push({ kind: 'notfound', i: null, low: 0, high: n - 1, mid: null, cmp, line: 4, text: `${key} is not in the list: ${cmp} comparisons, the whole list was checked. Returns -1.` });
  return s;
}

export function binarySteps(a: number[], key: number): SearchStep[] {
  let low = 0, high = a.length - 1, cmp = 0;
  const s: SearchStep[] = [{ kind: 'start', i: null, low, high, mid: null, cmp: 0, line: 2, text: `The list is sorted. low = 0 and high = ${high} enclose the whole list.` }];
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    cmp++;
    const v = a[mid]!;
    const outcome = v === key ? 'eq' : v < key ? 'right' : 'left';
    s.push({
      kind: 'compare', i: null, low, high, mid, cmp, outcome,
      line: outcome === 'eq' ? 5 : outcome === 'right' ? 8 : 10,
      text: `low = ${low}, high = ${high}, mid = (${low} + ${high}) // 2 = ${mid}. a[${mid}] = ${v}${outcome === 'eq' ? ` equals ${key}.` : outcome === 'right' ? ` < ${key}: the key can only be on the right, so low = ${mid + 1}.` : ` > ${key}: the key can only be on the left, so high = ${mid - 1}.`}`,
    });
    if (outcome === 'eq') {
      s.push({ kind: 'found', i: mid, low, high, mid, cmp, line: 6, text: `Found ${key} at index ${mid} after ${cmp} comparison${cmp === 1 ? '' : 's'}.` });
      return s;
    }
    if (outcome === 'right') low = mid + 1;
    else high = mid - 1;
  }
  s.push({ kind: 'notfound', i: null, low, high, mid: null, cmp, line: 11, text: `low = ${low} is greater than high = ${high}: nothing is left to search. ${key} is not in the list (${cmp} comparison${cmp === 1 ? '' : 's'}). Returns -1.` });
  return s;
}

export const searchCount = (alg: 'linear' | 'binary', a: number[], key: number) => (alg === 'linear' ? linearSteps(a, key) : binarySteps(a, key)).at(-1)!.cmp;
/** floor(log2 n) + 1: the most comparisons binary search ever needs on n elements. */
export const binaryWorst = (n: number) => (n < 1 ? 0 : Math.floor(Math.log2(n)) + 1);

/** Student mode for binary search: is the clicked position the middle of low..high? */
export function checkMiddle(low: number, high: number, clicked: number): { correct: boolean; message: string } {
  const mid = Math.floor((low + high) / 2);
  if (clicked === mid) return { correct: true, message: `Correct: mid = (${low} + ${high}) // 2 = ${mid}.` };
  return { correct: false, message: `Not quite. mid = (low + high) // 2 = (${low} + ${high}) // 2 = ${mid}. Whole-number division drops the fraction.` };
}

/** All keys present in the list plus an absent one: best, average and worst comparisons for both searches. */
export interface SearchStats { best: number; avg: number; worst: number; absent: number }
export function searchStats(alg: 'linear' | 'binary', a: number[]): SearchStats {
  const counts = a.map((k) => searchCount(alg, a, k));
  return { best: Math.min(...counts), avg: counts.reduce((x, y) => x + y, 0) / counts.length, worst: Math.max(...counts), absent: searchCount(alg, a, Math.max(...a) + 1) };
}
/** A sorted list of n different values with gaps, so absent keys exist. */
export const sortedList = (n: number, seed: number) => randomDistinct(n, seed, Math.max(99, n * 3)).sort((x, y) => x - y);

// ---------------------------------------------------------------- the Measure step

export interface MeasureRow {
  n: number;
  bubble: number;
  selection: number;
  insertion: number;
  linAvg: number;
  linWorst: number;
  binAvg: number;
  binWorst: number;
}
export const MEASURE_LIMITS = { min: 4, max: 256, step: 1 };
/** One measured run at size n: the three sorts on the same shuffled data, and both searches over every key of a sorted list of n. */
export function measureRow(n: number): MeasureRow {
  const data = permutation(n, 1000 + n);
  const sorted = range(1, n + 1);
  const lin = searchStats('linear', sorted);
  const bin = searchStats('binary', sorted);
  return {
    n,
    bubble: countSort('bubble', data, true).cmp,
    selection: countSort('selection', data).cmp,
    insertion: countSort('insertion', data).cmp,
    linAvg: lin.avg, linWorst: lin.worst, binAvg: bin.avg, binWorst: bin.worst,
  };
}

// ---------------------------------------------------------------- predictions and practice questions

export interface AlgoPredict {
  id: string;
  title: string;
  /** Which tab of the bench the test runs on. */
  tab: 'stack' | 'sort' | 'search';
  prompt: string;
  options: string[];
  answer: number;
}

export const PRED_SORT_ARRAY = [9, 4, 7, 2, 6];
export const PRED_SWAPS_ARRAY = [6, 5, 4, 3, 2, 1];
export const PRED_PUSHES = [3, 5, 7];

export const PREDICTS: AlgoPredict[] = [
  { id: 'a1', title: 'Binary search, 64 elements', tab: 'search', prompt: 'A sorted list holds 64 elements. What is the largest number of comparisons binary search can need to find a key or to decide it is absent?', options: ['6', '7', '8', '64'], answer: 1 },
  { id: 'a2', title: 'Two passes of bubble sort', tab: 'sort', prompt: 'Bubble sort runs on [9, 4, 7, 2, 6]. After exactly two passes, which elements are in their final places at the right end?', options: ['9 only', '7 and 9', '6 and 9', '2 and 9'], answer: 1 },
  { id: 'a3', title: 'What does pop() return?', tab: 'stack', prompt: 'An empty stack gets push(3), push(5), push(7). What does the next pop() return?', options: ['3', '5', '7', 'It raises an error'], answer: 2 },
  { id: 'a4', title: 'Fewest swaps', tab: 'sort', prompt: 'The list [6, 5, 4, 3, 2, 1] is sorted into ascending order. Which sort makes the fewest swaps (an insertion shift counts as one)?', options: ['Bubble sort', 'Selection sort', 'Insertion sort', 'All three make the same number'], answer: 1 },
];

export interface AlgoMcq { id: string; q: string; options: string[]; answer: number; why: string }
/** CUET-style practice questions written for this lab. Every key is recomputed by the tests. Draft - unverified. */
export const APPLY: AlgoMcq[] = [
  {
    id: 'q1',
    q: 'An empty stack st is used as: push 4, push 8, push 2, pop, pop, push 6. What does the stack hold now, from bottom to top?',
    options: ['[4, 8, 6]', '[4, 6]', '[6, 2]', '[4, 8, 2, 6]'],
    answer: 1,
    why: 'push 4, 8, 2 gives [4, 8, 2]. The two pops remove 2 and then 8, leaving [4]. push 6 puts 6 on top: [4, 6].',
  },
  {
    id: 'q2',
    q: 'A queue is stored in the list q = [10, 20, 30] (index 0 is the front). After q.append(40) and then q.pop(0) twice, what is q[0]?',
    options: ['10', '20', '30', '40'],
    answer: 2,
    why: 'append(40) gives [10, 20, 30, 40]. pop(0) removes the front each time: first 10, then 20, leaving [30, 40]. The front, q[0], is 30.',
  },
  {
    id: 'q3',
    q: 'Bubble sort arranges [7, 3, 5, 1] in ascending order. How many swaps does it make altogether?',
    options: ['3', '4', '5', '6'],
    answer: 2,
    why: 'Each swap of neighbours removes exactly one out-of-order pair. The out-of-order pairs are (7,3), (7,5), (7,1), (3,1) and (5,1): 5 swaps. Pass 1 makes 3 swaps, pass 2 makes 1, pass 3 makes 1.',
  },
  {
    id: 'q4',
    q: 'Binary search looks for 31 in the sorted list [3, 8, 12, 19, 25, 31, 40]. How many comparisons with list elements does it make?',
    options: ['1', '2', '3', '6'],
    answer: 1,
    why: 'low = 0, high = 6, mid = 3 and a[3] = 19 < 31, so low = 4. Then mid = (4 + 6) // 2 = 5 and a[5] = 31: found. That is 2 comparisons. A linear search would need 6.',
  },
  {
    id: 'q5',
    q: 'Selection sort is applied to a list of 6 elements. How many comparisons does it make, whatever the order of the data?',
    options: ['5', '12', '15', '36'],
    answer: 2,
    why: 'Pass 1 compares 5 times, pass 2 compares 4, then 3, 2 and 1: 5 + 4 + 3 + 2 + 1 = 15 = n(n − 1)/2 with n = 6. Selection sort scans the whole unsorted part even when the list is already sorted.',
  },
];
