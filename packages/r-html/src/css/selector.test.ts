import { describe, expect, it } from 'vitest';

import { compileToRules } from '@/css';
import { emit } from '@/css/emit';
import { FlatRule } from '@/css/flatten';
import { isShadowBoundary, SCOPE, substituteScope } from '@/css/selector';

/**
 * `selector.ts` is two small functions, but both encode a decision that is expensive to get wrong:
 * R6 (the substitution is global, unanchored, and confined to selectors) and R1's replacement
 * (shadow boundaries are diagnosed, not rewritten, and only in the leftmost compound).
 */

describe('SCOPE', () => {
  it('is an identifier-safe token, so the scanner treats it as a plain type selector', () => {
    expect(SCOPE).toBe('rhtml-scope');
    // No `@`, `%`, quote or brace: every one of those is a scanner state change in stylis, which is
    // how the old `@@r-html…` marker lost the scope entirely.
    expect(SCOPE).toMatch(/^[a-z][a-z-]*$/);
  });
});

describe('substituteScope', () => {
  it('replaces a lone occurrence', () => {
    expect(substituteScope(`${SCOPE} .a`, '._x')).toBe('._x .a');
  });

  it('is global — `&&{}` compiles to two adjacent sentinels and both must be replaced', () => {
    // This is the case that forbids a first-occurrence-only replace: stylis expands `&&{color:red}`
    // to the single selector `rhtml-scoperhtml-scope`.
    expect(substituteScope(`${SCOPE}${SCOPE}`, '._x')).toBe('._x._x');
    expect(substituteScope(`${SCOPE}+${SCOPE}`, '._x')).toBe('._x+._x');
  });

  it('is unanchored — the sentinel is not always leftmost', () => {
    // `.x &{color:red}` puts the scope at the end, `${child} &{}` puts it in the middle.
    expect(substituteScope(`.x ${SCOPE}`, '._x')).toBe('.x ._x');
    expect(substituteScope(`.p ${SCOPE} .q`, '._x')).toBe('.p ._x .q');
  });

  it('leaves a selector without the sentinel exactly as it was', () => {
    const selector = '.a:hover::before';
    expect(substituteScope(selector, '._x')).toBe(selector);
  });

  it('is a plain textual replace, with no token boundary of its own', () => {
    // Documented, not desired: nothing downstream can produce `rhtml-scopeX`, because the sentinel
    // only ever enters a selector as a whole parent frame. The guard that matters is the one below —
    // this function is never run over anything but a selector.
    expect(substituteScope(`${SCOPE}d`, '._x')).toBe('._xd');
  });
});

describe('substituteScope is applied to selectors only (R6)', () => {
  const scoped: FlatRule = {
    conditions: [],
    selectors: [`${SCOPE} .a`],
    declarations: [`content:'${SCOPE}'`, `background:url(${SCOPE}.png)`],
  };

  it('rewrites the selector and leaves declarations alone', () => {
    expect(emit([scoped], { scope: '._x' })).toBe(
      `._x .a{content:'${SCOPE}';background:url(${SCOPE}.png);}`
    );
  });

  it('leaves an at-rule prelude and a keyframes body alone', () => {
    const atLeaf: FlatRule = {
      conditions: [],
      selectors: [],
      prelude: `@counter-style ${SCOPE}`,
      declarations: ['system:cyclic'],
    };
    const keyframes: FlatRule = {
      conditions: [],
      selectors: [],
      prelude: `@keyframes ${SCOPE}`,
      declarations: [],
      body: `${SCOPE}{opacity:0;}`,
    };

    expect(emit([atLeaf, keyframes], { scope: '._x' })).toBe(
      `@counter-style ${SCOPE}{system:cyclic;}@keyframes ${SCOPE}{${SCOPE}{opacity:0;}}`
    );
  });

  it('survives a real compile: a sentinel written into a value ships verbatim', () => {
    const { cssText, identifier } = compileToRules(
      `.a{content:'${SCOPE}'}&:hover{color:red}`
    );

    expect(cssText).toBe(
      `.${identifier} .a{content:'${SCOPE}';}.${identifier}:hover{color:red;}`
    );
  });
});

describe('isShadowBoundary', () => {
  it.each([
    ':host',
    ':host(.dark)',
    ':host-context(.x)',
    '::slotted(span)',
    ':host .a',
    ':host(.dark) .a',
    '::slotted(span)::before',
  ])('is a boundary: %s', selector => {
    expect(isShadowBoundary(selector)).toBe(true);
  });

  it.each([
    '.a :host',
    '.a ::slotted(span)',
    '&:host',
    ':hostname',
    ':hover',
    '::before',
    '.a',
    '',
    'slotted(span)',
    '::slotted',
  ])('is not a boundary: %s', selector => {
    expect(isShadowBoundary(selector)).toBe(false);
  });

  it('only the leftmost compound counts', () => {
    // The asymmetry is the whole rule. `:host .a` is dead once the scope class is prepended;
    // `.a :host` was written by an author who already knew where the boundary was.
    expect(isShadowBoundary(':host .a')).toBe(true);
    expect(isShadowBoundary('.a :host')).toBe(false);
  });

  it('trims the segment, because a selector list leaves whitespace behind', () => {
    expect(isShadowBoundary('  :host  ')).toBe(true);
    expect(isShadowBoundary('\n  ::slotted(span)')).toBe(true);
  });
});
