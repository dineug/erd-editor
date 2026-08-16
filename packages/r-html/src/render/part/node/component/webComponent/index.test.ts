import { afterEach, describe, expect, it } from 'vite-plus/test';

import { nextTick } from '@/observable/scheduler';
import {
  onBeforeFirstUpdate,
  onBeforeMount,
  onBeforeUpdate,
  onFirstUpdated,
  onMounted,
  onUnmounted,
  onUpdated,
} from '@/render/part/node/component/hooks';
import { defineCustomElement } from '@/render/part/node/component/webComponent';
import { Options } from '@/render/part/node/component/webComponent/helper';
import { html } from '@/template/html';

let uid = 0;
const trash: Element[] = [];

const flush = () => nextTick(() => {});

const define = (options: Options<any, any>) => {
  const name = `x-wc-${++uid}`;
  defineCustomElement(name, options);
  return name;
};

const create = (name: string) => {
  const el = document.createElement(name) as HTMLElement & Record<string, any>;
  trash.push(el);
  return el;
};

const mount = (name: string) => {
  const el = create(name);
  document.body.append(el);
  return el;
};

afterEach(() => {
  trash.splice(0).forEach(el => el.remove());
});

describe('defineCustomElement', () => {
  it('registers the element and renders into an open shadow root', () => {
    const name = define({
      observedProps: { message: { type: String, default: 'hello' } },
      render: props => () => html`<span>${props.message}</span>`,
    });

    expect(customElements.get(name)).toBeTypeOf('function');

    const el = mount(name);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot?.querySelector('span')?.textContent).toBe('hello');
  });

  it('defaults the shadow option to "open"', () => {
    const options: Options<any, any> = { render: () => () => html`<i></i>` };

    define(options);

    expect(options.shadow).toBe('open');
  });

  it('renders into the element itself when shadow is disabled', () => {
    const name = define({
      shadow: false,
      render: () => () => html`<span>light</span>`,
    });
    const el = mount(name);

    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector('span')?.textContent).toBe('light');
  });

  it('hides the render root when shadow is "closed"', () => {
    const name = define({
      shadow: 'closed',
      render: () => () => html`<span>closed</span>`,
    });
    const el = mount(name);

    expect(el.shadowRoot).toBeNull();
    expect(el.querySelector('span')).toBeNull();
  });

  it('exposes observed attributes in both camelCase and kebab-case', () => {
    const name = define({
      observedProps: { myValue: String, flag: Boolean },
      render: () => () => html`<i></i>`,
    });
    const observedAttributes = (customElements.get(name) as any)
      .observedAttributes;

    expect(observedAttributes).toEqual(['myValue', 'flag', 'my-value']);
  });

  it('seeds default props from the constructor shorthand', () => {
    const name = define({
      observedProps: { n: Number, s: String, b: Boolean },
      render: props => () => html`<i>${`${props.n}|${props.s}|${props.b}`}</i>`,
    });
    const el = mount(name);

    expect(el.n).toBe(0);
    expect(el.s).toBe('');
    expect(el.b).toBe(false);
    expect(el.shadowRoot?.textContent).toContain('0||false');
  });

  it('passes the props object and the element as the render context', () => {
    let receivedProps: any = null;
    let receivedCtx: any = null;
    let thisIsCtx = false;

    const name = define({
      observedProps: { value: { type: Number, default: 3 } },
      render(props, ctx) {
        receivedProps = props;
        receivedCtx = ctx;
        thisIsCtx = (this as any) === ctx;
        return () => html`<i></i>`;
      },
    });
    const el = create(name);

    expect(receivedCtx).toBe(el);
    expect(thisIsCtx).toBe(true);
    expect(receivedProps.value).toBe(3);
  });

  it('re-renders when an observed property is assigned', async () => {
    const name = define({
      observedProps: { count: { type: Number, default: 1 } },
      render: props => () => html`<span>${props.count}</span>`,
    });
    const el = mount(name);

    expect(el.shadowRoot?.textContent).toContain('1');

    el.count = 2;

    expect(el.count).toBe(2);

    await flush();

    expect(el.shadowRoot?.textContent).toContain('2');
  });

  it('converts attributes with the declared prop types', async () => {
    const name = define({
      observedProps: {
        count: Number,
        label: String,
        flag: Boolean,
        wrapped: (value: string | null) => `[${value}]`,
      },
      render: props => () =>
        html`<i>
          ${`${props.count}/${props.label}/${props.flag}/${props.wrapped}`}
        </i>`,
    });
    const el = mount(name);

    el.setAttribute('count', '5');
    el.setAttribute('label', 'a');
    el.setAttribute('flag', 'true');
    el.setAttribute('wrapped', 'x');

    expect(el.count).toBe(5);
    expect(el.label).toBe('a');
    expect(el.flag).toBe(true);
    expect(el.wrapped).toBe('[x]');

    await flush();

    expect(el.shadowRoot?.textContent).toContain('5/a/true/[x]');
  });

  it('treats an empty boolean attribute as true and any other value as false', () => {
    const name = define({
      observedProps: { flag: Boolean },
      render: props => () => html`<i>${props.flag}</i>`,
    });
    const el = mount(name);

    el.setAttribute('flag', '');
    expect(el.flag).toBe(true);

    el.setAttribute('flag', 'false');
    expect(el.flag).toBe(false);

    el.setAttribute('flag', 'true');
    expect(el.flag).toBe(true);

    el.removeAttribute('flag');
    expect(el.flag).toBe(false);
  });

  it('converts a removed attribute by passing null to the converter', () => {
    const name = define({
      observedProps: { count: Number, label: String },
      render: () => () => html`<i></i>`,
    });
    const el = mount(name);

    el.setAttribute('count', '7');
    el.setAttribute('label', 'a');

    el.removeAttribute('count');
    el.removeAttribute('label');

    expect(el.count).toBe(0);
    expect(el.label).toBe('null');
  });

  it('maps kebab-case attributes onto camelCase props', () => {
    const name = define({
      observedProps: { myValue: Number },
      render: () => () => html`<i></i>`,
    });
    const el = mount(name);

    el.setAttribute('my-value', '11');

    expect(el.myValue).toBe(11);
  });

  it('stores the raw string when the prop has no declared type', async () => {
    const name = define({
      observedProps: ['plain'],
      render: props => () => html`<i>${props.plain}</i>`,
    });
    const el = mount(name);

    el.setAttribute('plain', 'raw');

    expect(el.plain).toBe('raw');

    await flush();

    expect(el.shadowRoot?.textContent).toContain('raw');
  });

  it('runs the lifecycle hooks in order', async () => {
    const order: string[] = [];
    const name = define({
      observedProps: { count: { type: Number, default: 0 } },
      render: props => {
        onBeforeMount(() => order.push('beforeMount'));
        onMounted(() => order.push('mounted'));
        onBeforeFirstUpdate(() => order.push('beforeFirstUpdate'));
        onFirstUpdated(() => order.push('firstUpdated'));
        onBeforeUpdate(() => order.push('beforeUpdate'));
        onUpdated(() => order.push('updated'));
        onUnmounted(() => order.push('unmounted'));
        return () => html`<i>${props.count}</i>`;
      },
    });
    const el = mount(name);

    expect(order).toEqual([
      'beforeMount',
      'beforeFirstUpdate',
      'firstUpdated',
      'mounted',
    ]);

    el.count = 1;
    await flush();

    expect(order.slice(4)).toEqual(['beforeUpdate', 'updated']);

    el.remove();

    expect(order.slice(6)).toEqual(['unmounted']);
  });

  it('stops reacting to prop changes after disconnect', async () => {
    const name = define({
      observedProps: { count: { type: Number, default: 0 } },
      render: props => () => html`<span>${props.count}</span>`,
    });
    const el = mount(name);

    expect(el.shadowRoot?.textContent).toContain('0');

    el.remove();
    el.count = 9;
    await flush();

    expect(el.shadowRoot?.textContent).toContain('0');

    document.body.append(el);
    trash.push(el);

    expect(el.shadowRoot?.textContent).toContain('9');
  });

  it('resolves host to itself in the light DOM', () => {
    const name = define({ render: () => () => html`<i></i>` });
    const el = mount(name);

    expect((el as any).host).toBe(el);
  });

  it('resolves host to the shadow host when nested in a shadow root', () => {
    const name = define({ render: () => () => html`<i></i>` });
    const wrapper = document.createElement('div');
    trash.push(wrapper);
    document.body.append(wrapper);
    const shadowRoot = wrapper.attachShadow({ mode: 'open' });
    const el = create(name);
    shadowRoot.append(el);

    expect((el as any).host).toBe(wrapper);
  });
});
