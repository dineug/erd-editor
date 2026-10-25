import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  lazyMessagesOf,
  type LoadedLocaleCode,
  loadMessages,
} from '@/i18n/loadMessages';
import { LocaleCodeList } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import { MESSAGES } from '@/i18n/messages/index';

const OTHER_CODES = LocaleCodeList.filter(
  (code): code is LoadedLocaleCode => code !== 'en'
);

afterEach(() => {
  vi.doUnmock('@/i18n/messages/ko-KR');
  vi.resetModules();
});

describe('loadMessages', () => {
  it('loads each of the 24 languages but English to the dictionary messagesOf holds', async () => {
    expect(OTHER_CODES).toHaveLength(24);

    for (const code of OTHER_CODES) {
      expect(await loadMessages(code), code).toBe(MESSAGES[code]);
    }
  });

  it('asks for a language once, every caller after the first sharing its load', () => {
    const first = loadMessages('ja-JP');

    expect(loadMessages('ja-JP')).toBe(first);
  });

  it('forgets a load that failed, so the next one asked tries again', async () => {
    vi.doMock('@/i18n/messages/ko-KR', () => {
      throw new Error('offline');
    });
    const loader = await import('@/i18n/loadMessages');

    const failed = loader.loadMessages('ko-KR');
    await expect(failed).rejects.toThrow();

    vi.doUnmock('@/i18n/messages/ko-KR');
    const again = loader.loadMessages('ko-KR');

    expect(again).not.toBe(failed);
    expect((await again)['common.close']).toBe('닫기');
  });
});

describe('lazyMessagesOf', () => {
  it('hands English over at once and every other language as a load', async () => {
    expect(lazyMessagesOf('en')).toBe(en);

    const korean = lazyMessagesOf('ko-KR');
    expect(korean).toBeInstanceOf(Promise);
    expect(await korean).toBe(MESSAGES['ko-KR']);
  });
});
