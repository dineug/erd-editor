import { html } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { openToastWhileRunning } from '@/components/toast-container/openToastWhileRunning';
import { Emitter, openToastAction } from '@/utils/emitter';

type ToastPayload = ReturnType<typeof openToastAction>['payload'];

let emitter: Emitter;
let toasts: ToastPayload[];
let off: () => void;

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const message = html`<span>working</span>`;

beforeEach(() => {
  vi.useFakeTimers();
  emitter = new Emitter();
  toasts = [];
  off = emitter.on({ openToast: action => toasts.push(action.payload) });
});

afterEach(() => {
  off();
  emitter.clear();
  vi.useRealTimers();
});

describe('openToastWhileRunning', () => {
  it('says nothing about a task that is over before it was worth saying', async () => {
    const task = createDeferred<void>();
    const done = vi.fn();

    openToastWhileRunning(emitter, task.promise, message).then(done);
    task.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(toasts).toEqual([]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('resolves as soon as a fast task settles, without waiting out the threshold', async () => {
    const task = createDeferred<void>();
    const done = vi.fn();

    openToastWhileRunning(emitter, task.promise, message).then(done);
    await vi.advanceTimersByTimeAsync(399);
    task.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(toasts).toEqual([]);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('opens the toast once the task outruns the threshold', async () => {
    const task = createDeferred<void>();

    openToastWhileRunning(emitter, task.promise, message);
    await vi.advanceTimersByTimeAsync(399);
    expect(toasts).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe(message);
  });

  it('keeps the toast open while the task is still running', async () => {
    const task = createDeferred<void>();
    const closed = vi.fn();

    openToastWhileRunning(emitter, task.promise, message);
    await vi.advanceTimersByTimeAsync(400);
    toasts[0].close?.then(closed);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(closed).not.toHaveBeenCalled();

    task.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('holds the toast on screen long enough to read when the task ends right after it opened', async () => {
    const task = createDeferred<void>();
    const closed = vi.fn();

    openToastWhileRunning(emitter, task.promise, message);
    await vi.advanceTimersByTimeAsync(400);
    toasts[0].close?.then(closed);

    task.resolve();
    await vi.advanceTimersByTimeAsync(599);
    expect(closed).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('resolves only once the toast it opened is gone', async () => {
    const task = createDeferred<void>();
    const done = vi.fn();

    openToastWhileRunning(emitter, task.promise, message).then(done);
    await vi.advanceTimersByTimeAsync(400);
    task.resolve();

    await vi.advanceTimersByTimeAsync(599);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('closes the toast on a failed task and never hands on the rejection', async () => {
    const task = createDeferred<void>();
    const done = vi.fn();
    const rejected = vi.fn();

    openToastWhileRunning(emitter, task.promise, message).then(done, rejected);
    await vi.advanceTimersByTimeAsync(400);
    expect(toasts).toHaveLength(1);

    task.reject(new Error('no canvas'));
    await vi.advanceTimersByTimeAsync(600);

    expect(done).toHaveBeenCalledTimes(1);
    expect(rejected).not.toHaveBeenCalled();
    await expect(toasts[0].close).resolves.toBeUndefined();
  });

  it('gives the toast a close promise of its own rather than the task', async () => {
    const task = createDeferred<void>();

    openToastWhileRunning(emitter, task.promise, message);
    await vi.advanceTimersByTimeAsync(400);

    expect(toasts[0].close).not.toBe(task.promise);
    task.resolve();
    await vi.advanceTimersByTimeAsync(600);
  });
});
