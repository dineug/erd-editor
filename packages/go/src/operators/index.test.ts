import { describe, expect, it } from 'vitest';

import { channel } from '@/channel';
import * as operators from '@/operators';
import {
  ATTACH_CANCEL,
  attachCancel,
  CANCEL,
  cancel,
  isCancel,
} from '@/operators/cancel';
import { flush } from '@/operators/flush';
import { isKill, KILL, kill } from '@/operators/kill';
import { put } from '@/operators/put';
import { take } from '@/operators/take';
import { takeEvery } from '@/operators/takeEvery';
import { takeLatest } from '@/operators/takeLatest';
import { takeLeading } from '@/operators/takeLeading';

describe('operators barrel', () => {
  it('exposes exactly the public operator surface', () => {
    expect(Object.keys(operators).sort()).toEqual(
      [
        'ATTACH_CANCEL',
        'CANCEL',
        'KILL',
        'all',
        'attachCancel',
        'cancel',
        'debounce',
        'delay',
        'flush',
        'isCancel',
        'isKill',
        'kill',
        'put',
        'race',
        'take',
        'takeEvery',
        'takeLatest',
        'takeLeading',
        'throttle',
      ].sort()
    );
  });

  it('re-exports the cancel module bindings by identity', () => {
    expect(operators.ATTACH_CANCEL).toBe(ATTACH_CANCEL);
    expect(operators.CANCEL).toBe(CANCEL);
    expect(operators.attachCancel).toBe(attachCancel);
    expect(operators.cancel).toBe(cancel);
    expect(operators.isCancel).toBe(isCancel);
  });

  it('re-exports the kill module bindings by identity', () => {
    expect(operators.KILL).toBe(KILL);
    expect(operators.kill).toBe(kill);
    expect(operators.isKill).toBe(isKill);
  });

  it('re-exports the channel operators by identity', () => {
    expect(operators.put).toBe(put);
    expect(operators.take).toBe(take);
    expect(operators.flush).toBe(flush);
    expect(operators.takeEvery).toBe(takeEvery);
    expect(operators.takeLatest).toBe(takeLatest);
    expect(operators.takeLeading).toBe(takeLeading);
  });

  it('exports every binding as a function except the symbols', () => {
    const symbolKeys = ['ATTACH_CANCEL', 'CANCEL', 'KILL'];

    for (const [key, value] of Object.entries(operators)) {
      expect(typeof value).toBe(
        symbolKeys.includes(key) ? 'symbol' : 'function'
      );
    }
  });

  it('works end to end through the barrel', async () => {
    const ch = channel<number>();

    operators.put(ch, 1);
    operators.put(ch, 2);

    await expect(operators.take(ch)).resolves.toBe(1);
    await expect(operators.flush(ch)).resolves.toEqual([2]);
  });
});
