import { describe, expect, it } from 'vite-plus/test';

import { type LocaleCode } from '@/i18n/locales';
import { sourceI18n } from '@/i18n/source';
import {
  createI18n,
  formatMessage,
  isolate,
  localized,
  type Messages,
} from '@/i18n/translate';

/** A dictionary with every shape a message takes, under keys English has. */
const fixture = {
  'common.cancel': 'Plain',
  'common.edited': 'Edited {time}, {time}',
  'trash.deletesIn': { one: '{count} day', other: '{count} days' },
  'import.skippedOversized': {
    zero: 'zero {count} {size}',
    one: 'one {count} {size}',
    two: 'two {count} {size}',
    few: 'few {count} {size}',
    many: 'many {count} {size}',
    other: 'other {count} {size}',
  },
} as unknown as Messages;

const i18nOf = (locale: LocaleCode) => createI18n(locale, fixture);

describe('formatMessage', () => {
  it('writes every occurrence of a name and leaves a name it is not given as typed', () => {
    expect(formatMessage('{a} and {a}, not {b}', { a: 'x' })).toBe(
      'x and x, not {b}'
    );
  });

  it('returns the template as it is without values', () => {
    expect(formatMessage('{a}')).toBe('{a}');
  });

  it('writes a number as String writes it', () => {
    expect(formatMessage('{n}|{z}', { n: 1.5, z: 0 })).toBe('1.5|0');
  });

  it('isolates each value when asked', () => {
    expect(formatMessage('<{a}>', { a: 'x' }, true)).toBe(`<${isolate('x')}>`);
    expect(isolate('x')).toBe('⁨x⁩');
  });
});

describe('createI18n', () => {
  it('reads a plain message and fills its placeholders', () => {
    const { t } = i18nOf('en');
    expect(t('common.cancel')).toBe('Plain');
    expect(t('common.edited', { time: 'now' })).toBe('Edited now, now');
  });

  it('picks a plural form by the language rules', () => {
    const { t } = i18nOf('en');
    expect(t('trash.deletesIn', { count: 1 })).toBe('1 day');
    expect(t('trash.deletesIn', { count: 2 })).toBe('2 days');
  });

  it('falls back to other where the language has a form the message lacks', () => {
    const { t } = i18nOf('ru-RU');
    expect(t('trash.deletesIn', { count: 3 })).toBe('3 days');
  });

  it('reads every Arabic category', () => {
    const { t } = i18nOf('ar-SA');
    const forms = [0, 1, 2, 3, 11, 100].map(
      count => t('import.skippedOversized', { count, size: 64 }).split(' ')[0]
    );
    expect(forms).toEqual(['zero', 'one', 'two', 'few', 'many', 'other']);
  });

  it('isolates values under right to left only', () => {
    expect(i18nOf('he-IL').t('common.edited', { time: 'x' })).toBe(
      `Edited ${isolate('x')}, ${isolate('x')}`
    );
    expect(i18nOf('he-IL').dir).toBe('rtl');
    expect(i18nOf('ko-KR').t('common.edited', { time: 'x' })).toBe(
      'Edited x, x'
    );
    expect(i18nOf('ko-KR').dir).toBe('ltr');
  });
});

describe('localized', () => {
  it('reads its message in the language it is handed', () => {
    const text = localized('common.edited', { time: 'x' });
    expect(text(sourceI18n)).toBe('Edited x');
    expect(text(i18nOf('en'))).toBe('Edited x, x');
  });
});
