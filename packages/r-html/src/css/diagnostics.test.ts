import { describe, expect, it } from 'vitest';

import { compileToRules } from '@/css';
import { compile } from '@/css/compile';
import { collectDiagnostics, Diagnostic } from '@/css/diagnostics';
import { flatten } from '@/css/flatten';
import { SCOPE } from '@/css/selector';

/**
 * The diagnostics are the whole of R1 and R2 — both were withdrawn as selector rewrites and both
 * survive here as warnings — plus the reports for everything the compiler silently drops. Two
 * properties are asserted for every code: it fires exactly when it should, and its message names the
 * thing the author has to go and change.
 */

const diagnose = (source: string, scoped = true): Diagnostic[] => {
  const rules = scoped ? [SCOPE] : [''];
  const elements = compile(source, { rules });

  return collectDiagnostics(elements, flatten(elements, { rules }), {
    source,
    scoped,
  });
};

const codes = (source: string, scoped = true) =>
  diagnose(source, scoped).map(diagnostic => diagnostic.code);

const messages = (source: string, scoped = true) =>
  diagnose(source, scoped).map(diagnostic => diagnostic.message);

describe('shadow-boundary (R1)', () => {
  it.each([
    ':host{color:red}',
    ':host(.dark){color:red}',
    ':host-context(.x){color:red}',
    '::slotted(span){color:red}',
    ':host .a{color:red}',
    '.a{:host{color:red}}',
  ])('fires for %s', source => {
    expect(codes(source)).toEqual(['shadow-boundary']);
  });

  it('does not fire when the boundary is not the leftmost compound', () => {
    // `.a :host` was written by an author who already knew where the boundary was; prepending the
    // scope to it changes nothing about whether it can match.
    expect(codes('.a :host{color:red}')).toEqual([]);
    expect(codes('.a ::slotted(span){color:red}')).toEqual([]);
  });

  it('fires once per offending segment of a selector list', () => {
    expect(codes(':host,.a{color:red}')).toEqual(['shadow-boundary']);
    expect(codes(':host,::slotted(span){color:red}')).toEqual([
      'shadow-boundary',
      'shadow-boundary',
    ]);
  });

  it('is silent in global mode, where the selector is simply correct', () => {
    expect(codes(':host{color:red}', false)).toEqual([]);
    expect(codes('::slotted(span){color:red}', false)).toEqual([]);
  });

  it('names the selector and the escape hatch', () => {
    const [message] = messages(':host(.dark){color:red}');

    expect(message).toContain(':host(.dark)');
    expect(message).toContain('css.global');
  });

  it('carries the position of the rule it came from', () => {
    const [diagnostic] = diagnose('.a{color:red}\n:host{color:blue}');

    expect(diagnostic.severity).toBe('warning');
    expect(diagnostic.line).toBe(2);
    expect(typeof diagnostic.column).toBe('number');
  });
});

describe('implicit-descendant (R2)', () => {
  it.each([
    '::before{color:red}',
    ':hover{color:red}',
    '.a{::before{color:red}}',
    '@media m{::before{color:red}}',
  ])('fires for %s', source => {
    expect(codes(source)).toEqual(['implicit-descendant']);
  });

  it('does not fire when the author anchored the selector with `&`', () => {
    expect(codes('&::before{color:red}')).toEqual([]);
    expect(codes('&:hover{color:red}')).toEqual([]);
    expect(codes('.a{&:hover{color:red}}')).toEqual([]);
    expect(codes('.a:hover{color:red}')).toEqual([]);
  });

  it('fires once per leading-colon segment', () => {
    expect(codes(':hover,:focus{color:red}')).toEqual([
      'implicit-descendant',
      'implicit-descendant',
    ]);
    expect(codes(':hover,.a{color:red}')).toEqual(['implicit-descendant']);
  });

  it('yields to shadow-boundary rather than doubling up on it', () => {
    // `:host` starts with a colon too. Reporting both would give the author two contradictory
    // instructions for one selector.
    expect(codes(':host{color:red}')).toEqual(['shadow-boundary']);
  });

  it('is silent in global mode', () => {
    expect(codes('::before{color:red}', false)).toEqual([]);
    expect(codes('::-webkit-scrollbar{width:8px}', false)).toEqual([]);
  });

  it('is silent below a non-conditional at-rule, where nothing is scoped anyway', () => {
    expect(codes('@keyframes k{from{opacity:0}}')).toEqual([]);
  });

  it('quotes the selector and the exact fix', () => {
    const [message] = messages('::before{color:red}');

    expect(message).toContain('`::before`');
    expect(message).toContain('`&::before`');
  });

  it('does not split a selector list inside brackets, parens or quotes', () => {
    expect(codes(`.a{[data-x='a,b']{color:red}}`)).toEqual([]);
    expect(codes('.a{&:not(.b, .c){color:red}}')).toEqual([]);
    expect(codes('.a{[data-x="a,b"]{color:red}}')).toEqual([]);
    expect(codes(`.a{[data-x='a\\',:b']{color:red}}`)).toEqual([]);
  });
});

