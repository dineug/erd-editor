import { describe, expect, it } from 'vite-plus/test';

import {
  createMatcher,
  DEFAULT_FIND_OPTIONS,
  expandReplacement,
  FindOptions,
  Matcher,
  toUnicodeSource,
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
      matcherOf('user\\_(id)', { regex: true }).replace(text, 'u_$1').value
    ).toBe('u_id a-b x#y key:value');
  });

  it('reads every pattern in unicode mode, property classes and all', () => {
    const matcher = matcherOf('\\p{Lu}\\p{Ll}+', {
      regex: true,
      matchCase: true,
    });

    expect(texts('Éclair and Bob', matcher)).toEqual(['Éclair', 'Bob']);
    expect(texts('😀x', matcherOf('^.x$', { regex: true }))).toEqual(['😀x']);
  });

  it('stays in unicode mode with an escape typed in a name beside a property class', () => {
    expect(
      texts(
        'A_ p{Lu}_',
        matcherOf('\\p{Lu}\\_', { regex: true, matchCase: true })
      )
    ).toEqual(['A_']);
    // Case folding in unicode mode takes the long s for an s.
    expect(texts('ſ_ s_', matcherOf('s\\_', { regex: true }))).toEqual([
      'ſ_',
      's_',
    ]);
    expect(texts('a😀b', matcherOf('\\😀', { regex: true }))).toEqual(['😀']);
  });

  it('refuses what unicode mode refuses besides the escapes and stray brackets it rewrites', () => {
    for (const query of [
      '\\p{Foo}',
      '[\\w-.]+',
      '\\z',
      'user\\',
      '(?=a)*',
      '\\p{L',
    ]) {
      expect(createMatcher(query, options({ regex: true })).error).toBe(
        'invalid'
      );
    }
  });

  it('takes a stray ] and a brace no quantifier owns as themselves', () => {
    const regex = { regex: true };

    expect(texts('a]', matcherOf(']', regex))).toEqual([']']);
    expect(texts('a{', matcherOf('a{', regex))).toEqual(['a{']);
    expect(texts('a{1', matcherOf('a{1', regex))).toEqual(['a{1']);
    expect(texts('x}', matcherOf('x}', regex))).toEqual(['x}']);
    expect(texts('{x,1}', matcherOf('{x,1}', regex))).toEqual(['{x,1}']);
    expect(texts('[]]', matcherOf('[\\]]]', regex))).toEqual([']]']);
    expect(texts('aaa', matcherOf('a{2}', regex))).toEqual(['aa']);
    expect(texts('aaa', matcherOf('a{1,}?', regex))).toEqual(['a', 'a', 'a']);
    expect(texts('éé ab', matcherOf('\\p{L}{2}', regex))).toEqual(['éé', 'ab']);
    expect(texts('a{2}', matcherOf('\\u{61}\\{2\\}', regex))).toEqual(['a{2}']);
  });

  it('never splits a surrogate pair, so a replacement never writes half of one', () => {
    const value = matcherOf('.\\_id', { regex: true }).replace(
      '😀_id',
      'X'
    ).value;

    expect(value).toBe('X');
    for (const query of ['.', '.\\_', '[^a]', '\\W', '(?<=.).']) {
      const replaced = matcherOf(query, { regex: true }).replace(
        '😀a𠀀_😀',
        '-'
      ).value;
      expect(/\p{Cs}/u.test(replaced)).toBe(false);
    }
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
    const decomposed = '사용자 아이디'.normalize('NFD');
    expect(
      texts(
        decomposed,
        matcherOf('사용자'.normalize('NFD'), { wholeWord: true })
      )
    ).toEqual(['사용자'.normalize('NFD')]);
  });

  it('takes a letter past the first plane as one, and a mark or a joiner as part of a word', () => {
    const whole = (query: string, text: string) =>
      texts(text, matcherOf(query, { wholeWord: true }));

    expect(whole('id', '𠀀id 𠀀 id')).toEqual(['id']);
    // A virama and Thai vowel and tone marks join the letters around them.
    expect(whole('नमस', 'नमस्ते')).toEqual([]);
    expect(whole('नमस्ते', 'नमस्ते')).toEqual(['नमस्ते']);
    expect(whole('ผ', 'ผู้ใช้ ผ')).toEqual(['ผ']);
    // A Persian word keeps its parts apart with a zero width non-joiner.
    expect(whole('خواهم', 'می‌خواهم می خواهم')).toEqual(['خواهم']);
    expect(whole('id', 'user＿id')).toEqual([]);
  });

  it('leaves a decomposed accent on the word it belongs to', () => {
    const text = 'café cafe';

    expect(
      matcherOf('cafe', { wholeWord: true }).replace(text, 'shop').value
    ).toBe('café shop');
  });

  it('counts a separator at the edge of a match as its boundary there, as VS Code and JetBrains do', () => {
    const whole = (query: string, text: string, regex = false) =>
      texts(text, matcherOf(query, { wholeWord: true, regex }));

    expect(whole('user ', 'user name')).toEqual(['user ']);
    expect(whole('.id', 'user.id')).toEqual(['.id']);
    expect(whole('-', 'a-b')).toEqual(['-']);
    expect(whole('(id)', 'fn(id)x')).toEqual(['(id)']);
    expect(whole('\\.\\w+', 'user.id', true)).toEqual(['.id']);
    // A word character at an edge still wants none beside it.
    expect(whole('.i', 'user.id')).toEqual([]);
    expect(whole('r.', 'user.id')).toEqual([]);
  });

  it('still never finds a word inside a longer one', () => {
    const whole = (query: string, text: string) =>
      texts(text, matcherOf(query, { wholeWord: true }));

    expect(whole('user', 'username superuser user')).toEqual(['user']);
    expect(whole('user', 'superusername')).toEqual([]);
    expect(whole('user', 'user_name user-name')).toEqual(['user']);
  });

  it('weighs whole word while it matches, so another alternative or length still gets its turn', () => {
    const whole = { regex: true, wholeWord: true };

    expect(texts('users user', matcherOf('user|users', whole))).toEqual([
      'users',
      'user',
    ]);
    expect(texts('identity id', matcherOf('id|identity', whole))).toEqual([
      'identity',
      'id',
    ]);
    expect(texts('user id', matcherOf('\\S+?', whole))).toEqual(['user', 'id']);
    expect(
      matcherOf('user|users', whole).replace('users user', 'X').value
    ).toBe('X X');
  });

  it('refuses an unbalanced pattern under whole word, which the wrapper around it would balance', () => {
    expect(
      createMatcher('user)|(id', options({ regex: true, wholeWord: true }))
    ).toEqual({ matcher: null, error: 'invalid' });
  });

  it('keeps the groups a pattern numbers and names under whole word', () => {
    const whole = { regex: true, wholeWord: true };

    expect(
      matcherOf('(\\w+?)_(?<suffix>id)', whole).replace(
        'user_id x_idx',
        '$<suffix>_$1'
      ).value
    ).toBe('id_user x_idx');
    expect(texts('aa aab', matcherOf('(a)\\1', whole))).toEqual(['aa']);
  });

  it('reads ^ and $ at each line of a text of several, CRLF ones too', () => {
    const regex = { regex: true };

    expect(texts('first line\nuser here', matcherOf('^user', regex))).toEqual([
      'user',
    ]);
    expect(texts('a line\nb line', matcherOf('line$', regex))).toEqual([
      'line',
      'line',
    ]);
    expect(texts('first line\r\nuser here', matcherOf('^user', regex))).toEqual(
      ['user']
    );
    expect(texts('a line\r\nb line', matcherOf('line$', regex))).toEqual([
      'line',
      'line',
    ]);
    expect(matcherOf('^- ', regex).replace('- a\r\n- b', '* ').value).toBe(
      '* a\r\n* b'
    );
  });

  it('keeps a dot to one line, a class reaching across', () => {
    expect(texts('a\nb', matcherOf('a.b', { regex: true }))).toEqual([]);
    expect(texts('a\nb', matcherOf('a[\\s\\S]b', { regex: true }))).toEqual([
      'a\nb',
    ]);
    expect(texts('^user\nuser', matcherOf('^user'))).toEqual(['^user']);
  });

  it('never counts an empty match of a regular expression', () => {
    const matcher = matcherOf('x*', { regex: true });

    expect(texts('axxb', matcher)).toEqual(['xx']);
    expect(matcher.replace('axxb', '-').value).toBe('a-b');
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

describe('toUnicodeSource', () => {
  it.each([
    ['user\\_id', 'user\\u{5f}id'],
    ['a\\-b', 'a\\x2db'],
    ['[a\\-z]', '[a\\x2dz]'],
    ['\\#\\:\\ ', '\\u{23}\\u{3a}\\u{20}'],
    ['\\😀', '\\u{1f600}'],
    ['\\.\\d\\/\\$', '\\.\\d\\/\\$'],
    ['\\p{Lu}\\P{L}\\u{61}', '\\p{Lu}\\P{L}\\u{61}'],
    ['a]', 'a\\]'],
    ['[]]', '[]\\]'],
    ['[{}]', '[{}]'],
    ['a{', 'a\\{'],
    ['x}', 'x\\}'],
    ['a{2}b{1,}c{1,3}', 'a{2}b{1,}c{1,3}'],
    ['user\\', 'user\\'],
  ])('spells %s as %s', (source, rewritten) => {
    expect(toUnicodeSource(source)).toBe(rewritten);
  });
});

describe('Matcher.replace', () => {
  it('replaces every occurrence with the text as typed, dollar signs included', () => {
    const matcher = matcherOf('id');

    expect(matcher.replace('id, user_ID', '$1&$$').value).toBe(
      '$1&$$, user_$1&$$'
    );
  });

  it('counts only the occurrences whose replacement changes the text', () => {
    expect(matcherOf('user').replace('User user', 'user')).toEqual({
      value: 'user user',
      changed: 1,
    });
    expect(
      matcherOf('(user)', { regex: true }).replace('user users', '$1')
    ).toEqual({ value: 'user users', changed: 0 });
    expect(
      matcherOf('users?', { regex: true }).replace('user users', 'users')
    ).toEqual({ value: 'users users', changed: 1 });
    expect(matcherOf('user').replace('user user', 'member', 5)).toEqual({
      value: 'user member',
      changed: 1,
    });
  });

  it('replaces only the occurrence at the offset given', () => {
    const matcher = matcherOf('id');

    expect(matcher.replace('id, user_id', 'key', 9).value).toBe('id, user_key');
    expect(matcher.replace('id, user_id', 'key', 3).value).toBe('id, user_id');
  });

  it('leaves what whole word refuses as it was', () => {
    const matcher = matcherOf('id', { wholeWord: true });

    expect(matcher.replace('id user_id', 'key').value).toBe('key user_id');
  });

  it('replaces a whole word whose edge is a separator, and no word inside a longer one', () => {
    const whole = (query: string) => matcherOf(query, { wholeWord: true });

    expect(whole('user ').replace('user name, username', 'member ').value).toBe(
      'member name, username'
    );
    expect(whole('.id').replace('user.id user.idx', '_id').value).toBe(
      'user_id user.idx'
    );
    expect(whole('-').replace('a-b', '_').value).toBe('a_b');
    expect(whole('.id').replace('a.id b.id', '_id', 6).value).toBe('a.id b_id');
    expect(
      whole('user').replace('username superuser user', 'member').value
    ).toBe('username superuser member');
    expect(
      matcherOf('\\.(\\w+)', { regex: true, wholeWord: true }).replace(
        'user.id',
        '[$1]'
      ).value
    ).toBe('user[id]');
  });

  it('expands groups in a regular expression replacement', () => {
    const matcher = matcherOf('(\\w+)_(?<suffix>id)', { regex: true });

    expect(matcher.replace('user_id, team_id', '$<suffix>_$1').value).toBe(
      'id_user, id_team'
    );
    expect(matcher.replace('user_id', '[$&] $$ $2').value).toBe(
      '[user_id] $ id'
    );
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

  it('reads on past a $< when the pattern has no named group, as the native replace does', () => {
    expect(expand('a', /(a)/g, '$<$1>')).toBe('$<a>');
    expect(matcherOf('(a)', { regex: true }).replace('a', '$<$1>').value).toBe(
      '$<a>'
    );
  });

  it.each([
    '$<$1>',
    '$<',
    '$<>',
    '$<a>',
    '$<1>',
    '$<$2>x',
    '$$<a>',
    '$<$&>',
    "$<$'>",
    '$<$`>',
    '$<<a>>',
    '$<a$1>',
    '$1$<',
    '$<$12>',
    '$<x>$1',
    '<$1>',
    '$<$$>',
    '$<$0>',
    '$<$10>',
    '$<a>b>',
    '$<$1$2>',
    '$<\\>',
    'x$<',
    '$<$1',
    '$<$<a>>',
    '$<$1>$<$2>',
  ])(
    'agrees with String.prototype.replace on %s over every kind of group',
    template => {
      for (const pattern of [
        /(a)/g,
        /(a)(b)?/g,
        /a/g,
        /(?<a>a)/g,
        /(?<a>a)(b)/g,
      ]) {
        expect(expand('xaby', pattern, template)).toBe(
          native('xaby', pattern, template)
        );
      }
    }
  );

  it('gives an unmatched group as nothing', () => {
    expect(expand('b', /(a)?b/g, '[$1]')).toBe(native('b', /(a)?b/g, '[$1]'));
    expect(
      expandReplacement('[$<name>]', 'b', [undefined], 0, 'b', {
        name: undefined,
      })
    ).toBe('[]');
  });
});
