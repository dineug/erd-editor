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

describe('the display language shown', () => {
  /** Stubs the browser's languages, read on init and on languagechange. */
  function browserLanguages(languages: string[]) {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('@/i18n/messages');
  });

  it('loads a stored language before the first render and marks the page with it', async () => {
    window.localStorage.setItem(KEY, JSON.stringify('ko-KR'));
    const { i18nAtom, watchDisplayLanguage } = await loadModule();
    const store = createStore();
    const root = document.createElement('html');

    const ready = watchDisplayLanguage(store, root);
    expect(root.lang).toBe('en');

    await ready;
    expect(store.get(i18nAtom).t('sidebar.schemas')).toBe('스키마');
    expect([root.lang, root.dir]).toEqual(['ko-KR', 'ltr']);
  });

  it('follows the browser while nothing is picked, right to left included', async () => {
    browserLanguages(['nb', 'ar-EG']);
    const { i18nAtom, watchDisplayLanguage } = await loadModule();
    const store = createStore();
    const root = document.createElement('html');

    await watchDisplayLanguage(store, root);

    expect(store.get(i18nAtom).locale).toBe('ar-SA');
    expect([root.lang, root.dir]).toEqual(['ar-SA', 'rtl']);
  });

  it('switches on a pick and on a change of the browser language', async () => {
    browserLanguages(['en-US']);
    const { i18nAtom, localeAtom, watchDisplayLanguage } = await loadModule();
    const store = createStore();
    const root = document.createElement('html');
    await watchDisplayLanguage(store, root);

    store.set(localeAtom, 'ja-JP');
    await vi.waitFor(() => expect(root.lang).toBe('ja-JP'));

    store.set(localeAtom, 'system');
    await vi.waitFor(() => expect(root.lang).toBe('en'));

    browserLanguages(['de-AT']);
    window.dispatchEvent(new Event('languagechange'));
    await vi.waitFor(() => expect(store.get(i18nAtom).locale).toBe('de-DE'));
  });

  it('keeps the language asked for last when an earlier load lands after it', async () => {
    const { i18nAtom, loadDisplayLanguage, localeAtom } = await loadModule();
    const store = createStore();

    store.set(localeAtom, 'ko-KR');
    const earlier = loadDisplayLanguage(store);
    store.set(localeAtom, 'en');
    await earlier;

    expect(store.get(i18nAtom).locale).toBe('en');
  });

  it('keeps what is shown when a dictionary fails to load', async () => {
    const failure = new Error('chunk');
    vi.doMock('@/i18n/messages', () => ({
      loadMessages: () => Promise.reject(failure),
    }));
    const { i18nAtom, loadDisplayLanguage, localeAtom } = await loadModule();
    const store = createStore();

    store.set(localeAtom, 'fr-FR');

    await expect(loadDisplayLanguage(store)).rejects.toBe(failure);
    expect(store.get(i18nAtom).locale).toBe('en');
  });

  it('hands components the language, the one System stands for and a setter', async () => {
    browserLanguages(['pt']);
    const { useI18n, useSetLocalePreference, useSystemLocale } =
      await loadModule();
    const { result, unmount } = renderHook(
      () => [useI18n(), useSystemLocale(), useSetLocalePreference()] as const,
      createStore()
    );

    expect(result.current[0].locale).toBe('en');
    expect(result.current[1]).toBe('pt-BR');

    act(() => result.current[2]('sv-SE'));
    expect(window.localStorage.getItem(KEY)).toBe('"sv-SE"');
    unmount();
  });
});
