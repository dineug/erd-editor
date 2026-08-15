import { describe, expect, it } from 'vitest';

import { compile } from '@/css/compile';
import { emit } from '@/css/emit';
import { FlatRule, flatten, Middleware } from '@/css/flatten';
import { SCOPE } from '@/css/selector';

/**
 * `flatten()` is the layer that owns everything stylis does not do for us: the condition stack, the
 * two discard conditions, the statement at-rule drop, the root declaration merge, and the plugin
 * seam. Selector algebra is deliberately not tested here — it belongs to stylis and is pinned by
 * `compile.test.ts`.
 */

const flat = (
  source: string,
  options: { rules?: string[]; plugins?: Middleware[] } = {}
): FlatRule[] => {
  const rules = options.rules ?? [SCOPE];
  return flatten(compile(source, { rules }), {
    rules,
    plugins: options.plugins,
  });
};

const global = (source: string) => flat(source, { rules: [''] });

describe('condition stack', () => {
  it('carries one enclosing conditional at-rule', () => {
    expect(flat('@media m{.a{color:red}}')).toEqual([
      {
        conditions: ['@media m'],
        selectors: [`${SCOPE} .a`],
        declarations: ['color:red'],
      },
    ]);
  });

  it('nests outermost first', () => {
    expect(flat('@media a{@supports (b:c){.d{color:red}}}')).toEqual([
      {
        conditions: ['@media a', '@supports (b:c)'],
        selectors: [`${SCOPE} .d`],
        declarations: ['color:red'],
      },
    ]);
  });

  it('nests three deep and mixes at-rule kinds', () => {
    expect(
      flat(
        '@layer base{@media m{@supports (display:grid){.a{color:red}}}}'
      ).map(rule => rule.conditions)
    ).toEqual([['@layer base', '@media m', '@supports (display:grid)']]);
  });

  it('keeps the prelude verbatim, whitespace included', () => {
    expect(
      flat('@media (min-width: 100px){.a{color:red}}')[0].conditions
    ).toEqual(['@media (min-width: 100px)']);
  });

  it('lifts a nested at-rule out of the rule it was written in', () => {
    // stylis hoists: the `@media` is a sibling of `.c`, and the selector context survives it.
    expect(flat('.c{color:red;@media m{&:hover{color:blue}}}')).toEqual([
      {
        conditions: [],
        selectors: [`${SCOPE} .c`],
        declarations: ['color:red'],
      },
      {
        conditions: ['@media m'],
        selectors: [`${SCOPE} .c:hover`],
        declarations: ['color:blue'],
      },
    ]);
  });

  it('keeps sibling conditions separate and in source order', () => {
    expect(
      flat(
        '@media a{.x{color:red}}@media b{.y{color:blue}}@media a{.z{color:green}}'
      ).map(rule => [rule.conditions, rule.selectors])
    ).toEqual([
      [['@media a'], [`${SCOPE} .x`]],
      [['@media b'], [`${SCOPE} .y`]],
      [['@media a'], [`${SCOPE} .z`]],
    ]);
  });
});

describe('R4-A — a RULESET with no selector is discarded', () => {
  it('drops a block written without a selector', () => {
    expect(flat('{color:red}')).toEqual([]);
  });

  it('drops the empty-string wrapper the global seed produces inside a conditional at-rule', () => {
    // In global mode `rules` is `['']`, so the wrapper stylis synthesizes for bare declarations
    // carries `props: ['']` — not `props: []`. Testing `props.length === 0` alone would emit
    // `@media m{{color:red;}}`.
    expect(global('@media m{color:red}')).toEqual([]);
    expect(global('.a{color:red}')).toEqual([
      { conditions: [], selectors: ['.a'], declarations: ['color:red'] },
    ]);
  });

  it('drops the empty members of a mixed seed rather than the whole rule', () => {
    // A seed of `['', SCOPE]` is not something the product builds, but it is what separates
    // "filter the empty selectors" from "drop the rule if any selector is empty".
    expect(flat('color:red', { rules: ['', SCOPE] })).toEqual([
      { conditions: [], selectors: [SCOPE], declarations: ['color:red'] },
    ]);
  });

  it.each([
    ['@font-face{src:x}', '@font-face', ['src:x']],
    ['@page{margin:1cm}', '@page', ['margin:1cm']],
    ['@counter-style x{system:cyclic}', '@counter-style x', ['system:cyclic']],
  ])(
    'keeps %s — an empty props list is not a RULESET-only signal',
    (source, prelude, declarations) => {
      expect(flat(source)).toEqual([
        { conditions: [], selectors: [], prelude, declarations },
      ]);
    }
  );
});

