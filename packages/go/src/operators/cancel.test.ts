import { describe, expect, it, vi } from 'vitest';

import { go } from '@/go';
import {
  ATTACH_CANCEL,
  attachCancel,
  CANCEL,
  cancel,
  isCancel,
} from '@/operators/cancel';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('CANCEL', () => {
  it('is the well known cancel symbol', () => {
    expect(CANCEL).toBe(Symbol.for('https://github.com/dineug/go.git#cancel'));
  });
});

describe('ATTACH_CANCEL', () => {
  it('is the well known attachCancel symbol', () => {
    expect(ATTACH_CANCEL).toBe(
      Symbol.for('https://github.com/dineug/go.git#attachCancel')
    );
  });
});

describe('attachCancel', () => {
  it('returns the same promise instance', () => {
    const promise = Promise.resolve(1);

    expect(attachCancel(promise, () => {})).toBe(promise);
  });

  it('stores the canceler under the ATTACH_CANCEL key', () => {
    const promise = Promise.resolve(1);
    const canceler = vi.fn();

    attachCancel(promise, canceler);

    expect(Reflect.get(promise, ATTACH_CANCEL)).toBe(canceler);
    expect(canceler).not.toHaveBeenCalled();
  });

  it('overwrites a previously attached canceler', () => {
    const promise = Promise.resolve(1);
    const first = vi.fn();
    const second = vi.fn();

    attachCancel(promise, first);
    attachCancel(promise, second);
    cancel(promise);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe('isCancel', () => {
  it('returns true only for the CANCEL symbol', () => {
    expect(isCancel(CANCEL)).toBe(true);
    expect(
      isCancel(Symbol.for('https://github.com/dineug/go.git#cancel'))
    ).toBe(true);
  });

  it('returns false for anything else', () => {
    expect(isCancel(undefined)).toBe(false);
    expect(isCancel(null)).toBe(false);
    expect(isCancel('cancel')).toBe(false);
    expect(isCancel(Symbol('cancel'))).toBe(false);
    expect(isCancel(new Error('cancel'))).toBe(false);
  });
});

describe('cancel', () => {
  it('calls the attached canceler and rejects with CANCEL', async () => {
    const canceler = vi.fn();
    const promise = attachCancel(new Promise<void>(() => {}), canceler);

    const result = cancel(promise);

    expect(canceler).toHaveBeenCalledTimes(1);
    await expect(result).rejects.toBe(CANCEL);
  });

  it('rejects with CANCEL when no promise is given', async () => {
    await expect(cancel()).rejects.toBe(CANCEL);
  });

  it('ignores a promise without an attached canceler', async () => {
    await expect(cancel(Promise.resolve('ok'))).rejects.toBe(CANCEL);
  });

  it('ignores non object values', async () => {
    await expect(cancel(null as any)).rejects.toBe(CANCEL);
    await expect(cancel(1 as any)).rejects.toBe(CANCEL);
    await expect(cancel('promise' as any)).rejects.toBe(CANCEL);
    await expect(cancel([] as any)).rejects.toBe(CANCEL);
  });

  it('accepts a plain object carrying a canceler', () => {
    const canceler = vi.fn();
    const thenable = { then: () => {} };
    Reflect.set(thenable, ATTACH_CANCEL, canceler);

    cancel(thenable as any);

    expect(canceler).toHaveBeenCalledTimes(1);
  });

  it('rejects a running go task with CANCEL', async () => {
    const task = go(function* () {
      yield new Promise(() => {});
      return 'never';
    });
    await tick();

    cancel(task);

    await expect(task).rejects.toBe(CANCEL);
  });

  it('propagates the cancel down to the promise a go task is waiting on', async () => {
    const canceler = vi.fn();
    const task = go(function* () {
      yield attachCancel(new Promise(() => {}), canceler);
    });
    await tick();

    cancel(task);

    await expect(task).rejects.toBe(CANCEL);
    expect(canceler).toHaveBeenCalledTimes(1);
  });
});
