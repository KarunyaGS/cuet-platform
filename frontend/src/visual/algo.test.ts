import { describe, expect, it } from 'vitest';
import {
  APPLY, applyOp, codeFor, SEARCH_CODE, binarySteps, binaryWorst, BRACKET_STRINGS, checkMiddle, checkStudentSwap, cleanTaskText, countSort, expectedAction, inversions, isBalanced, isSorted, linearSteps,
  measureRow, newDS, newTask, nextSwapIndex, OPS, parseArray, permutation, PRED_PUSHES, PRED_SORT_ARRAY, PRED_SWAPS_ARRAY, PREDICTS, pythonList, randomDistinct, range, REVERSE_WORDS,
  runOps, sameElements, searchCount, searchStats, sortedList, sortSteps, studentPointer, taskAct, type Op, type SortAlg, type TaskKind, type TaskState,
} from './algo';

const ALGS: SortAlg[] = ['bubble', 'selection', 'insertion'];
const ARRAYS: number[][] = [
  [], [1], [2, 1], [1, 2], [5, 1, 4, 2, 8], [64, 25, 12, 22, 11], [9, 5, 1, 4, 3], [1, 2, 3, 4, 5, 6], [6, 5, 4, 3, 2, 1], [3, 3, 1, 2, 1], [7, 7, 7, 7],
  [9, 4, 7, 2, 6], [7, 3, 5, 1], ...[7, 8, 9, 10, 11, 12].map((n, k) => randomDistinct(n, 40 + k)),
];

describe('every algorithm sorts every test array', () => {
  for (const alg of ALGS) {
    for (const early of [true, false]) {
      if (alg !== 'bubble' && !early) continue;
      it(`${alg}${alg === 'bubble' ? (early ? ' (early stop)' : ' (plain)') : ''}`, () => {
        for (const arr of ARRAYS) {
          const steps = sortSteps(alg, arr, early);
          const last = steps.at(-1)!;
          expect(last.kind).toBe('done');
          expect(isSorted(last.a)).toBe(true);
          expect(sameElements(last.a, arr)).toBe(true);
          // every step is a permutation of the input, counters never go down
          let c = 0, s = 0;
          for (const st of steps) {
            expect(sameElements(st.a, arr)).toBe(true);
            expect(st.cmp).toBeGreaterThanOrEqual(c);
            expect(st.swp).toBeGreaterThanOrEqual(s);
            c = st.cmp; s = st.swp;
          }
        }
      });
    }
  }
});

describe('step counters equal the number of compare and swap steps, and the independent counter', () => {
  it('holds for every algorithm and array', () => {
    for (const alg of ALGS) {
      for (const arr of ARRAYS) {
        const steps = sortSteps(alg, arr);
        const last = steps.at(-1)!;
        expect(last.cmp).toBe(steps.filter((x) => x.kind === 'compare').length);
        expect(last.swp).toBe(steps.filter((x) => x.kind === 'swap').length);
        const c = countSort(alg, arr);
        expect(c.cmp).toBe(last.cmp);
        expect(c.swp).toBe(last.swp);
      }
    }
  });
  it('a swap step exchanges exactly the two positions it names', () => {
    for (const alg of ALGS) {
      const steps = sortSteps(alg, [9, 4, 7, 2, 6, 1, 8]);
      steps.forEach((st, k) => {
        if (st.kind !== 'swap') return;
        const prev = steps[k - 1]!.a;
        const [p, q] = st.pair!;
        const exp = [...prev];
        [exp[p], exp[q]] = [exp[q]!, exp[p]!];
        if (alg === 'insertion') expect(st.a).toEqual(exp);
        else expect(st.a).toEqual(exp);
        expect(prev[p]! > prev[q]! || prev[p]! < prev[q]! || prev[p] === prev[q]).toBe(true);
      });
    }
  });
});

