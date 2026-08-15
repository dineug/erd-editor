import { describe, expect, it } from 'vitest';

import { MARKER, TAttrType, TEMPLATE_LITERALS } from '@/constants';
import { TemplateLiteralsType } from '@/template';
import { css } from '@/template/css';
import {
  createMarker,
  getAttrName,
  getAttrType,
  getMarkers,
  isCSSTemplateLiterals,
  isMarker,
  isMarkerOnly,
  isPartAttr,
  isPrefixBooleanMarker,
  isPrefixEventMarker,
  isPrefixOnEventMarker,
  isPrefixPropertyMarker,
  isPrefixSpreadMarker,
  isSVG,
  isTemplateLiterals,
  isTemplateStringsArray,
} from '@/template/helper';
import { html, svg } from '@/template/html';

const m0 = createMarker(0);
const m1 = createMarker(1);

const tag = (strings: TemplateStringsArray, ..._values: unknown[]) => strings;

describe('template/helper', () => {
  describe('createMarker', () => {
    it('suffixes the shared MARKER with the value index', () => {
      expect(createMarker(0)).toBe(`${MARKER}_0_`);
      expect(createMarker(12)).toBe(`${MARKER}_12_`);
    });
  });

  describe('isTemplateStringsArray', () => {
    it('accepts a real tagged template strings array', () => {
      expect(isTemplateStringsArray(tag`a${1}b`)).toBe(true);
    });

    it('accepts any array carrying an array `raw`', () => {
      expect(isTemplateStringsArray(Object.assign(['a'], { raw: ['a'] }))).toBe(
        true
      );
    });

    it('rejects arrays without `raw` and non-arrays', () => {
      expect(isTemplateStringsArray(['a'])).toBe(false);
      expect(isTemplateStringsArray({ raw: ['a'] })).toBe(false);
      expect(isTemplateStringsArray(null)).toBe(false);
      expect(isTemplateStringsArray('a')).toBe(false);
    });
  });

  describe('isTemplateLiterals', () => {
    it('accepts html, svg and css tagged templates', () => {
      expect(isTemplateLiterals(html`<div></div>`)).toBe(true);
      expect(isTemplateLiterals(svg`<circle></circle>`)).toBe(true);
      expect(
        isTemplateLiterals(css`
          color: red;
        `)
      ).toBe(true);
    });

    it('rejects objects with an unknown template literals type', () => {
      expect(
        isTemplateLiterals({
          strings: tag`a`,
          values: [],
          [TEMPLATE_LITERALS]: 'nope',
        })
      ).toBe(false);
    });

    it('rejects objects missing the template literals brand', () => {
      expect(isTemplateLiterals({ strings: tag`a`, values: [] })).toBe(false);
      expect(
        isTemplateLiterals({
          strings: ['a'],
          values: [],
          [TEMPLATE_LITERALS]: TemplateLiteralsType.html,
        })
      ).toBe(false);
      expect(
        isTemplateLiterals({
          strings: tag`a`,
          values: 'not-an-array',
          [TEMPLATE_LITERALS]: TemplateLiteralsType.html,
        })
      ).toBe(false);
      expect(isTemplateLiterals(null)).toBe(false);
    });
  });

  describe('isCSSTemplateLiterals', () => {
    it('only accepts css tagged templates', () => {
      expect(
        isCSSTemplateLiterals(css`
          color: red;
        `)
      ).toBe(true);
      expect(isCSSTemplateLiterals(html`<div></div>`)).toBe(false);
      expect(isCSSTemplateLiterals('color: red;')).toBe(false);
    });
  });

  describe('prefix markers', () => {
    it('matches the spread prefix, ignoring leading whitespace', () => {
      expect(isPrefixSpreadMarker(`...${m0}`)).toBe(true);
      expect(isPrefixSpreadMarker(`   ...${m0}`)).toBe(true);
      expect(isPrefixSpreadMarker(m0)).toBe(false);
      expect(isPrefixSpreadMarker(undefined)).toBe(false);
      expect(isPrefixSpreadMarker(null)).toBe(false);
    });

    it('matches the property, boolean and event prefixes', () => {
      expect(isPrefixPropertyMarker('.value')).toBe(true);
      expect(isPrefixPropertyMarker('value')).toBe(false);
      expect(isPrefixBooleanMarker('?disabled')).toBe(true);
      expect(isPrefixBooleanMarker('disabled')).toBe(false);
      expect(isPrefixEventMarker('@click')).toBe(true);
      expect(isPrefixEventMarker('click')).toBe(false);
      expect(isPrefixOnEventMarker('onclick')).toBe(true);
      expect(isPrefixOnEventMarker('click')).toBe(false);
    });
  });

  describe('isMarker / isMarkerOnly', () => {
    it('isMarker matches the marker anywhere inside the value', () => {
      expect(isMarker(m0)).toBe(true);
      expect(isMarker(`prefix ${m1} suffix`)).toBe(true);
      expect(isMarker('plain')).toBe(false);
      expect(isMarker('')).toBe(false);
      expect(isMarker(undefined)).toBe(false);
      expect(isMarker(null)).toBe(false);
    });

    it('isMarkerOnly requires the trimmed value to be exactly one marker', () => {
      expect(isMarkerOnly(m0)).toBe(true);
      expect(isMarkerOnly(`  \n${m1}\n  `)).toBe(true);
      expect(isMarkerOnly(`a${m0}`)).toBe(false);
      expect(isMarkerOnly(`${m0}${m1}`)).toBe(false);
      expect(isMarkerOnly('plain')).toBe(false);
      expect(isMarkerOnly(undefined)).toBe(false);
    });
  });

  describe('isPartAttr', () => {
    it('treats spread and directive attributes as parts', () => {
      expect(isPartAttr({ type: TAttrType.spread, name: 'x' })).toBe(true);
      expect(isPartAttr({ type: TAttrType.directive, name: m0 })).toBe(true);
    });

    it('treats any attribute holding a marker value as a part', () => {
      expect(
        isPartAttr({
          type: TAttrType.attribute,
          name: 'class',
          value: `a ${m0}`,
        })
      ).toBe(true);
      expect(
        isPartAttr({ type: TAttrType.property, name: 'value', value: m1 })
      ).toBe(true);
    });

    it('treats static attributes as non parts', () => {
      expect(
        isPartAttr({ type: TAttrType.attribute, name: 'class', value: 'a' })
      ).toBe(false);
      expect(isPartAttr({ type: TAttrType.boolean, name: 'disabled' })).toBe(
        false
      );
    });
  });

  describe('isSVG', () => {
    it('is true only for the svg template type', () => {
      expect(isSVG(TemplateLiteralsType.svg)).toBe(true);
      expect(isSVG(TemplateLiteralsType.html)).toBe(false);
      expect(isSVG(TemplateLiteralsType.css)).toBe(false);
    });
  });

  describe('getAttrType', () => {
    it('resolves every attribute type', () => {
      expect(getAttrType(m0)).toBe(TAttrType.directive);
      expect(getAttrType(`...${m0}`)).toBe(TAttrType.spread);
      expect(getAttrType('.value')).toBe(TAttrType.property);
      expect(getAttrType('@click')).toBe(TAttrType.event);
      expect(getAttrType('onclick')).toBe(TAttrType.event);
      expect(getAttrType('?disabled')).toBe(TAttrType.boolean);
      expect(getAttrType('class')).toBe(TAttrType.attribute);
    });

    it('classifies any `on` prefixed attribute as an event', () => {
      expect(getAttrType('only')).toBe(TAttrType.event);
    });
  });

  describe('getAttrName', () => {
    it('strips the prefix belonging to each attribute type', () => {
      expect(getAttrName(`...${m0}`)).toBe(m0);
      expect(getAttrName(m0)).toBe(m0);
      expect(getAttrName('.value')).toBe('value');
      expect(getAttrName('@click')).toBe('click');
      expect(getAttrName('?disabled')).toBe('disabled');
      expect(getAttrName('onclick')).toBe('click');
      expect(getAttrName('class')).toBe('class');
    });
  });

  describe('getMarkers', () => {
    it('returns an empty list when there is no marker', () => {
      expect(getMarkers('color: red;')).toEqual([]);
    });

    it('returns every marker with its value index', () => {
      expect(getMarkers(`${m0} b ${m1}`)).toEqual([
        [m0, 0],
        [m1, 1],
      ]);
    });

    it('returns repeated markers once per occurrence', () => {
      expect(getMarkers(`${m0}-${m0}`)).toEqual([
        [m0, 0],
        [m0, 0],
      ]);
    });

    it('resets the shared regexp state between calls', () => {
      const value = `${m0}${m1}`;
      expect(getMarkers(value)).toEqual(getMarkers(value));
    });

    it('parses multi digit indexes', () => {
      expect(getMarkers(createMarker(123))).toEqual([[createMarker(123), 123]]);
    });
  });
});
