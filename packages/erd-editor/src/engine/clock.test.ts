import { describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';

describe('Clock', () => {
  it('starts at version 0', () => {
    const clock = new Clock();

    expect(clock.getVersion()).toBe(0);
  });

  it('getNextVersion is a pure peek — it never advances the clock', () => {
    const clock = new Clock();

    expect(clock.getNextVersion()).toBe(1);
    expect(clock.getNextVersion()).toBe(1);
    expect(clock.getVersion()).toBe(0);
  });

  it('merge adopts a strictly greater remote version', () => {
    const clock = new Clock();

    clock.merge(5);

    expect(clock.getVersion()).toBe(5);
    expect(clock.getNextVersion()).toBe(6);
  });

  it('merge ignores a lower or equal remote version', () => {
    const clock = new Clock();
    clock.merge(10);

    clock.merge(10);
    expect(clock.getVersion()).toBe(10);

    clock.merge(3);
    expect(clock.getVersion()).toBe(10);

    clock.merge(-1);
    expect(clock.getVersion()).toBe(10);
  });

  it('merge ignores non-integer input', () => {
    const clock = new Clock();
    clock.merge(2);

    clock.merge(undefined);
    clock.merge(NaN);
    clock.merge(4.5);
    clock.merge('8' as any);
    clock.merge(null as any);
    clock.merge(Infinity);

    expect(clock.getVersion()).toBe(2);
  });

  it('merge returns itself so calls can be chained', () => {
    const clock = new Clock();

    const result = clock.merge(1).merge(undefined).merge(7);

    expect(result).toBe(clock);
    expect(clock.getVersion()).toBe(7);
  });

  it('keeps the version private per instance', () => {
    const a = new Clock();
    const b = new Clock();

    a.merge(9);

    expect(a.getVersion()).toBe(9);
    expect(b.getVersion()).toBe(0);
    // the counter lives in a #version private field, so it is not an own
    // property — only the bound method properties are enumerable.
    expect(Object.keys(a)).toEqual(['getVersion', 'getNextVersion', 'merge']);
    expect(JSON.parse(JSON.stringify(a))).toEqual({});
  });

  it('exposes readonly bound methods that survive destructuring', () => {
    const clock = new Clock();
    const { getVersion, getNextVersion, merge } = clock;

    merge(4);

    expect(getVersion()).toBe(4);
    expect(getNextVersion()).toBe(5);
  });
});
