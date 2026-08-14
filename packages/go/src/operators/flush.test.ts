import { describe, expect, it, vi } from 'vitest';

import { channel, CLOSED } from '@/channel';
import { flush } from '@/operators/flush';
import { put } from '@/operators/put';
import { take } from '@/operators/take';

describe('flush', () => {
  it('resolves with every buffered value in order', async () => {
    const ch = channel<number>();
    put(ch, 1);
    put(ch, 2);
    put(ch, 3);

    await expect(flush(ch)).resolves.toEqual([1, 2, 3]);
  });

  it('resolves with an empty array when nothing is buffered', async () => {
    await expect(flush(channel())).resolves.toEqual([]);
  });

  it('empties the buffer so a second flush resolves with an empty array', async () => {
    const ch = channel<string>();
    put(ch, 'a');

    await expect(flush(ch)).resolves.toEqual(['a']);
    await expect(flush(ch)).resolves.toEqual([]);
  });

  it('does not include values already consumed by a take', async () => {
    const ch = channel<number>();
    put(ch, 1);
    put(ch, 2);

    await expect(take(ch)).resolves.toBe(1);
    await expect(flush(ch)).resolves.toEqual([2]);
  });

  it('does not include values handed to a waiting take', async () => {
    const ch = channel<number>();
    const waiting = take(ch);
    put(ch, 1);
    put(ch, 2);

    await expect(waiting).resolves.toBe(1);
    await expect(flush(ch)).resolves.toEqual([2]);
  });

  it('delegates to Channel#flush with a callback', () => {
    const ch = channel<number>();
    const spy = vi.spyOn(ch, 'flush');
    put(ch, 1);

    flush(ch);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBeInstanceOf(Function);
  });

  it('rejects with CLOSED when the channel is closed', async () => {
    const ch = channel<number>();
    put(ch, 1);
    ch.close();

    await expect(flush(ch)).rejects.toBe(CLOSED);
  });
});
