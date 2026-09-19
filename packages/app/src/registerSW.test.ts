import { afterEach, beforeAll, describe, expect, it } from 'vite-plus/test';

import { appUpdateStatusAtom } from '@/atoms/modules/app-update';
import { watchStaleChunks } from '@/registerSW';
import { store } from '@/store';

const preloadError = () =>
  window.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));

describe('watchStaleChunks', () => {
  beforeAll(() => {
    watchStaleChunks();
  });

  afterEach(() => {
    store.set(appUpdateStatusAtom, 'idle');
  });

  it('asks for a reload once a chunk fails to load', () => {
    preloadError();

    expect(store.get(appUpdateStatusAtom)).toBe('outdated');
  });

  it('leaves the event unprevented, so the import still rejects', () => {
    expect(preloadError()).toBe(true);
  });

  it.each(['available', 'updating', 'updatedElsewhere'] as const)(
    'keeps %s, which already offers the reload',
    status => {
      store.set(appUpdateStatusAtom, status);

      preloadError();

      expect(store.get(appUpdateStatusAtom)).toBe(status);
    }
  );
});
