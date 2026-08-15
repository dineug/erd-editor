import { addCSSHost } from '@dineug/r-html';

/**
 * Test-only helpers for reading what the css compiler actually emitted.
 *
 * Deliberately a module of its own rather than a member of `__test-utils__/index.ts`: importing
 * that barrel pulls in the whole app context, and every component style module it drags along
 * would register another sheet into the same shared registry. A style test that imports only the
 * module under test reads only that module's rules.
 */

/** A fresh shadow root's adopted rules, in cascade order — global sheets first. */
export function adoptedRules(): CSSStyleRule[] {
  const host = document.createElement('div').attachShadow({ mode: 'open' });
  addCSSHost(host);

  return host.adoptedStyleSheets.flatMap(
    sheet => Array.from(sheet.cssRules) as CSSStyleRule[]
  );
}

/** One entry per adopted sheet, each holding that sheet's rules. */
export function adoptedSheets(): CSSStyleRule[][] {
  const host = document.createElement('div').attachShadow({ mode: 'open' });
  addCSSHost(host);

  return host.adoptedStyleSheets.map(
    sheet => Array.from(sheet.cssRules) as CSSStyleRule[]
  );
}

export function selectorsOf(rules: CSSStyleRule[]): string[] {
  return rules.map(rule => rule.selectorText);
}

export function ruleOf(rules: CSSStyleRule[], selector: string): CSSStyleRule {
  const rule = rules.find(candidate => candidate.selectorText === selector);
  if (!rule) {
    throw new Error(
      `missing rule: ${selector}\nhave:\n  ${selectorsOf(rules).join('\n  ')}`
    );
  }
  return rule;
}

/** The generated class a scoped template emits. A global sheet must contain none. */
export const SCOPE_CLASS = /\._[0-9a-z]{7}/;
