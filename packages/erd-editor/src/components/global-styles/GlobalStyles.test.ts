import { html } from '@dineug/r-html';
import { afterEach, beforeAll, describe, expect, it } from 'vite-plus/test';

import { adoptedSheets, SCOPE_CLASS } from '@/__test-utils__/adoptedCss';
import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import { CodeFontFamily, TextFontFamily } from '@/styles/fonts.styles';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/**
 * Which sheet is which. A global sheet is the one kind carrying no generated
 * class, after which a marker is unambiguous.
 */
function kindOf(rules: CSSStyleRule[]): string {
  const text = rules.map(rule => rule.cssText).join('');
  if (rules.some(rule => SCOPE_CLASS.test(rule.cssText))) return 'component';

  if (text.includes('box-sizing: border-box')) return 'reset';
  if (text.includes('--text-font-family:')) return 'fonts';
  if (text.includes('--font-size-1:')) return 'typography';
  if (text.includes('-webkit-scrollbar')) return 'scrollbar';
  return 'component';
}

let sheetKinds: string[] = [];

beforeAll(() => {
  sheetKinds = adoptedSheets().map(kindOf);
});

describe('GlobalStyles', () => {
  describe('cascade order of the global bucket', () => {
    it('adopts the four global sheets in the pinned order', () => {
      // Registration order is module evaluation order, which follows the alphabetically sorted
      // import list in GlobalStyles.ts — fonts, reset, scrollbar, typography. The explicit array
      // passed to setGlobalStyleOrder is what produces this sequence instead.
      expect(sheetKinds.slice(0, 4)).toEqual([
        'reset',
        'fonts',
        'typography',
        'scrollbar',
      ]);
    });

    it('is not the order the imports would have produced', () => {
      const registrationOrder = ['fonts', 'reset', 'scrollbar', 'typography'];

      expect(sheetKinds.slice(0, 4)).not.toEqual(registrationOrder);
    });

    it('puts every global sheet ahead of every component sheet', () => {
      // A fold rather than findLastIndex: the root tsconfig.app.json targets ES2020 and
      // findLastIndex is ES2023, so it type-errors here even though Node 22 runs it fine.
      const lastGlobal = sheetKinds.reduce(
        (last, kind, index) => (kind === 'component' ? last : index),
        -1
      );
      const firstComponent = sheetKinds.indexOf('component');

      expect(lastGlobal).toBe(3);
      expect(firstComponent).toBe(4);
      expect(sheetKinds.slice(4).every(kind => kind === 'component')).toBe(
        true
      );
    });
  });

  describe('what the four sheets carry', () => {
    it('includes the reset', () => {
      const rules = adoptedSheets()[0];
      const text = rules.map(rule => rule.cssText).join('');

      expect(text).toContain('box-sizing: border-box');
      expect(text).toContain('font-family: var(--text-font-family)');
    });

    it('includes the font family custom properties', () => {
      const [rule] = adoptedSheets()[1];

      expect(rule.style.getPropertyValue('--text-font-family')).toBe(
        TextFontFamily.split(', ').join(',')
      );
      expect(rule.style.getPropertyValue('--code-font-family')).toBe(
        CodeFontFamily.split(', ').join(',')
      );
    });

    it('includes the typography tokens', () => {
      const [rule] = adoptedSheets()[2];

      expect(rule.style.getPropertyValue('--font-size-1')).toBe('12px');
      expect(rule.style.getPropertyValue('--font-weight-bold')).toBe('700');
    });

    it('includes the scrollbar sheet, with the hook class intact', () => {
      const selectors = adoptedSheets()[3].map(rule => rule.selectorText);

      expect(selectors).toContain('::-webkit-scrollbar');
      expect(selectors).toContain('.scrollbar');
    });
  });

  describe('renders no markup and adds no sheet twice', () => {
    it('renders no markup at all', async () => {
      // The component is nothing but the setGlobalStyleOrder call at module
      // scope; a <style> would put the global rules in front of the whole
      // adopted pool, which a shadow root applies second.
      mounted = await mountAndFlush(html`<${GlobalStyles} />`);

      expect(mounted.container.querySelectorAll('style')).toHaveLength(0);
    });

    it('adopts each global sheet once however many instances mount', async () => {
      const before = adoptedSheets().length;
      const first = await mountAndFlush(html`<${GlobalStyles} />`);
      const second = await mountAndFlush(html`<${GlobalStyles} />`);

      // Each sheet is keyed by its template's content hash, so mounting cannot register one twice.
      expect(adoptedSheets()).toHaveLength(before);
      expect(first.container.querySelector('style')).toBeNull();
      expect(second.container.querySelector('style')).toBeNull();

      first.unmount();
      second.unmount();
    });
  });
});
