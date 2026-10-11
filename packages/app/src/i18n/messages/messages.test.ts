import { describe, expect, it } from 'vite-plus/test';

import { type LocaleCode, LocaleCodeList } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import { LOADERS, loadMessages } from '@/i18n/messages/index';

type Value = string | Readonly<Record<string, string>>;
type Dictionary = Readonly<Record<string, Value>>;

/** The words no language translates, kept wherever English writes them. */
const PROTECTED_TOKENS = [
  'ERD Editor',
  'ERD',
  'Google',
  'WebRTC',
  'SQL',
  'DBML',
  'AML',
  'GraphQL',
  'MB',
  '.erd',
  '.vuerd',
  '.json',
  'erd-editor.io',
  'accounts.google.com',
  'myaccount.google.com/permissions',
];

/** The bidi controls: the isolates t() adds itself, and the marks and embeddings. */
const BIDI_CONTROL = /[؜‎‏‪-‮⁦-⁩]/;

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
  }

  return problems;
}

const translated = LocaleCodeList.filter(code => code !== 'en');

describe('the dictionaries', () => {
  it('have a loader for every language but English, and no other', () => {
    expect(Object.keys(LOADERS).sort()).toEqual([...translated].sort());
    expect(translated).toHaveLength(24);
  });

  it('load English without a chunk', async () => {
    expect(await loadMessages('en')).toBe(en);
  });

  it('load each language as a dictionary of its own', async () => {
    const loaded = await Promise.all(translated.map(loadMessages));
    expect(new Set(loaded).size).toBe(translated.length);
    expect(loaded).not.toContain(en);
  });

  for (const code of translated) {
    it(`${code} matches English key for key, shape for shape`, async () => {
      const messages = (await loadMessages(code)) as Dictionary;
      expect(checkDictionary(code, messages)).toEqual([]);
    });
  }
});

describe('the dictionary check', () => {
  it('passes English against itself', () => {
    expect(checkDictionary('en', english)).toEqual([]);
  });

  it('reports every kind of fault a translation can carry', () => {
    const source = {
      'x.named': 'Open {name} in ERD Editor',
      'x.count': { one: '{count} file', other: '{count} files' },
    };

    expect(
      checkDictionary(
        'ru-RU',
        {
          'x.named': ' {nom} ‏',
          'x.count': { one: 'one', other: '{count} {total}' },
          'x.extra': 'extra',
        },
        source
      )
    ).toEqual([
      'x.extra: not in English',
      'x.named: placeholders nom differ from English',
      'x.named: empty or padded',
      'x.named: holds a bidi control',
      'x.named: drops ERD Editor',
      'x.named: drops ERD',
      'x.count: forms one,other are not few,many,one,other',
      'x.count.one: no {count}',
      'x.count.other: placeholders total not in English',
    ]);
    expect(checkDictionary('ko-KR', { 'x.count': 'text' }, source)).toEqual([
      'x.named: missing',
      'x.count: shape differs from English',
    ]);
  });
});