describe('known formulas', () => {
  it('plain bubble sort makes n(n-1)/2 comparisons for every input of size n', () => {
    for (const n of range(2, 13)) {
      for (const arr of [range(1, n + 1), range(1, n + 1).reverse(), randomDistinct(n, n, 99)]) {
        const st = sortSteps('bubble', arr, false);
        expect(st.at(-1)!.cmp).toBe((n * (n - 1)) / 2);
        expect(st.at(-1)!.swp).toBe(inversions(arr));
      }
    }
  });
  it('bubble sort with the early stop: sorted input needs n-1 comparisons and no swap, reversed needs n(n-1)/2 of each', () => {
    for (const n of range(2, 13)) {
      const a = sortSteps('bubble', range(1, n + 1), true).at(-1)!;
      expect([a.cmp, a.swp]).toEqual([n - 1, 0]);
      const b = sortSteps('bubble', range(1, n + 1).reverse(), true).at(-1)!;
      expect([b.cmp, b.swp]).toEqual([(n * (n - 1)) / 2, (n * (n - 1)) / 2]);
    }
  });
  it('selection sort always makes n(n-1)/2 comparisons and at most n-1 swaps', () => {
    for (const n of range(2, 13)) {
      for (const arr of [range(1, n + 1), range(1, n + 1).reverse(), randomDistinct(n, 7 * n)]) {
        const r = sortSteps('selection', arr).at(-1)!;
        expect(r.cmp).toBe((n * (n - 1)) / 2);
        expect(r.swp).toBeLessThanOrEqual(n - 1);
      }
      expect(sortSteps('selection', range(1, n + 1)).at(-1)!.swp).toBe(0);
    }
  });
  it('insertion sort: shifts equal the inversions; sorted input n-1 comparisons; reversed n(n-1)/2', () => {
    for (const n of range(2, 13)) {
      const s = sortSteps('insertion', range(1, n + 1)).at(-1)!;
      expect([s.cmp, s.swp]).toEqual([n - 1, 0]);
      const r = sortSteps('insertion', range(1, n + 1).reverse()).at(-1)!;
      expect([r.cmp, r.swp]).toEqual([(n * (n - 1)) / 2, (n * (n - 1)) / 2]);
      const x = randomDistinct(n, 3 * n);
      const t = sortSteps('insertion', x).at(-1)!;
      expect(t.swp).toBe(inversions(x));
      expect(t.cmp).toBeLessThanOrEqual(inversions(x) + n - 1);
    }
  });
  it('the lesson dry runs: [5,1,4,2,8] bubble swaps per pass 3,1,0; selection [64,25,12,22,11]; insertion [9,5,1,4,3]', () => {
    const b = sortSteps('bubble', [5, 1, 4, 2, 8]);
    const passEnds = b.filter((s) => s.kind === 'passEnd');
    expect(passEnds[0]!.a).toEqual([1, 4, 2, 5, 8]);
    expect(passEnds[0]!.swp).toBe(3);
    expect(passEnds[1]!.a).toEqual([1, 2, 4, 5, 8]);
    expect(passEnds[1]!.swp - passEnds[0]!.swp).toBe(1);
    expect(passEnds[2]!.swp - passEnds[1]!.swp).toBe(0);
    expect(passEnds).toHaveLength(3);
    const s = sortSteps('selection', [64, 25, 12, 22, 11]).filter((x) => x.kind === 'passEnd').map((x) => x.a);
    expect(s[0]).toEqual([11, 25, 12, 22, 64]);
    expect(s[1]).toEqual([11, 12, 25, 22, 64]);
    expect(s[2]).toEqual([11, 12, 22, 25, 64]);
    expect(s[3]).toEqual([11, 12, 22, 25, 64]);
    const i = sortSteps('insertion', [9, 5, 1, 4, 3]).filter((x) => x.kind === 'passEnd').map((x) => x.a);
    expect(i[0]).toEqual([5, 9, 1, 4, 3]);
    expect(i[1]).toEqual([1, 5, 9, 4, 3]);
    expect(i[2]).toEqual([1, 4, 5, 9, 3]);
    expect(i[3]).toEqual([1, 3, 4, 5, 9]);
  });
});

