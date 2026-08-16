import { describe, expect, it } from 'vite-plus/test';

import { TEMPLATE_LITERALS } from '@/constants';
import {
  cssTemplateCache,
  templateCache,
  TemplateLiteralsType,
  TemplateLiteralsTypes,
} from '@/template';
import { css } from '@/template/css';
import { html, svg } from '@/template/html';

describe('template/index', () => {
  describe('TemplateLiteralsType', () => {
    it('maps every member onto its own literal name', () => {
      expect(TemplateLiteralsType.html).toBe('html');
      expect(TemplateLiteralsType.svg).toBe('svg');
      expect(TemplateLiteralsType.css).toBe('css');
    });

    it('exposes exactly three members', () => {
      const values = Object.values(TemplateLiteralsType);
      expect(values).toEqual(['html', 'svg', 'css']);
    });
  });

  describe('TemplateLiteralsTypes', () => {
    it('is a Set built from every enum value', () => {
      expect(TemplateLiteralsTypes).toBeInstanceOf(Set);
      expect(TemplateLiteralsTypes.size).toBe(3);
      expect(TemplateLiteralsTypes.has(TemplateLiteralsType.html)).toBe(true);
      expect(TemplateLiteralsTypes.has(TemplateLiteralsType.svg)).toBe(true);
      expect(TemplateLiteralsTypes.has(TemplateLiteralsType.css)).toBe(true);
    });

    it('rejects values that are not template literal types', () => {
      expect(TemplateLiteralsTypes.has('text' as TemplateLiteralsType)).toBe(
        false
      );
      expect(TemplateLiteralsTypes.has('' as TemplateLiteralsType)).toBe(false);
    });
  });

  describe('templateCache', () => {
    it('is a WeakMap keyed by the strings array', () => {
      expect(templateCache).toBeInstanceOf(WeakMap);
    });

    it('holds the compiled template of an html literal', () => {
      const tpl = html`<div data-index-spec="html"></div>`;

      expect(templateCache.has(tpl.strings)).toBe(true);
      expect(templateCache.get(tpl.strings)).toBe(tpl.template);
    });

    it('holds the compiled template of an svg literal', () => {
      const tpl = svg`<svg data-index-spec="svg"></svg>`;

      expect(templateCache.has(tpl.strings)).toBe(true);
      expect(templateCache.get(tpl.strings)).toBe(tpl.template);
    });

    it('does not receive css literals', () => {
      const tpl = css`
        border-radius: 1px;
      `;

      expect(templateCache.has(tpl.strings)).toBe(false);
    });
  });

  describe('cssTemplateCache', () => {
    it('is a WeakMap keyed by the strings array', () => {
      expect(cssTemplateCache).toBeInstanceOf(WeakMap);
    });

    it('holds the compiled template of a css literal', () => {
      const tpl = css`
        border-radius: 2px;
      `;

      expect(cssTemplateCache.has(tpl.strings)).toBe(true);
      expect(cssTemplateCache.get(tpl.strings)).toBe(tpl.template);
    });

    it('does not receive html literals', () => {
      const tpl = html`<div data-index-spec="not-css"></div>`;

      expect(cssTemplateCache.has(tpl.strings)).toBe(false);
    });
  });

  describe('literal shape', () => {
    it('tags each literal with the TEMPLATE_LITERALS symbol', () => {
      expect(html`<i></i>`[TEMPLATE_LITERALS]).toBe(TemplateLiteralsType.html);
      expect(svg`<svg></svg>`[TEMPLATE_LITERALS]).toBe(
        TemplateLiteralsType.svg
      );
      expect(
        css`
          color: red;
        `[TEMPLATE_LITERALS]
      ).toBe(TemplateLiteralsType.css);
    });
  });
});
