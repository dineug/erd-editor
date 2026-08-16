import { describe, expect, it } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { VNodeType } from '@/parser/vNode';
import {
  camelCase,
  createNode,
  equalValues,
  insertAfterNode,
  insertBeforeNode,
  isEqualShallowObject,
  isEventTuple,
  isHTMLElement,
  isNode,
  isPromise,
  isSvgElement,
  isTruthy,
  kebabCase,
  noop,
  rangeNodes,
  removeNode,
  setAttr,
  setProps,
} from '@/render/helper';
import { TNode } from '@/template/tNode';

const tNode = (type: VNodeType, value: string) =>
  ({ type, value }) as unknown as TNode;

describe('render/helper', () => {
  describe('createNode', () => {
    it('creates an HTML element for element nodes', () => {
      const node = createNode(tNode(VNodeType.element, 'div'));

      expect(node).toBeInstanceOf(HTMLElement);
      expect((node as HTMLElement).tagName).toBe('DIV');
      expect((node as HTMLElement).namespaceURI).toBe(
        'http://www.w3.org/1999/xhtml'
      );
    });

    it('creates an SVG namespaced element when isSvg is true', () => {
      const node = createNode(tNode(VNodeType.element, 'circle'), true);

      expect((node as Element).namespaceURI).toBe('http://www.w3.org/2000/svg');
      expect((node as Element).tagName).toBe('circle');
    });

    it('creates a text node for text nodes', () => {
      const node = createNode(tNode(VNodeType.text, 'hello'));

      expect(node.nodeType).toBe(Node.TEXT_NODE);
      expect(node.textContent).toBe('hello');
    });

    it('creates a comment node for comment nodes and for unknown types', () => {
      const comment = createNode(tNode(VNodeType.comment, 'marker'));
      const unknown = createNode(tNode('nope' as VNodeType, 'fallback'));

      expect(comment.nodeType).toBe(Node.COMMENT_NODE);
      expect(comment.textContent).toBe('marker');
      expect(unknown.nodeType).toBe(Node.COMMENT_NODE);
      expect(unknown.textContent).toBe('fallback');
    });

    it('ignores isSvg for text nodes', () => {
      const node = createNode(tNode(VNodeType.text, 'x'), true);
      expect(node.nodeType).toBe(Node.TEXT_NODE);
    });
  });

  describe('isTruthy', () => {
    it('treats non-empty strings other than "false" as truthy', () => {
      expect(isTruthy('true')).toBe(true);
      expect(isTruthy('0')).toBe(true);
      expect(isTruthy(' ')).toBe(true);
    });

    it('treats empty, null, undefined and the literal "false" as falsy', () => {
      expect(isTruthy('')).toBe(false);
      expect(isTruthy(null)).toBe(false);
      expect(isTruthy(undefined)).toBe(false);
      expect(isTruthy('false')).toBe(false);
    });
  });

  describe('setAttr', () => {
    it('sets a plain attribute, coercing a missing value to an empty string', () => {
      const node = document.createElement('div');

      setAttr(node, { type: TAttrType.attribute, name: 'id', value: 'a' });
      setAttr(node, { type: TAttrType.attribute, name: 'title' });

      expect(node.getAttribute('id')).toBe('a');
      expect(node.getAttribute('title')).toBe('');
    });

    it('sets a boolean attribute only when the value is truthy', () => {
      const node = document.createElement('input');

      setAttr(node, { type: TAttrType.boolean, name: 'disabled', value: 'x' });
      setAttr(node, {
        type: TAttrType.boolean,
        name: 'readonly',
        value: 'false',
      });

      expect(node.getAttribute('disabled')).toBe('');
      expect(node.hasAttribute('readonly')).toBe(false);
    });

    it('sets a property instead of an attribute for property attrs', () => {
      const node = document.createElement('input');

      setAttr(node, { type: TAttrType.property, name: 'value', value: 'text' });

      expect(node.value).toBe('text');
      expect(node.hasAttribute('value')).toBe(false);
    });

    it('does nothing for attr types it does not handle', () => {
      const node = document.createElement('div');

      setAttr(node, { type: TAttrType.event, name: 'click', value: 'x' });
      setAttr(node, { type: TAttrType.spread, name: 'spread', value: 'x' });
      setAttr(node, { type: TAttrType.directive, name: 'd', value: 'x' });

      expect(node.attributes.length).toBe(0);
    });
  });

  describe('setProps', () => {
    it('copies attribute and property attrs verbatim', () => {
      const props: any = {};

      setProps(props, { type: TAttrType.attribute, name: 'id', value: 'a' });
      setProps(props, { type: TAttrType.property, name: 'value', value: 'b' });
      setProps(props, { type: TAttrType.attribute, name: 'empty' });

      expect(props).toEqual({ id: 'a', value: 'b', empty: undefined });
      expect(Object.keys(props)).toEqual(['id', 'value', 'empty']);
    });

    it('coerces boolean attrs through isTruthy', () => {
      const props: any = {};

      setProps(props, { type: TAttrType.boolean, name: 'on', value: 'yes' });
      setProps(props, { type: TAttrType.boolean, name: 'off', value: 'false' });
      setProps(props, { type: TAttrType.boolean, name: 'none' });

      expect(props).toEqual({ on: true, off: false, none: false });
    });

    it('ignores event, spread and directive attrs', () => {
      const props: any = {};

      setProps(props, { type: TAttrType.event, name: 'click', value: 'x' });
      setProps(props, { type: TAttrType.spread, name: 's', value: 'x' });
      setProps(props, { type: TAttrType.directive, name: 'd', value: 'x' });

      expect(props).toEqual({});
    });
  });

  describe('equalValues', () => {
    it('compares length and identity of each element', () => {
      const ref = {};

      expect(equalValues([1, 'a', ref], [1, 'a', ref])).toBe(true);
      expect(equalValues([], [])).toBe(true);
      expect(equalValues([1], [1, 2])).toBe(false);
      expect(equalValues([{}], [{}])).toBe(false);
    });

    it('uses strict equality so NaN is never equal', () => {
      expect(equalValues([NaN], [NaN])).toBe(false);
    });
  });

  describe('isEqualShallowObject', () => {
    it('short-circuits on reference equality, even for primitives', () => {
      const ref = { a: 1 };

      expect(isEqualShallowObject(ref, ref)).toBe(true);
      expect(isEqualShallowObject(1, 1)).toBe(true);
      expect(isEqualShallowObject(null, null)).toBe(true);
    });

    it('compares own enumerable keys one level deep', () => {
      expect(isEqualShallowObject({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(isEqualShallowObject({ a: 1 }, { a: 2 })).toBe(false);
      expect(isEqualShallowObject({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(isEqualShallowObject({ a: {} }, { a: {} })).toBe(false);
    });

    it('treats non-object operands as empty objects', () => {
      expect(isEqualShallowObject(null, {})).toBe(true);
      expect(isEqualShallowObject(1, 'a')).toBe(true);
      expect(isEqualShallowObject([1], {})).toBe(true);
      expect(isEqualShallowObject(undefined, { a: 1 })).toBe(false);
    });
  });

  describe('isEventTuple', () => {
    it('accepts [listener] with no options or with boolean/object options', () => {
      expect(isEventTuple([noop] as any)).toBe(true);
      expect(isEventTuple([noop, true] as any)).toBe(true);
      expect(isEventTuple([noop, { capture: true }] as any)).toBe(true);
    });

    it('rejects non-arrays, non-function heads and invalid options', () => {
      expect(isEventTuple(noop as any)).toBe(false);
      expect(isEventTuple(['click'] as any)).toBe(false);
      expect(isEventTuple([noop, 'capture'] as any)).toBe(false);
      expect(isEventTuple([noop, null] as any)).toBe(false);
    });
  });

  describe('insertBeforeNode / insertAfterNode', () => {
    it('inserts before the reference node', () => {
      const parent = document.createElement('div');
      const ref = document.createElement('span');
      parent.append(ref);

      insertBeforeNode(document.createElement('b'), ref);

      expect(parent.innerHTML).toBe('<b></b><span></span>');
    });

    it('inserts after the reference node when it has a next sibling', () => {
      const parent = document.createElement('div');
      const ref = document.createElement('span');
      const tail = document.createElement('i');
      parent.append(ref, tail);

      insertAfterNode(document.createElement('b'), ref);

      expect(parent.innerHTML).toBe('<span></span><b></b><i></i>');
    });

    it('appends when the reference node is the last child', () => {
      const parent = document.createElement('div');
      const ref = document.createElement('span');
      parent.append(ref);

      insertAfterNode(document.createElement('b'), ref);

      expect(parent.innerHTML).toBe('<span></span><b></b>');
    });

    it('is a no-op when the reference node has no parent', () => {
      const detached = document.createElement('span');
      const newChild = document.createElement('b');

      insertBeforeNode(newChild, detached);
      insertAfterNode(newChild, detached);

      expect(detached.parentNode).toBeNull();
      expect(newChild.parentNode).toBeNull();
    });
  });

  describe('removeNode', () => {
    it('removes the node from its parent and returns the removed node', () => {
      const parent = document.createElement('div');
      const child = document.createElement('span');
      parent.append(child);

      expect(removeNode(child)).toBe(child);
      expect(parent.childNodes.length).toBe(0);
    });

    it('returns null for a detached node', () => {
      expect(removeNode(document.createElement('span'))).toBeNull();
    });
  });

  describe('rangeNodes', () => {
    it('collects the siblings strictly between the two markers', () => {
      const parent = document.createElement('div');
      const start = document.createComment('s');
      const a = document.createElement('a');
      const b = document.createTextNode('b');
      const end = document.createComment('e');
      const after = document.createElement('i');
      parent.append(start, a, b, end, after);

      expect(rangeNodes(start, end)).toEqual([a, b]);
    });

    it('returns an empty array for adjacent markers', () => {
      const parent = document.createElement('div');
      const start = document.createComment('s');
      const end = document.createComment('e');
      parent.append(start, end);

      expect(rangeNodes(start, end)).toEqual([]);
    });

    it('walks to the end of the sibling list when the end node is unreachable', () => {
      const parent = document.createElement('div');
      const start = document.createComment('s');
      const a = document.createElement('a');
      parent.append(start, a);

      expect(rangeNodes(start, document.createComment('e'))).toEqual([a]);
    });
  });

  describe('type guards', () => {
    it('isNode matches any DOM node', () => {
      expect(isNode(document.createElement('div'))).toBe(true);
      expect(isNode(document.createTextNode('t'))).toBe(true);
      expect(isNode(document.createDocumentFragment())).toBe(true);
      expect(isNode({ nodeType: 1 })).toBe(false);
      expect(isNode(null)).toBe(false);
    });

    it('isHTMLElement only matches HTML elements', () => {
      expect(isHTMLElement(document.createElement('div'))).toBe(true);
      expect(
        isHTMLElement(
          document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        )
      ).toBe(false);
      expect(isHTMLElement(document.createTextNode('t'))).toBe(false);
    });

    it('isSvgElement only matches SVG elements', () => {
      expect(
        isSvgElement(
          document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        )
      ).toBe(true);
      expect(isSvgElement(document.createElement('div'))).toBe(false);
    });

    it('isPromise matches real promises only', () => {
      expect(isPromise(Promise.resolve())).toBe(true);
      expect(isPromise({ then: noop })).toBe(false);
      expect(isPromise(undefined)).toBe(false);
    });
  });

  describe('noop', () => {
    it('returns undefined and takes no arguments', () => {
      expect(noop()).toBeUndefined();
      expect(noop.length).toBe(0);
    });
  });

  describe('kebabCase', () => {
    it('splits camelCase and PascalCase words', () => {
      expect(kebabCase('backgroundColor')).toBe('background-color');
      expect(kebabCase('MyComponent')).toBe('my-component');
    });

    it('keeps consecutive capitals together as one acronym word', () => {
      expect(kebabCase('XMLHttpRequest')).toBe('xml-http-request');
      expect(kebabCase('ABC')).toBe('abc');
      expect(kebabCase('A')).toBe('a');
    });

    it('handles digits, separators and already-kebab input', () => {
      expect(kebabCase('h1Title')).toBe('h1-title');
      expect(kebabCase('fooBar2Baz')).toBe('foo-bar2-baz');
      expect(kebabCase('my_snake_case')).toBe('my-snake-case');
      expect(kebabCase('already-kebab')).toBe('already-kebab');
    });

    it('returns an empty string when nothing matches', () => {
      expect(kebabCase('')).toBe('');
      expect(kebabCase('!!!')).toBe('');
    });
  });

  describe('camelCase', () => {
    it('joins dash, underscore and whitespace separated words', () => {
      expect(camelCase('background-color')).toBe('backgroundColor');
      expect(camelCase('foo_bar baz')).toBe('fooBarBaz');
      expect(camelCase('data-testId')).toBe('dataTestId');
    });

    it('lowercases a leading capital', () => {
      expect(camelCase('Foo')).toBe('foo');
      expect(camelCase('ABC')).toBe('aBC');
    });

    it('leaves single lowercase words untouched and drops a leading separator', () => {
      expect(camelCase('already')).toBe('already');
      expect(camelCase('')).toBe('');
      expect(camelCase('-x')).toBe('X');
    });
  });
});
