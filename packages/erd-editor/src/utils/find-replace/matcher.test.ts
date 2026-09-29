import { describe, expect, it } from 'vite-plus/test';

import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  expandReplacement,
  FindOptions,
  Matcher,
} from '@/utils/find-replace';

const options = (overrides: Partial<FindOptions> = {}): FindOptions => ({
  ...DEFAULT_FIND_OPTIONS,
  ...overrides,
});

function matcherOf(query: string, overrides: Partial<FindOptions> = {}) {
  const { matcher, error } = createMatcher(query, options(overrides));
  expect(error).toBeNull();
  return matcher as Matcher;
}

const texts = (text: string, matcher: Matcher) =>
  matcher.find(text).map(({ start, end }) => text.slice(start, end));

describe('createMatcher', () => {
  it('has nothing to look for in an empty query', () => {
    expect(createMatcher('', DEFAULT_FIND_OPTIONS)).toEqual({
      matcher: null,
      error: 'empty',
    });
  });

  it('refuses a regular expression that does not parse, and only in regex mode', () => {
    expect(createMatcher('user(', options({ regex: true }))).toEqual({
      matcher: null,
      error: 'invalid',
    });
    expect(createMatcher('user(', DEFAULT_FIND_OPTIONS).error).toBeNull();
  });

  it('reads the identity escapes typed in names, which unicode mode refuses', () => {
    const text = 'user_id a-b x#y key:value';

    expect(texts(text, matcherOf('user\\_id', { regex: true }))).toEqual([
      'user_id',
    ]);
    expect(texts(text, matcherOf('a\\-b', { regex: true }))).toEqual(['a-b']);
    expect(texts(text, matcherOf('x\\#y', { regex: true }))).toEqual(['x#y']);
    expect(texts(text, matcherOf('y\\:v', { regex: true }))).toEqual(['y:v']);
    expect(
      matcherOf('user\\_(id)', { regex: true }).replace(text, 'u_$1')
    ).toBe('u_id a-b x#y key:value');
  });

  it('keeps unicode mode for a pattern that parses there, property classes and all', () => {
    const matcher = matcherOf('\\p{Lu}\\p{Ll}+', {
      regex: true,
      matchCase: true,
    });

    expect(texts('Éclair and Bob', matcher)).toEqual(['Éclair', 'Bob']);
    expect(texts('😀x', matcherOf('^.x$', { regex: true }))).toEqual(['😀x']);
  });

  it('finds plain text in any case by default, special characters and all', () => {
    const matcher = matcherOf('user.id');

    expect(texts('User.Id, user_id, USER.ID', matcher)).toEqual([
      'User.Id',
      'USER.ID',
    ]);
  });

  it('keeps to the case typed when asked', () => {
    const matcher = matcherOf('User', { matchCase: true });

    expect(texts('User user USER', matcher)).toEqual(['User']);
  });

  it('folds the case of any script', () => {
    expect(texts('ÉCOLE école', matcherOf('école'))).toEqual([
      'ÉCOLE',
      'école',
    ]);
  });

  it('reports each occurrence with its offsets, in order', () => {
    expect(matcherOf('id').find('id, user_id, idx')).toEqual([
      { start: 0, end: 2 },
      { start: 9, end: 11 },
      { start: 13, end: 15 },
    ]);
  });

  it('takes an underscore and a letter of any script as part of a word', () => {
    const matcher = matcherOf('id', { wholeWord: true });

    expect(texts('id user_id idx (id) id-card', matcher)).toEqual([
      'id',
      'id',
      'id',
    ]);
    expect(
      texts('사용자id 사용자 id', matcherOf('id', { wholeWord: true }))
    ).toEqual(['id']);
    expect(
      texts('사용자 아이디', matcherOf('사용자', { wholeWord: true }))
    ).toEqual(['사용자']);
  });

  it('never counts an empty match of a regular expression', () => {
    const matcher = matcherOf('x*', { regex: true });

    expect(texts('axxb', matcher)).toEqual(['xx']);
    expect(matcher.replace('axxb', '-')).toBe('a-b');
  });

  it('runs a regular expression with the case option applied', () => {
    expect(texts('Id ID id', matcherOf('^i.', { regex: true }))).toEqual([
      'Id',
    ]);
    expect(
      texts('Id ID id', matcherOf('i[a-z]', { regex: true, matchCase: true }))
    ).toEqual(['id']);
  });
});

describe('Matcher.replace', () => {
  it('replaces every occurrence with the text as typed, dollar signs included', () => {
    const matcher = matcherOf('id');

    expect(matcher.replace('id, user_ID', '$1&$$')).toBe('$1&$$, user_$1&$$');
  });

  it('replaces only the occurrence at the offset given', () => {
    const matcher = matcherOf('id');

    expect(matcher.replace('id, user_id', 'key', 9)).toBe('id, user_key');
    expect(matcher.replace('id, user_id', 'key', 3)).toBe('id, user_id');
  });

  it('leaves what whole word refuses as it was', () => {
    const matcher = matcherOf('id', { wholeWord: true });

    expect(matcher.replace('id user_id', 'key')).toBe('key user_id');
  });

  it('expands groups in a regular expression replacement', () => {
    const matcher = matcherOf('(\\w+)_(?<suffix>id)', { regex: true });

    expect(matcher.replace('user_id, team_id', '$<suffix>_$1')).toBe(
      'id_user, id_team'
    );
    expect(matcher.replace('user_id', '[$&] $$ $2')).toBe('[user_id] $ id');
  });
});

describe('expandReplacement', () => {
  /** What String.prototype.replace makes of the same template, the reference this follows. */
  const native = (subject: string, pattern: RegExp, template: string) =>
    subject.replace(pattern, template);

  const expand = (subject: string, pattern: RegExp, template: string) =>
    subject.replace(pattern, (...args: any[]) => {
      const hasGroups = typeof args[args.length - 1] === 'object';
      const tail = hasGroups ? 3 : 2;
      return expandReplacement(
        template,
        args[0],
        args.slice(1, args.length - tail),
        args[args.length - tail],
        args[args.length - tail + 1],
        hasGroups ? args[args.length - 1] : undefined
      );
    });

  it.each([
    '$1-$2',
    '$$',
    '$&!',
    '[$`]',
    "[$']",
    '$12',
    '$10',
    '$0',
    '$3',
    '$<name>',
    '$<missing>',
    '$',
    '$x',
  ])('agrees with String.prototype.replace on %s', template => {
    const pattern = /(a)(b)/g;
    const named = /(?<name>a)b/g;
    const subject = 'xxabyyabzz';

    expect(expand(subject, pattern, template)).toBe(
      native(subject, pattern, template)
    );
    expect(expand(subject, named, template)).toBe(
      native(subject, named, template)
    );
  });

  it('reads $<name> as it is written when the pattern has no named group', () => {
    expect(expandReplacement('$<name>', 'ab', ['a'], 0, 'ab')).toBe('$<name>');
  });

  it('gives an unmatched group as nothing', () => {
    expect(expand('b', /(a)?b/g, '[$1]')).toBe(native('b', /(a)?b/g, '[$1]'));
    expect(
      expandReplacement('[$<name>]', 'b', [undefined], 0, 'b', {
        name: undefined,
      })
    ).toBe('[]');
  });
});
