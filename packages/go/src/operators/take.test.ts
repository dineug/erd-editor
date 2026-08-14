import { describe, expect, it } from 'vitest';

import { channel, CLOSED } from '@/channel';
import { CANCEL, cancel } from '@/operators/cancel';
import { flush } from '@/operators/flush';
import { put } from '@/operators/put';
import { take } from '@/operators/take';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('take', () => {
  it('resolves with a value that is put after the take is registered', async () => {
    const ch = channel<number>();

    const result = take(ch);
    put(ch, 1);

    await expect(result).resolves.toBe(1);
  });

  it('resolves with a value that was buffered before the take', async () => {
    const ch = channel<string>();
    put(ch, 'a');

    await expect(take(ch)).resolves.toBe('a');
  });

  it('delivers buffered values to sequential takes in FIFO order', async () => {
    const ch = channel<number>();
    put(ch, 1);
    put(ch, 2);

    const first = take(ch);
    const second = take(ch);

    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
  });

  it('consumes the value so a later flush no longer sees it', async () => {
    const ch = channel<number>();
    put(ch, 1);
    put(ch, 2);

    await expect(take(ch)).resolves.toBe(1);
    await expect(flush(ch)).resolves.toEqual([2]);
  });

  it('resolves with undefined values put on the channel', async () => {
    const ch = channel<undefined>();

    const result = take(ch);
    put(ch, undefined);

    await expect(result).resolves.toBeUndefined();
  });

  it('rejects with CLOSED when the channel is already closed', async () => {
    const ch = channel<number>();
    ch.close();

    await expect(take(ch)).rejects.toBe(CLOSED);
  });

  it('rejects with CLOSED when the channel closes while waiting', async () => {
    const ch = channel<number>();

    const result = take(ch);
    ch.close();

    await expect(result).rejects.toBe(CLOSED);
  });

  it('rejects with CANCEL and drops the pending callback when canceled', async () => {
    const ch = channel<number>();

    const result = take(ch);
    await tick();
    cancel(result);

    await expect(result).rejects.toBe(CANCEL);

    put(ch, 42);
    await expect(flush(ch)).resolves.toEqual([42]);
  });

  it('rejects with CANCEL when canceled before it starts waiting', async () => {
    const ch = channel<number>();

    const result = take(ch);
    cancel(result);

    await expect(result).rejects.toBe(CANCEL);
  });

  it('leaves other pending takes untouched when one is canceled', async () => {
    const ch = channel<number>();

    const first = take(ch);
    const second = take(ch);
    await tick();
    cancel(first);

    await expect(first).rejects.toBe(CANCEL);

    put(ch, 7);
    await expect(second).resolves.toBe(7);
  });
});
