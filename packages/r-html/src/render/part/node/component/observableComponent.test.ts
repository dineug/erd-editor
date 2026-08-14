import { afterEach, describe, expect, it, vi } from 'vitest';

import { observable } from '@/observable';
import { nextTick } from '@/observable/scheduler';
import { render } from '@/render';
import { createAttributeDirective } from '@/render/directives/attributeDirective';
import { fragmentHostBridge } from '@/render/host';
import type { Part } from '@/render/part';
import {
  onBeforeFirstUpdate,
  onBeforeMount,
  onBeforeUpdate,
  onFirstUpdated,
  onMounted,
  onUnmounted,
  onUpdated,
} from '@/render/part/node/component/hooks';
import {
  Context,
  FC,
  ObservableComponentPart,
} from '@/render/part/node/component/observableComponent';
import { DOMTemplateLiterals } from '@/template';
import { html } from '@/template/html';
import { TNode } from '@/template/tNode';

const containers: HTMLElement[] = [];

function createContainer() {
  const container = document.createElement('div');
  document.body.append(container);
  containers.push(container);
  return container;
}

function componentTNode(tl: DOMTemplateLiterals): TNode {
  return (tl.template.node.children as TNode[])[0];
}

function createHarness(tl: DOMTemplateLiterals, root?: Node) {
  const parent = root ?? createContainer();
  const startNode = document.createComment('');
  const endNode = document.createComment('');
  parent.appendChild(startNode);
  parent.appendChild(endNode);

  const attrParts: Part[] = [];
  const part = new ObservableComponentPart(
    startNode,
    endNode,
    componentTNode(tl),
    attrParts
  );
  const commit = (values: any[]) => {
    attrParts.forEach(p => p.commit(values));
    part.commit(values);
  };

  return { attrParts, commit, endNode, parent, part, startNode };
}

afterEach(() => {
  let container = containers.pop();
  while (container) {
    render(container, null);
    container.remove();
    container = containers.pop();
  }
});

