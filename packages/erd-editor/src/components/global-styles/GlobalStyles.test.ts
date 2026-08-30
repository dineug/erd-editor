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
 * class, after which a marker is unambiguous — except that the vendored picker
 * declares the reset's marker itself and has to be identified first.
 */
function kindOf(rules: CSSStyleRule[]): string {
  const text = rules.map(rule => rule.cssText).join('');
  if (rules.some(rule => SCOPE_CLASS.test(rule.cssText))) return 'component';

  if (text.includes('.easylogic-colorpicker')) return 'colorPicker';
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
    it('adopts the five global sheets in the pinned order', () => {
      // Registration order is module evaluation order, which follows the alphabetically sorted
      // import list in GlobalStyles.ts — colorPicker, fonts, reset, scrollbar, typography. The
      // explicit array passed to setGlobalStyleOrder is what produces this sequence instead.
      expect(sheetKinds.slice(0, 5)).toEqual([
        'reset',
        'fonts',
        'typography',
        'scrollbar',
        'colorPicker',
      ]);
    });

    it('is not the order the imports would have produced', () => {
      const registrationOrder = [
        'colorPicker',
        'fonts',
        'reset',
        'scrollbar',
        'typography',
      ];

      expect(sheetKinds.slice(0, 5)).not.toEqual(registrationOrder);
    });

    it('puts every global sheet ahead of every component sheet', () => {
      // A fold rather than findLastIndex: the root tsconfig.app.json targets ES2020 and
      // findLastIndex is ES2023, so it type-errors here even though Node 22 runs it fine.
      const lastGlobal = sheetKinds.reduce(
        (last, kind, index) => (kind === 'component' ? last : index),
        -1
      );
      const firstComponent = sheetKinds.indexOf('component');

      expect(lastGlobal).toBe(4);
      expect(firstComponent).toBe(5);
      expect(sheetKinds.slice(5).every(kind => kind === 'component')).toBe(
        true
      );
    });
  });

  describe('what the five sheets carry', () => {
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

  describe('the color picker is adopted, not a tree <style>', () => {
    it('renders no markup at all', async () => {
      // The component is nothing but the setGlobalStyleOrder call at module
      // scope. Rendering a <style> again would put the vendored rules back in
      // front of the whole adopted pool, which a shadow root applies second.
      mounted = await mountAndFlush(html`<${GlobalStyles} />`);

      expect(mounted.container.querySelectorAll('style')).toHaveLength(0);
    });

    it('adopts one sheet for the picker however many instances mount', async () => {
      const before = adoptedSheets().length;
      const first = await mountAndFlush(html`<${GlobalStyles} />`);
      const second = await mountAndFlush(html`<${GlobalStyles} />`);

      // The sheet is keyed by the template's content hash, so mounting cannot register it twice —
      // which is the property that made folding it cheap in the first place.
      expect(adoptedSheets()).toHaveLength(before);
      expect(first.container.querySelector('style')).toBeNull();
      expect(second.container.querySelector('style')).toBeNull();

      first.unmount();
      second.unmount();
    });

    it('carries the picker rules in the last global sheet', () => {
      const rules = adoptedSheets()[4];
      const selectors = rules.map(rule => rule.selectorText).join(' ');

      expect(rules.length).toBeGreaterThan(300);
      expect(selectors).toContain('.easylogic-colorpicker');
      expect(selectors).toContain('.colorsets-contextmenu');
    });
  });
});
