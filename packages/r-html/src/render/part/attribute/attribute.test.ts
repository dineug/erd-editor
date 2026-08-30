import { describe, expect, it, vi } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { AttributePart } from '@/render/part/attribute/attribute';
import { css } from '@/template/css';
import { createMarker } from '@/template/helper';
import { TAttr } from '@/template/tNode';

const m0 = createMarker(0);
const m1 = createMarker(1);

const attr = (name: string, value?: string): TAttr => ({
  type: TAttrType.attribute,
  name,
  value,
});

const createNsElement = () => document.createElementNS('urn:x-test', 'thing');
const createSvgElement = () =>
  document.createElementNS('http://www.w3.org/2000/svg', 'rect');

describe('AttributePart', () => {
  describe('generic attributes', () => {
    it('replaces a single marker with the committed value', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('id', m0));

      part.commit(['foo']);

      expect(el.getAttribute('id')).toBe('foo');
    });

    it('replaces every marker inside a mixed attribute value', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('data-x', `a-${m0}-${m1}`));

      part.commit(['x', 'y']);

      expect(el.getAttribute('data-x')).toBe('a-x-y');
    });

    it('reads the value from the marker index, not the argument order', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('data-x', m1));

      part.commit(['first', 'second']);

      expect(el.getAttribute('data-x')).toBe('second');
    });

    it('stringifies primitive values and trims the result', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('data-x', ` ${m0} `));

      part.commit([42]);
      expect(el.getAttribute('data-x')).toBe('42');

      part.commit([false]);
      expect(el.getAttribute('data-x')).toBe('false');

      part.commit([10n]);
      expect(el.getAttribute('data-x')).toBe('10');
    });

    it('renders null and undefined as an empty string', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('data-x', m0));

      part.commit([null]);
      expect(el.getAttribute('data-x')).toBe('');

      part.commit([undefined]);
      expect(el.getAttribute('data-x')).toBe('');
    });

    it('renders non-primitive values as an empty string', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('data-x', m0));

      part.commit([{ a: 1 }]);
      expect(el.getAttribute('data-x')).toBe('');

      part.commit([[1, 2]]);
      expect(el.getAttribute('data-x')).toBe('');

      part.commit([() => {}]);
      expect(el.getAttribute('data-x')).toBe('');
    });

    it('renders css template literals through their identifier', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('data-x', m0));
      const cssValue = css`
        color: red;
      `;

      part.commit([cssValue]);

      expect(el.getAttribute('data-x')).toBe(String(cssValue));
      expect(el.getAttribute('data-x')).not.toBe('');
    });

    it('skips the DOM write when the values did not change', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('id', m0));
      const spy = vi.spyOn(el, 'setAttribute');

      part.commit(['foo']);
      part.commit(['foo']);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the attribute holds no marker', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('id'));
      const spy = vi.spyOn(el, 'setAttribute');

      part.commit(['foo']);

      expect(spy).not.toHaveBeenCalled();
      expect(el.hasAttribute('id')).toBe(false);
    });
  });

  describe('class', () => {
    it('ignores nodes that are neither HTMLElement nor SVGElement', () => {
      const el = createNsElement();
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a']]);

      expect(el.classList.contains('a')).toBe(false);
    });

    it('applies a primitive class value, as it does inside an array', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit(['a']);

      expect([...el.classList]).toEqual(['a']);
    });

    it('adds nothing for a falsy value, and does not throw on one', () => {
      // classList.add('') is a SyntaxError, so an empty token must never
      // reach it — the same rule the array branch has always applied.
      for (const value of [null, undefined, '', false, 0]) {
        const el = document.createElement('div');
        const part = new AttributePart(el, attr('class', m0));

        expect(() => part.commit([value])).not.toThrow();
        expect(el.className).toBe('');
      }
    });

    it('adds every truthy entry of an array value', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a', '', null, undefined, false, 'b']]);

      expect([...el.classList]).toEqual(['a', 'b']);
    });

    it('flattens nested arrays', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a', ['b', ['c']]]]);

      expect([...el.classList]).toEqual(['a', 'b', 'c']);
    });

    it('adds only the truthy keys of an object value', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([{ a: true, b: 0, c: 'yes' }]);

      expect([...el.classList]).toEqual(['a', 'c']);
    });

    it('supports objects nested inside arrays', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a', { b: true, c: false }]]);

      expect([...el.classList]).toEqual(['a', 'b']);
    });

    it('drops entries that are neither primitive nor plain objects', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a', () => {}]]);

      expect([...el.classList]).toEqual(['a']);
    });

    it('uses the css identifier for css template literals', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));
      const cssValue = css`
        color: blue;
      `;

      part.commit([[cssValue]]);

      expect(el.classList.contains(String(cssValue))).toBe(true);
    });

    it('keeps the static classes and removes only the previously added ones', () => {
      const el = document.createElement('div');
      el.className = 'base';
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a']]);
      expect([...el.classList]).toEqual(['base', 'a']);

      part.commit([['b']]);
      expect([...el.classList]).toEqual(['base', 'b']);
    });

    it('keeps classes that are present in both the previous and next list', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a', 'b']]);
      part.commit([['b', 'c']]);

      expect([...el.classList]).toEqual(['b', 'c']);
    });

    it('skips shallow-equal array values', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a']]);
      el.classList.remove('a');
      part.commit([['a']]);

      expect(el.classList.contains('a')).toBe(false);
    });

    it('skips shallow-equal object values', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', m0));

      part.commit([{ a: true }]);
      el.classList.remove('a');
      part.commit([{ a: true }]);

      expect(el.classList.contains('a')).toBe(false);
    });

    it('skips when the exact same reference is committed for a new marker set', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('class', `${m0}${m1}`));
      const shared = ['a'];

      part.commit([shared, shared]);
      el.classList.remove('a');
      part.commit([null, shared]);

      expect(el.classList.contains('a')).toBe(false);
    });

    it('works on svg elements', () => {
      const el = createSvgElement();
      const part = new AttributePart(el, attr('class', m0));

      part.commit([['a']]);

      expect(el.classList.contains('a')).toBe(true);
    });
  });

  describe('style', () => {
    it('ignores nodes that are neither HTMLElement nor SVGElement', () => {
      const el = createNsElement();
      const part = new AttributePart(el, attr('style', m0));

      expect(() => part.commit([{ color: 'red' }])).not.toThrow();
      expect(el.hasAttribute('style')).toBe(false);
    });

    it('applies the object entries as css properties', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('style', m0));

      part.commit([{ color: 'red', 'font-size': '10px' }]);

      expect(el.style.getPropertyValue('color')).toBe('red');
      expect(el.style.getPropertyValue('font-size')).toBe('10px');
    });

    it('does nothing on the first commit of an empty object', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('style', m0));

      part.commit([{}]);

      expect(el.getAttribute('style')).toBeFalsy();
    });

    it('keeps the inline styles that existed before the first commit', () => {
      const el = document.createElement('div');
      el.style.setProperty('color', 'blue');
      const part = new AttributePart(el, attr('style', m0));

      part.commit([{ 'font-size': '10px' }]);
      part.commit([{ margin: '1px' }]);

      expect(el.style.getPropertyValue('color')).toBe('blue');
      expect(el.style.getPropertyValue('margin')).toBe('1px');
      expect(el.style.getPropertyValue('font-size')).toBe('');
    });

    it('removes previously committed properties when a non-object is committed', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('style', m0));

      part.commit([{ color: 'red' }]);
      part.commit(['not-an-object']);

      expect(el.style.getPropertyValue('color')).toBe('');
    });

    it('skips shallow-equal style objects', () => {
      const el = document.createElement('div');
      const part = new AttributePart(el, attr('style', m0));

      part.commit([{ color: 'red' }]);
      el.style.removeProperty('color');
      part.commit([{ color: 'red' }]);

      expect(el.style.getPropertyValue('color')).toBe('');
    });

    it('works on svg elements', () => {
      const el = createSvgElement();
      const part = new AttributePart(el, attr('style', m0));

      part.commit([{ color: 'red' }]);

      expect(el.style.getPropertyValue('color')).toBe('red');
    });
  });
});
