import { describe, expect, it } from 'vitest';

import { channel, CLOSED } from '@/channel';
import { CANCEL, cancel } from '@/operators/cancel';
import { put } from '@/operators/put';
import { takeEvery } from '@/operators/takeEvery';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('takeEvery', () => {
  it('invokes the callback for every value put on the channel', async () => {
    const ch = channel<number>();
    const received: number[] = [];
    const task = takeEvery(ch, (value: number) => {
      received.push(value);
    });

    put(ch, 1);
    put(ch, 2);
    put(ch, 3);
    await tick();

    expect(received).toEqual([1, 2, 3]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('keeps consuming values that arrive over several turns', async () => {
    const ch = channel<string>();
    const received: string[] = [];
    const task = takeEvery(ch, (value: string) => {
      received.push(value);
    });

    put(ch, 'a');
    await tick();
    put(ch, 'b');
    await tick();

    expect(received).toEqual(['a', 'b']);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('consumes values that were buffered before it started', async () => {
    const ch = channel<number>();
    put(ch, 1);
    put(ch, 2);

    const received: number[] = [];
    const task = takeEvery(ch, (value: number) => {
      received.push(value);
    });
    await tick();

    expect(received).toEqual([1, 2]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('keeps running after a callback throws', async () => {
    const ch = channel<number>();
    const received: number[] = [];
    const task = takeEvery(ch, (value: number) => {
      received.push(value);
      if (value === 1) {
        throw new Error('boom');
      }
    });

    put(ch, 1);
    put(ch, 2);
    await tick();

    expect(received).toEqual([1, 2]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('runs generator callbacks through go', async () => {
    const ch = channel<number>();
    const received: number[] = [];
    const task = takeEvery(ch, function* (value: number) {
      const doubled: number = yield Promise.resolve(value * 2);
      received.push(doubled);
    });

    put(ch, 1);
    put(ch, 2);
    await tick();

    expect(received).toEqual([2, 4]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('stops consuming once the task is canceled', async () => {
    const ch = channel<number>();
    const received: number[] = [];
    const task = takeEvery(ch, (value: number) => {
      received.push(value);
    });

    put(ch, 1);
    await tick();
    cancel(task);
    await expect(task).rejects.toBe(CANCEL);

    put(ch, 2);
    await tick();

    expect(received).toEqual([1]);
  });

  it('rejects with CLOSED when the channel closes', async () => {
    const ch = channel<number>();
    const received: number[] = [];
    const task = takeEvery(ch, (value: number) => {
      received.push(value);
    });

    put(ch, 1);
    await tick();
    ch.close();

    await expect(task).rejects.toBe(CLOSED);
    expect(received).toEqual([1]);
  });
});