describe('ObservableComponentPart', () => {
  it('renders the component template between its markers', () => {
    const Comp: FC<any, any> = () => () => html`<b>rendered</b>`;
    const tl = html`<${Comp} />`;
    const { commit, parent, startNode, endNode } = createHarness(tl);

    commit(tl.values);

    const b = (parent as HTMLElement).querySelector('b') as HTMLElement;
    expect(b.textContent).toBe('rendered');
    expect(parent.firstChild).toBe(startNode);
    expect(parent.lastChild).toBe(endNode);
  });

  it('seeds props from static attributes', () => {
    const seen: any[] = [];
    const Comp: FC<any, any> = props => {
      seen.push({ name: props.name, flag: props.flag, off: props.off });
      return () => html`<i>${props.name}</i>`;
    };
    const tl = html`<${Comp} name="static" ?flag="true" ?off="false" />`;
    const { commit, parent } = createHarness(tl);

    commit(tl.values);

    expect(seen).toEqual([{ name: 'static', flag: true, off: false }]);
    expect(parent.textContent).toBe('static');
  });

  it('re-renders when a bound prop changes', async () => {
    const renderCount = vi.fn();
    const Comp: FC<any, any> = props => () => {
      renderCount();
      return html`<i>${props.value}</i>`;
    };
    const tpl = (value: string) => html`<${Comp} .value=${value} />`;
    const first = tpl('one');
    const { commit, parent } = createHarness(first);

    commit(first.values);
    expect(parent.textContent).toBe('one');
    expect(renderCount).toHaveBeenCalledTimes(1);

    commit(tpl('two').values);
    await nextTick(() => {});

    expect(parent.textContent).toBe('two');
    expect(renderCount).toHaveBeenCalledTimes(2);
  });

  it('applies spread attributes onto the props', () => {
    const Comp: FC<any, any> = props => () =>
      html`<i>${props.a}-${props.b}</i>`;
    const tl = html`<${Comp} ...${{ a: 1, b: 2 }} />`;
    const { commit, parent } = createHarness(tl);

    commit(tl.values);

    expect(parent.textContent).toBe('1-2');
  });

  it('routes ctx.dispatchEvent through the event attributes', () => {
    const handler = vi.fn();
    let fire: (() => boolean) | null = null;
    const Comp: FC<any, any> = (_props, ctx) => {
      fire = () => ctx.dispatchEvent(new CustomEvent('ping', { detail: 7 }));
      return () => html`<i>event</i>`;
    };
    const tl = html`<${Comp} @ping=${handler} />`;
    const { commit } = createHarness(tl);

    commit(tl.values);
    const dispatched = (fire as unknown as () => boolean)();

    expect(dispatched).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toBe(7);
  });

  it('passes the component context to attribute directives', () => {
    const calls: Array<[any, string]> = [];
    const directive = createAttributeDirective(
      (value: string) => value,
      ({ node }) =>
        value => {
          calls.push([node, value]);
        }
    );
    const Comp: FC<any, any> = () => () => html`<i>directive</i>`;
    const tl = html`<${Comp} ${directive('dir-value')} />`;
    const { commit } = createHarness(tl);

    commit(tl.values);

    expect(calls.length).toBe(1);
    expect(calls[0][1]).toBe('dir-value');
    expect(calls[0][0].host).toBe(document.body);
  });

  it('re-commits and destroys directive parts of an already mounted component', async () => {
    const applied: string[] = [];
    const disposed: string[] = [];
    const directive = createAttributeDirective(
      (value: string) => value,
      () => value => {
        applied.push(value);
        return () => disposed.push(value);
      }
    );
    const Comp: FC<any, any> = props => () => html`<i>${props.value}</i>`;
    const tpl = (value: string) =>
      html`<${Comp} ${directive(value)} .value=${value} />`;
    const first = tpl('one');
    const { commit, part, parent } = createHarness(first);

    commit(first.values);
    expect(applied).toEqual(['one']);

    commit(tpl('two').values);
    await nextTick(() => {});
    expect(parent.textContent).toBe('two');
    expect(applied).toEqual(['one', 'two']);
    expect(disposed).toEqual(['one']);

    part.destroy();

    expect(disposed).toEqual(['one', 'two']);
  });

  it('exposes document.body as host and the live parentElement', () => {
    let ctx: Context | null = null;
    const Comp: FC<any, any> = (_props, c) => {
      ctx = c;
      return () => html`<i>ctx</i>`;
    };
    const tl = html`<${Comp} />`;
    const { commit, parent } = createHarness(tl);

    commit(tl.values);

    const context = ctx as unknown as Context;
    expect(context.host).toBe(document.body);
    expect(context.parentElement).toBe(parent);
  });

  it('uses the shadow root host as ctx.host', () => {
    const hostElement = createContainer();
    const shadowRoot = hostElement.attachShadow({ mode: 'open' });
    let ctx: Context | null = null;
    const Comp: FC<any, any> = (_props, c) => {
      ctx = c;
      return () => html`<i>shadow</i>`;
    };
    const tl = html`<${Comp} />`;
    const { commit } = createHarness(tl, shadowRoot);

    commit(tl.values);

    expect((ctx as unknown as Context).host).toBe(hostElement);
    expect(shadowRoot.querySelector('i')?.textContent).toBe('shadow');
  });

  it('uses the bridged fragment host as ctx.host', () => {
    const hostElement = createContainer();
    const shadowRoot = hostElement.attachShadow({ mode: 'open' });
    const fragment = document.createDocumentFragment();
    const unbridge = fragmentHostBridge(fragment, shadowRoot);
    let ctx: Context | null = null;
    const Comp: FC<any, any> = (_props, c) => {
      ctx = c;
      return () => html`<i>fragment</i>`;
    };
    const tl = html`<${Comp} />`;
    const { commit } = createHarness(tl, fragment);

    commit(tl.values);

    expect((ctx as unknown as Context).host).toBe(hostElement);
    unbridge();
  });

  it('falls back to document.body for a fragment without a host', () => {
    const fragment = document.createDocumentFragment();
    let ctx: Context | null = null;
    const Comp: FC<any, any> = (_props, c) => {
      ctx = c;
      return () => html`<i>orphan</i>`;
    };
    const tl = html`<${Comp} />`;
    const { commit } = createHarness(tl, fragment);

    commit(tl.values);

    expect((ctx as unknown as Context).host).toBe(document.body);
    expect(fragment.textContent).toBe('orphan');
  });

  it('ignores values that are not functions', () => {
    const tl = html`<${'not-a-component' as any} />`;
    const { commit, parent } = createHarness(tl);

    commit(tl.values);

    expect(parent.textContent).toBe('');
  });

  it('creates the component only once for the same function reference', async () => {
    const factory = vi.fn();
    const Comp: FC<any, any> = props => {
      factory();
      return () => html`<i>${props.value}</i>`;
    };
    const tpl = (value: string) => html`<${Comp} .value=${value} />`;
    const first = tpl('a');
    const { commit, parent } = createHarness(first);

    commit(first.values);
    commit(tpl('b').values);
    await nextTick(() => {});

    expect(factory).toHaveBeenCalledTimes(1);
    expect(parent.textContent).toBe('b');
  });

  it('unmounts the previous component when the function changes', () => {
    const unmounted = vi.fn();
    const A: FC<any, any> = () => {
      onUnmounted(unmounted);
      return () => html`<i>A</i>`;
    };
    const B: FC<any, any> = () => () => html`<i>B</i>`;
    const tpl = (C: FC<any, any>) => html`<${C} />`;
    const first = tpl(A);
    const { commit, parent } = createHarness(first);

    commit(first.values);
    expect(parent.textContent).toBe('A');

    commit(tpl(B).values);

    expect(unmounted).toHaveBeenCalledTimes(1);
    expect(parent.textContent).toBe('B');
  });

  it('runs the lifecycle hooks in order', async () => {
    const order: string[] = [];
    const Comp: FC<any, any> = props => {
      onBeforeMount(() => order.push('beforeMount'));
      onMounted(() => order.push('mounted'));
      onUnmounted(() => order.push('unmounted'));
      onBeforeFirstUpdate(() => order.push('beforeFirstUpdate'));
      onBeforeUpdate(() => order.push('beforeUpdate'));
      onFirstUpdated(() => order.push('firstUpdated'));
      onUpdated(() => order.push('updated'));
      return () => html`<i>${props.value}</i>`;
    };
    const tpl = (value: string) => html`<${Comp} .value=${value} />`;
    const first = tpl('1');
    const { commit, part } = createHarness(first);

    commit(first.values);
    expect(order).toEqual([
      'beforeMount',
      'beforeFirstUpdate',
      'firstUpdated',
      'mounted',
    ]);

    commit(tpl('2').values);
    await nextTick(() => {});
    expect(order.slice(4)).toEqual(['beforeUpdate', 'updated']);

    part.destroy();
    expect(order.slice(6)).toEqual(['unmounted']);
  });

  it('swaps the inner part when the rendered value type changes', async () => {
    const state = observable({ rich: false });
    const Comp: FC<any, any> = () => () =>
      state.rich ? html`<b>rich</b>` : 'plain';
    const tl = html`<${Comp} />`;
    const { commit, parent } = createHarness(tl);

    commit(tl.values);
    expect(parent.textContent).toBe('plain');
    expect((parent as HTMLElement).querySelector('b')).toBeNull();

    state.rich = true;
    await nextTick(() => {});

    expect((parent as HTMLElement).querySelector('b')?.textContent).toBe(
      'rich'
    );
    expect(parent.textContent).toBe('rich');
  });

  it('stops reacting to observables after destroy', async () => {
    const state = observable({ value: 'before' });
    const renderCount = vi.fn();
    const Comp: FC<any, any> = () => () => {
      renderCount();
      return html`<i>${state.value}</i>`;
    };
    const tl = html`<${Comp} />`;
    const { commit, part, parent, startNode, endNode } = createHarness(tl);

    commit(tl.values);
    expect(parent.textContent).toBe('before');

    part.destroy();
    expect(parent.childNodes.length).toBe(2);
    expect(parent.firstChild).toBe(startNode);
    expect(parent.lastChild).toBe(endNode);

    state.value = 'after';
    await nextTick(() => {});

    expect(renderCount).toHaveBeenCalledTimes(1);
    expect(parent.textContent).toBe('');
  });

  it('does not remount the same component after destroy', () => {
    // destroy() never resets the cached component reference, so committing the
    // same function again keeps hitting the "already mounted" early return.
    const Comp: FC<any, any> = () => () => html`<i>again</i>`;
    const tl = html`<${Comp} />`;
    const { commit, part, parent } = createHarness(tl);

    commit(tl.values);
    part.destroy();
    expect(parent.textContent).toBe('');

    commit(tl.values);

    expect(parent.textContent).toBe('');
  });

  it('mounts a different component after destroy', () => {
    const A: FC<any, any> = () => () => html`<i>A</i>`;
    const B: FC<any, any> = () => () => html`<i>B</i>`;
    const tpl = (C: FC<any, any>) => html`<${C} />`;
    const first = tpl(A);
    const { commit, part, parent } = createHarness(first);

    commit(first.values);
    part.destroy();
    expect(parent.textContent).toBe('');

    commit(tpl(B).values);

    expect(parent.textContent).toBe('B');
  });
});
