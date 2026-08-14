import { describe, expect, it, vi } from 'vitest';

import { go } from '@/go';
import { isKill, KILL, kill } from '@/operators/kill';

describe('KILL', () => {
  it('is the well known kill symbol', () => {
    expect(KILL).toBe(Symbol.for('https://github.com/dineug/go.git#kill'));
  });
});

describe('isKill', () => {
  it('returns true only for the KILL symbol', () => {
    expect(isKill(KILL)).toBe(true);
    expect(isKill(Symbol.for('https://github.com/dineug/go.git#kill'))).toBe(
      true
    );
  });

  it('returns false for anything else', () => {
    expect(isKill(undefined)).toBe(false);
    expect(isKill(null)).toBe(false);
    expect(isKill('kill')).toBe(false);
    expect(isKill(Symbol('kill'))).toBe(false);
    expect(isKill(new Error('kill'))).toBe(false);
  });
});

describe('kill', () => {
  it('returns a promise rejected with KILL', async () => {
    await expect(kill()).rejects.toBe(KILL);
  });

  it('returns a new promise on every call', async () => {
    const first = kill();
    const second = kill();

    expect(first).not.toBe(second);
    await expect(first).rejects.toBe(KILL);
    await expect(second).rejects.toBe(KILL);
  });

  it('terminates a go task', async () => {
    const after = vi.fn();
    const task = go(function* () {
      yield kill();
      after();
      return 'done';
    });

    await expect(task).rejects.toBe(KILL);
    expect(after).not.toHaveBeenCalled();
  });

  it('cannot be caught inside the generator', async () => {
    const caught = vi.fn();
    const task = go(function* () {
      try {
        yield kill();
      } catch (error) {
        caught(error);
      }
      return 'done';
    });

    await expect(task).rejects.toBe(KILL);
    expect(caught).not.toHaveBeenCalled();
  });

  it('stops a loop that would otherwise keep running', async () => {
    const seen: number[] = [];
    const task = go(function* () {
      for (let i = 0; i < 3; i++) {
        seen.push(i);
        yield i === 1 ? kill() : Promise.resolve(i);
      }
      return 'done';
    });

    await expect(task).rejects.toBe(KILL);
    expect(seen).toEqual([0, 1]);
  });
});