describe('unsupported-at-rule (R8)', () => {
  it.each([
    '@import url("a.css");',
    '@charset "utf-8";',
    '@namespace url(http://a);',
    '@layer a;',
  ])('fires for %s', source => {
    expect(codes(source)).toEqual(['unsupported-at-rule']);
    // The only `error` in the set: this one silently erases the whole sheet in happy-dom, and
    // `replaceSync` strips `@import` by spec even when it is written first.
    expect(diagnose(source)[0].severity).toBe('error');
  });

  it('does not fire for an at-rule that has a body', () => {
    expect(codes('@layer a{.b{color:red}}')).toEqual([]);
    expect(codes('@media m{.a{color:red}}')).toEqual([]);
    expect(codes('@media m{}')).toEqual([]);
    expect(codes('@font-face{src:x}')).toEqual([]);
  });

  it.each([
    '@font-face{}',
    '@page{}',
    '@keyframes k{}',
    '@counter-style x{}',
    '@font-feature-values f{}',
  ])('does not fire for the empty block %s — that is R4-B', source => {
    // An empty block parses to the same shape as a statement at-rule (`children: []`), but it is a
    // different finding: these four are supported and would have been emitted had they carried
    // anything. Telling their author to "move it to a `<link>`" would be wrong on every clause, and
    // it would report a discard that `.a{}`, `@media m{}` and `@layer a{}` all take in silence.
    expect(codes(source)).toEqual([]);
    // The rule is still gone — only the diagnostic changed.
    expect(compileToRules(source, { dev: true }).cssText).toBe('');
  });

  it('still fires for a body-less `@layer`, which shares its type with the block form', () => {
    // `@layer a{}` is conditional, so stylis gives it a wrapper child and it never reaches the R8
    // test at all. Only `@layer a;` arrives with an empty child list.
    expect(codes('@layer a;')).toEqual(['unsupported-at-rule']);
    expect(codes('@layer a{}')).toEqual([]);
  });

  it('quotes the statement that was dropped and says where it belongs', () => {
    const [message] = messages('@import url("a.css");');

    expect(message).toContain('@import url("a.css");');
    expect(message).toContain('<link>');
  });

  it('carries the position, and fires per statement', () => {
    const diagnostics = diagnose(
      '@charset "utf-8";\n@namespace url(http://a);'
    );

    expect(diagnostics.map(diagnostic => diagnostic.line)).toEqual([1, 2]);
  });

  it('fires in global mode too — this one is not about the scope', () => {
    expect(codes('@import url("a.css");', false)).toEqual([
      'unsupported-at-rule',
    ]);
  });
});

