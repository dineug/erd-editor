import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEMPLATE_LITERALS } from '@/constants';
import {
  CSSTemplate,
  CSSTemplateLiterals,
  TemplateLiteralsType,
} from '@/template';

type Css = (
  strings: TemplateStringsArray,
  ...values: any[]
) => CSSTemplateLiterals;

const identifierRegexp = /^_[0-9a-z]{7}$/;

let css: Css;
let addCSSHost: (host: ShadowRoot) => void;
let cssTemplateCache: WeakMap<TemplateStringsArray, CSSTemplate>;

const createHost = (): ShadowRoot => {
  const host = document.createElement('div');
  document.body.append(host);
  return host.attachShadow({ mode: 'open' });
};

const rulesOf = (host: ShadowRoot): string[] =>
  host.adoptedStyleSheets.flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );

beforeEach(async () => {
  vi.resetModules();
  css = (await import('@/template/css')).css;
  addCSSHost = (await import('@/template/vCSSStyleSheet')).addCSSHost;
  cssTemplateCache = (await import('@/template')).cssTemplateCache;
});

describe('template/css', () => {
  it('builds a template literals object tagged as css', () => {
    const tpl = css`
      color: red;
    `;

    expect(tpl[TEMPLATE_LITERALS]).toBe(TemplateLiteralsType.css);
    expect(tpl.values).toEqual([]);
    expect(Object.isFrozen(tpl.template)).toBe(true);
    expect(tpl.template.node).toBeDefined();
  });

  it('stringifies to a generated class selector name', () => {
    const tpl = css`
      color: red;
    `;

    expect(String(tpl)).toMatch(identifierRegexp);
    expect(`${tpl}`).toBe(tpl.toString());
  });

  it('emits the parsed declarations under the generated selector', () => {
    const host = createHost();
    const tpl = css`
      color: red;
      font-size: 12px;
    `;
    addCSSHost(host);

    expect(rulesOf(host)).toEqual([
      `.${String(tpl)} { color: red; font-size: 12px; }`,
    ]);
  });

  it('interpolates values into property values and selectors', () => {
    const host = createHost();
    const tpl = css`
      .foo-${'x'} {
        color: ${'blue'};
      }
    `;
    addCSSHost(host);

    expect(tpl.values).toEqual(['x', 'blue']);
    expect(rulesOf(host)).toContain(`.${String(tpl)} .foo-x { color: blue; }`);
  });

  it('interpolates a value in the middle of a declaration', () => {
    const host = createHost();
    const tpl = css`
      height: ${10}px;
    `;
    addCSSHost(host);

    expect(rulesOf(host)).toEqual([`.${String(tpl)} { height: 10px; }`]);
  });

  it('drops null and undefined interpolations', () => {
    const host = createHost();
    const tpl = css`
      color: ${null};
      width: ${undefined};
      height: ${10}px;
    `;
    addCSSHost(host);

    expect(rulesOf(host)).toEqual([`.${String(tpl)} { height: 10px; }`]);
  });

  it('resolves the & reference to the parent selector', () => {
    const host = createHost();
    const tpl = css`
      &:hover {
        color: green;
      }
    `;
    addCSSHost(host);

    expect(rulesOf(host)).toContain(`.${String(tpl)}:hover { color: green; }`);
  });

  it('merges the declarations of an interpolated css literal', () => {
    const host = createHost();
    const base = css`
      color: red;
    `;
    const merged = css`
      ${base}
      font-size: 12px;
    `;
    addCSSHost(host);

    expect(String(merged)).not.toBe(String(base));
    expect(rulesOf(host)).toContain(
      `.${String(merged)} { color: red; font-size: 12px; }`
    );
  });

  it('embeds an interpolated css literal as a nested class selector', () => {
    const host = createHost();
    const child = css`
      color: teal;
    `;
    const parent = css`
      .wrap ${child} {
        color: pink;
      }
    `;
    addCSSHost(host);

    expect(rulesOf(host)).toContain(
      `.${String(parent)} .wrap .${String(child)} { color: pink; }`
    );
  });

  it('reuses raw strings so invalid escape sequences survive', () => {
    const tpl = css`
      content: '\2014';
    `;

    expect(tpl.strings[0]).toBeUndefined();
    expect(tpl.strings.raw[0]).toContain("content: '\\2014';");
    expect(String(tpl)).toMatch(identifierRegexp);
  });

  it('caches the compiled template per call site', () => {
    const make = (color: string) => css`
      color: ${color};
    `;
    const first = make('red');
    const second = make('blue');

    expect(first.strings).toBe(second.strings);
    expect(first.template).toBe(second.template);
    expect(cssTemplateCache.get(first.strings)).toBe(first.template);
    expect(first).not.toBe(second);
  });

  it('re-renders cached templates with the new values', () => {
    const host = createHost();
    const make = (color: string) => css`
      color: ${color};
    `;
    const first = make('red');
    const second = make('blue');
    addCSSHost(host);

    expect(String(first)).not.toBe(String(second));
    expect(rulesOf(host)).toEqual([
      `.${String(first)} { color: red; }`,
      `.${String(second)} { color: blue; }`,
    ]);
  });

  it('gives identical declaration blocks the same identifier', () => {
    const a = css`
      color: red;
    `;
    const b = css`
      color: red;
    `;

    expect(a.strings).not.toBe(b.strings);
    expect(String(a)).toBe(String(b));
  });

  it('memoizes each set of slot values on the template', () => {
    const make = (color: string) => css`
      color: ${color};
    `;
    const first = make('red');

    expect(first.template.node.memo.size).toBe(1);
    expect(make('red').template.node.memo.size).toBe(1);
    expect(make('blue').template.node.memo.size).toBe(2);
  });

  it('bounds the memo at 32 entries', () => {
    const make = (size: number) => css`
      width: ${size}px;
    `;
    const first = make(0);

    for (let i = 1; i < 40; i++) make(i);

    expect(first.template.node.memo.size).toBe(32);
    // The oldest entries went first, and a re-render of one of them still compiles.
    expect(String(make(0))).toBe(String(first));
    expect(first.template.node.memo.size).toBe(32);
  });

  it('supports an at-rule with a nested block', () => {
    const host = createHost();
    const tpl = css`
      @media (min-width: 100px) {
        color: red;
      }
    `;
    addCSSHost(host);

    expect(
      rulesOf(host).some(rule => rule.startsWith('@media (min-width: 100px)'))
    ).toBe(true);
    expect(String(tpl)).toMatch(identifierRegexp);
  });
});
