import { describe, expect, it } from 'vitest';

import { channel, CLOSED } from '@/channel';
import { attachCancel, CANCEL, cancel } from '@/operators/cancel';
import { put } from '@/operators/put';
import { takeLatest } from '@/operators/takeLatest';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

type Worker = {
  callback: (value: number) => Promise<void>;
  started: number[];
  canceled: number[];
  release: (value: number) => void;
};

const createWorker = (): Worker => {
  const started: number[] = [];
  const canceled: number[] = [];
  const resolvers = new Map<number, () => void>();

  return {
    started,
    canceled,
    release: value => resolvers.get(value)?.(),
    callback: value => {
      started.push(value);
      const promise = new Promise<void>(resolve => {
        resolvers.set(value, resolve);
      });
      return attachCancel(promise, () => {
        canceled.push(value);
      });
    },
  };
};

describe('takeLatest', () => {
  it('starts a task for the first value without canceling anything', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLatest(ch, worker.callback);

    put(ch, 1);
    await tick();

    expect(worker.started).toEqual([1]);
    expect(worker.canceled).toEqual([]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('cancels the previous task when a new value arrives', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLatest(ch, worker.callback);

    put(ch, 1);
    await tick();
    put(ch, 2);
    await tick();

    expect(worker.started).toEqual([1, 2]);
    expect(worker.canceled).toEqual([1]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('keeps canceling every superseded task', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLatest(ch, worker.callback);

    put(ch, 1);
    await tick();
    put(ch, 2);
    await tick();
    put(ch, 3);
    await tick();

    expect(worker.started).toEqual([1, 2, 3]);
    expect(worker.canceled).toEqual([1, 2]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('still cancels the previous task even after it settled', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLatest(ch, worker.callback);

    put(ch, 1);
    await tick();
    worker.release(1);
    await tick();
    put(ch, 2);
    await tick();

    expect(worker.started).toEqual([1, 2]);
    expect(worker.canceled).toEqual([1]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('runs the callback with the taken value', async () => {
    const ch = channel<string>();
    const received: string[] = [];
    const task = takeLatest(ch, (value: string) => {
      received.push(value);
    });

    put(ch, 'a');
    put(ch, 'b');
    await tick();

    expect(received).toEqual(['a', 'b']);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('stops taking once the task is canceled', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLatest(ch, worker.callback);

    put(ch, 1);
    await tick();
    cancel(task);
    await expect(task).rejects.toBe(CANCEL);

    put(ch, 2);
    await tick();

    expect(worker.started).toEqual([1]);
  });

  it('rejects with CLOSED when the channel closes', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLatest(ch, worker.callback);

    put(ch, 1);
    await tick();
    ch.close();

    await expect(task).rejects.toBe(CLOSED);
    expect(worker.started).toEqual([1]);
  });
});
