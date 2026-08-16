import { DECLARATION, Element, RULESET, serialize, stringify } from 'stylis';
import { describe, expect, it } from 'vite-plus/test';

import { compile } from '@/css/compile';

const SCOPE = '._scope';

const css = (source: string, rules?: string[]) =>
  serialize(compile(source, rules ? { rules } : {}) as never, stringify);

const scoped = (source: string) => css(source, [SCOPE]);

/**
 * `@types/stylis` types every node with `props: string[] | string` and
 * `children: Element[] | string`, so narrowing lives here rather than in the source. Precise
 * element types arrive with the flattening layer, which is the first code that needs them.
 */
const rulesetAt = (elements: Element[], index: number) => {
  const element = elements[index];
  const isRuleset =
    element.type === RULESET || element.type.charCodeAt(0) === 64;
  if (!isRuleset) {
    throw new Error(`elements[${index}] is a ${element.type}, not a ruleset`);
  }
  return element as Element & { props: string[]; children: Element[] };
};

describe('scope seeding', () => {
  it('prefixes a top level rule with the scope', () => {
    expect(scoped('.a{color:red}')).toBe(`${SCOPE} .a{color:red;}`);
  });

  it('leaves ROOT level bare declarations unwrapped', () => {
    // The synthetic scope rule only makes stylis wrap bare declarations that sit inside a
    // conditional at-rule (`Parser.js`: `rule && append(ruleset(...), children)`). At the root,
    // declarations are appended straight to the element list instead.
    //
    // This is deliberate. The alternative — handing stylis `declarations = synthetic.children` —
    // does collect them, but it also splits declarations away from the rules they were interleaved
    // with and destroys source order. Attaching root declarations to the scope is therefore the
    // flattening layer's job, not the parser's. This assertion pins the contract that layer builds
    // on.
    expect(scoped('color:red;')).toBe('color:red;');

    const elements = compile('color:red;', { rules: [SCOPE] });
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe(DECLARATION);
  });

  it('leaves the scope out when no rules are supplied', () => {
    expect(css('.a{color:red}')).toBe('.a{color:red;}');
  });

  it('resolves & against the scope', () => {
    expect(scoped('&:hover{color:red}')).toBe(`${SCOPE}:hover{color:red;}`);
  });

  it('resolves every & in a selector, not just the first', () => {
    // stylis classes `+` as an isolate token, so it collapses the whitespace around it.
    expect(scoped('& + &{color:red}')).toBe(`${SCOPE}+${SCOPE}{color:red;}`);
  });

  it('resolves & in a trailing position', () => {
    expect(scoped('.x &{color:red}')).toBe(`.x ${SCOPE}{color:red;}`);
  });

  it('resolves & inside a functional pseudo class', () => {
    expect(scoped(':is(&, .b){color:red}')).toBe(
      `:is(${SCOPE}, .b){color:red;}`
    );
  });

  it('supports more than one parent selector', () => {
    expect(css('.b{color:red}', ['.p', '.q'])).toBe('.p .b,.q .b{color:red;}');
  });
});

describe('selector lists', () => {
  it('scopes every segment of a comma list, not just the first', () => {
    // This is the defect the old hand written pipeline had: it prefixed the list once, leaving
    // the 2nd and 3rd segments unscoped and matching globally.
    expect(scoped('.a:hover, .a[data-x], .a.b[data-x]{color:red}')).toBe(
      `${SCOPE} .a:hover,${SCOPE} .a[data-x],${SCOPE} .a.b[data-x]{color:red;}`
    );
  });

  it('expands a nested list against every parent as a cartesian product', () => {
    // Segment-major, parent-minor: `ruleset()` loops the comma segments outside and the parent
    // selectors inside, so the child segment varies slowest.
    const out = css('.p, .q{ a, b{color:red} }', ['']);
    expect(out).toBe('.p a,.q a,.p b,.q b{color:red;}');
  });

  it('preserves quoted attribute selectors verbatim', () => {
    expect(scoped(`.a[data-checked='true']{color:red}`)).toBe(
      `${SCOPE} .a[data-checked='true']{color:red;}`
    );
  });
});

