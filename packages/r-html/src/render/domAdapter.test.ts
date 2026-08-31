import { describe, expect, it, vi } from 'vite-plus/test';

import { TAttrType } from '@/constants';
import { contextSubscribeEvent } from '@/context/createContext';
import { domAdapter } from '@/render/domAdapter';
import { insertBeforeNode, isNode, removeNode, setAttr } from '@/render/helper';
import { getFragmentHost } from '@/render/host';

const parentWith = (...children: Node[]) => {
  const parent = document.createElement('div');
  children.forEach(child => parent.appendChild(child));
  return parent;
};

describe('domAdapter creation', () => {
  it('creates html and svg elements in the right namespace', () => {
    expect(domAdapter.createElement('div')).toBeInstanceOf(HTMLDivElement);
    expect(
      (domAdapter.createElement('rect', true) as Element).namespaceURI
    ).toBe('http://www.w3.org/2000/svg');
  });

  it('creates text nodes, markers and fragments carrying their value', () => {
    expect((domAdapter.createText('x') as Text).data).toBe('x');
    expect(domAdapter.createMarker('m')).toBeInstanceOf(Comment);
    expect((domAdapter.createMarker('m') as Comment).data).toBe('m');
    expect(domAdapter.createFragment()).toBeInstanceOf(DocumentFragment);
  });

  it('creates the event bus as a detached div', () => {
    const bus = domAdapter.createEventBus() as HTMLElement;

    expect(bus).toBeInstanceOf(HTMLDivElement);
    expect(bus.parentNode).toBeNull();
  });
});

describe('domAdapter tree', () => {
  it('inserts before a reference node exactly as insertBeforeNode does', () => {
    const ref = document.createElement('span');
    const parent = parentWith(ref);
    const node = document.createElement('b');

    domAdapter.insertBefore(node, ref);

    expect([...parent.childNodes]).toEqual([node, ref]);
  });

  it('does nothing when the reference node has no parent', () => {
    const ref = document.createElement('span');
    const node = document.createElement('b');

    expect(() => domAdapter.insertBefore(node, ref)).not.toThrow();
    expect(node.parentNode).toBeNull();
    expect(() => insertBeforeNode(node, ref)).not.toThrow();
  });

  it('appends and prepends children at the ends of the parent', () => {
    const first = document.createElement('i');
    const parent = parentWith(first);
    const appended = document.createElement('b');
    const prepended = document.createElement('u');

    domAdapter.appendChild(parent, appended);
    domAdapter.prependChild(parent, prepended);

    expect([...parent.childNodes]).toEqual([prepended, first, appended]);
  });

  it('removes a child and tolerates a detached one, as removeNode does', () => {
    const node = document.createElement('b');
    const parent = parentWith(node);

    domAdapter.removeChild(node);

    expect(parent.childNodes.length).toBe(0);
    expect(() => domAdapter.removeChild(node)).not.toThrow();
    expect(() => removeNode(node)).not.toThrow();
  });

  it('reads the parent and the next sibling', () => {
    const first = document.createElement('i');
    const second = document.createElement('b');
    const parent = parentWith(first, second);

    expect(domAdapter.parentOf(first)).toBe(parent);
    expect(domAdapter.nextSiblingOf(first)).toBe(second);
    expect(domAdapter.nextSiblingOf(second)).toBeNull();
    expect(domAdapter.parentOf(parent)).toBeNull();
  });
});

describe('domAdapter values', () => {
  it('writes text node data', () => {
    const node = document.createTextNode('');

    domAdapter.setText(node, 'hello');

    expect(node.data).toBe('hello');
  });

  it('stringifies and trims a raw single-marker value', () => {
    const el = document.createElement('div');

    domAdapter.setAttribute(el, 'data-x', ' 42 ', true);
    expect(el.getAttribute('data-x')).toBe('42');

    domAdapter.setAttribute(el, 'data-x', { a: 1 }, true);
    expect(el.getAttribute('data-x')).toBe('');
  });

  it('writes an already merged string untouched', () => {
    const el = document.createElement('div');

    domAdapter.setAttribute(el, 'data-x', 'a-b', false);

    expect(el.getAttribute('data-x')).toBe('a-b');
  });

  it('writes the same value setAttr writes for a static attribute', () => {
    const viaAdapter = document.createElement('div');
    const viaHelper = document.createElement('div');

    domAdapter.setAttribute(viaAdapter, 'id', 'foo', true);
    setAttr(viaHelper, { type: TAttrType.attribute, name: 'id', value: 'foo' });

    expect(viaAdapter.getAttribute('id')).toBe(viaHelper.getAttribute('id'));
  });

  it('removes an attribute', () => {
    const el = document.createElement('div');
    el.setAttribute('data-x', 'v');

    domAdapter.removeAttribute(el, 'data-x');

    expect(el.hasAttribute('data-x')).toBe(false);
  });
});

