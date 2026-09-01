import { describe, expect, it } from 'vite-plus/test';

import { compileToRules } from '@/css';

/**
 * A comma prelude is the one selector shape where scoping can half-succeed: miss
 * a segment and it leaks to the whole document while the rule still applies where
 * it was meant to, so nothing downstream reports it.
 */

const SCOPE_CLASS = /^\._[0-9a-z]{7}\b/;

/** The selector segments of the one ruleset, past a conditional at-rule wrapper. */
function segmentsOf(cssText: string): string[] {
  const body = cssText.startsWith('@')
    ? cssText.slice(cssText.indexOf('{') + 1)
    : cssText;

  return body.slice(0, body.indexOf('{')).split(',');
}

describe('a comma prelude is scoped in every segment', () => {
  it.each([
    ['a descendant list', '.r:hover,.r[data-hover],.r.ident[data-hover]{s:1}'],
    ['a parent-reference list', '&:hover,&:focus{s:1}'],
    ['a list nested under a parent', '.a{.b,.c{s:1}}'],
    ['a list inside a conditional at-rule', '@media (w:1px){.a,.b{s:1}}'],
  ])('scopes %s', (_name, source) => {
    const { cssText, identifier } = compileToRules(source);
    const segments = segmentsOf(cssText);

    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) {
      expect(segment).toMatch(SCOPE_CLASS);
      expect(segment.startsWith(`.${identifier}`)).toBe(true);
    }
  });

  it('scopes the three segments erd-editor shipped before its scene left the dom', () => {
    // The site this replaces: erd-editor pinned it through its own emitted css
    // until P6-51 deleted CanvasSvg.styles.ts, and the hand-written pipeline it
    // was written against leaked segments two and three to the whole document.
    const { cssText, identifier } = compileToRules(
      `.relationship:hover,
       .relationship[data-hover],
       .relationship.identification[data-hover] {
         stroke: var(--relationship-hover);
       }`
    );

    expect(cssText).toBe(
      `.${identifier} .relationship:hover,` +
        `.${identifier} .relationship[data-hover],` +
        `.${identifier} .relationship.identification[data-hover]` +
        '{stroke:var(--relationship-hover);}'
    );
  });

  it('leaves a global list unscoped, which is what makes the guard above mean something', () => {
    const { cssText } = compileToRules('.a,.b{s:1}', { mode: 'global' });

    expect(cssText).toBe('.a,.b{s:1;}');
  });
});
