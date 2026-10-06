import { observer } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__/index';
import {
  clearDrawTarget,
  getDrawTarget,
  updateDrawTarget,
} from '@/components/erd/draw-target/drawTargetState';

const first = createTestAppContext();
const second = createTestAppContext();

afterEach(() => {
  clearDrawTarget(first.store.state);
  clearDrawTarget(second.store.state);
});

describe('drawTargetState', () => {
  it('reads as empty before anything is written', () => {
    expect(getDrawTarget(first.store.state)).toEqual({
      pointer: null,
      pressPoint: null,
      selfArmed: false,
      targetId: null,
    });
  });

  it('keeps each editor on a page to its own record', () => {
    updateDrawTarget(first.store.state, { targetId: 'orders' });
    updateDrawTarget(second.store.state, { targetId: 'users' });

    expect(getDrawTarget(first.store.state).targetId).toBe('orders');
    expect(getDrawTarget(second.store.state).targetId).toBe('users');
  });

  it('writes the fields given and leaves the rest', () => {
    updateDrawTarget(first.store.state, {
      pointer: { x: 1, y: 2 },
      targetId: 'orders',
    });
    updateDrawTarget(first.store.state, { selfArmed: true });

    expect(getDrawTarget(first.store.state)).toMatchObject({
      pointer: { x: 1, y: 2 },
      selfArmed: true,
      targetId: 'orders',
    });
  });

  /** An observer that writes back what it read has to settle rather than run again. */
  it('wakes no reader for a value it already holds, a point at the same place included', async () => {
    const { state } = first.store;
    updateDrawTarget(state, { pointer: { x: 1, y: 2 }, targetId: 'orders' });
    let runs = 0;
    const stop = observer(() => {
      runs += 1;
      const { pointer, targetId } = getDrawTarget(state);
      return [pointer?.x, targetId];
    });

    updateDrawTarget(state, { pointer: { x: 1, y: 2 }, targetId: 'orders' });
    await flush();
    expect(runs).toBe(1);

    updateDrawTarget(state, { pointer: { x: 3, y: 2 } });
    await flush();
    expect(runs).toBe(2);
    stop();
  });

  it('forgets the whole record, and clears one that was never written', () => {
    const { state } = first.store;
    clearDrawTarget(state);
    updateDrawTarget(state, { targetId: 'orders', selfArmed: true });
    clearDrawTarget(state);

    expect(getDrawTarget(state)).toMatchObject({
      targetId: null,
      selfArmed: false,
    });
  });
});
