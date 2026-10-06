import { describe, expect, it } from 'vite-plus/test';

import { LocaleCode, LocaleCodeList } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import { MESSAGES, messagesOf } from '@/i18n/messages/index';

type Value = string | Readonly<Record<string, string>>;
type Dictionary = Readonly<Record<string, Value>>;

/** The words no language translates, kept wherever English writes them. */
const PROTECTED_TOKENS = ['ERD Editor', 'ERD', 'SQL', 'PNG', 'SVG', 'JSON'];

const PLACEHOLDER_LIMIT = 12;

/** The bidi controls: the isolates t() adds itself, and the marks and embeddings. */
const BIDI_CONTROL = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/;

/** Each language's dictionary, by the code its file is named after. */
const dictionaries = Object.entries(
  import.meta.glob<Record<string, Dictionary>>(
    ['./*.ts', '!./index.ts', '!./*.test.ts'],
    { eager: true }
  )
).map(([path, module]) => {
  const code = path.replace(/^\.\/(.+)\.ts$/, '$1');
  const exportName = code.replace('-', '');
  return { code, module, exportName, messages: module[exportName] };
});

/** The English files, one per part of the editor, each exporting its part's messages. */
const englishParts = Object.entries(
  import.meta.glob<Record<string, Dictionary | undefined>>(
    ['./en/*.ts', '!./en/index.ts', '!./en/*.test.ts'],
    { eager: true }
  )
).map(([path, module]) => {
  const name = path.replace(/^\.\/en\/(.+)\.ts$/, '$1');
  return { name, messages: module[name] ?? {} };
});

const english = en as Dictionary;

const placeholdersOf = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)].map(([, name]) => name);

const textsOf = (value: Value) =>
  typeof value === 'string' ? [value] : Object.values(value);

/** What is wrong with one language's dictionary, as lines a failure prints. */
function checkDictionary(
  code: LocaleCode,
  messages: Dictionary,
  source: Dictionary = english
): string[] {
  const problems: string[] = [];
  const categories = new Intl.PluralRules(code)
    .resolvedOptions()
    .pluralCategories.slice()
    .sort();

  const missing = Object.keys(source).filter(key => !(key in messages));
  const extra = Object.keys(messages).filter(key => !(key in source));
  missing.forEach(key => problems.push(`${key}: missing`));
  extra.forEach(key => problems.push(`${key}: not in English`));

  for (const [key, sourceValue] of Object.entries(source)) {
    const value = messages[key];
    if (value === undefined) continue;

    if (typeof sourceValue !== typeof value) {
      problems.push(`${key}: shape differs from English`);
      continue;
    }

    const sourceOther =
      typeof sourceValue === 'string' ? sourceValue : sourceValue.other;
    const allowed = new Set(placeholdersOf(sourceOther));

    if (typeof value === 'string') {
      const names = [...new Set(placeholdersOf(value))].sort();
      if (names.join() !== [...allowed].sort().join()) {
        problems.push(`${key}: placeholders ${names} differ from English`);
      }
    } else {
      const forms = Object.keys(value).sort();
      if (forms.join() !== categories.join()) {
        problems.push(`${key}: forms ${forms} are not ${categories}`);
      }
      for (const [form, text] of Object.entries(value)) {
        if (!text.includes('{count}')) {
          problems.push(`${key}.${form}: no {count}`);
        }
        const strays = placeholdersOf(text).filter(name => !allowed.has(name));
        if (strays.length) {
          problems.push(
            `${key}.${form}: placeholders ${strays} not in English`
          );
        }
      }
    }

    for (const text of textsOf(value)) {
      if (!text.length || text.trim() !== text) {
        problems.push(`${key}: empty or padded`);
      }
      if (BIDI_CONTROL.test(text)) {
        problems.push(`${key}: holds a bidi control`);
      }
      for (const token of PROTECTED_TOKENS) {
        if (sourceOther.includes(token) && !text.includes(token)) {
          problems.push(`${key}: drops ${token}`);
        }
      }
    }

    if (
      key.startsWith('common.placeholder.') &&
      typeof value === 'string' &&
      [...value].length > PLACEHOLDER_LIMIT
    ) {
      problems.push(`${key}: longer than ${PLACEHOLDER_LIMIT} code points`);
    }
  }

  return problems;
}

describe('the dictionaries', () => {
  it('are one file for each listed code but English, and no other', () => {
    expect(dictionaries.map(({ code }) => code).sort()).toEqual(
      LocaleCodeList.filter(code => code !== 'en').sort()
    );
    expect(dictionaries).toHaveLength(24);
  });

  it('follow an English file for every part, none of them empty', () => {
    expect(englishParts).toHaveLength(16);
    for (const { name, messages } of englishParts) {
      expect(Object.keys(messages).length, name).toBeGreaterThan(0);
    }
  });

  it('are named after a listed code other than English, one export each', () => {
    for (const { code, module, exportName } of dictionaries) {
      expect(LocaleCodeList, code).toContain(code);
      expect(code).not.toBe('en');
      expect(Object.keys(module), code).toEqual([exportName]);
    }
  });

  for (const { code, messages } of dictionaries) {
    it(`${code} matches English key for key, shape for shape`, () => {
      expect(checkDictionary(code as LocaleCode, messages)).toEqual([]);
    });
  }
});

describe('the dictionary check', () => {
  it('passes English against itself', () => {
    expect(checkDictionary('en', english)).toEqual([]);
  });

  it('reports every kind of fault a translation can carry', () => {
    const source = {
      'x.named': 'Open {name} in ERD',
      'x.count': { one: '{count} match', other: '{count} matches' },
      'common.placeholder.table': 'table',
    };

    expect(
      checkDictionary(
        'ru-RU',
        {
          'x.named': ' {nom} \u200f',
          'x.count': { one: 'one', other: '{count} {total}' },
          'common.placeholder.table': 'a very long placeholder',
          'x.extra': 'extra',
        },
        source
      )
    ).toEqual([
      'x.extra: not in English',
      'x.named: placeholders nom differ from English',
      'x.named: empty or padded',
      'x.named: holds a bidi control',
      'x.named: drops ERD',
      'x.count: forms one,other are not few,many,one,other',
      'x.count.one: no {count}',
      'x.count.other: placeholders total not in English',
      'common.placeholder.table: longer than 12 code points',
    ]);
    expect(checkDictionary('ko-KR', { 'x.count': 'text' }, source)).toEqual([
      'x.named: missing',
      'common.placeholder.table: missing',
      'x.count: shape differs from English',
    ]);
  });
});

describe('messagesOf', () => {
  it('reads English for English', () => {
    expect(messagesOf('en')).toBe(en);
  });

  it('reads each dictionary written for its language', () => {
    for (const { code, messages } of dictionaries) {
      expect(messagesOf(code as LocaleCode), code).toBe(messages);
    }
  });

  it('holds a dictionary for every listed code, each its own', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LocaleCodeList].sort());
    expect(new Set(Object.values(MESSAGES)).size).toBe(LocaleCodeList.length);
    for (const code of LocaleCodeList) {
      expect(messagesOf(code), code).toBe(MESSAGES[code]);
    }
  });
});