describe('root level conditional at-rules', () => {
  // Without the synthetic scope rule, stylis emits `@supports (a:b){color:red;}` — a declaration
  // with no selector, which browsers drop silently.
  it('wraps bare declarations inside @supports', () => {
    expect(scoped('@supports (display:grid){color:red}')).toBe(
      `@supports (display:grid){${SCOPE}{color:red;}}`
    );
  });

  it('wraps bare declarations inside @media', () => {
    expect(scoped('@media (min-width:100px){color:red}')).toBe(
      `@media (min-width:100px){${SCOPE}{color:red;}}`
    );
  });

  it('still scopes sibling rules inside the same at-rule', () => {
    expect(scoped('@media m{color:red;.c{color:blue}}')).toBe(
      `@media m{${SCOPE}{color:red;}${SCOPE} .c{color:blue;}}`
    );
  });

  it('scopes a nested at-rule the same way', () => {
    expect(scoped('.c{@media m{color:red}}')).toBe(
      `@media m{${SCOPE} .c{color:red;}}`
    );
  });

  it('does not wrap when no scope is seeded', () => {
    expect(css('@supports (a:b){color:red}')).toBe(
      '@supports (a:b){color:red;}'
    );
  });
});

describe('at-rules that must not be scoped', () => {
  it('leaves @keyframes step selectors alone', () => {
    expect(scoped('@keyframes fade{from{opacity:0}to{opacity:1}}')).toBe(
      '@keyframes fade{from{opacity:0;}to{opacity:1;}}'
    );
  });

  it('leaves @font-face alone', () => {
    expect(scoped('@font-face{font-family:a}')).toBe(
      '@font-face{font-family:a;}'
    );
  });
});

describe('element shapes', () => {
  it('gives a ruleset a string[] of selectors and Element children', () => {
    const ruleset = rulesetAt(compile('.a{color:red}', { rules: [SCOPE] }), 0);
    expect(ruleset.type).toBe(RULESET);
    expect(ruleset.props).toEqual([`${SCOPE} .a`]);
    expect(Array.isArray(ruleset.children)).toBe(true);
  });

  it('gives a declaration a string property and a string value', () => {
    const ruleset = rulesetAt(compile('.a{color:red}'), 0);
    const [declaration] = ruleset.children;
    expect(declaration.type).toBe(DECLARATION);
    expect(declaration.props).toBe('color');
    expect(declaration.children).toBe('red');
  });

  it('gives @font-face and @page an empty selector list', () => {
    expect(rulesetAt(compile('@font-face{font-family:a}'), 0).props).toEqual(
      []
    );
    expect(rulesetAt(compile('@page{margin:1cm}'), 0).props).toEqual([]);
  });

  it('records a comment body, with the last scanned character as its prop', () => {
    const [block] = compile('/* hi */');
    expect(block.type).toBe('comm');
    // `props` is `from(char())` — the character the scanner stopped on, not the comment kind.
    expect(block.props).toBe('/');
    expect(block.children).toBe(' hi ');
    expect(block.value).toBe('/* hi */');

    const [line] = compile('// hi\n');
    expect(line.type).toBe('comm');
    expect(line.props).toBe('\n');
    expect(line.children).toBe(' hi');
  });

  it('carries source positions', () => {
    const ruleset = rulesetAt(compile('\n\n.a{color:red}'), 0);
    expect(ruleset.line).toBe(3);
    expect(ruleset.column).toBeGreaterThan(0);
  });

  it('starts every node with an empty return slot', () => {
    const ruleset = rulesetAt(compile('.a{color:red}'), 0);
    expect(ruleset.return).toBe('');
  });

  it('preserves source order when declarations and rules interleave', () => {
    const elements = compile('color:red;.a{color:blue}font-size:1px');
    expect(elements.map(element => element.type)).toEqual([
      DECLARATION,
      RULESET,
      DECLARATION,
    ]);
  });
});

describe('scanner state is not shared between compiles', () => {
  it('produces the same tree when compiles are interleaved with other compiles', () => {
    const once = css('.a{color:red}');
    css('.b{color:blue}');
    const again = css('.a{color:red}');
    expect(again).toBe(once);
  });

  it('reports positions from the start of each source', () => {
    compile('\n\n\n\n.z{color:red}');
    const ruleset = rulesetAt(compile('.a{color:red}'), 0);
    expect(ruleset.line).toBe(1);
  });
});