describe('domAdapter predicates', () => {
  it('answers isHostNode exactly as isNode does', () => {
    const values = [
      document.createElement('div'),
      document.createComment(''),
      document.createTextNode(''),
      document.createDocumentFragment(),
      'div',
      null,
      {},
    ];

    expect(values.map(value => domAdapter.isHostNode(value))).toEqual(
      values.map(value => isNode(value))
    );
  });

  it('separates markers, text, elements and fragments', () => {
    const marker = document.createComment('');
    const text = document.createTextNode('');
    const element = document.createElement('div');
    const fragment = document.createDocumentFragment();

    expect(
      [marker, text, element, fragment].map(node => [
        domAdapter.isMarker(node),
        domAdapter.isText(node),
        domAdapter.isElement(node),
        domAdapter.isFragment(node),
      ])
    ).toEqual([
      [true, false, false, false],
      [false, true, false, false],
      [false, false, true, false],
      [false, false, false, true],
    ]);
  });

  it('answers false for values that are not nodes', () => {
    expect(domAdapter.isMarker('x')).toBe(false);
    expect(domAdapter.isText(null)).toBe(false);
    expect(domAdapter.isElement({})).toBe(false);
    expect(domAdapter.isFragment(undefined)).toBe(false);
  });
});

describe('domAdapter events', () => {
  it('adds and removes a listener with its options', () => {
    const el = document.createElement('div');
    const handle = vi.fn();

    domAdapter.addEventListener(el, 'click', handle, { once: true });
    el.dispatchEvent(new Event('click'));
    el.dispatchEvent(new Event('click'));

    expect(handle).toHaveBeenCalledTimes(1);

    const always = vi.fn();
    domAdapter.addEventListener(el, 'click', always);
    domAdapter.removeEventListener(el, 'click', always);
    el.dispatchEvent(new Event('click'));

    expect(always).not.toHaveBeenCalled();
  });
});

describe('domAdapter root and context', () => {
  it('returns the root node the node belongs to', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const node = document.createElement('span');
    shadowRoot.appendChild(node);

    const detached = document.createElement('i');

    expect(domAdapter.getRoot(node)).toBe(shadowRoot);
    expect(domAdapter.getRoot(detached)).toBe(detached);
  });

  it('falls back to document.body and tracks the live parent element', () => {
    const startNode = document.createComment('');
    const parent = parentWith(startNode);
    const ctx = domAdapter.createComponentContext(
      startNode,
      document.createElement('div')
    );

    expect(ctx.host).toBe(document.body);
    expect(ctx.parentElement).toBe(parent);

    parent.removeChild(startNode);

    expect(ctx.parentElement).toBeNull();
  });

  it('resolves the host from a shadow root', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const startNode = document.createComment('');
    shadowRoot.appendChild(startNode);

    const ctx = domAdapter.createComponentContext(
      startNode,
      document.createElement('div')
    );

    expect(ctx.host).toBe(host);
  });

  it('resolves the host from a bridged fragment', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const fragment = document.createDocumentFragment();
    const startNode = document.createComment('');
    fragment.appendChild(startNode);
    domAdapter.bridgeFragment(fragment, shadowRoot);

    const ctx = domAdapter.createComponentContext(
      startNode,
      document.createElement('div')
    );

    expect(ctx.host).toBe(host);
  });

  it('keeps document.body when the fragment carries no host', () => {
    const fragment = document.createDocumentFragment();
    const startNode = document.createComment('');
    fragment.appendChild(startNode);

    const ctx = domAdapter.createComponentContext(
      startNode,
      document.createElement('div')
    );

    expect(ctx.host).toBe(document.body);
  });

  it('dispatches through the event bus it was given', () => {
    const bus = document.createElement('div');
    const handle = vi.fn();
    bus.addEventListener('click', handle);
    const ctx = domAdapter.createComponentContext(
      document.createComment(''),
      bus
    );

    ctx.dispatchEvent(new Event('click'));

    expect(handle).toHaveBeenCalledTimes(1);
  });
});

describe('domAdapter bridgeFragment', () => {
  it('installs the context bridge and the host bridge together', () => {
    const host = document.createElement('div');
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const fragment = document.createDocumentFragment();
    const handle = vi.fn();
    shadowRoot.addEventListener(contextSubscribeEvent.type, handle);

    const destroy = domAdapter.bridgeFragment(fragment, shadowRoot);

    expect(getFragmentHost(fragment)).toBe(host);
    fragment.dispatchEvent(
      contextSubscribeEvent({ context: {} as any, observer: () => {} })
    );
    expect(handle).toHaveBeenCalledTimes(1);

    destroy();

    expect(getFragmentHost(fragment)).toBeNull();
    fragment.dispatchEvent(
      contextSubscribeEvent({ context: {} as any, observer: () => {} })
    );
    expect(handle).toHaveBeenCalledTimes(1);
  });
});
