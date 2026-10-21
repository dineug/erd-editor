import {
  type DictionaryCheck,
  DictionaryCheckLevel,
  markOf,
} from '@/engine/modules/dictionary/checks';

/** What an idle period hands its task: how long it may run, and whether it waited past its timeout instead. */
export type IdleBudget = Pick<IdleDeadline, 'didTimeout' | 'timeRemaining'>;

/** How long an idle task may wait for the browser to go idle before it runs anyway. */
export const IDLE_TIMEOUT_MS = 1000;

/** How long a slice runs where the browser names no idle time: one that timed out, or a timer's. */
export const SLICE_MS = 8;

/** Runs a task once the browser is idle, or on a timer where it names no idle time, and hands back its cancel. */
export function whenIdle(task: (budget: IdleBudget) => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    return () => cancelIdleCallback(id);
  }

  const id = setTimeout(() =>
    task({ didTimeout: true, timeRemaining: () => 0 })
  );
  return () => clearTimeout(id);
}

/** The loudest of two levels, null for neither. */
const louder = (
  mark: DictionaryCheckLevel | null,
  level: DictionaryCheckLevel | null
) => (mark === DictionaryCheckLevel.error ? mark : (level ?? mark));

export type CheckCountOptions = {
  /** The checks of the document a step at a time (walkDictionaryChecks). */
  walk: () => Iterator<ReadonlyArray<DictionaryCheck>>;
  /** Whether a count is still wanted: a slice that finds none drops the walk. */
  wanted: () => boolean;
  /** Takes the number of checks and the loudest of their levels once a walk ends. */
  done: (count: number, mark: DictionaryCheckLevel | null) => void;
};

/**
 * Counts the checks on idle, a slice per idle period: each takes steps until
 * its time runs out, one at least, and the next goes on where it stopped, so
 * a slice outlasts its period by one step at most. A restart drops a walk begun.
 */
export function createCheckCount({ walk, wanted, done }: CheckCountOptions) {
  let steps: Iterator<ReadonlyArray<DictionaryCheck>> | null = null;
  let count = 0;
  let mark: DictionaryCheckLevel | null = null;
  let cancel: (() => void) | null = null;

  function slice(budget: IdleBudget) {
    cancel = null;
    if (!wanted()) {
      steps = null;
      return;
    }

    if (!steps) {
      steps = walk();
      count = 0;
      mark = null;
    }

    const time = budget.didTimeout ? SLICE_MS : budget.timeRemaining();
    const end = performance.now() + time;
    do {
      const step = steps.next();
      if (step.done) {
        steps = null;
        done(count, mark);
        return;
      }

      count += step.value.length;
      mark = louder(mark, markOf(step.value));
    } while (performance.now() < end);

    cancel = whenIdle(slice);
  }

  return {
    /** Counts afresh on the next idle period, once however many restarts come before it. */
    restart() {
      steps = null;
      if (cancel === null && wanted()) cancel = whenIdle(slice);
    },
    stop() {
      cancel?.();
      cancel = null;
      steps = null;
    },
  };
}
