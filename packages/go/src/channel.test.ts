import { describe, expect, it, vi } from 'vitest';

import { buffers } from '@/buffers';
import { Channel, channel, CLOSED, isClosed } from '@/channel';

describe('isClosed', () => {
  it('is true only for the CLOSED symbol', () => {
    expect(isClosed(CLOSED)).toBe(true);
    expect(
      isClosed(Symbol.for('https://github.com/dineug/go.git#closed'))
    ).toBe(true);
    expect(isClosed(Symbol('closed'))).toBe(false);
    expect(isClosed(undefined)).toBe(false);
    expect(isClosed('CLOSED')).toBe(false);
  });
});

describe('channel', () => {
  it('creates a Channel instance that starts open', () => {
    const ch = channel<number>();

    expect(ch).toBeInstanceOf(Channel);
    expect(ch.closed).toBe(false);
  });

  it('accepts a custom buffer', () => {
    const ch = channel<number>(buffers.limitBuffer<number>({ limit: 1 }));

    ch.put(1);
    ch.put(2);

    const values: Array<Array<number>> = [];
    ch.flush(v => values.push(v));

    expect(values).toEqual([[1]]);
  });
});

describe('Channel', () => {
  describe('put / take', () => {
    it('delivers a value to a callback that is already waiting', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();

      ch.take(callback);
      expect(callback).not.toHaveBeenCalled();

      ch.put(1);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(1);
    });

    it('delivers a buffered value as soon as a callback subscribes', () => {
      const ch = new Channel<string>();
      const callback = vi.fn();

      ch.put('a');
      ch.take(callback);

      expect(callback).toHaveBeenCalledWith('a');
    });

    it('only consumes one value per take', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();

      ch.put(1);
      ch.put(2);
      ch.take(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(1);

      const rest: Array<Array<number>> = [];
      ch.flush(v => rest.push(v));
      expect(rest).toEqual([[2]]);
    });

    it('serves waiting callbacks in FIFO order', () => {
      const ch = new Channel<number>();
      const order: Array<string> = [];

      ch.take(value => order.push(`first:${value}`));
      ch.take(value => order.push(`second:${value}`));

      ch.put(10);
      ch.put(20);

      expect(order).toEqual(['first:10', 'second:20']);
    });

    it('returns an unsubscribe function that drops the pending callback', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();

      const off = ch.take(callback);

      expect(off()).toBe(true);
      expect(off()).toBe(false);

      ch.put(1);
      expect(callback).not.toHaveBeenCalled();
    });

    it('leaves other callbacks in place when one unsubscribes', () => {
      const ch = new Channel<number>();
      const dropped = vi.fn();
      const kept = vi.fn();

      const off = ch.take(dropped);
      ch.take(kept);
      off();

      ch.put(7);

      expect(dropped).not.toHaveBeenCalled();
      expect(kept).toHaveBeenCalledWith(7);
    });
  });

  describe('flush', () => {
    it('hands over every buffered value and empties the buffer', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();

      ch.put(1);
      ch.put(2);
      ch.put(3);
      ch.flush(callback);

      expect(callback).toHaveBeenCalledWith([1, 2, 3]);

      const second = vi.fn();
      ch.flush(second);
      expect(second).toHaveBeenCalledWith([]);
    });
  });

  describe('close', () => {
    it('flips the closed flag', () => {
      const ch = new Channel();

      expect(ch.closed).toBe(false);
      ch.close();
      expect(ch.closed).toBe(true);
    });

    it('notifies every pending take with CLOSED', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();
      const onClose = vi.fn();

      ch.take(callback, onClose);
      ch.close();

      expect(onClose).toHaveBeenCalledWith(CLOSED);
      expect(callback).not.toHaveBeenCalled();
    });

    it('tolerates pending takes registered without a close callback', () => {
      const ch = new Channel<number>();

      ch.take(vi.fn());

      expect(() => ch.close()).not.toThrow();
    });

    it('ignores put after close', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();

      ch.close();
      ch.put(1);
      ch.take(callback);

      expect(callback).not.toHaveBeenCalled();
    });

    it('rejects take after close and returns a no-op unsubscribe', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();
      const onClose = vi.fn();

      ch.close();
      const off = ch.take(callback, onClose);

      expect(onClose).toHaveBeenCalledWith(CLOSED);
      expect(callback).not.toHaveBeenCalled();
      expect(off()).toBe(false);
    });

    it('does not throw when take after close has no close callback', () => {
      const ch = new Channel<number>();

      ch.close();

      expect(() => ch.take(vi.fn())).not.toThrow();
    });

    it('rejects flush after close', () => {
      const ch = new Channel<number>();
      const callback = vi.fn();
      const onClose = vi.fn();

      ch.put(1);
      ch.close();
      ch.flush(callback, onClose);

      expect(onClose).toHaveBeenCalledWith(CLOSED);
      expect(callback).not.toHaveBeenCalled();
    });

    it('does not throw when flush after close has no close callback', () => {
      const ch = new Channel<number>();

      ch.close();

      expect(() => ch.flush(vi.fn())).not.toThrow();
    });
  });
});
