import { describe, expect, it } from 'vite-plus/test';

import { compile } from '@/css/compile';
import { emit } from '@/css/emit';
import { FlatRule, flatten } from '@/css/flatten';
import { SCOPE } from '@/css/selector';

/**
 * `emit()` defines the canonical text — the string that gets hashed — so every assertion here is a
 * literal. Anything it is allowed to vary on would become a way for two identical stylesheets to get
 * two identifiers.
 */

const style = (
  conditions: string[],
  selector: string,
  declaration = 'color:red'
): FlatRule => ({
  conditions,
  selectors: [selector],
  declarations: [declaration],
});

const flat = (source: string) =>
  flatten(compile(source, { rules: [SCOPE] }), { rules: [SCOPE] });

describe('canonical format', () => {
  it('emits nothing for an empty rule list', () => {
    expect(emit([])).toBe('');
  });

  it('style rule: selectors joined with `,`, declarations with `;`, and a trailing `;`', () => {
    expect(
      emit([
        {
          conditions: [],
          selectors: ['.a', '.b'],
          declarations: ['color:red', 'font-size:12px'],
        },
      ])
    ).toBe('.a,.b{color:red;font-size:12px;}');
  });

  it('at-rule leaf: the prelude takes the selector slot', () => {
    expect(
      emit([
        {
          conditions: [],
          selectors: [],
          prelude: '@font-face',
          declarations: ['src:x'],
        },
      ])
    ).toBe('@font-face{src:x;}');
  });

  it('@keyframes: the body goes in verbatim, with no trailing `;`', () => {
    expect(
      emit([
        {
          conditions: [],
          selectors: [],
          prelude: '@keyframes fade',
          declarations: [],
          body: 'from{opacity:0;}to{opacity:1;}',
        },
      ])
    ).toBe('@keyframes fade{from{opacity:0;}to{opacity:1;}}');
  });

  it('never emits a space and never reorders', () => {
    const rules = [style([], '.b'), style([], '.a', 'color:blue')];

    expect(emit(rules)).toBe('.b{color:red;}.a{color:blue;}');
    expect(emit(rules)).toBe(emit(rules));
  });
});

describe('condition run-length grouping', () => {
  it('opens a shared condition once for a run of adjacent rules', () => {
    expect(
      emit([style(['@media m'], '.a'), style(['@media m'], '.b', 'color:blue')])
    ).toBe('@media m{.a{color:red;}.b{color:blue;}}');
  });

  it('closes only down to the longest common prefix', () => {
    expect(
      emit([
        style(['@media m', '@supports (a:b)'], '.a'),
        style(['@media m'], '.b', 'color:blue'),
      ])
    ).toBe('@media m{@supports (a:b){.a{color:red;}}.b{color:blue;}}');
  });

  it('opens the extra levels a deeper rule needs, keeping the shared ones open', () => {
    expect(
      emit([
        style(['@media m'], '.a'),
        style(['@media m', '@supports (a:b)'], '.b', 'color:blue'),
      ])
    ).toBe('@media m{.a{color:red;}@supports (a:b){.b{color:blue;}}}');
  });

  it('closes and reopens when two adjacent stacks share no prefix', () => {
    expect(
      emit([style(['@media a'], '.a'), style(['@media b'], '.b', 'color:blue')])
    ).toBe('@media a{.a{color:red;}}@media b{.b{color:blue;}}');
  });

  it('does not merge two runs of the same condition that are not adjacent', () => {
    // Grouping compares against the previous rule only, never against everything seen so far, which
    // is exactly what keeps it from reordering the sheet.
    expect(
      emit([
        style(['@media m'], '.a'),
        style([], '.c', 'color:green'),
        style(['@media m'], '.b', 'color:blue'),
      ])
    ).toBe('@media m{.a{color:red;}}.c{color:green;}@media m{.b{color:blue;}}');
  });

  it('closes every open condition at the end of the list', () => {
    const text = emit([
      style(['@layer base', '@media m', '@supports (a:b)'], '.a'),
    ]);

    expect(text).toBe('@layer base{@media m{@supports (a:b){.a{color:red;}}}}');
    expect(text.split('{')).toHaveLength(text.split('}').length);
  });

  it('closes a trailing at-rule leaf the same way', () => {
    expect(
      emit([
        {
          conditions: ['@media m'],
          selectors: [],
          prelude: '@font-face',
          declarations: ['src:x'],
        },
      ])
    ).toBe('@media m{@font-face{src:x;}}');
  });
});

describe('scope substitution', () => {
  const rules: FlatRule[] = [
    {
      conditions: ['@media m'],
      selectors: [`${SCOPE} .a`, `${SCOPE}:hover`],
      declarations: [`content:'${SCOPE}'`],
    },
  ];

  it('leaves the sentinel in place when no scope is given — that text is the hash input', () => {
    expect(emit(rules)).toBe(
      `@media m{${SCOPE} .a,${SCOPE}:hover{content:'${SCOPE}';}}`
    );
  });

  it('substitutes selectors and nothing else', () => {
    expect(emit(rules, { scope: '._x' })).toBe(
      `@media m{._x .a,._x:hover{content:'${SCOPE}';}}`
    );
  });
});

describe('against real compiled input', () => {
  it('merges two adjacent blocks that share a condition', () => {
    expect(
      flat('@media m{.a{color:red}}@media m{.b{color:blue}}')
    ).toHaveLength(2);
    expect(emit(flat('@media m{.a{color:red}}@media m{.b{color:blue}}'))).toBe(
      `@media m{${SCOPE} .a{color:red;}${SCOPE} .b{color:blue;}}`
    );
  });

  it('keeps them apart when a top level rule separates them', () => {
    expect(
      emit(
        flat('@media m{.a{color:red}}.c{color:green}@media m{.b{color:blue}}')
      )
    ).toBe(
      `@media m{${SCOPE} .a{color:red;}}${SCOPE} .c{color:green;}@media m{${SCOPE} .b{color:blue;}}`
    );
  });

  it('never opens a condition whose whole body was discarded', () => {
    expect(emit(flat('@media m{.a{}}'))).toBe('');
    expect(emit(flat('@media a{@media b{.c{}}.d{color:red}}'))).toBe(
      `@media a{${SCOPE} .d{color:red;}}`
    );
  });

  it('is insensitive to source whitespace and formatting', () => {
    expect(emit(flat('.a{color:red}'))).toBe(
      emit(flat('\n.a {\n  color: red;\n}\n'))
    );
  });

  it('round-trips a nested source into balanced, minimized text', () => {
    const text = emit(
      flat(
        'color:red;.a{color:blue;&:hover{color:green}}@media m{@supports (a:b){.b{color:teal}}}@keyframes fade{from{opacity:0}}'
      )
    );

    expect(text).toBe(
      `${SCOPE}{color:red;}` +
        `${SCOPE} .a{color:blue;}` +
        `${SCOPE} .a:hover{color:green;}` +
        `@media m{@supports (a:b){${SCOPE} .b{color:teal;}}}` +
        '@keyframes fade{from{opacity:0;}}'
    );
  });
});
