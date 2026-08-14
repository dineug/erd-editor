import { describe, expect, it } from 'vitest';

import {
  buffers,
  CANCEL,
  cancel,
  Channel,
  channel,
  CLOSED,
  go,
  isClosed,
  isKill,
  KILL,
  kill,
  put,
  take,
  takeEvery,
} from '@/index';

describe('public api', () => {
  it('re-exports the buffer factory', () => {
    const buffer = buffers.limitBuffer<number>({ limit: 2, leading: true });

    buffer.put(1);
    buffer.put(2);
    buffer.put(3);

    expect(buffer.flush()).toEqual([2, 3]);
  });

  it('re-exports the channel factory and its sentinel helpers', () => {
    const ch = channel<number>();

    expect(ch).toBeInstanceOf(Channel);
    expect(isClosed(CLOSED)).toBe(true);
    expect(isKill(KILL)).toBe(true);
  });

  it('re-exports kill as a rejected task', async () => {
    await expect(kill()).rejects.toBe(KILL);
  });

  it('runs a go task driven by put/take from the barrel', async () => {
    const ch = channel<number>();
    const seen: Array<number> = [];

    const task = go(function* () {
      const value: number = yield take(ch);
      seen.push(value);
      return value * 2;
    });

    put(ch, 21);

    await expect(task).resolves.toBe(42);
    expect(seen).toEqual([21]);
  });

  it('drives takeEvery until the channel closes', async () => {
    const ch = channel<number>();
    const seen: Array<number> = [];

    const task = takeEvery(ch, value => {
      seen.push(value);
    });

    put(ch, 1);
    put(ch, 2);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(seen).toEqual([1, 2]);

    ch.close();
    await expect(task).rejects.toBe(CLOSED);
  });

  it('re-exports cancel and CANCEL', async () => {
    const task = go(function* () {
      yield new Promise(() => {});
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    cancel(task);

    await expect(task).rejects.toBe(CANCEL);
  });
});
