import { describe, expect, it } from 'vite-plus/test';

import {
  compileToRules,
  type DiagnosticCode,
  SCOPE,
  toIdentifier,
} from '@/css';

/**
 * The acceptance suite for the compiler: the design document's 33 row input → output table, driven
 * end to end through `compileToRules()`.
 *
 * ## How the table is transcribed
 *
 * The document writes the scope as `.S`. The real scope is a hash of the compiled output, so every
 * expectation below is written with `.S` as a placeholder and expanded against the identifier the
 * call actually produced (see {@link expand}). That is deliberate: it pins the *shape* of the output
 * while letting the identifier stay what it is — a function of the content.
 *
 * Two mechanical adjustments to the table's shorthand:
 *
 * 1. The table writes selector-only rows as `&:hover{}` and gives only the selector as the expected
 *    output. An empty block is discarded (R4-B), so each of those rows is exercised with a single
 *    declaration added and the expectation is written in `emit()`'s canonical format —
 *    `<selectors>{<declarations>;}`.
 * 2. Rows that list several inputs (13, 14, 23, 24) become one case per input: `13a`, `13b`, …
 *
 * Rows 11–14 are the withdrawn R1/R2. They are no longer selector rewrites, so the assertion is that
 * the output is **unchanged** (the scope is prepended, producing a descendant combinator or dead
 * CSS) *and* that a diagnostic is emitted saying so.
 *
 * Diagnostics are asserted exactly, by code, in emission order. Every row runs with `dev: true`.
 */

/** Stands in for `.${identifier}` in the expected output. */
const SCOPE_PLACEHOLDER = '.S';

const expand = (expected: string, identifier: string) =>
  expected.split(SCOPE_PLACEHOLDER).join(`.${identifier}`);

type Row = {
  /** The document's row number, plus a letter when one row lists several inputs. */
  id: string;
  label: string;
  source: string;
  /** Canonical CSS with `.S` for the scope. */
  expected: string;
  /** Every diagnostic code the row must produce, in order. Defaults to none. */
  diagnostics?: DiagnosticCode[];
};

