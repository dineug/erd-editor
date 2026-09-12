import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  progressOf,
  setTransitionClock,
  stopTransitions,
  TRANSITION_MS,
  type TransitionClock,
  transitionKey,
  transitionTo,
} from '@/components/erd/canvas/highlightTransition';

/**
 * A clock the case winds by hand, counting what the ticker asked of it. The
 * counts are the whole point of half these cases: a frame asked for is a frame
 * the export worker would have run.
 */
function createClock() {
  const counts = { frames: 0, cancels: 0 };
  let now = 0;
  let pending: (() => void) | null = null;

  const clock: TransitionClock = {
    now: () => now,
    requestFrame: callback => {
      counts.frames += 1;
      pending = callback;
      return counts.frames;
    },
    cancelFrame: () => {
      counts.cancels += 1;
      pending = null;
    },
  };

  return {
    clock,
    counts,
    isPending: () => pending !== null,
    step(ms: number) {
      now += ms;
      const frame = pending;
      pending = null;
      frame?.();
    },
  };
}

let editors = 0;
let clock = createClock();
let editorId = '';

beforeEach(() => {
  editors += 1;
  editorId = `editor-${editors}`;
  clock = createClock();
  setTransitionClock(clock.clock);
});

afterEach(() => {
  stopTransitions(editorId);
  setTransitionClock();
});

const keyOf = (id: string) => transitionKey(editorId, 'table', id);

describe('the highlight ticker', () => {
  it('answers a key it has never been asked about with nothing lit', () => {
    expect(progressOf(keyOf('a'))).toBe(0);
    expect(clock.counts.frames).toBe(0);
  });

  it('settles a key on the target it is first asked for, and asks for no frame', () => {
    const key = keyOf('a');
    transitionTo(key, 1);

    expect(progressOf(key)).toBe(1);
    expect(clock.counts.frames).toBe(0);
    expect(clock.isPending()).toBe(false);
  });

  /**
   * The invariant the export worker rests on. It re-renders the table, so it
   * carries this module, and every key it ever asks about is a first ask.
   */
  it('asks for no frame at all while every key it is given is a first ask', () => {
    for (let index = 0; index < 20; index++) {
      const key = keyOf(`t${index}`);
      transitionTo(key, index % 2);
      progressOf(key);
    }

    expect(clock.counts.frames).toBe(0);
    expect(clock.isPending()).toBe(false);
  });

  it('leaves a key already heading where it is asked to go alone', () => {
    const key = keyOf('a');
    transitionTo(key, 0);
    transitionTo(key, 1);
    const asked = clock.counts.frames;

    transitionTo(key, 1);
    transitionTo(key, 1);

    expect(clock.counts.frames).toBe(asked);
  });

  it('walks an ease out curve from the value it left to the one it was sent to', () => {
    const key = keyOf('a');
    transitionTo(key, 0);
    transitionTo(key, 1);

    expect(progressOf(key)).toBe(0);

    clock.step(TRANSITION_MS / 2);
    // 1 - (1 - t) cubed at the halfway point, which is the curve's own value.
    expect(progressOf(key)).toBeCloseTo(0.875, 12);

    clock.step(TRANSITION_MS / 4);
    expect(progressOf(key)).toBeCloseTo(0.984375, 12);

    clock.step(TRANSITION_MS / 4);
    expect(progressOf(key)).toBe(1);
  });

  it('slows as it goes, which is what makes the curve an ease out', () => {
    const key = keyOf('a');
    transitionTo(key, 0);
    transitionTo(key, 1);

    const steps: number[] = [];
    let last = 0;
    for (let index = 0; index < 5; index++) {
      clock.step(TRANSITION_MS / 6);
      const value = progressOf(key);
      steps.push(value - last);
      last = value;
    }

    expect(steps.every(step => step > 0)).toBe(true);
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
  });

  it('turns back from where it stands when the target flips mid walk', () => {
    const key = keyOf('a');
    transitionTo(key, 0);
    transitionTo(key, 1);
    clock.step(TRANSITION_MS / 2);

    const turned = progressOf(key);
    transitionTo(key, 0);
    clock.step(1);

    expect(progressOf(key)).toBeLessThan(turned);

    clock.step(TRANSITION_MS);
    expect(progressOf(key)).toBe(0);
  });

  it('keeps one frame out at a time, however many keys are moving', () => {
    const first = keyOf('a');
    const second = keyOf('b');
    transitionTo(first, 0);
    transitionTo(second, 0);

    transitionTo(first, 1);
    expect(clock.counts.frames).toBe(1);

    transitionTo(second, 1);
    expect(clock.counts.frames).toBe(1);
    expect(clock.isPending()).toBe(true);

    clock.step(16);
    expect(clock.counts.frames).toBe(2);
    expect(clock.isPending()).toBe(true);
  });

  it('asks for nothing more once the last key has landed', () => {
    const key = keyOf('a');
    transitionTo(key, 0);
    transitionTo(key, 1);

    clock.step(TRANSITION_MS);
    expect(progressOf(key)).toBe(1);
    expect(clock.isPending()).toBe(false);

    const asked = clock.counts.frames;
    clock.step(TRANSITION_MS);
    expect(clock.counts.frames).toBe(asked);
  });

  it('drops the keys of the editor torn down, and the frame with them', () => {
    const mine = keyOf('a');
    const theirs = transitionKey('editor-other', 'table', 'a');
    transitionTo(mine, 0);
    transitionTo(theirs, 0);
    transitionTo(mine, 1);
    transitionTo(theirs, 1);
    clock.step(TRANSITION_MS / 2);

    stopTransitions(editorId);

    expect(progressOf(mine)).toBe(0);
    expect(clock.isPending()).toBe(true);
    expect(progressOf(theirs)).toBeCloseTo(0.875, 12);

    stopTransitions('editor-other');

    expect(clock.counts.cancels).toBe(1);
    expect(clock.isPending()).toBe(false);
  });

  it('lands whatever was moving when the clock underneath it is swapped', () => {
    const key = keyOf('a');
    transitionTo(key, 0);
    transitionTo(key, 1);
    clock.step(TRANSITION_MS / 2);

    const next = createClock();
    setTransitionClock(next.clock);

    expect(progressOf(key)).toBe(1);
    expect(next.isPending()).toBe(false);
  });
});