describe('R4-B — a rule with no declarations and no body is discarded, bottom-up', () => {
  it('drops an empty rule', () => {
    expect(flat('.a{}')).toEqual([]);
    expect(flat('.a{color:red}.b{}').map(rule => rule.selectors)).toEqual([
      [`${SCOPE} .a`],
    ]);
  });

  it('drops the at-rule whose only child was empty', () => {
    expect(flat('@media m{.a{}}')).toEqual([]);
  });

  it('propagates the discard upwards through two levels of at-rule', () => {
    // Emptiness has to be evaluated after the children, not before: `@media a` looks non-empty until
    // `@media b` has been flattened and thrown away.
    expect(flat('@media a{@media b{.c{}}}')).toEqual([]);
  });

  it('removes the childless ghost wrapper a nested conditional at-rule leaves behind', () => {
    // `@media a{@media b{…}}` parses to `[@media a [rule props=[SCOPE] children=[]] [@media b …]]`.
    // The ghost carries a selector but no declarations, so condition B is what removes it.
    expect(flat('@media a{@media b{color:red}}')).toEqual([
      {
        conditions: ['@media a', '@media b'],
        selectors: [SCOPE],
        declarations: ['color:red'],
      },
    ]);
  });

  it('keeps the surviving sibling when only part of the body is empty', () => {
    expect(
      flat('@media a{@media b{.c{}}.d{color:red}}').map(rule => [
        rule.conditions,
        rule.selectors,
      ])
    ).toEqual([[['@media a'], [`${SCOPE} .d`]]]);
  });

  it('drops an at-rule leaf and a keyframes block with nothing in them', () => {
    expect(flat('@font-face{}')).toEqual([]);
    expect(flat('@keyframes k{from{}}')).toEqual([]);
    expect(flat('@keyframes k{}')).toEqual([]);
  });

  it('drops an at-rule leaf whose body is only a comment', () => {
    // Not the same test as the one above: this at-rule does have children, so R8's "no body" check
    // passes it through, and it is the declaration count that has to stop it.
    expect(flat('@font-face{/* nothing here */}')).toEqual([]);
    expect(flat('@font-face{/* a */src:x}')[0].declarations).toEqual(['src:x']);
  });

  it('drops a declaration stylis itself threw away for having an empty value', () => {
    expect(flat('.a{color:}')).toEqual([]);
    expect(flat('.a{color:;height:1px}')[0].declarations).toEqual([
      'height:1px',
    ]);
  });
});

describe('R7 — the two classes of at-rule', () => {
  it.each([
    ['@media m{.a{color:red}}', '@media m'],
    ['@supports (a:b){.a{color:red}}', '@supports (a:b)'],
    ['@layer base{.a{color:red}}', '@layer base'],
    ['@container (min-width:1px){.a{color:red}}', '@container (min-width:1px)'],
    ['@document url(x){.a{color:red}}', '@document url(x)'],
  ])(
    '%s keeps the selector context and becomes a condition',
    (source, condition) => {
      expect(flat(source)).toEqual([
        {
          conditions: [condition],
          selectors: [`${SCOPE} .a`],
          declarations: ['color:red'],
        },
      ]);
    }
  );

  it('a `@c…` that is not `@container` is not conditional', () => {
    // stylis lets `case 99` fall through into the `@layer` test, so `@counter-style` is measured
    // against `charat(2) === 'a'` and comes out non-conditional. We reproduce that, not tidy it.
    expect(flat('@counter-style x{system:cyclic}')[0].prelude).toBe(
      '@counter-style x'
    );
  });

  it('serializes @keyframes steps into `body`, unscoped', () => {
    expect(flat('@keyframes fade{from{opacity:0}to{opacity:1}}')).toEqual([
      {
        conditions: [],
        selectors: [],
        prelude: '@keyframes fade',
        declarations: [],
        body: 'from{opacity:0;}to{opacity:1;}',
      },
    ]);
  });

  it('never scopes a @keyframes name or step, even when it was written inside a rule', () => {
    const rules = flat('.a{@keyframes fade{from{opacity:0}}}');

    expect(rules).toHaveLength(1);
    expect(rules[0].prelude).toBe('@keyframes fade');
    expect(rules[0].body).toBe('from{opacity:0;}');
    expect(emit(rules)).not.toContain(SCOPE);
  });

  it('runs the steps through the same discards as any other rule', () => {
    expect(flat('@keyframes k{from{}to{opacity:1}}')[0].body).toBe(
      'to{opacity:1;}'
    );
  });

  it('emits a prefixed keyframes block, which is detected structurally rather than by name', () => {
    expect(flat('@-webkit-keyframes k{from{opacity:0}}')).toEqual([
      {
        conditions: [],
        selectors: [],
        prelude: '@-webkit-keyframes k',
        declarations: [],
        body: 'from{opacity:0;}',
      },
    ]);
  });

  it('carries the condition stack on an at-rule leaf too', () => {
    expect(flat('@media m{@font-face{src:x}}')).toEqual([
      {
        conditions: ['@media m'],
        selectors: [],
        prelude: '@font-face',
        declarations: ['src:x'],
      },
    ]);
    expect(
      flat('@media m{@keyframes k{from{opacity:0}}}')[0].conditions
    ).toEqual(['@media m']);
  });
});

