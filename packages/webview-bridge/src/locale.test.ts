import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { type Locale, LocaleLabel, type LocaleSetting } from '@/locale';

describe('LocaleLabel', () => {
  it('lists the twenty-five codes in picker order', () => {
    expect(Object.keys(LocaleLabel)).toEqual([
      'id-ID',
      'de-DE',
      'en',
      'es-ES',
      'eu-ES',
      'fr-FR',
      'it-IT',
      'nl-NL',
      'pl-PL',
      'pt-PT',
      'pt-BR',
      'ro-RO',
      'sk-SK',
      'sl-SI',
      'sv-SE',
      'tr-TR',
      'ru-RU',
      'uk-UA',
      'he-IL',
      'ar-SA',
      'fa-IR',
      'ja-JP',
      'zh-CN',
      'zh-TW',
      'ko-KR',
    ]);
  });

  it('sorts every language by its label, English among them', () => {
    const labels = Object.values(LocaleLabel);

    expect(labels).toEqual([...labels].sort((a, b) => (a > b ? 1 : -1)));
  });

  it('includes the three right-to-left languages', () => {
    expect(LocaleLabel).toMatchObject({
      'he-IL': 'עברית',
      'ar-SA': 'العربية',
      'fa-IR': 'فارسی',
    });
  });

  it('spells every code as a language with an optional region', () => {
    for (const code of Object.keys(LocaleLabel)) {
      expect(code).toMatch(/^[a-z]{2}(?:-[A-Z]{2})?$/);
    }
  });

  it('gives every language a distinct label', () => {
    const labels = Object.values(LocaleLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('types a setting as a code or auto', () => {
    expectTypeOf<Locale>().toEqualTypeOf<keyof typeof LocaleLabel>();
    expectTypeOf<'ko-KR'>().toExtend<LocaleSetting>();
    expectTypeOf<'auto'>().toExtend<LocaleSetting>();
    expectTypeOf<'system'>().not.toExtend<LocaleSetting>();
  });
});