describe('import-after-rule', () => {
  it('adds a second finding when an @import follows a rule', () => {
    expect(codes('.a{color:red}@import url("a.css");')).toEqual([
      'unsupported-at-rule',
      'import-after-rule',
    ]);
  });

  it('does not fire when the @import comes first', () => {
    expect(codes('@import url("a.css");.a{color:red}')).toEqual([
      'unsupported-at-rule',
    ]);
  });

  it('counts an at-rule with a body as a rule', () => {
    expect(codes('@media m{.a{color:red}}@import url("a.css");')).toEqual([
      'unsupported-at-rule',
      'import-after-rule',
    ]);
  });

  it('is specific to @import — the other three are order-independent', () => {
    expect(codes('.a{color:red}@charset "utf-8";')).toEqual([
      'unsupported-at-rule',
    ]);
    expect(codes('.a{color:red}@layer a;')).toEqual(['unsupported-at-rule']);
  });

  it('explains why the rule could not have applied', () => {
    const [, message] = messages('.a{color:red}@import url("a.css");');

    expect(message).toContain('@import url("a.css");');
    expect(message).toContain('precede every rule');
  });
});

describe('duplicate-keyframes (R7)', () => {
  it('fires on the second and every later definition of a name', () => {
    expect(codes('@keyframes k{from{opacity:0}}')).toEqual([]);
    expect(
      codes('@keyframes k{from{opacity:0}}@keyframes k{to{opacity:1}}')
    ).toEqual(['duplicate-keyframes']);
    expect(
      codes(
        '@keyframes k{from{opacity:0}}@keyframes k{to{opacity:1}}@keyframes k{to{opacity:0.5}}'
      )
    ).toEqual(['duplicate-keyframes', 'duplicate-keyframes']);
  });

  it('does not fire for different names, or for a repeated at-rule that is not keyframes', () => {
    expect(
      codes('@keyframes a{from{opacity:0}}@keyframes b{from{opacity:0}}')
    ).toEqual([]);
    expect(codes('@font-face{src:x}@font-face{src:y}')).toEqual([]);
  });

  it('sees through a conditional at-rule, because the name is global either way', () => {
    expect(
      codes(
        '@keyframes k{from{opacity:0}}@media m{@keyframes k{to{opacity:1}}}'
      )
    ).toEqual(['duplicate-keyframes']);
  });

  it('names the animation and says which definition wins', () => {
    const [message] = messages(
      '@keyframes fade{from{opacity:0}}@keyframes fade{to{opacity:1}}'
    );

    expect(message).toContain('@keyframes fade');
    expect(message).toContain('last definition wins');
  });
});

describe('rule-without-selector (R4-A)', () => {
  it('fires for a block written without a selector', () => {
    expect(codes('{color:red}')).toEqual(['rule-without-selector']);
  });

  it('does not fire for an empty block, which loses nothing', () => {
    expect(codes('{}')).toEqual([]);
    expect(codes('.a{color:red}')).toEqual([]);
  });

  it('reports the declarations that went with it', () => {
    const [message] = messages('{color:red;font-size:1px}');

    expect(message).toContain('{color:red;font-size:1px}');
  });

  it('fires for top level declarations in global mode, which R9 cannot rescue', () => {
    expect(codes('color:red', false)).toEqual(['rule-without-selector']);
    expect(codes('color:red;.a{color:blue}', false)).toEqual([
      'rule-without-selector',
    ]);
    expect(messages('color:red', false)[0]).toContain('Wrap them in one');
  });

  it('does not fire for top level declarations in scoped mode, which R9 does rescue', () => {
    expect(codes('color:red')).toEqual([]);
  });

  it('has no position, because the finding is about the whole block', () => {
    const [diagnostic] = diagnose('color:red', false);

    expect(diagnostic.line).toBeUndefined();
    expect(diagnostic.column).toBeUndefined();
  });
});

describe('scope-in-declaration (R6)', () => {
  it('fires when the sentinel reaches a declaration value', () => {
    expect(codes(`.a{content:'${SCOPE}'}`)).toEqual(['scope-in-declaration']);
    expect(codes(`.a{background:url(${SCOPE}.png)}`)).toEqual([
      'scope-in-declaration',
    ]);
  });

  it('does not fire for the sentinel in a selector, which is where it belongs', () => {
    expect(codes('&:hover{color:red}')).toEqual([]);
  });

  it('fires once per offending declaration', () => {
    expect(codes(`.a{content:'${SCOPE}';border-image:url(${SCOPE})}`)).toEqual([
      'scope-in-declaration',
      'scope-in-declaration',
    ]);
  });

  it('quotes the declaration and explains what will ship', () => {
    const [message] = messages(`.a{content:'${SCOPE}'}`);

    expect(message).toContain(`content:'${SCOPE}'`);
    expect(message).toContain('only substituted in selectors');
  });

  it('has no position — a FlatRule no longer remembers where it came from', () => {
    const [diagnostic] = diagnose(`.a{content:'${SCOPE}'}`);

    expect(diagnostic.line).toBeUndefined();
    expect(diagnostic.column).toBeUndefined();
  });
});

