import { describe, expect, it, vi } from 'vitest';

import { buffers } from '@/buffers';
import { channel, CLOSED } from '@/channel';
import { flush } from '@/operators/flush';
import { put } from '@/operators/put';
import { take } from '@/operators/take';

describe('put', () => {
  it('returns undefined', () => {
    const ch = channel<number>();

    expect(put(ch, 1)).toBeUndefined();
  });

  it('delegates to Channel#put', () => {
    const ch = channel<string>();
    const spy = vi.spyOn(ch, 'put');

    put(ch, 'a');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('a');
  });

  it('buffers values in insertion order', async () => {
    const ch = channel<number>();

    put(ch, 1);
    put(ch, 2);
    put(ch, 3);

    await expect(flush(ch)).resolves.toEqual([1, 2, 3]);
  });

  it('hands the value to a waiting take instead of buffering it', async () => {
    const ch = channel<number>();
    const waiting = take(ch);

    put(ch, 10);

    await expect(waiting).resolves.toBe(10);
    await expect(flush(ch)).resolves.toEqual([]);
  });

  it('supports any value type including null and undefined', async () => {
    const ch = channel<unknown>();

    put(ch, null);
    put(ch, undefined);
    put(ch, { a: 1 });

    await expect(flush(ch)).resolves.toEqual([null, undefined, { a: 1 }]);
  });

  it('respects the channel buffer limit', async () => {
    const ch = channel<number>(buffers.limitBuffer({ limit: 2 }));

    put(ch, 1);
    put(ch, 2);
    put(ch, 3);

    await expect(flush(ch)).resolves.toEqual([1, 2]);
  });

  it('is a no-op on a closed channel', async () => {
    const ch = channel<number>();
    ch.close();

    expect(() => put(ch, 1)).not.toThrow();
    await expect(take(ch)).rejects.toBe(CLOSED);
  });
});
