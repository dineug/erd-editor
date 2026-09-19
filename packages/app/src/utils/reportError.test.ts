import * as Sentry from '@sentry/react';
import { createStore } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { collectUnhandledRejections } from '@/__test-utils__/rejections';
import { renderHook } from '@/__test-utils__/renderHook';
import {
  reportError,
  settleReported,
  useSettleReported,
} from '@/utils/reportError';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const FAILURE = new Error('IndexedDB is gone');

async function fail(): Promise<never> {
  throw FAILURE;
}

describe('reportError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it('logs the error and hands it to Sentry', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    reportError(FAILURE);

    expect(consoleError).toHaveBeenCalledWith(FAILURE);
    expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
  });

  describe('settleReported', () => {
    it('passes the arguments through and gives back the result', async () => {
      const action = async (a: number, b: number) => a + b;

      await expect(settleReported(action)(2, 3)).resolves.toBe(5);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('settles with undefined where the action rejects, and reports it', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const reasons = await collectUnhandledRejections(async () => {
        await expect(settleReported(fail)()).resolves.toBeUndefined();
      });

      expect(reasons).toEqual([]);
      expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
    });
  });

  describe('useSettleReported', () => {
    it('keeps its identity while the action keeps its own', () => {
      let action = async () => 1;
      const { result, rerender } = renderHook(
        () => useSettleReported(action),
        createStore()
      );
      const first = result.current;

      rerender();
      expect(result.current).toBe(first);

      action = async () => 2;
      rerender();
      expect(result.current).not.toBe(first);
    });
  });
});
