import { describe, expect, it } from 'vite-plus/test';

import {
  applyPickedLocale,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  parseLocalePreference,
} from './locale';

describe('the stored display language', () => {
  it('lives under its own key and follows the browser until a pick', () => {
    expect(LOCALE_STORAGE_KEY).toBe('@locale');
    expect(DEFAULT_LOCALE).toBe('system');
  });

  it.each(['system', 'en', 'ko-KR', 'ar-SA'])('keeps %s', value => {
    expect(parseLocalePreference(value)).toBe(value);
  });

  it('keeps a code this build does not know, which the editor ignores', () => {
    expect(parseLocalePreference('xx-YY')).toBe('xx-YY');
  });

  it.each([
    ['nothing stored', null],
    ['an empty string', ''],
    ['a number', 7],
    ['an object', { locale: 'ko-KR' }],
    ['undefined', undefined],
  ])('reads %s as system', (_, value) => {
    expect(parseLocalePreference(value)).toBe('system');
  });
});

describe('applyPickedLocale', () => {
  it('takes the language a pick names', () => {
    expect(applyPickedLocale('system', { locale: 'ko-KR' })).toBe('ko-KR');
    expect(applyPickedLocale('ko-KR', { locale: 'system' })).toBe('system');
  });

  it('keeps the same language picked again', () => {
    expect(applyPickedLocale('ja-JP', { locale: 'ja-JP' })).toBe('ja-JP');
  });

  it.each([
    ['no detail', undefined],
    ['a null detail', null],
    ['a string detail', 'ko-KR'],
    ['a detail without a locale', {}],
    ['an empty locale', { locale: '' }],
    ['a locale that is no string', { locale: 3 }],
  ])('keeps the preference for %s', (_, detail) => {
    expect(applyPickedLocale('de-DE', detail)).toBe('de-DE');
  });
});
