import { describe, expect, it } from 'vite-plus/test';

import { html, nextTick, render } from '@/index';
import { createRef, Ref, ref } from '@/render/directives/attribute/ref';

type RefTuple = [
  Ref<any>,
  (props: { node: any }) => (value: Ref<any>) => (() => void) | void,
];

const asTuple = (value: unknown) => value as unknown as RefTuple;

describe('createRef', () => {
  it('creates a holder with an undefined value by default', () => {
    const refObject = createRef<HTMLElement>();

    expect(refObject).toEqual({ value: undefined });
    expect('value' in refObject).toBe(true);
  });

  it('creates a holder seeded with the given value', () => {
    const node = document.createElement('span');

    expect(createRef(node).value).toBe(node);
    expect(createRef(0).value).toBe(0);
  });

  it('creates a distinct holder per call', () => {
    expect(createRef(1)).not.toBe(createRef(1));
  });
});

describe('ref directive', () => {
  it('wraps the ref object as the directive value', () => {
    const refObject = createRef<HTMLElement>();

    expect(asTuple(ref(refObject))[0]).toBe(refObject);
  });

  it('assigns the bound node to the ref object', () => {
    const node = document.createElement('div');
    const refObject = createRef<HTMLElement>();
    const directive = asTuple(ref(refObject))[1]({ node });

    const destroy = directive(refObject);

    expect(refObject.value).toBe(node);
    expect(typeof destroy).toBe('function');
  });

  it('short-circuits when the same ref object is committed again', () => {
    const node = document.createElement('div');
    const refObject = createRef<HTMLElement>();
    const directive = asTuple(ref(refObject))[1]({ node });

    directive(refObject);
    refObject.value = null as unknown as HTMLElement;
    directive(refObject);

    expect(refObject.value).toBeNull();
  });

  it('re-targets to a new ref object but leaves the previous one populated', () => {
    const node = document.createElement('div');
    const first = createRef<HTMLElement>();
    const second = createRef<HTMLElement>();
    const directive = asTuple(ref(first))[1]({ node });

    directive(first);
    directive(second);

    expect(second.value).toBe(node);
    // the implementation only clears the tracked ref on destroy, so the
    // previously bound ref keeps pointing at the node
    expect(first.value).toBe(node);
  });

  it('nulls only the currently tracked ref object on destroy', () => {
    const node = document.createElement('div');
    const first = createRef<HTMLElement>();
    const second = createRef<HTMLElement>();
    const directive = asTuple(ref(first))[1]({ node });

    directive(first);
    const destroy = directive(second) as () => void;
    destroy();

    expect(second.value).toBeNull();
    expect(first.value).toBe(node);
  });

  it('keeps destroy safe when nothing was ever tracked', () => {
    const node = document.createElement('div');
    const directive = asTuple(ref(createRef()))[1]({ node });

    const destroy = directive(null as unknown as Ref<any>) as () => void;

    expect(() => destroy()).not.toThrow();
  });

  it('binds the rendered element and releases it on unmount', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const refObject = createRef<HTMLInputElement>();

    render(container, html`<input ${ref(refObject)} />`);
    await nextTick(() => {});

    const input = container.querySelector('input');
    expect(input).not.toBeNull();
    expect(refObject.value).toBe(input);

    render(container, null);

    expect(refObject.value).toBeNull();
    container.remove();
  });
});
