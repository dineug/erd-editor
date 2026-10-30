import { describe, expect, it } from 'vite-plus/test';

import { counterOf, versionOf } from '@/__test-utils__/version';
import { Clock, SLOT_BASE, slotOf, VERSION_SLOT_BITS } from '@/engine/clock';

describe('Clock', () => {
  it('starts at version 0', () => {
    const clock = new Clock();

    expect(clock.getVersion()).toBe(0);
  });

  it('folds the slot into the low 22 bits of a version', () => {
    expect(VERSION_SLOT_BITS).toBe(22);
    expect(SLOT_BASE).toBe(4_194_304);
  });

  it('getNextVersion is a pure peek — it never advances the clock', () => {
    const clock = new Clock();

    expect(clock.getNextVersion()).toBe(versionOf(1, 0));
    expect(clock.getNextVersion()).toBe(versionOf(1, 0));
    expect(clock.getVersion()).toBe(0);
  });

  it('merge adopts a strictly greater remote version', () => {
    const clock = new Clock();

    clock.merge(5);

    expect(clock.getVersion()).toBe(5);
    expect(clock.getNextVersion()).toBe(versionOf(1, 0));

    clock.merge(versionOf(3, 77));

    expect(clock.getVersion()).toBe(versionOf(3, 77));
    expect(clock.getNextVersion()).toBe(versionOf(4, 0));
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

  it('setSlot puts its slot under the next counter, read off the highest version seen', () => {
    const clock = new Clock();

    expect(clock.setSlot(9)).toBe(clock);
    expect(clock.getNextVersion()).toBe(versionOf(1, 9));

    clock.merge(versionOf(5, 3));

    expect(clock.getVersion()).toBe(versionOf(5, 3));
    expect(clock.getNextVersion()).toBe(versionOf(6, 9));
  });

  it('setSlot keeps the slot it had for one outside the slot bits', () => {
    const clock = new Clock().setSlot(9);

    clock.setSlot(-1);
    clock.setSlot(SLOT_BASE);
    clock.setSlot(1.5);
    clock.setSlot(NaN);

    expect(clock.getNextVersion()).toBe(versionOf(1, 9));

    clock.setSlot(SLOT_BASE - 1);

    expect(clock.getNextVersion()).toBe(versionOf(1, SLOT_BASE - 1));
  });

  it('two clocks of different slots never stamp one version at one counter (AC-T1)', () => {
    const a = new Clock().setSlot(1);
    const b = new Clock().setSlot(2);

    a.merge(versionOf(7, 5));
    b.merge(versionOf(7, 5));

    expect(a.getNextVersion()).not.toBe(b.getNextVersion());
    expect(counterOf(a.getNextVersion())).toBe(8);
    expect(counterOf(b.getNextVersion())).toBe(8);
  });

  it('stamps its next version above every version it merged, whatever slot that carried (AC-T1)', () => {
    const received = [
      1,
      SLOT_BASE - 1,
      SLOT_BASE,
      versionOf(2, 0),
      versionOf(2, 4),
      versionOf(2, SLOT_BASE - 1),
      versionOf(9, 3) + 1,
    ];

    for (const remote of received) {
      const clock = new Clock().setSlot(4);

      clock.merge(remote);

      expect(clock.getNextVersion()).toBeGreaterThan(remote);
      expect(counterOf(clock.getNextVersion())).toBe(counterOf(remote) + 1);
    }
  });

  it('stays a safe integer to the last of 2^31 counters (AC-T1)', () => {
    const clock = new Clock().setSlot(SLOT_BASE - 1);

    clock.merge(versionOf(2 ** 31 - 2, 5));

    expect((2 ** 31 - 1) * 2 ** 22 + 2 ** 22 - 1).toBe(Number.MAX_SAFE_INTEGER);
    expect(clock.getNextVersion()).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('keeps the version and the slot private per instance', () => {
    const a = new Clock();
    const b = new Clock();

    a.merge(9);
    a.setSlot(3);

    expect(a.getVersion()).toBe(9);
    expect(b.getVersion()).toBe(0);
    expect(b.getNextVersion()).toBe(versionOf(1, 0));
    // The counter and the slot live in private fields, so neither is an own
    // property: only the bound method properties are enumerable.
    expect(Object.keys(a)).toEqual([
      'getVersion',
      'getNextVersion',
      'setSlot',
      'merge',
    ]);
    expect(JSON.parse(JSON.stringify(a))).toEqual({});
  });

  it('exposes readonly bound methods that survive destructuring', () => {
    const clock = new Clock();
    const { getVersion, getNextVersion, setSlot, merge } = clock;

    merge(4);
    setSlot(6);

    expect(getVersion()).toBe(4);
    expect(getNextVersion()).toBe(versionOf(1, 6));
  });
});

describe('slotOf (AC-T1)', () => {
  it('is the low 22 bits of the FNV-1a hash of the id', () => {
    // The 32-bit FNV-1a values of "", "a" and "foobar" are 0x811c9dc5,
    // 0xe40c292c and 0xbf9cf968.
    expect(slotOf('')).toBe(0x1c9dc5);
    expect(slotOf('a')).toBe(0x0c292c);
    expect(slotOf('foobar')).toBe(0x1cf968);
  });

  it('gives one id one slot every time, on every clock', () => {
    const id = '1hd2cjvyvwfx7wo6zzk9n1y0b';
    const a = new Clock().setSlot(slotOf(id));
    const b = new Clock().setSlot(slotOf(id));

    expect(slotOf(id)).toBe(slotOf(id));
    expect(a.getNextVersion()).toBe(b.getNextVersion());
  });

  it('answers a whole number within the slot bits for any id', () => {
    const ids = [
      '',
      'users',
      'V1StGXR8_Z5jdHi6B-myT',
      '0198f2a3-6c1e-7d3b-9a4f-1e2d3c4b5a69',
      '테이블',
      'x'.repeat(1000),
    ];

    for (const id of ids) {
      const slot = slotOf(id);
      expect(Number.isInteger(slot)).toBe(true);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(SLOT_BASE);
    }
  });
});