describe('invariants after each pass', () => {
  it('bubble: after k passes the k largest are in final place at the right end', () => {
    const arr = randomDistinct(10, 5);
    const sorted = [...arr].sort((x, y) => x - y);
    for (const st of sortSteps('bubble', arr, false).filter((x) => x.kind === 'passEnd')) {
      const k = st.pass;
      expect(st.a.slice(arr.length - k)).toEqual(sorted.slice(arr.length - k));
      expect(st.settled).toEqual(range(arr.length - k, arr.length));
    }
  });
  it('selection: after pass k the k smallest are in final place at the left end', () => {
    const arr = randomDistinct(10, 6);
    const sorted = [...arr].sort((x, y) => x - y);
    for (const st of sortSteps('selection', arr).filter((x) => x.kind === 'passEnd')) expect(st.a.slice(0, st.pass)).toEqual(sorted.slice(0, st.pass));
  });
  it('insertion: after pass k the first k+1 elements are sorted', () => {
    const arr = randomDistinct(10, 8);
    for (const st of sortSteps('insertion', arr).filter((x) => x.kind === 'passEnd')) expect(isSorted(st.a.slice(0, st.pass + 1))).toBe(true);
  });
  it('every executing line index exists in the listing shown, and points at the right kind of line', () => {
    for (const [alg, early] of [['bubble', true], ['bubble', false], ['selection', true], ['insertion', true]] as [SortAlg, boolean][]) {
      const code = codeFor(alg, early);
      for (const st of sortSteps(alg, [4, 3, 2, 1, 5], early)) {
        expect(st.line).toBeGreaterThanOrEqual(0);
        expect(st.line).toBeLessThan(code.length);
        if (st.kind === 'compare') expect(code[st.line]).toMatch(/if |while /);
        if (st.kind === 'swap') expect(code[st.line]).toMatch(/a\[/);
      }
    }
    for (const st of [...linearSteps([1, 2, 3], 2), ...binarySteps([1, 2, 3, 4, 5], 5), ...binarySteps([1, 2, 3], 9)]) {
      expect(st.line).toBeLessThan((st.mid !== null || st.low !== 0 || st.kind === 'start' ? SEARCH_CODE.binary : SEARCH_CODE.binary).length);
    }
    for (const st of linearSteps([1, 2, 3], 2)) expect(st.line).toBeLessThan(SEARCH_CODE.linear.length);
  });
});

describe('stack operations', () => {
  const S = (items: (string | number)[] = [], cap = 5) => newDS('stack', cap, items);
  it('push 3, 5, 7 then pop returns 7 and leaves [3, 5]', () => {
    const r = runOps(S(), [['push', 3], ['push', 5], ['push', 7], ['pop']]);
    expect(r.results[3]!.value).toBe(7);
    expect(r.ds.items).toEqual([3, 5]);
    expect(r.results[3]!.code).toBe('st.pop()');
    expect(r.results[0]!.code).toBe('st.append(3)');
  });
  it('peek and isEmpty do not change the stack', () => {
    const r = runOps(S([1, 2]), [['peek'], ['isEmpty']]);
    expect(r.results[0]!.value).toBe(2);
    expect(r.results[1]!.value).toBe(false);
    expect(r.ds.items).toEqual([1, 2]);
    expect(applyOp(S(), 'isEmpty').value).toBe(true);
  });
  it('overflow when full and underflow when empty, with the structure unchanged', () => {
    const full = S([1, 2, 3], 3);
    const o = applyOp(full, 'push', 9);
    expect(o.ok).toBe(false);
    expect(o.error).toBe('overflow');
    expect(o.ds.items).toEqual([1, 2, 3]);
    for (const op of ['pop', 'peek'] as Op[]) {
      const u = applyOp(S(), op);
      expect(u.error).toBe('underflow');
      expect(u.ds.items).toEqual([]);
    }
  });
  it('does not change the input structure (pure)', () => {
    const s = S([1]);
    applyOp(s, 'push', 2);
    expect(s.items).toEqual([1]);
  });
  it('last in, first out for any sequence', () => {
    const xs = [4, 9, 1, 7];
    const r = runOps(S([], 8), [...xs.map((x) => ['push', x] as [Op, number]), ...xs.map(() => ['pop'] as [Op])]);
    expect(r.results.slice(4).map((x) => x.value)).toEqual([...xs].reverse());
  });
});

describe('queue and deque operations', () => {
  it('queue is first in, first out: enqueue appends, dequeue is pop(0)', () => {
    const q = newDS('queue', 5);
    const r = runOps(q, [['enqueue', 10], ['enqueue', 20], ['enqueue', 30], ['dequeue'], ['front'], ['rear']]);
    expect(r.results[0]!.code).toBe('q.append(10)');
    expect(r.results[3]!.code).toBe('q.pop(0)');
    expect(r.results[3]!.value).toBe(10);
    expect(r.results[4]!.value).toBe(20);
    expect(r.results[5]!.value).toBe(30);
    expect(r.ds.items).toEqual([20, 30]);
  });
  it('queue underflow, overflow, and a queue rejects stack operations', () => {
    expect(applyOp(newDS('queue', 2), 'dequeue').error).toBe('underflow');
    expect(applyOp(newDS('queue', 2, [1, 2]), 'enqueue', 3).error).toBe('overflow');
    expect(applyOp(newDS('queue', 2), 'push', 1).error).toBe('invalid');
  });
  it('deque: insert and delete at both ends match the list calls in the lesson', () => {
    const r = runOps(newDS('deque', 6), [['insertRear', 1], ['insertRear', 2], ['insertFront', 0], ['deletionRear'], ['deletionFront']]);
    expect(r.results[2]!.code).toBe('dq.insert(0, 0)');
    expect(r.results[3]!.value).toBe(2);
    expect(r.results[3]!.code).toBe('dq.pop()');
    expect(r.results[4]!.value).toBe(0);
    expect(r.results[4]!.code).toBe('dq.pop(0)');
    expect(r.ds.items).toEqual([1]);
  });
  it('a deque used at one end is a stack, and rear-in front-out is a queue', () => {
    const asStack = runOps(newDS('deque', 6), [['insertRear', 1], ['insertRear', 2], ['deletionRear']]);
    expect(asStack.results[2]!.value).toBe(2);
    const asQueue = runOps(newDS('deque', 6), [['insertRear', 1], ['insertRear', 2], ['deletionFront']]);
    expect(asQueue.results[2]!.value).toBe(1);
  });
  it('every listed operation exists for its structure and none throws', () => {
    for (const kind of ['stack', 'queue', 'deque'] as const) for (const op of OPS[kind]) expect(() => applyOp(newDS(kind, 3, [1]), op, 5)).not.toThrow();
  });
  it('pythonList prints like Python', () => {
    expect(pythonList([3, 5, 7])).toBe('[3, 5, 7]');
    expect(pythonList(['(', '['])).toBe("['(', '[']");
  });
});

describe('hand-executed tasks', () => {
  const run = (kind: TaskKind, text: string) => {
    let t: TaskState = newTask(kind, text);
    let guard = 0;
    while (expectedAction(t) && guard++ < 100) {
      const r = taskAct(t, expectedAction(t)!);
      expect(r.correct).toBe(true);
      t = r.task;
    }
    return t;
  };
  it('balanced brackets: following the expected actions gives the textbook answer for every string', () => {
    for (const s of [...BRACKET_STRINGS, '', '()', '(()', '())', '{[(])}', ']', '[[]]()']) {
      const t = run('brackets', s);
      if (s === '') continue;
      expect(t.phase).toBe('done');
      expect(t.balanced).toBe(isBalanced(s));
      expect(t.mistakes).toBe(0);
    }
  });
  it('the balanced and unbalanced preset strings are what they claim', () => {
    expect(BRACKET_STRINGS.map(isBalanced)).toEqual([true, true, false, false, false]);
  });
  it('reverse a string: the output is the reverse and the stack ends empty', () => {
    for (const w of [...REVERSE_WORDS, 'A', 'AB']) {
      const t = run('reverse', w);
      expect(t.out).toBe([...w].reverse().join(''));
      expect(t.stack).toEqual([]);
      expect(t.moves).toBe(2 * w.length);
    }
  });
  it('a wrong action is refused, changes nothing and counts a mistake', () => {
    const t = newTask('brackets', '(]');
    const r = taskAct(t, 'pop');
    expect(r.correct).toBe(false);
    expect(r.task.stack).toEqual([]);
    expect(r.task.pos).toBe(0);
    expect(r.task.mistakes).toBe(1);
    const t2 = newTask('reverse', 'AB');
    expect(taskAct(t2, 'pop').correct).toBe(false);
    const full = taskAct(taskAct(t2, 'push').task, 'push').task;
    expect(taskAct(full, 'push').correct).toBe(false);
    expect(expectedAction(full)).toBe('pop');
  });
  it('closing bracket on an empty stack is an underflow and ends the task as not balanced', () => {
    const r = taskAct(newTask('brackets', ')'), 'pop');
    expect(r.correct).toBe(true);
    expect(r.task.balanced).toBe(false);
    expect(r.message).toContain('Underflow');
  });
  it('a verdict is only asked at the end and the wrong one is refused', () => {
    let t = newTask('brackets', '((');
    t = taskAct(t, 'push').task;
    t = taskAct(t, 'push').task;
    expect(t.phase).toBe('verdict');
    expect(expectedAction(t)).toBe('no');
    expect(taskAct(t, 'yes').correct).toBe(false);
    expect(taskAct(t, 'no').task.balanced).toBe(false);
  });
  it('cleans typed task text', () => {
    expect(cleanTaskText('brackets', '(a+b)<script>')).toBe('(a+b)script');
    expect(cleanTaskText('reverse', 'he llo!')).toBe('hello');
    expect(cleanTaskText('reverse', 'x'.repeat(40))).toHaveLength(12);
  });
});

describe('student sorting mode', () => {
  it('the next swap is found, the right pair is accepted in either order, a wrong pair is refused with a reason', () => {
    const steps = sortSteps('bubble', [5, 1, 4, 2, 8]);
    const k = nextSwapIndex(steps, 0);
    expect(steps[k]!.pair).toEqual([0, 1]);
    const ok = checkStudentSwap(steps, 0, 1, 0, 'bubble');
    expect(ok.correct).toBe(true);
    expect(ok.to).toBe(k);
    expect(steps[ok.to]!.cmp).toBe(1);
    const far = checkStudentSwap(steps, 0, 0, 3, 'bubble');
    expect(far.correct).toBe(false);
    expect(far.message).toContain('neighbours');
    const inOrder = checkStudentSwap(steps, 0, 3, 4, 'bubble');
    expect(inOrder.message).toContain('already in order');
    expect(checkStudentSwap(steps, 0, 2, 2, 'bubble').correct).toBe(false);
  });
  it('bubble: another out-of-order pair further right is not yet the next step', () => {
    const steps = sortSteps('bubble', [5, 1, 4, 2, 8]);
    const r = checkStudentSwap(steps, 0, 2, 3, 'bubble');
    expect(r.correct).toBe(false);
    expect(r.message).toContain('left to right');
  });
  it('a student who always plays the correct swap sorts every array with the same totals as the algorithm', () => {
    for (const alg of ALGS) {
      for (const arr of ARRAYS.filter((x) => x.length > 1)) {
        const steps = sortSteps(alg, arr);
        let cur = 0, guard = 0;
        while (nextSwapIndex(steps, cur) >= 0 && guard++ < 200) {
          const k = nextSwapIndex(steps, cur);
          const [p, q] = steps[k]!.pair!;
          const r = checkStudentSwap(steps, cur, q, p, alg);
          expect(r.correct).toBe(true);
          cur = r.to;
        }
        expect(steps[cur]!.swp).toBe(steps.at(-1)!.swp);
        expect(isSorted(steps.at(-1)!.a)).toBe(true);
      }
    }
  });
  it('selection: swapping the right two positions is accepted, the first unsorted with a non-minimum is not', () => {
    const steps = sortSteps('selection', [64, 25, 12, 22, 11]);
    expect(checkStudentSwap(steps, 0, 0, 4, 'selection').correct).toBe(true);
    expect(checkStudentSwap(steps, 0, 0, 2, 'selection').correct).toBe(false);
  });
  it('insertion: the key moves left past a larger neighbour', () => {
    const steps = sortSteps('insertion', [3, 1, 2]);
    expect(checkStudentSwap(steps, 0, 0, 1, 'insertion').correct).toBe(true);
    expect(checkStudentSwap(steps, 0, 1, 2, 'insertion').correct).toBe(false);
  });
  it('the pointer text names a position without naming the swap', () => {
    const steps = sortSteps('bubble', [5, 1, 4, 2, 8]);
    expect(studentPointer(steps, 0, 'bubble')).toContain('positions 0 and 1');
    expect(studentPointer(sortSteps('selection', [3, 1, 2]), 0, 'selection')).toContain('smallest');
  });
});

describe('searching', () => {
  const A = [3, 8, 12, 19, 25, 31, 40];
  it('linear search: comparisons are the position plus one, n when absent', () => {
    A.forEach((v, i) => expect(searchCount('linear', A, v)).toBe(i + 1));
    expect(searchCount('linear', A, 99)).toBe(A.length);
    const s = linearSteps(A, 19);
    expect(s.at(-1)!.kind).toBe('found');
    expect(s.at(-1)!.i).toBe(3);
    expect(linearSteps(A, 4).at(-1)!.kind).toBe('notfound');
  });
  it('binary search on the lesson list finds 31 in 2 comparisons', () => {
    const s = binarySteps(A, 31);
    expect(s.filter((x) => x.kind === 'compare').map((x) => x.mid)).toEqual([3, 5]);
    expect(s.at(-1)!.cmp).toBe(2);
    expect(s.at(-1)!.i).toBe(5);
  });
  it('binary search finds every key and never needs more than floor(log2 n) + 1 comparisons, and that bound is reached', () => {
    for (const n of range(1, 130)) {
      const a = range(0, n).map((k) => 2 * k + 1);
      let worst = 0;
      for (const [k, v] of a.entries()) {
        const s = binarySteps(a, v);
        expect(s.at(-1)!.kind).toBe('found');
        expect(s.at(-1)!.i).toBe(k);
        worst = Math.max(worst, s.at(-1)!.cmp);
      }
      for (const v of [0, ...a.map((x) => x + 1)]) {
        const s = binarySteps(a, v);
        expect(s.at(-1)!.kind).toBe('notfound');
        expect(s.at(-1)!.cmp).toBeLessThanOrEqual(binaryWorst(n));
        worst = Math.max(worst, s.at(-1)!.cmp);
      }
      expect(worst).toBe(binaryWorst(n));
    }
  });
  it('the lesson values: n = 8 needs 4, n = 1000 needs 10, n = 64 needs 7', () => {
    expect(binaryWorst(8)).toBe(4);
    expect(binaryWorst(1000)).toBe(10);
    expect(binaryWorst(64)).toBe(7);
    const a64 = range(1, 65);
    expect(Math.max(...a64.map((v) => searchCount('binary', a64, v)), searchCount('binary', a64, 0), searchCount('binary', a64, 65))).toBe(7);
  });
  it('best case is 1 for both; linear average is (n+1)/2; linear worst is n', () => {
    for (const n of [5, 10, 33]) {
      const a = sortedList(n, n);
      const lin = searchStats('linear', a);
      expect([lin.best, lin.worst, lin.avg]).toEqual([1, n, (n + 1) / 2]);
      expect(lin.absent).toBe(n);
      expect(searchStats('binary', a).best).toBe(1);
      expect(searchStats('binary', a).worst).toBeLessThanOrEqual(binaryWorst(n));
    }
  });
  it('the 10 element lesson example: average of 1..10 is 5.5', () => {
    expect(searchStats('linear', range(1, 11)).avg).toBe(5.5);
  });
  it('the step counter equals the number of compare steps, for both searches', () => {
    for (const alg of ['linear', 'binary'] as const) for (const v of [3, 25, 40, 4, 100]) {
      const s = alg === 'linear' ? linearSteps(A, v) : binarySteps(A, v);
      expect(s.at(-1)!.cmp).toBe(s.filter((x) => x.kind === 'compare').length);
    }
  });
  it('the middle check: the student clicking mid is right, any other is told the formula', () => {
    expect(checkMiddle(0, 6, 3).correct).toBe(true);
    expect(checkMiddle(0, 5, 2).correct).toBe(true);
    const bad = checkMiddle(0, 5, 3);
    expect(bad.correct).toBe(false);
    expect(bad.message).toContain('(0 + 5) // 2 = 2');
  });
  it('sortedList is sorted and has distinct values', () => {
    const a = sortedList(20, 3);
    expect(isSorted(a)).toBe(true);
    expect(new Set(a).size).toBe(20);
  });
});

describe('measured runs', () => {
  it('a row at size n follows the formulas where there is one', () => {
    for (const n of [8, 16, 32, 64, 100]) {
      const r = measureRow(n);
      expect(r.selection).toBe((n * (n - 1)) / 2);
      expect(r.linAvg).toBe((n + 1) / 2);
      expect(r.linWorst).toBe(n);
      expect(r.binWorst).toBe(binaryWorst(n));
      expect(r.bubble).toBeLessThanOrEqual((n * (n - 1)) / 2);
      expect(r.insertion).toBeLessThan(r.bubble);
    }
  });
  it('doubling n: bubble sort comparisons grow about four times, binary search worst case grows by one', () => {
    const a = measureRow(64), b = measureRow(128);
    expect(b.bubble / a.bubble).toBeGreaterThan(3.5);
    expect(b.bubble / a.bubble).toBeLessThan(4.5);
    expect(b.binWorst - a.binWorst).toBe(1);
    expect(b.linWorst / a.linWorst).toBe(2);
  });
  it('the same size always gives the same row', () => {
    expect(measureRow(40)).toEqual(measureRow(40));
  });
  it('permutation is a permutation', () => {
    expect([...permutation(30, 2)].sort((x, y) => x - y)).toEqual(range(1, 31));
  });
});

describe('typed arrays', () => {
  it('accepts commas and spaces and rejects bad input with a reason', () => {
    expect(parseArray('5, 1 4,2')).toEqual({ ok: true, a: [5, 1, 4, 2] });
    expect(parseArray('5')).toMatchObject({ ok: false });
    expect(parseArray('5, x')).toMatchObject({ ok: false });
    expect(parseArray('5, 100')).toMatchObject({ ok: false });
    expect(parseArray('1.5, 2')).toMatchObject({ ok: false });
    expect(parseArray(range(1, 14).join(','))).toMatchObject({ ok: false });
  });
});

describe('every prediction is verified by running the code', () => {
  const byId = Object.fromEntries(PREDICTS.map((p) => [p.id, p]));
  it('four predictions with distinct options', () => {
    expect(PREDICTS).toHaveLength(4);
    for (const p of PREDICTS) { expect(new Set(p.options).size).toBe(p.options.length); expect(p.answer).toBeLessThan(p.options.length); }
  });
  it('a1: binary search on 64 elements needs at most 7', () => {
    const a = range(1, 65);
    const worst = Math.max(...[...a, 0, 65, 32.5].map((v) => searchCount('binary', a, v)));
    expect(byId.a1!.options[byId.a1!.answer]).toBe(String(worst));
  });
  it('a2: after two passes of bubble sort on [9,4,7,2,6] the elements 7 and 9 are fixed', () => {
    const steps = sortSteps('bubble', PRED_SORT_ARRAY, false);
    const e = steps.filter((s) => s.kind === 'passEnd')[1]!;
    expect(e.a).toEqual([4, 2, 6, 7, 9]);
    const fixed = e.settled.map((i) => e.a[i]).sort((x, y) => x! - y!);
    expect(fixed).toEqual([7, 9]);
    expect(byId.a2!.options[byId.a2!.answer]).toBe('7 and 9');
    // after pass 1 the 9 is already last
    expect(steps.filter((s) => s.kind === 'passEnd')[0]!.a.at(-1)).toBe(9);
  });
  it('a3: pop after push 3, 5, 7 returns 7', () => {
    const r = runOps(newDS('stack', 5), [...PRED_PUSHES.map((x) => ['push', x] as [Op, number]), ['pop']]);
    expect(String(r.results.at(-1)!.value)).toBe(byId.a3!.options[byId.a3!.answer]);
  });
  it('a4: on a reversed list selection sort makes the fewest swaps', () => {
    const c = Object.fromEntries(ALGS.map((alg) => [alg, countSort(alg, PRED_SWAPS_ARRAY).swp]));
    expect(c).toEqual({ bubble: 15, selection: 3, insertion: 15 });
    const min = Math.min(...Object.values(c));
    expect(Object.entries(c).filter(([, v]) => v === min).map(([k]) => k)).toEqual(['selection']);
    expect(byId.a4!.options[byId.a4!.answer]).toBe('Selection sort');
  });
});

describe('every practice question is verified by running the code', () => {
  const by = Object.fromEntries(APPLY.map((q) => [q.id, q]));
  const key = (id: string) => by[id]!.options[by[id]!.answer]!;
  it('five questions, four options each, distinct, one key', () => {
    expect(APPLY).toHaveLength(5);
    for (const q of APPLY) { expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(4); expect(q.why.length).toBeGreaterThan(20); }
  });
  it('q1: stack after push 4, 8, 2, pop, pop, push 6', () => {
    const r = runOps(newDS('stack', 8), [['push', 4], ['push', 8], ['push', 2], ['pop'], ['pop'], ['push', 6]]);
    expect(pythonList(r.ds.items)).toBe(key('q1'));
  });
  it('q2: queue [10,20,30], append 40, pop(0) twice: front is 30', () => {
    const r = runOps(newDS('queue', 8, [10, 20, 30]), [['enqueue', 40], ['dequeue'], ['dequeue'], ['front']]);
    expect(String(r.results.at(-1)!.value)).toBe(key('q2'));
    // the same with real Python-list semantics
    const q = [10, 20, 30]; q.push(40); q.shift(); q.shift();
    expect(String(q[0])).toBe(key('q2'));
  });
  it('q3: bubble sort swaps on [7, 3, 5, 1]', () => {
    const swaps = sortSteps('bubble', [7, 3, 5, 1], false).at(-1)!.swp;
    expect(String(swaps)).toBe(key('q3'));
    expect(inversions([7, 3, 5, 1])).toBe(swaps);
    expect(sortSteps('bubble', [7, 3, 5, 1], false).filter((s) => s.kind === 'passEnd').map((s) => s.swp)).toEqual([3, 4, 5]);
  });
  it('q4: binary search for 31 makes 2 comparisons (linear would make 6)', () => {
    const A = [3, 8, 12, 19, 25, 31, 40];
    expect(String(searchCount('binary', A, 31))).toBe(key('q4'));
    expect(searchCount('linear', A, 31)).toBe(6);
  });
  it('q5: selection sort on 6 elements makes 15 comparisons for every ordering tried', () => {
    for (const arr of [range(1, 7), range(1, 7).reverse(), randomDistinct(6, 1), randomDistinct(6, 2)]) expect(String(countSort('selection', arr).cmp)).toBe(key('q5'));
  });
  it('the wrong options are the traps the explanations name (spot checks)', () => {
    expect(by.q3!.options).toContain('6');
    expect(inversions([4, 3, 2, 1])).toBe(6);
    expect(by.q5!.options).toContain('36');
  });
});