describe('R8 — statement at-rules are dropped', () => {
  it.each([
    '@import url("a.css");',
    '@charset "utf-8";',
    '@namespace url(http://a);',
    '@layer a;',
  ])('drops %s', source => {
    expect(flat(source)).toEqual([]);
  });

  it('drops only the statement, not the rules around it', () => {
    expect(
      flat('@import url("a.css");.a{color:red}').map(rule => rule.selectors)
    ).toEqual([[`${SCOPE} .a`]]);
  });

  it('keeps a `@layer` that does have a body', () => {
    // The test is "no children", not the at-rule name: `@layer a;` and `@layer a{…}` are the same
    // `type` and only differ in whether a body was parsed.
    expect(flat('@layer a{.b{color:red}}')).toEqual([
      {
        conditions: ['@layer a'],
        selectors: [`${SCOPE} .b`],
        declarations: ['color:red'],
      },
    ]);
  });
});

describe('R9 — root declarations merge to the front of their condition context', () => {
  it('gives bare declarations the seed as their selector', () => {
    expect(flat('color:red')).toEqual([
      { conditions: [], selectors: [SCOPE], declarations: ['color:red'] },
    ]);
  });

  it('merges every root declaration of one context into a single rule', () => {
    expect(flat('color:red;font-size:1px')).toEqual([
      {
        conditions: [],
        selectors: [SCOPE],
        declarations: ['color:red', 'font-size:1px'],
      },
    ]);
  });

  it('places the merged rule first even when a rule was written before it', () => {
    // Not "where the first declaration appeared": inside a conditional at-rule stylis appends its
    // wrapper before recursing, so declarations are already at the front there. The top level is
    // matched to it so the canonical text — and the identifier — is a function of content alone.
    expect(
      flat('color:red;.a{color:blue}font-size:1px').map(rule => [
        rule.selectors,
        rule.declarations,
      ])
    ).toEqual([
      [[SCOPE], ['color:red', 'font-size:1px']],
      [[`${SCOPE} .a`], ['color:blue']],
    ]);

    expect(
      flat('.a{color:blue};color:red').map(rule => rule.selectors)
    ).toEqual([[SCOPE], [`${SCOPE} .a`]]);
  });

  it('merges per condition context, not globally', () => {
    expect(
      flat('color:red;@media m{.a{color:blue};font-size:1px}').map(rule => [
        rule.conditions,
        rule.selectors,
        rule.declarations,
      ])
    ).toEqual([
      [[], [SCOPE], ['color:red']],
      [['@media m'], [SCOPE], ['font-size:1px']],
      [['@media m'], [`${SCOPE} .a`], ['color:blue']],
    ]);
  });

  it('preserves last-wins order inside the merge', () => {
    expect(flat('color:red;color:blue')[0].declarations).toEqual([
      'color:red',
      'color:blue',
    ]);
  });

  it('drops them in global mode, where there is no selector to give them', () => {
    expect(global('color:red')).toEqual([]);
    expect(
      global('color:red;.a{color:blue}').map(rule => rule.selectors)
    ).toEqual([['.a']]);
  });

  it('keeps a custom property whose value contains braces intact', () => {
    // `--x:{a:b}` splits into `props: '--x:{a'` / `children: 'b}'`, so the text has to come from
    // `Element.value`, not from `props + ':' + children`.
    expect(flat('.a{--x:{a:b};color:red}')[0].declarations).toEqual([
      '--x:{a:b}',
      'color:red',
    ]);
  });

  it('ignores comments', () => {
    expect(flat('/* x */.a{/* y */color:red}/* z */')).toEqual([
      {
        conditions: [],
        selectors: [`${SCOPE} .a`],
        declarations: ['color:red'],
      },
    ]);
  });
});