const ROWS: Row[] = [
  {
    id: '1',
    label: 'a root declaration gets the scope (R9)',
    source: 'color:red',
    expected: '.S{color:red;}',
  },
  {
    id: '2',
    label: 'a top level rule is prefixed with the scope',
    source: '.a{color:red}',
    expected: '.S .a{color:red;}',
  },
  {
    id: '3',
    label: '& attaches to the scope instead of descending from it',
    source: '&:hover{color:red}',
    expected: '.S:hover{color:red;}',
  },
  {
    id: '4',
    label: 'every & in a selector is replaced, not just the first',
    source: '& + &{color:red}',
    expected: '.S+.S{color:red;}',
  },
  {
    id: '5',
    label: '& in a trailing position keeps its prefix',
    source: '.x &{color:red}',
    expected: '.x .S{color:red;}',
  },
  {
    id: '6',
    label: 'adjacent & — substitution is global and unanchored (R6)',
    source: '&&{color:red}',
    expected: '.S.S{color:red;}',
  },
  {
    id: '7',
    label: 'every segment of a & list is scoped',
    source: '&.a,&.b{color:red}',
    expected: '.S.a,.S.b{color:red;}',
  },
  {
    id: '8',
    label: 'every segment of a plain list is scoped',
    source: '.x,.y{color:red}',
    expected: '.S .x,.S .y{color:red;}',
  },
  {
    id: '9',
    label: 'nested lists multiply out segment-major, parent-minor',
    source: '.p,.q{.a,.b{color:red}}',
    expected: '.S .p .a,.S .q .a,.S .p .b,.S .q .b{color:red;}',
  },
  {
    id: '10',
    label: 'three levels of nesting join with descendant combinators',
    source: '.a{.b{.c{color:red}}}',
    expected: '.S .a .b .c{color:red;}',
  },
  {
    id: '11',
    label:
      'a leading :: becomes a descendant of the scope — output unchanged, warned (R2 withdrawn)',
    source: '::before{color:red}',
    expected: '.S ::before{color:red;}',
    diagnostics: ['implicit-descendant'],
  },
  {
    id: '12',
    label:
      'a nested leading :: is a descendant too — output unchanged, warned (R2 withdrawn)',
    source: '.a{::before{color:red}}',
    expected: '.S .a ::before{color:red;}',
    diagnostics: ['implicit-descendant'],
  },
  {
    id: '13a',
    label:
      ':host is scoped into dead CSS — output unchanged, warned (R1 withdrawn)',
    source: ':host{color:red}',
    expected: '.S :host{color:red;}',
    diagnostics: ['shadow-boundary'],
  },
  {
    id: '13b',
    label:
      ':host(.dark) is scoped into dead CSS — output unchanged, warned (R1 withdrawn)',
    source: ':host(.dark){color:red}',
    expected: '.S :host(.dark){color:red;}',
    diagnostics: ['shadow-boundary'],
  },
  {
    id: '14a',
    label:
      '::slotted() is scoped into dead CSS — output unchanged, warned (R1 withdrawn)',
    source: '::slotted(span){color:red}',
    expected: '.S ::slotted(span){color:red;}',
    diagnostics: ['shadow-boundary'],
  },
  {
    id: '14b',
    label:
      ':host-context() is scoped into dead CSS — output unchanged, warned (R1 withdrawn)',
    source: ':host-context(.x){color:red}',
    expected: '.S :host-context(.x){color:red;}',
    diagnostics: ['shadow-boundary'],
  },
  {
    id: '15',
    label:
      'a selector slot in a descendant position (already substituted before the compile)',
    source: '.wrap ._child{color:red}',
    expected: '.S .wrap ._child{color:red;}',
  },
  {
    id: '16',
    label: 'a selector slot in front of &',
    source: '._child &{color:red}',
    expected: '._child .S{color:red;}',
  },
  {
    id: '17',
    label: 'quotes inside an attribute selector are preserved',
    source: "&[data-x='a b']::before{color:red}",
    expected: ".S[data-x='a b']::before{color:red;}",
  },
  {
    id: '18',
    label: 'a comma inside () does not split the selector list',
    source: '&:not(.a, .b){color:red}',
    expected: '.S:not(.a, .b){color:red;}',
  },
  {
    id: '19',
    label:
      'a bare declaration inside a conditional at-rule gets the scope (R0(a) + R9)',
    source: '@media m{color:red;.c{color:blue}}',
    expected: '@media m{.S{color:red;}.S .c{color:blue;}}',
  },
  {
    id: '20',
    label: 'a nested at-rule is hoisted and its selector context kept',
    source: '.c{@media m{&:hover{color:red}}}',
    expected: '@media m{.S .c:hover{color:red;}}',
  },
  {
    id: '21',
    label:
      'nested conditionals recurse, and the ghost wrapper is discarded (R0(e))',
    source: '@media a{@media b{color:red}}',
    expected: '@media a{@media b{.S{color:red;}}}',
  },
  {
    id: '22',
    label: '@keyframes — neither the name nor the steps are scoped (R7)',
    source: '@keyframes fade{from{opacity:0}to{opacity:1}}',
    expected: '@keyframes fade{from{opacity:0;}to{opacity:1;}}',
  },
  {
    id: '23a',
    label: '@font-face survives despite props: [] (R4-A is RULESET only)',
    source: '@font-face{src:url(a.woff)}',
    expected: '@font-face{src:url(a.woff);}',
  },
  {
    id: '23b',
    label: '@page survives despite props: []',
    source: '@page{margin:1cm}',
    expected: '@page{margin:1cm;}',
  },
  {
    id: '23c',
    label: '@counter-style survives and is not scoped',
    source: '@counter-style x{system:cyclic}',
    expected: '@counter-style x{system:cyclic;}',
  },
  {
    id: '24a',
    label: '@import is discarded with a dev error (R8)',
    source: '@import url("a.css");',
    expected: '',
    diagnostics: ['unsupported-at-rule'],
  },
  {
    id: '24b',
    label: '@charset is discarded with a dev error (R8)',
    source: '@charset "utf-8";',
    expected: '',
    diagnostics: ['unsupported-at-rule'],
  },
  {
    id: '24c',
    label: '@namespace is discarded with a dev error (R8)',
    source: '@namespace svg url(http://x);',
    expected: '',
    diagnostics: ['unsupported-at-rule'],
  },
  {
    id: '24d',
    label: 'a body-less @layer is discarded with a dev error (R8)',
    source: '@layer a;',
    expected: '',
    diagnostics: ['unsupported-at-rule'],
  },
  {
    id: '25',
    label: 'a rule whose selector interpolated to nothing is discarded (R4-A)',
    // `${null}{color:red}` after pre-substitution. The warning is beyond the document's list: it is
    // the only report of R4-A's otherwise silent data loss.
    source: '{color:red}',
    expected: '',
    diagnostics: ['rule-without-selector'],
  },
  {
    id: '26',
    label:
      'a declaration whose value interpolated to nothing is dropped by the parser',
    source: 'color:;height:1px',
    expected: '.S{height:1px;}',
  },
  {
    id: '27',
    label: 'a semicolon inside url() does not terminate the declaration',
    source: 'background:url(a;b)',
    expected: '.S{background:url(a;b);}',
  },
  {
    id: '28',
    label: 'a semicolon inside a string does not terminate the declaration',
    source: "content:'a;b'",
    expected: ".S{content:'a;b';}",
  },
  {
    id: '29',
    label: 'a line comment is stripped',
    source: '//line\ncolor:red',
    expected: '.S{color:red;}',
  },
  {
    id: '30',
    label:
      "the %/ quirk inside a line comment — stylis' bug is inherited verbatim",
    source: '// a%/b\ncolor:red',
    expected: '.S{/b color:red;}',
  },
  {
    id: '31',
    label:
      'an unterminated block comment swallows the rest; earlier rules survive, and it is warned',
    source: '.a{color:red;/* never closed',
    expected: '.S .a{color:red;}',
    diagnostics: ['unterminated-comment'],
  },
  {
    id: '32',
    label: 'a final declaration without a semicolon is still a declaration',
    source: 'padding: 4px',
    expected: '.S{padding:4px;}',
  },
  {
    id: '33',
    label: 'whitespace inside an at-rule prelude is preserved',
    source: '@media (min-width: 100px){color:red}',
    expected: '@media (min-width: 100px){.S{color:red;}}',
  },
];

