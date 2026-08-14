import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CSSTemplateLiterals } from '@/template';

type Css = (
  strings: TemplateStringsArray,
  ...values: any[]
) => CSSTemplateLiterals;

let css: Css;
let addCSSHost: (host: ShadowRoot) => void;
let removeCSSHost: (host: ShadowRoot) => void;
let cssUnwrap: () => void;

const createHost = (): ShadowRoot => {
  const host = document.createElement('div');
  document.body.append(host);
  return host.attachShadow({ mode: 'open' });
};

const rulesOf = (host: ShadowRoot): string[] =>
  host.adoptedStyleSheets.flatMap(sheet =>
    Array.from(sheet.cssRules).map(rule => rule.cssText)
  );

const styleTextsOf = (host: ShadowRoot): string[] =>
  Array.from(host.querySelectorAll('style')).map(el => el.textContent ?? '');

beforeEach(async () => {
  vi.resetModules();
  css = (await import('@/template/css')).css;
  const vCSSStyleSheet = await import('@/template/vCSSStyleSheet');
  addCSSHost = vCSSStyleSheet.addCSSHost;
  removeCSSHost = vCSSStyleSheet.removeCSSHost;
  cssUnwrap = vCSSStyleSheet.cssUnwrap;
});

describe('template/vCSSStyleSheet', () => {
  describe('constructable stylesheet mode', () => {
    it('adopts the stylesheets registered before the host joins', () => {
      const tpl = css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(1);
      expect(rulesOf(host)).toEqual([`.${String(tpl)} { color: red; }`]);
    });

    it('pushes newly rendered stylesheets to already registered hosts', () => {
      const host = createHost();
      addCSSHost(host);
      expect(host.adoptedStyleSheets).toHaveLength(0);

      const tpl = css`
        color: blue;
      `;

      expect(rulesOf(host)).toEqual([`.${String(tpl)} { color: blue; }`]);
    });

    it('shares one stylesheet between every registered host', () => {
      const first = createHost();
      const second = createHost();
      addCSSHost(first);
      addCSSHost(second);

      css`
        color: red;
      `;

      expect(first.adoptedStyleSheets).toHaveLength(1);
      expect(first.adoptedStyleSheets[0]).toBe(second.adoptedStyleSheets[0]);
    });

    it('registers a selector only once', () => {
      const host = createHost();
      addCSSHost(host);

      const a = css`
        color: red;
      `;
      const b = css`
        color: red;
      `;

      expect(String(a)).toBe(String(b));
      expect(host.adoptedStyleSheets).toHaveLength(1);
    });

    it('creates one stylesheet per nested selector', () => {
      const host = createHost();
      addCSSHost(host);

      css`
        color: red;
        .foo {
          color: blue;
        }
      `;

      expect(host.adoptedStyleSheets).toHaveLength(2);
    });
  });

  describe('addCSSHost', () => {
    it('is a no-op for an already registered host', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      expect(host.adoptedStyleSheets).toHaveLength(1);

      host.adoptedStyleSheets = [];
      addCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(0);
    });

    it('registers a host even when no stylesheet exists yet', () => {
      const host = createHost();

      expect(() => addCSSHost(host)).not.toThrow();
      expect(host.adoptedStyleSheets).toHaveLength(0);
    });
  });

  describe('removeCSSHost', () => {
    it('clears the adopted stylesheets of the host', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      expect(host.adoptedStyleSheets).toHaveLength(1);

      removeCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(0);
    });

    it('stops the host from receiving later stylesheets', () => {
      const host = createHost();
      addCSSHost(host);
      removeCSSHost(host);

      css`
        color: red;
      `;

      expect(host.adoptedStyleSheets).toHaveLength(0);
    });

    it('leaves other hosts untouched', () => {
      const removed = createHost();
      const kept = createHost();
      addCSSHost(removed);
      addCSSHost(kept);
      css`
        color: red;
      `;

      removeCSSHost(removed);

      expect(removed.adoptedStyleSheets).toHaveLength(0);
      expect(kept.adoptedStyleSheets).toHaveLength(1);
    });

    it('is a no-op for an unknown host', () => {
      const host = createHost();
      const unknown = createHost();
      addCSSHost(host);
      css`
        color: red;
      `;
      unknown.adoptedStyleSheets = host.adoptedStyleSheets;

      expect(() => removeCSSHost(unknown)).not.toThrow();
      expect(unknown.adoptedStyleSheets).toHaveLength(1);
    });

    it('is a no-op when called twice', () => {
      const host = createHost();
      addCSSHost(host);
      css`
        color: red;
      `;
      removeCSSHost(host);
      host.adoptedStyleSheets = [new CSSStyleSheet()];

      removeCSSHost(host);

      expect(host.adoptedStyleSheets).toHaveLength(1);
    });
  });

  describe('cssUnwrap', () => {
    it('converts the registered stylesheets into style elements', () => {
      const tpl = css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      expect(styleTextsOf(host)).toEqual([]);

      cssUnwrap();

      expect(styleTextsOf(host)).toEqual([`.${String(tpl)} {\ncolor: red;\n}`]);
    });

    it('keeps a body-less at-rule as bare css text', () => {
      css`
        @import url('a.css');
      `;
      const host = createHost();
      addCSSHost(host);

      cssUnwrap();

      expect(styleTextsOf(host)).toContain("@import url('a.css');");
    });

    it('is a no-op on the second call', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      cssUnwrap();
      const before = styleTextsOf(host);

      cssUnwrap();

      expect(styleTextsOf(host)).toEqual(before);
    });

    it('appends only the style elements the host does not have yet', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      cssUnwrap();
      expect(styleTextsOf(host)).toHaveLength(1);

      const next = css`
        .bar {
          color: green;
        }
      `;

      const texts = styleTextsOf(host);
      expect(texts).toHaveLength(3);
      expect(texts[2]).toBe(`.${String(next)} .bar {\ncolor: green;\n}`);
    });

    it('gives every host its own imported copy of a style element', () => {
      css`
        color: red;
      `;
      const first = createHost();
      addCSSHost(first);
      cssUnwrap();

      const second = createHost();
      addCSSHost(second);

      expect(styleTextsOf(second)).toEqual(styleTextsOf(first));
      expect(second.querySelector('style')).not.toBe(
        first.querySelector('style')
      );
    });

    it('removes the appended style elements on removeCSSHost', () => {
      css`
        color: red;
        .foo {
          color: blue;
        }
      `;
      const host = createHost();
      addCSSHost(host);
      cssUnwrap();
      expect(styleTextsOf(host)).toHaveLength(2);

      removeCSSHost(host);

      expect(styleTextsOf(host)).toHaveLength(0);
    });

    it('stops appending style elements to a removed host', () => {
      css`
        color: red;
      `;
      const host = createHost();
      addCSSHost(host);
      cssUnwrap();
      removeCSSHost(host);

      css`
        color: purple;
      `;

      expect(styleTextsOf(host)).toHaveLength(0);
    });
  });
});
