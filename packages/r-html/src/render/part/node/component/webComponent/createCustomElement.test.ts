import { afterEach, describe, expect, expectTypeOf, it } from 'vite-plus/test';

import { nextTick } from '@/observable/scheduler';
import {
  createCustomElement,
  CustomElementClass,
  defineCustomElement,
} from '@/render/part/node/component/webComponent';
import { Options } from '@/render/part/node/component/webComponent/helper';
import { html } from '@/template/html';

interface ProbeElement extends HTMLElement {
  message: string;
}

let uid = 0;
const trash: Element[] = [];

const nextName = () => `x-cce-${++uid}`;

const mount = (el: HTMLElement) => {
  document.body.append(el);
  trash.push(el);
  return el;
};

afterEach(() => {
  trash.splice(0).forEach(el => el.remove());
});

describe('createCustomElement', () => {
  it('returns the element class without registering a tag', () => {
    const name = nextName();
    const ElementClass = createCustomElement({
      render: () => () => html`<i></i>`,
    });

    expect(ElementClass).toBeTypeOf('function');
    expect(ElementClass.prototype).toBeInstanceOf(HTMLElement);
    expect(customElements.get(name)).toBeUndefined();
    expect(customElements.getName(ElementClass)).toBeNull();
  });

  it('throws a TypeError when constructed before it is defined', () => {
    const ElementClass = createCustomElement({
      render: () => () => html`<i></i>`,
    });

    expect(() => new ElementClass()).toThrow(TypeError);
  });

  it('renders into an open shadow root once the caller defines it', () => {
    const name = nextName();
    const ProbeElement = createCustomElement<{ message: string }, ProbeElement>(
      {
        observedProps: { message: { type: String, default: 'hello' } },
        render: props => () => html`<span>${props.message}</span>`,
      }
    );

    customElements.define(name, ProbeElement);

    expect(customElements.get(name)).toBe(ProbeElement);

    const el = mount(document.createElement(name));

    expect(el).toBeInstanceOf(ProbeElement);
    expect(el.shadowRoot?.querySelector('span')?.textContent).toBe('hello');
  });

  it('builds an element with new after it is defined', async () => {
    const name = nextName();
    const ProbeElement = createCustomElement<{ message: string }, ProbeElement>(
      {
        observedProps: { message: { type: String, default: 'first' } },
        render: props => () => html`<span>${props.message}</span>`,
      }
    );
    customElements.define(name, ProbeElement);

    const el = new ProbeElement();
    mount(el);

    expect(el.localName).toBe(name);
    expect(el.message).toBe('first');

    el.message = 'second';
    await nextTick(() => {});

    expect(el.shadowRoot?.querySelector('span')?.textContent).toBe('second');
  });

  it('lists observed attributes in both camelCase and kebab-case', () => {
    const ElementClass = createCustomElement({
      observedProps: { myValue: String, flag: Boolean },
      render: () => () => html`<i></i>`,
    });

    expect(ElementClass.observedAttributes).toEqual([
      'myValue',
      'flag',
      'my-value',
    ]);
  });

  it('defaults the shadow option to "open" on the options it is given', () => {
    const options: Options<any, any> = { render: () => () => html`<i></i>` };

    createCustomElement(options);

    expect(options.shadow).toBe('open');
  });

  it('keeps a closed shadow root hidden from the element', () => {
    const name = nextName();
    const ElementClass = createCustomElement({
      shadow: 'closed',
      render: () => () => html`<span>closed</span>`,
    });
    customElements.define(name, ElementClass);

    const el = mount(document.createElement(name));

    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector('span')).toBeNull();
  });

  it('returns a new class on every call', () => {
    const options: Options<any, any> = { render: () => () => html`<i></i>` };
    const first = createCustomElement(options);
    const second = createCustomElement(options);
    const firstName = nextName();
    const secondName = nextName();

    customElements.define(firstName, first);
    customElements.define(secondName, second);

    expect(first).not.toBe(second);
    expect(customElements.get(firstName)).toBe(first);
    expect(customElements.get(secondName)).toBe(second);
  });

  it('types the class by the element interface it is given', () => {
    const ProbeElement = createCustomElement<{ message: string }, ProbeElement>(
      { render: () => () => html`<i></i>` }
    );
    const PlainElement = createCustomElement({
      render: () => () => html`<i></i>`,
    });

    expectTypeOf(ProbeElement).toEqualTypeOf<
      CustomElementClass<ProbeElement>
    >();
    expectTypeOf<
      InstanceType<typeof ProbeElement>
    >().toEqualTypeOf<ProbeElement>();
    expectTypeOf(PlainElement).toEqualTypeOf<CustomElementClass<HTMLElement>>();
    expectTypeOf(defineCustomElement).returns.toEqualTypeOf<void>();
  });
});

describe('defineCustomElement', () => {
  it('registers a class that createCustomElement would build', () => {
    const name = nextName();

    defineCustomElement(name, {
      observedProps: { myValue: Number },
      render: () => () => html`<i></i>`,
    });

    const ElementClass = customElements.get(name) as CustomElementClass;

    expect(ElementClass.observedAttributes).toEqual(['myValue', 'my-value']);
    expect(customElements.getName(ElementClass)).toBe(name);
  });
});