const codesOf = (row: Row) => row.diagnostics ?? [];

describe('the 33 row input to output table', () => {
  it.each(ROWS)('row $id · $label', row => {
    const { cssText, identifier, diagnostics } = compileToRules(row.source, {
      dev: true,
    });

    expect(cssText).toBe(expand(row.expected, identifier));
    expect(diagnostics.map(diagnostic => diagnostic.code)).toEqual(
      codesOf(row)
    );
  });

  it('produces the same CSS with diagnostics off', () => {
    for (const row of ROWS) {
      const dev = compileToRules(row.source, { dev: true });
      const production = compileToRules(row.source);

      expect(production.cssText).toBe(dev.cssText);
      expect(production.identifier).toBe(dev.identifier);
      expect(production.diagnostics).toEqual([]);
    }
  });
});

describe('the sentinel never reaches the output', () => {
  it.each(ROWS)('row $id leaks no SCOPE', row => {
    const { cssText } = compileToRules(row.source, { dev: true });

    expect(cssText).not.toContain(SCOPE);
  });

  it('keeps the sentinel in the canonical text, which is what gets hashed', () => {
    const { canonicalText, cssText, identifier } =
      compileToRules('.a{color:red}');

    expect(canonicalText).toBe(`${SCOPE} .a{color:red;}`);
    expect(cssText).toBe(`.${identifier} .a{color:red;}`);
    expect(toIdentifier(canonicalText)).toBe(identifier);
  });
});

describe('R6 — substitution is confined to selectors', () => {
  it('leaves the sentinel inside a content value untouched', () => {
    const { cssText, identifier, diagnostics } = compileToRules(
      `.a{content:'${SCOPE}'}`,
      { dev: true }
    );

    expect(cssText).toBe(`.${identifier} .a{content:'${SCOPE}';}`);
    expect(diagnostics.map(diagnostic => diagnostic.code)).toContain(
      'scope-in-declaration'
    );
  });

  it('leaves the sentinel inside a url() untouched', () => {
    const { cssText, identifier, diagnostics } = compileToRules(
      `.a{background:url(${SCOPE}.png)}`,
      { dev: true }
    );

    expect(cssText).toBe(`.${identifier} .a{background:url(${SCOPE}.png);}`);
    expect(diagnostics.map(diagnostic => diagnostic.code)).toContain(
      'scope-in-declaration'
    );
  });

  it('replaces every occurrence in a selector', () => {
    // `&&` compiles to `rhtml-scoperhtml-scope`, which is why the substitution has to be global and
    // unanchored — and therefore why it cannot be run over the whole serialized text.
    const { cssText, identifier } = compileToRules('&&{color:red}');

    expect(cssText).toBe(`.${identifier}.${identifier}{color:red;}`);
  });
});

