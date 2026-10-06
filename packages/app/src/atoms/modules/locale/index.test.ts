import { createStore } from 'jotai';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { renderHook } from '@/__test-utils__/renderHook';

const KEY = '@locale';

/** The module afresh, so its atom reads storage on init as a page load does. */
async function loadModule() {
  vi.resetModules();
  return await import('@/atoms/modules/locale');
}

/** What another tab's write looks like to this one. */
function storageEvent(newValue: string | null) {
  act(() => {
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: KEY,
        newValue,
        storageArea: window.localStorage,
      })
    );
  });
}

afterEach(() => {
  window.localStorage.clear();
});

describe('the display language atom', () => {
  it('follows the browser while nothing is stored', async () => {
    const { localeAtom } = await loadModule();

    expect(createStore().get(localeAtom)).toBe('system');
  });

  it('reads a stored language before anything mounts', async () => {
    window.localStorage.setItem(KEY, JSON.stringify('ko-KR'));
    const { localeAtom } = await loadModule();

    expect(createStore().get(localeAtom)).toBe('ko-KR');
  });

  it.each([
    ['a value that is no JSON', 'ko-KR'],
    ['a number', '42'],
    ['an object', '{"locale":"ko-KR"}'],
  ])('reads %s as system', async (_, stored) => {
    window.localStorage.setItem(KEY, stored);
    const { localeAtom } = await loadModule();

    expect(createStore().get(localeAtom)).toBe('system');
  });

  it('stores a pick from the editor as JSON', async () => {
    const { useApplyPickedLocale, useLocalePreference } = await loadModule();
    const { result, unmount } = renderHook(
      () => [useLocalePreference(), useApplyPickedLocale()] as const,
      createStore()
    );

    act(() => result.current[1]({ locale: 'ko-KR' }));
    expect(result.current[0]).toBe('ko-KR');
    expect(window.localStorage.getItem(KEY)).toBe('"ko-KR"');

    act(() => result.current[1]({ locale: 'system' }));
    expect(result.current[0]).toBe('system');
    expect(window.localStorage.getItem(KEY)).toBe('"system"');
    unmount();
  });

  it('keeps the preference for an event that names no language', async () => {
    window.localStorage.setItem(KEY, JSON.stringify('de-DE'));
    const { useApplyPickedLocale, useLocalePreference } = await loadModule();
    const { result, unmount } = renderHook(
      () => [useLocalePreference(), useApplyPickedLocale()] as const,
      createStore()
    );

    act(() => result.current[1](null));
    act(() => result.current[1]({}));
    expect(result.current[0]).toBe('de-DE');
    expect(window.localStorage.getItem(KEY)).toBe('"de-DE"');
    unmount();
  });

  it('follows a pick another tab stored', async () => {
    const { useLocalePreference } = await loadModule();
    const { result, unmount } = renderHook(useLocalePreference, createStore());
    expect(result.current).toBe('system');

    storageEvent('"ja-JP"');
    expect(result.current).toBe('ja-JP');

    storageEvent('[1]');
    expect(result.current).toBe('system');

    storageEvent('"ar-SA"');
    storageEvent(null);
    expect(result.current).toBe('system');
    unmount();
  });

  it('stops following the other tabs once nothing reads it', async () => {
    const { localeAtom, useLocalePreference } = await loadModule();
    const store = createStore();
    const { unmount } = renderHook(useLocalePreference, store);
    unmount();

    storageEvent('"ja-JP"');
    expect(store.get(localeAtom)).toBe('system');
  });
});
