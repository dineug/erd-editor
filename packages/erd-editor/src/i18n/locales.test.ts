import { describe, expect, it } from 'vite-plus/test';

import {
  directionOf,
  hasLocaleOption,
  LocaleCode,
  LocaleCodeList,
  localeInfoOf,
  LOCALES,
  SYSTEM_LOCALE,
} from '@/i18n/locales';

/** The languages and native names the owner decisions of 2026-10-06 list, in picker order. */
const OWNER_LIST = [
  ['en', 'English'],
  ['id-ID', 'Bahasa Indonesia'],
  ['de-DE', 'Deutsch'],
  ['es-ES', 'Español'],
  ['eu-ES', 'Euskara'],
  ['fr-FR', 'Français'],
  ['it-IT', 'Italiano'],
  ['nl-NL', 'Nederlands'],
  ['pl-PL', 'Polski'],
  ['pt-PT', 'Português'],
  ['pt-BR', 'Português Brasileiro'],
  ['ro-RO', 'Română'],
  ['sk-SK', 'Slovenčina'],
  ['sl-SI', 'Slovenščina'],
  ['sv-SE', 'Svenska'],
  ['tr-TR', 'Türkçe'],
  ['ru-RU', 'Русский'],
  ['uk-UA', 'Українська'],
  ['he-IL', 'עברית'],
  ['ar-SA', 'العربية'],
  ['fa-IR', 'فارسی'],
  ['ja-JP', '日本語'],
  ['zh-CN', '简体中文'],
  ['zh-TW', '繁體中文'],
  ['ko-KR', '한국어'],
];

describe('LOCALES', () => {
  it('lists the 25 languages with the native names the owner listed', () => {
    expect(LOCALES.map(locale => [locale.code, locale.label])).toEqual(
      OWNER_LIST
    );
    expect(LocaleCodeList).toEqual(OWNER_LIST.map(([code]) => code));
  });

  it('puts English first and the rest in the order of their own names', () => {
    const [first, ...rest] = LOCALES.map(locale => locale.label);
    const sorted = [...rest].sort((a, b) => (a > b ? 1 : -1));

    expect(first).toBe('English');
    expect(rest).toEqual(sorted);
  });

  it('reads right to left in Hebrew, Arabic and Persian alone', () => {
    const rtl = LOCALES.filter(locale => localeInfoOf(locale.code).rtl).map(
      locale => locale.code
    );

    expect(rtl.sort()).toEqual(['ar-SA', 'fa-IR', 'he-IL']);
    expect(LocaleCodeList.map(directionOf)).toEqual(
      LocaleCodeList.map(code => (rtl.includes(code) ? 'rtl' : 'ltr'))
    );
  });

  it('names every language in English too, each once', () => {
    const english = LOCALES.map(locale => locale.english);

    expect(new Set(english).size).toBe(LOCALES.length);
    expect(
      english.every(name => /^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(name))
    ).toBe(true);
  });

  it('has plural rules the runtime knows for every code', () => {
    expect(Intl.PluralRules.supportedLocalesOf([...LocaleCodeList])).toEqual(
      LocaleCodeList
    );
  });

  it('answers English for a code it does not list', () => {
    expect(localeInfoOf('xx' as LocaleCode)).toBe(LOCALES[0]);
  });
});

describe('hasLocaleOption', () => {
  it('takes system and every listed code', () => {
    expect(hasLocaleOption(SYSTEM_LOCALE)).toBe(true);
    expect(LocaleCodeList.every(hasLocaleOption)).toBe(true);
  });

  it('refuses a bare language, another case and anything else', () => {
    expect(hasLocaleOption('ko')).toBe(false);
    expect(hasLocaleOption('ko-kr')).toBe(false);
    expect(hasLocaleOption('System')).toBe(false);
    expect(hasLocaleOption('')).toBe(false);
  });
});