describe('the identifier is a stable function of content', () => {
  const identifierOf = (source: string) => compileToRules(source).identifier;

  it('gives the same identifier to the same declarations', () => {
    expect(identifierOf('.a{color:red}')).toBe(identifierOf('.a{color:red}'));
  });

  it('gives the same identifier across formatting differences', () => {
    expect(identifierOf('.a{color:red}')).toBe(
      identifierOf('.a {\n  color: red;\n}')
    );
  });

  it('gives different identifiers to different values', () => {
    expect(identifierOf('.a{color:red}')).not.toBe(
      identifierOf('.a{color:blue}')
    );
  });

  it('gives different identifiers to different declaration order', () => {
    expect(identifierOf('.a{color:red;width:1px}')).not.toBe(
      identifierOf('.a{width:1px;color:red}')
    );
  });

  it('gives different identifiers to different rule order', () => {
    expect(identifierOf('.a{color:red}.b{color:blue}')).not.toBe(
      identifierOf('.b{color:blue}.a{color:red}')
    );
  });

  it('is _ plus exactly 7 base36 digits for every row', () => {
    for (const row of ROWS) {
      expect(compileToRules(row.source).identifier).toMatch(/^_[0-9a-z]{7}$/);
    }
  });

  it('is _ plus exactly 7 base36 digits for 10,000 inputs', () => {
    // base36 of a uint32 is 6 digits about half the time and 7 the other half; the padding is what
    // makes separator-free prefix matching in the consumers safe.
    let seed = 1;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);

    for (let i = 0; i < 10000; i++) {
      const identifier = toIdentifier(`.a{color:rgb(${next()})}`);

      expect(identifier).toHaveLength(8);
      expect(identifier).toMatch(/^_[0-9a-z]{7}$/);
    }
  });
});

describe('global mode leaves shadow and universal selectors alone', () => {
  const global = (source: string) =>
    compileToRules(source, { mode: 'global', dev: true });

  it.each([
    [':host', ':host{color:red}', ':host{color:red;}'],
    [
      '::-webkit-scrollbar',
      '::-webkit-scrollbar{width:8px}',
      '::-webkit-scrollbar{width:8px;}',
    ],
    [
      'the universal reset',
      '*,*::before,*::after{margin:0}',
      '*,*::before,*::after{margin:0;}',
    ],
    [
      ':host with a nested rule',
      ':host{color:red;.a{color:blue}}',
      ':host{color:red;}:host .a{color:blue;}',
    ],
  ])('%s passes through untouched and silently', (_label, source, expected) => {
    const { cssText, canonicalText, diagnostics } = global(source);

    expect(cssText).toBe(expected);
    expect(canonicalText).toBe(expected);
    expect(diagnostics).toEqual([]);
  });

  it('does not prefix anything, so the identifier is not in the CSS', () => {
    const { cssText, identifier } = global(':host{color:red}');

    expect(cssText).not.toContain(identifier);
    expect(identifier).toMatch(/^_[0-9a-z]{7}$/);
  });
});

describe('at-rules', () => {
  it.each([
    [
      '@font-face',
      '@font-face{src:url(a.woff)}',
      '@font-face{src:url(a.woff);}',
    ],
    ['@page', '@page{margin:1cm}', '@page{margin:1cm;}'],
  ])('%s survives with no diagnostic', (_label, source, expected) => {
    const { cssText, diagnostics } = compileToRules(source, { dev: true });

    expect(cssText).toBe(expected);
    expect(diagnostics).toEqual([]);
  });

  it.each([
    ['@import', '@import url("a.css");'],
    ['@charset', '@charset "utf-8";'],
    ['@namespace', '@namespace svg url(http://x);'],
    ['a body-less @layer', '@layer a;'],
  ])('%s is discarded and reported as an error', (_label, source) => {
    const { rules, cssText, diagnostics } = compileToRules(source, {
      dev: true,
    });

    expect(rules).toEqual([]);
    expect(cssText).toBe('');
    expect(diagnostics[0]).toMatchObject({
      code: 'unsupported-at-rule',
      severity: 'error',
    });
  });

  it('drops the unsupported at-rule without taking the rest of the sheet with it', () => {
    const { cssText, identifier, diagnostics } = compileToRules(
      '@import url("a.css");.a{color:red}',
      { dev: true }
    );

    expect(cssText).toBe(`.${identifier} .a{color:red;}`);
    expect(diagnostics.map(diagnostic => diagnostic.code)).toContain(
      'unsupported-at-rule'
    );
  });
});
