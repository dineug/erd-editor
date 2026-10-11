import { describe, expect, it } from 'vite-plus/test';

import { resolveLocale } from '@/i18n/resolveLocale';

describe('resolveLocale', () => {
  it.each([
    ['en-US', 'en'],
    ['EN', 'en'],
    ['en-GB', 'en'],
    ['ko', 'ko-KR'],
    ['ko_KR', 'ko-KR'],
    ['de-AT', 'de-DE'],
    ['es-419', 'es-ES'],
    ['fa-AF', 'fa-IR'],
    ['ja', 'ja-JP'],
    [' fr-CA ', 'fr-FR'],
  ])('reads %s by its language as %s', (tag, code) => {
    expect(resolveLocale(tag)).toBe(code);
  });

  it.each([
    ['zh', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-SG', 'zh-CN'],
    ['zh-cn', 'zh-CN'],
    ['zh-Hans-HK', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-MO', 'zh-TW'],
    ['zh-Hant', 'zh-TW'],
    ['zh-tw', 'zh-TW'],
  ])('reads Chinese %s by its script, then its region, as %s', (tag, code) => {
    expect(resolveLocale(tag)).toBe(code);
  });

  it.each([
    ['pt', 'pt-BR'],
    ['pt-br', 'pt-BR'],
    ['pt-PT', 'pt-PT'],
    ['pt-AO', 'pt-PT'],
  ])('reads Portuguese %s as %s', (tag, code) => {
    expect(resolveLocale(tag)).toBe(code);
  });

  it('reads the retired codes of Hebrew and Indonesian', () => {
    expect(resolveLocale('iw')).toBe('he-IL');
    expect(resolveLocale('in')).toBe('id-ID');
  });

  it('falls through a language it has no dictionary for to the next tag', () => {
    expect(resolveLocale('nb')).toBe('en');
    expect(resolveLocale(['nb', 'de'])).toBe('de-DE');
    expect(resolveLocale(['en-US', 'ko'])).toBe('en');
  });

  it.each([[''], ['*'], ['x-foo'], [[]], [null], [undefined]])(
    'answers English for %j',
    tags => {
      expect(resolveLocale(tags)).toBe('en');
    }
  );

  it('skips a tag it cannot read and reads the one after it', () => {
    expect(resolveLocale(['*', 'x-foo', '', 'ar'])).toBe('ar-SA');
  });
});
