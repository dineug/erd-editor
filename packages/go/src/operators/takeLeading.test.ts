import { describe, expect, it } from 'vitest';

import { channel, CLOSED } from '@/channel';
import { CANCEL, cancel } from '@/operators/cancel';
import { put } from '@/operators/put';
import { takeLeading } from '@/operators/takeLeading';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

type Worker = {
  callback: (value: number) => Promise<void>;
  started: number[];
  release: (value: number) => void;
};

const createWorker = (): Worker => {
  const started: number[] = [];
  const resolvers = new Map<number, () => void>();

  return {
    started,
    release: value => resolvers.get(value)?.(),
    callback: value => {
      started.push(value);
      return new Promise<void>(resolve => {
        resolvers.set(value, resolve);
      });
    },
  };
};

describe('takeLeading', () => {
  it('runs the callback for the first value', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLeading(ch, worker.callback);

    put(ch, 1);
    await tick();

    expect(worker.started).toEqual([1]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('ignores values that arrive while a task is running', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLeading(ch, worker.callback);

    put(ch, 1);
    await tick();
    put(ch, 2);
    put(ch, 3);
    await tick();

    expect(worker.started).toEqual([1]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('accepts a new value once the running task settles', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLeading(ch, worker.callback);

    put(ch, 1);
    await tick();
    put(ch, 2);
    await tick();
    worker.release(1);
    await tick();
    put(ch, 3);
    await tick();

    expect(worker.started).toEqual([1, 3]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('accepts a new value again after the next task settles', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLeading(ch, worker.callback);

    put(ch, 1);
    await tick();
    worker.release(1);
    await tick();
    put(ch, 2);
    await tick();
    worker.release(2);
    await tick();
    put(ch, 3);
    await tick();

    expect(worker.started).toEqual([1, 2, 3]);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);
  });

  it('runs synchronous callbacks for every value', async () => {
    const ch = channel<string>();
    const received: string[] = [];
    const task = takeLeading(ch, (value: string) => {
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

  it('stops taking once the task is canceled', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLeading(ch, worker.callback);

    cancel(task);
    await expect(task).rejects.toBe(CANCEL);

    put(ch, 1);
    await tick();

    expect(worker.started).toEqual([]);
  });

  it('rejects with CLOSED when the channel closes', async () => {
    const ch = channel<number>();
    const worker = createWorker();
    const task = takeLeading(ch, worker.callback);

    put(ch, 1);
    await tick();
    ch.close();

    await expect(task).rejects.toBe(CLOSED);
    expect(worker.started).toEqual([1]);
  });
});
