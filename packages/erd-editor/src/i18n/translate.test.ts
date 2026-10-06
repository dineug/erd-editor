import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { directionOf, LocaleCode, LocaleCodeList } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import { sourceI18n } from '@/i18n/source';
import {
  createI18n,
  formatMessage,
  MessageParamsOf,
  Messages,
  PlainMessageKey,
  PlainMessageKeyOf,
  TranslateOf,
} from '@/i18n/translate';

/**
 * A dictionary with every shape a message takes, since English holds no plural
 * and no parameter until the parts of the editor that show one write theirs.
 */
const fixture = {
  'x.plain': 'Plain',
  'x.named': 'Hello {name}, {name}!',
  'x.count': { one: '{count} match', other: '{count} matches' },
  'x.total': { one: '{count} of {total}', other: '{count} of {total}' },
  'x.every': {
    zero: 'zero {count}',
    one: 'one {count}',
    two: 'two {count}',
    few: 'few {count}',
    many: 'many {count}',
    other: 'other {count}',
  },
} as const;

type Fixture = typeof fixture;

const i18nOf = (locale: LocaleCode) =>
  createI18n(locale, fixture as unknown as Messages);

const tOf = (locale: LocaleCode) =>
  i18nOf(locale).t as unknown as TranslateOf<Fixture>;

const formsOf = (locale: LocaleCode, counts: number[]) => {
  const t = tOf(locale);
  return counts.map(count => t('x.every', { count }));
};

describe('formatMessage', () => {
  it('writes every occurrence of a name and leaves a name it is not given as typed', () => {
    expect(
      formatMessage('{a} and {a}, not {b}', { a: 'x' }),
      'repeated and unknown'
    ).toBe('x and x, not {b}');
  });

  it('writes a number as String writes it', () => {
    expect(formatMessage('{n}|{m}|{z}', { n: 1.5, m: 1e21, z: 0 })).toBe(
      '1.5|1e+21|0'
    );
  });

  it('returns the template as is with no parameters', () => {
    expect(formatMessage('{count} matches')).toBe('{count} matches');
  });

  it('reads only the parameters it is given, never one the prototype carries', () => {
    expect(formatMessage('{toString}', {})).toBe('{toString}');
  });

  it('isolates each value in FSI and PDI only when asked', () => {
    expect(formatMessage('{a}-{b}', { a: 'x', b: 2 }, true)).toBe(
      '\u2068x\u2069-\u20682\u2069'
    );
    expect(formatMessage('{a}', { a: 'x' }, false)).toBe('x');
  });
});

describe('createI18n', () => {
  it('reads a plain message and fills its parameters', () => {
    const t = tOf('en');

    expect(t('x.plain')).toBe('Plain');
    expect(t('x.named', { name: 'Ann' })).toBe('Hello Ann, Ann!');
  });

  it('picks the English form by count', () => {
    const t = tOf('en');

    expect([0, 1, 2].map(count => t('x.count', { count }))).toEqual([
      '0 matches',
      '1 match',
      '2 matches',
    ]);
    expect(t('x.total', { count: 1, total: 3 })).toBe('1 of 3');
  });

  it('picks the Arabic forms, all six of them, each count isolated', () => {
    expect(formsOf('ar-SA', [0, 1, 2, 3, 11, 100])).toEqual([
      'zero \u20680\u2069',
      'one \u20681\u2069',
      'two \u20682\u2069',
      'few \u20683\u2069',
      'many \u206811\u2069',
      'other \u2068100\u2069',
    ]);
  });

  it('picks the Russian and Polish forms, one covering 21', () => {
    expect(formsOf('ru-RU', [1, 2, 5, 21])).toEqual([
      'one 1',
      'few 2',
      'many 5',
      'one 21',
    ]);
    expect(formsOf('pl-PL', [22])).toEqual(['few 22']);
  });

  it('picks the French forms, one covering 0 and many a million', () => {
    expect(formsOf('fr-FR', [0, 1e6])).toEqual(['one 0', 'many 1000000']);
  });

  it('has other alone in Korean', () => {
    expect(formsOf('ko-KR', [0, 1, 2])).toEqual([
      'other 0',
      'other 1',
      'other 2',
    ]);
  });

  it('falls back to other where the dictionary lacks the form', () => {
    const t = tOf('ru-RU');

    expect(t('x.count', { count: 5 })).toBe('5 matches');
    expect(t('x.count', { count: 21 })).toBe('21 match');
  });

  it('reads other for a plural given no count', () => {
    const t = i18nOf('en').t as unknown as (key: string) => string;

    expect(t('x.count')).toBe('{count} matches');
  });

  it('isolates parameters under a right-to-left language alone', () => {
    expect(tOf('he-IL')('x.named', { name: 'Ann' })).toBe(
      'Hello \u2068Ann\u2069, \u2068Ann\u2069!'
    );
    expect(tOf('fa-IR')('x.count', { count: 2 })).toBe('\u20682\u2069 matches');
    expect(tOf('de-DE')('x.named', { name: 'Ann' })).not.toMatch(
      /[\u2068\u2069]/
    );
  });

  it('carries its language, direction and dictionary, unfrozen', () => {
    for (const code of LocaleCodeList) {
      const i18n = createI18n(code, en);

      expect(i18n.locale).toBe(code);
      expect(i18n.dir).toBe(directionOf(code));
      expect(i18n.messages).toBe(en);
      expect(Object.isFrozen(i18n)).toBe(false);
    }
  });
});

describe('sourceI18n', () => {
  it('reads English', () => {
    expect(sourceI18n.locale).toBe('en');
    expect(sourceI18n.dir).toBe('ltr');
    expect(sourceI18n.t('common.close')).toBe('Close');
    expect(sourceI18n.t('common.tab.codeGenerator')).toBe('Code Generator');
  });
});

describe('the types t() takes', () => {
  it('names each parameter a message interpolates, count included for a plural', () => {
    expectTypeOf<MessageParamsOf<Fixture, 'x.named'>>().toEqualTypeOf<'name'>();
    expectTypeOf<MessageParamsOf<Fixture, 'x.total'>>().toEqualTypeOf<
      'count' | 'total'
    >();
    expectTypeOf<MessageParamsOf<Fixture, 'x.plain'>>().toEqualTypeOf<never>();
  });

  it('keeps a plural and a key with a parameter out of the plain keys', () => {
    expectTypeOf<PlainMessageKeyOf<Fixture>>().toEqualTypeOf<'x.plain'>();
    expectTypeOf<'common.close'>().toExtend<PlainMessageKey>();
  });

  it('takes a plain key held in a variable of the wide type', () => {
    const t = tOf('en');
    const readPlain = (key: PlainMessageKeyOf<Fixture>) => t(key);
    const readLabel = (key: PlainMessageKey) => sourceI18n.t(key);

    expect(readPlain('x.plain')).toBe('Plain');
    expect(readLabel('common.none')).toBe('None');
  });

  it('refuses a missing count, a wrong name and parameters a key does not take', () => {
    const t = tOf('en');
    const refused = () => [
      // @ts-expect-error a plural is read by its count
      t('x.count'),
      // @ts-expect-error the count is missing beside the other parameter
      t('x.total', { total: 3 }),
      // @ts-expect-error the message has no parameter of that name
      t('x.named', { nam: 'Ann' }),
      // @ts-expect-error a plain message takes no parameters
      t('x.plain', { name: 'Ann' }),
    ];

    expect(refused()).toHaveLength(4);
  });
});