describe('unterminated comment and string', () => {
  it('reports a block comment that swallowed the rest of the source', () => {
    expect(codes('.a{color:red;/* never closed')).toEqual([
      'unterminated-comment',
    ]);
  });

  it('reports an unterminated string', () => {
    expect(codes('.a{content:"never closed}')).toEqual(['unterminated-string']);
    expect(codes(".a{content:'never closed}")).toEqual(['unterminated-string']);
  });

  it('points at the character that opened it', () => {
    const [comment] = diagnose('.a{color:red}\n/* never closed');
    expect([comment.line, comment.column]).toEqual([2, 1]);

    const [string] = diagnose('.a{color:red}\n.b{content:"never closed}');
    expect([string.line, string.column]).toEqual([2, 12]);
  });

  it('stays quiet for terminated comments and strings', () => {
    expect(codes('/* fine */.a{color:red}/* also fine */')).toEqual([]);
    expect(codes('.a{content:"ok"}')).toEqual([]);
    expect(codes(`.a{content:'ok'}`)).toEqual([]);
    expect(codes('.a{content:"a\\"b"}')).toEqual([]);
  });

  it('scans line comments, so an apostrophe in prose is not a string', () => {
    expect(codes(`// don't\n.a{color:red}`)).toEqual([]);
    expect(codes(`.a{color:red}// don't`)).toEqual([]);
    expect(codes(`.a{content:"it's ok"}/* a ' b */`)).toEqual([]);
  });

  it('reports only the first finding, because it consumed everything after it', () => {
    // Whichever opened first wins: everything after it is inside it, so a second finding would be
    // a report about text the scanner never really read.
    expect(codes('/* one\n.a{content:"two')).toEqual(['unterminated-comment']);
    expect(codes('.a{content:"one /* never closed')).toEqual([
      'unterminated-string',
    ]);
    expect(codes('/* one\n/* two')).toEqual(['unterminated-comment']);
  });

  it('fires in global mode too', () => {
    expect(codes('.a{color:red;/* never closed', false)).toEqual([
      'unterminated-comment',
    ]);
  });
});

describe('a clean stylesheet produces nothing', () => {
  it.each([
    '.a{color:red}',
    '&:hover{color:red}',
    'color:red;.a{color:blue}',
    '@media m{.a{color:red}}',
    '@keyframes fade{from{opacity:0}to{opacity:1}}',
    '@font-face{src:x}',
    '/* a comment */.a{color:red}',
  ])('%s', source => {
    expect(diagnose(source)).toEqual([]);
  });

  it('reports several findings at once, in traversal order', () => {
    expect(
      codes('::before{color:red}:host{color:blue}@import url("a.css");')
    ).toEqual([
      'implicit-descendant',
      'shadow-boundary',
      'unsupported-at-rule',
      'import-after-rule',
    ]);
  });
});

describe('collection is gated on the dev flag', () => {
  it('collects nothing unless asked', () => {
    expect(compileToRules('::before{color:red}').diagnostics).toEqual([]);
    expect(
      compileToRules('::before{color:red}', { dev: false }).diagnostics
    ).toEqual([]);
  });

  it('collects when asked, against the mode the source was compiled in', () => {
    expect(
      compileToRules('::before{color:red}', { dev: true }).diagnostics.map(
        diagnostic => diagnostic.code
      )
    ).toEqual(['implicit-descendant']);
    expect(
      compileToRules('::before{color:red}', { dev: true, mode: 'global' })
        .diagnostics
    ).toEqual([]);
  });
});
