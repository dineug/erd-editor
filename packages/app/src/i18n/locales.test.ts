import { describe, expect, it } from 'vite-plus/test';

import {
  directionOf,
  isLocaleCode,
  type LocaleCode,
  LocaleCodeList,
  localeInfoOf,
  LOCALES,
} from '@/i18n/locales';
import { LOADERS } from '@/i18n/messages';

describe('LOCALES', () => {
  it('lists every language with a dictionary and English, once each', () => {
    expect(new Set(LocaleCodeList).size).toBe(LocaleCodeList.length);
    expect([...LocaleCodeList].sort()).toEqual(
      ['en', ...Object.keys(LOADERS)].sort()
    );
  });

  it('lists them in the order of their own names, English among them', () => {
    const labels = LOCALES.map(({ label }) => label);
    expect(labels).toEqual([...labels].sort((a, b) => (a > b ? 1 : -1)));
  });

  it('names each language in itself', () => {
    expect(localeInfoOf('ko-KR').label).toBe('한국어');
    expect(localeInfoOf('de-DE').label).toBe('Deutsch');
    for (const { label } of LOCALES) expect(label.trim()).toBe(label);
  });

  it('reads English for a code it does not list', () => {
    const unknown = 'xx-YY' as LocaleCode;
    expect(localeInfoOf(unknown).code).toBe('en');
    expect(directionOf(unknown)).toBe('ltr');
  });

  it('reads right to left for Hebrew, Arabic and Persian alone', () => {
    expect(LocaleCodeList.filter(code => directionOf(code) === 'rtl')).toEqual([
      'he-IL',
      'ar-SA',
      'fa-IR',
    ]);
    expect(directionOf('en')).toBe('ltr');
  });

  it('tells a listed code from any other string', () => {
    expect(isLocaleCode('ja-JP')).toBe(true);
    expect(isLocaleCode('system')).toBe(false);
    expect(isLocaleCode('xx-YY')).toBe(false);
    expect(isLocaleCode('ja')).toBe(false);
  });
});