describe('the middleware seam', () => {
  const source = '.a{color:red}.b{color:blue}';

  it('identity — a plugin that returns its argument changes nothing', () => {
    expect(flat(source, { plugins: [rule => rule] })).toEqual(flat(source));
  });

  it('rewrite — a plugin may replace a rule', () => {
    expect(
      emit(
        flat(source, {
          plugins: [rule => ({ ...rule, declarations: ['color:green'] })],
        })
      )
    ).toBe(`${SCOPE} .a{color:green;}${SCOPE} .b{color:green;}`);
  });

  it('fan-out — a plugin may return several rules for one', () => {
    const prefixed = flat(source, {
      plugins: [rule => [{ ...rule, selectors: ['.legacy'] }, rule]],
    });

    expect(prefixed.map(rule => rule.selectors)).toEqual([
      ['.legacy'],
      [`${SCOPE} .a`],
      ['.legacy'],
      [`${SCOPE} .b`],
    ]);
  });

  it('discard — `[]` removes the rule, and there is no `void` third form', () => {
    expect(flat(source, { plugins: [() => []] })).toEqual([]);
    expect(
      flat(source, {
        plugins: [rule => (rule.selectors[0].endsWith('.a') ? [] : rule)],
      }).map(rule => rule.selectors)
    ).toEqual([[`${SCOPE} .b`]]);
  });

  it('applies plugins in order, each over the whole list', () => {
    const seen: string[][] = [];
    const first: Middleware = rule => {
      seen.push(['first', ...rule.selectors]);
      return { ...rule, declarations: [...rule.declarations, 'order:1'] };
    };
    const second: Middleware = rule => {
      seen.push(['second', ...rule.selectors]);
      return { ...rule, declarations: [...rule.declarations, 'order:2'] };
    };

    expect(
      flat(source, { plugins: [first, second] }).map(rule => rule.declarations)
    ).toEqual([
      ['color:red', 'order:1', 'order:2'],
      ['color:blue', 'order:1', 'order:2'],
    ]);
    expect(seen).toEqual([
      ['first', `${SCOPE} .a`],
      ['first', `${SCOPE} .b`],
      ['second', `${SCOPE} .a`],
      ['second', `${SCOPE} .b`],
    ]);
  });

  it('re-establishes the emittable invariant after the plugins have run', () => {
    // The discards run before the seam, so a plugin can hand back a rule with nothing between the
    // braces. Left alone that serializes to `.S .a{;}`.
    const emptied = flat(source, {
      plugins: [rule => ({ ...rule, declarations: [] })],
    });

    expect(emptied).toEqual([]);
    expect(emit(emptied)).toBe('');
  });

  it('re-establishes it for the head as well, not just the body', () => {
    // The other half of the same hole, and the worse one: a rule with no selectors and no prelude
    // serializes to `{color:red;}` — the selectorless output R4-A exists to keep out, and the only
    // discard whose escape makes the whole sheet ill-formed rather than merely useless.
    const headless = flat(source, {
      plugins: [rule => ({ ...rule, selectors: [] })],
    });

    expect(headless).toEqual([]);
    expect(emit(headless)).toBe('');

    // An at-rule leaf has no selectors to begin with; its head is the prelude, so dropping that is
    // the same failure by a different field.
    const unprefixed = flat('@font-face{src:x}', {
      plugins: [rule => ({ ...rule, prelude: undefined })],
    });

    expect(unprefixed).toEqual([]);
    expect(emit(unprefixed)).toBe('');
  });

  it('keeps a rule whose head is a prelude rather than selectors', () => {
    // The guard above must not swallow at-rule leaves, which legitimately carry `selectors: []`.
    expect(emit(flat('@font-face{src:x}', { plugins: [rule => rule] }))).toBe(
      '@font-face{src:x;}'
    );
  });

  it('keeps a plugin-produced rule that has a body but no declarations', () => {
    const injected = flat(source, {
      plugins: [
        rule => [
          rule,
          {
            conditions: rule.conditions,
            selectors: [],
            prelude: '@keyframes injected',
            declarations: [],
            body: 'from{opacity:0;}',
          },
        ],
      ],
    });

    expect(injected).toHaveLength(4);
    expect(emit(injected)).toContain('@keyframes injected{from{opacity:0;}}');
  });
});

describe('aliasing', () => {
  it('never hands back the caller`s seed array, and never mutates it', () => {
    const seed = [SCOPE];
    // The wrapper stylis synthesizes for a conditional at-rule is handed `rules` itself as its
    // `props`, so an in-place substitution here would poison the parent frame.
    const rules = flatten(compile('@media m{color:red}', { rules: seed }), {
      rules: seed,
    });

    expect(rules[0].selectors).toEqual([SCOPE]);
    expect(rules[0].selectors).not.toBe(seed);

    rules[0].selectors[0] = '.mutated';
    expect(seed).toEqual([SCOPE]);
  });

  it('gives each rule its own selector array', () => {
    const rules = flat('color:red;@media m{font-size:1px}');

    expect(rules).toHaveLength(2);
    expect(rules[0].selectors).not.toBe(rules[1].selectors);
  });
});
