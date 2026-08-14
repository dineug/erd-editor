import { describe, expect, it } from 'vitest';

import { buffers } from '@/buffers/buffers';
import { LimitBuffer } from '@/buffers/limitBuffer';

describe('buffers', () => {
  it('exposes only the limitBuffer factory', () => {
    expect(Object.keys(buffers)).toEqual(['limitBuffer']);
    expect(typeof buffers.limitBuffer).toBe('function');
  });

  it('creates a LimitBuffer instance without config', () => {
    const buffer = buffers.limitBuffer<number>();

    expect(buffer).toBeInstanceOf(LimitBuffer);
    expect(buffer.isEmpty()).toBe(true);
  });

  it('creates an independent instance on every call', () => {
    const a = buffers.limitBuffer<number>();
    const b = buffers.limitBuffer<number>();

    a.put(1);

    expect(a).not.toBe(b);
    expect(a.isEmpty()).toBe(false);
    expect(b.isEmpty()).toBe(true);
  });

  it('forwards the config to the created LimitBuffer', () => {
    const buffer = buffers.limitBuffer<number>({ limit: 1, leading: true });

    buffer.put(1);
    buffer.put(2);

    expect(buffer.flush()).toEqual([2]);
  });

  it('produces a buffer satisfying the ChannelBuffer contract', () => {
    const buffer = buffers.limitBuffer<string>({ limit: 2 });

    buffer.put('a');
    buffer.put('b');
    buffer.put('c');

    expect(buffer.take()).toBe('a');
    expect(buffer.drop(value => value === 'b')).toBe(true);
    expect(buffer.isEmpty()).toBe(true);
    expect(buffer.flush()).toEqual([]);
  });
});
