import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { onCaughtError, safeCallback } from '@/helpers/fn';

const throwing = (error: unknown) => () => {
  throw error;
};

describe('onCaughtError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hands each listener what safeCallback logs, until its own off is called', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = onCaughtError(first);
    const offSecond = onCaughtError(second);
    const error = new Error('boom');

    safeCallback(throwing(error));
    offFirst();
    safeCallback(throwing('a string'));
    offSecond();
    safeCallback(throwing(error));

    expect(first.mock.calls).toEqual([[error]]);
    expect(second.mock.calls).toEqual([[error], ['a string']]);
    expect(log.mock.calls).toEqual([[error], ['a string'], [error]]);
  });

  it('hears nothing from a callback that returns', () => {
    const listener = vi.fn();
    const off = onCaughtError(listener);

    expect(safeCallback(() => 1)).toBe(1);
    off();

    expect(listener).not.toHaveBeenCalled();
  });

  it('takes the same listener twice as two, each removed by its own off', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const listener = vi.fn();
    const offOnce = onCaughtError(listener);
    const offTwice = onCaughtError(listener);

    safeCallback(throwing('first'));
    offOnce();
    offOnce();
    safeCallback(throwing('second'));
    offTwice();

    expect(listener.mock.calls).toEqual([['first'], ['first'], ['second']]);
  });

  it('logs a listener that throws, and the listeners after it still hear', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = new Error('listener broke');
    const after = vi.fn();
    const offBroken = onCaughtError(throwing(broken));
    const offAfter = onCaughtError(after);

    expect(safeCallback(throwing('boom'))).toBeUndefined();
    offBroken();
    offAfter();

    expect(after).toHaveBeenCalledWith('boom');
    expect(log.mock.calls).toEqual([['boom'], [broken]]);
  });
});
