import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createCheckCount,
  IDLE_TIMEOUT_MS,
  type IdleBudget,
  SLICE_MS,
  whenIdle,
} from '@/components/dictionary/checkCount';
import {
  DictionaryCheck,
  DictionaryCheckCode,
} from '@/engine/modules/dictionary/checks';

const check = (code: DictionaryCheckCode): DictionaryCheck => ({
  code,
  target: { kind: 'word', id: 'w1', tableId: '' },
  field: 'name',
  text: '',
  suggestions: [],
});

const warning = check(DictionaryCheckCode.unregisteredWord);
const error = check(DictionaryCheckCode.duplicateName);

/** Each step of a walk costs this much of the fake clock. */
const STEP_MS = 3;

let now = 0;
let idle: Array<(budget: IdleBudget) => void> = [];

beforeEach(() => {
  now = 0;
  idle = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal(
    'requestIdleCallback',
    vi.fn((task: (budget: IdleBudget) => void) => idle.push(task))
  );
  vi.stubGlobal('cancelIdleCallback', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** A walk of the steps given, each moving the clock on and counted as it is taken. */
function walkOf(steps: ReadonlyArray<ReadonlyArray<DictionaryCheck>>) {
  const walk = { started: 0, taken: 0 };
  const start = function* () {
    walk.started++;
    for (const step of steps) {
      now += STEP_MS;
      walk.taken++;
      yield step;
    }
  };
  return { walk, start };
}

/** Runs the oldest idle task with the time given. */
function runIdle(timeRemaining: number, didTimeout = false) {
  const task = idle.shift();
  if (!task) throw new Error('no idle task is waiting');
  task({ didTimeout, timeRemaining: () => timeRemaining });
}

const TEN_STEPS = [
  [warning],
  [],
  [warning, warning],
  [],
  [],
  [],
  [error],
  [],
  [warning],
  [],
];

describe('createCheckCount', () => {
  it('counts over as many idle periods as the walk needs, each ending when its time runs out', () => {
    const { walk, start } = walkOf(TEN_STEPS);
    const done = vi.fn();
    const count = createCheckCount({ walk: start, wanted: () => true, done });

    count.restart();
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: IDLE_TIMEOUT_MS,
    });

    runIdle(10);
    expect(walk.taken).toBe(4);
    runIdle(10);
    expect(walk.taken).toBe(8);
    expect(done).not.toHaveBeenCalled();

    runIdle(10);
    expect(done).toHaveBeenCalledExactlyOnceWith(5, 'error');
    expect(idle).toEqual([]);
    expect(walk.started).toBe(1);
  });

  it('takes one step at least, and a slice of its own once the wait timed out', () => {
    const { walk, start } = walkOf(TEN_STEPS);
    const count = createCheckCount({
      walk: start,
      wanted: () => true,
      done: vi.fn(),
    });

    count.restart();
    runIdle(0);
    expect(walk.taken).toBe(1);
    runIdle(0, true);
    expect(walk.taken).toBe(1 + Math.ceil(SLICE_MS / STEP_MS));
  });

  it('colours the count a warning while every check is one, and none for no check', () => {
    const done = vi.fn();
    const warned = createCheckCount({
      walk: walkOf([[warning], [], [warning]]).start,
      wanted: () => true,
      done,
    });
    warned.restart();
    runIdle(50);
    expect(done).toHaveBeenLastCalledWith(2, 'warning');

    const clean = createCheckCount({
      walk: walkOf([[], []]).start,
      wanted: () => true,
      done,
    });
    clean.restart();
    runIdle(50);
    expect(done).toHaveBeenLastCalledWith(0, null);
  });

  it('drops a walk under way on a restart and counts afresh, once however many restarts come', () => {
    const { walk, start } = walkOf(TEN_STEPS);
    const done = vi.fn();
    const count = createCheckCount({ walk: start, wanted: () => true, done });

    count.restart();
    runIdle(4);
    expect(walk.taken).toBe(2);

    count.restart();
    count.restart();
    expect(idle).toHaveLength(1);

    runIdle(100);
    expect(walk.started).toBe(2);
    expect(done).toHaveBeenCalledExactlyOnceWith(5, 'error');
  });

  it('counts nothing while no count is wanted, and stops a count waiting', () => {
    let wanted = false;
    const { walk, start } = walkOf(TEN_STEPS);
    const done = vi.fn();
    const count = createCheckCount({ walk: start, wanted: () => wanted, done });

    count.restart();
    expect(idle).toEqual([]);

    wanted = true;
    count.restart();
    runIdle(4);
    wanted = false;
    runIdle(100);
    expect(walk.taken).toBe(2);
    expect(idle).toEqual([]);

    wanted = true;
    count.restart();
    count.stop();
    expect(cancelIdleCallback).toHaveBeenCalledOnce();
    expect(done).not.toHaveBeenCalled();
  });
});

describe('whenIdle', () => {
  it('runs the task on a timer where the browser names no idle time, as one that timed out', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('requestIdleCallback', undefined);
    const task = vi.fn();

    whenIdle(task);
    vi.runAllTimers();
    expect(task).toHaveBeenCalledOnce();
    const [budget] = task.mock.calls[0];
    expect(budget.didTimeout).toBe(true);
    expect(budget.timeRemaining()).toBe(0);

    const cancel = whenIdle(task);
    cancel();
    vi.runAllTimers();
    expect(task).toHaveBeenCalledOnce();
  });
});
