import * as Sentry from '@sentry/react';
import { createStore } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { collectUnhandledRejections } from '@/__test-utils__/rejections';
import { renderHook } from '@/__test-utils__/renderHook';
import {
  collaborativeAtom,
  useStartSession,
  useStopSession,
  useUpdateCollaborativeSessionAll,
} from '@/atoms/modules/collaborative';
import type { AppDatabaseService } from '@/services/indexeddb/appDatabaseService';

const FAILURE = new Error('IndexedDB is gone');

// Plain functions rather than mocks, which would settle the promise they
// return and so hide a rejection nobody handled.
async function fail(): Promise<never> {
  throw FAILURE;
}

const service = vi.hoisted(
  () =>
    ({
      collaborativeSessionAll: fail,
      collaborativeStartSession: fail,
      collaborativeStopSession: fail,
    }) as Partial<AppDatabaseService>
);

vi.mock('@/services/indexeddb', () => ({
  getAppDatabaseService: () => service,
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

describe('collaboration session actions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(Sentry.captureException).mockClear();
  });

  it.each([
    ['loading the sessions', useUpdateCollaborativeSessionAll],
    ['starting a session', useStartSession],
    ['stopping a session', useStopSession],
  ] as const)('settles %s that failed and reports it', async (_, useAction) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createStore();
    store.set(collaborativeAtom, { 'schema-1': ['room', 'key'] });
    const { result } = renderHook(useAction, store);

    const reasons = await collectUnhandledRejections(async () => {
      await expect(result.current('schema-1')).resolves.toBeUndefined();
    });

    expect(reasons).toEqual([]);
    expect(store.get(collaborativeAtom)).toEqual({
      'schema-1': ['room', 'key'],
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
  });
});
