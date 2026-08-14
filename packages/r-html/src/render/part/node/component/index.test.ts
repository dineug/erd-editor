import { afterEach, describe, expect, it, vi } from 'vitest';

import { nextTick } from '@/observable/scheduler';
import { render } from '@/render';
import type { Part } from '@/render/part';
import { ComponentPart } from '@/render/part/node/component';
import { onUnmounted } from '@/render/part/node/component/hooks';
import type { FC } from '@/render/part/node/component/observableComponent';
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

function mount(container: HTMLElement, tl: DOMTemplateLiterals) {
  const node = document.createComment('');
  container.append(node);
  const parts: Part[] = [];
  const part = new ComponentPart(node, componentTNode(tl), parts);
  const commit = (values: any[]) => {
    parts.forEach(p => p.commit(values));
    part.commit(values);
  };
  commit(tl.values);
  return { node, part, commit };
}

afterEach(() => {
  let container = containers.pop();
  while (container) {
    render(container, null);
    container.remove();
    container = containers.pop();
  }
});

describe('ComponentPart', () => {
  it('replaces the placeholder comment with start/end markers', () => {
    const container = createContainer();
    const Comp: FC<any, any> = () => () => html`<b>hi</b>`;
    const tl = html`<${Comp} />`;

    const { node } = mount(container, tl);

    expect(node.parentNode).toBeNull();
    expect(container.firstChild?.nodeType).toBe(Node.COMMENT_NODE);
    expect(container.lastChild?.nodeType).toBe(Node.COMMENT_NODE);
    expect(container.querySelector('b')?.textContent).toBe('hi');
  });

  it('forwards committed values to the component props', async () => {
    const container = createContainer();
    const Comp: FC<any, any> = props => () => html`<i>${props.value}</i>`;
    const tpl = (value: string) => html`<${Comp} .value=${value} />`;

    const { commit } = mount(container, tpl('one'));
    expect(container.textContent).toBe('one');

    commit(tpl('two').values);
    await nextTick(() => {});

    expect(container.textContent).toBe('two');
  });

  it('removes its markers and content on destroy', () => {
    const container = createContainer();
    const unmounted = vi.fn();
    const Comp: FC<any, any> = () => {
      onUnmounted(unmounted);
      return () => html`<b>bye</b>`;
    };
    const tl = html`<${Comp} />`;

    const { part } = mount(container, tl);
    expect(container.childNodes.length).toBeGreaterThan(0);

    part.destroy?.();

    expect(container.childNodes.length).toBe(0);
    expect(unmounted).toHaveBeenCalledTimes(1);
  });

  it('does nothing on construction when the placeholder is detached', () => {
    const node = document.createComment('');
    const Comp: FC<any, any> = () => () => html`<b>detached</b>`;
    const tl = html`<${Comp} />`;
    const parts: Part[] = [];

    const part = new ComponentPart(node, componentTNode(tl), parts);

    expect(node.parentNode).toBeNull();
    expect(() => part.destroy?.()).not.toThrow();
  });

  it('renders a component through the full render pipeline', async () => {
    const container = createContainer();
    const Child: FC<any, any> = props => () => html`<em>${props.label}</em>`;
    const Parent: FC<any, any> = props => () =>
      html`<section><${Child} .label=${props.label} /></section>`;

    render(container, html`<${Parent} .label=${'a'} />`);
    expect(container.querySelector('em')?.textContent).toBe('a');

    render(container, html`<${Parent} .label=${'b'} />`);
    await nextTick(() => {});
    await nextTick(() => {});

    expect(container.querySelector('em')?.textContent).toBe('b');

    render(container, null);
    expect(container.childNodes.length).toBe(0);
  });
});
