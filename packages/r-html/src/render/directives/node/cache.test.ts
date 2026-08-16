import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  contextSubscribeEvent,
  contextUnsubscribeEvent,
  createContext,
} from '@/context/createContext';
import { html, nextTick, render } from '@/index';
import { cache } from '@/render/directives/node/cache';
import { getFragmentHost } from '@/render/host';

const hosts: HTMLElement[] = [];

function createHost(useShadow = false) {
  const container = document.createElement('div');
  document.body.append(container);
  hosts.push(container);

  const root: Element | ShadowRoot = useShadow
    ? container.attachShadow({ mode: 'open' })
    : container;
  const startNode = document.createComment('');
  const endNode = document.createComment('');
  root.append(startNode, endNode);

  const directive = cache(null)[1]({ startNode, endNode });
  const commit = (value: any) => directive(cache(value)[0]);

  return { container, root, startNode, endNode, commit };
}

const viewA = () => html`<p class="a">A</p>`;
const viewB = () => html`<p class="b">B</p>`;
const counter = (n: number) => html`<span class="count">${n}</span>`;

afterEach(() => {
  hosts.splice(0).forEach(host => host.remove());
});

describe('cache directive', () => {
  it('renders a primitive value between the markers', () => {
    const { root, commit } = createHost();

    commit('a');

    expect(root.textContent).toBe('a');
  });

  it('swaps rendered content when the value changes', () => {
    const { root, commit } = createHost();

    commit('a');
    commit('b');

    expect(root.textContent).toBe('b');
  });

  it('restores the cached nodes of a previously seen primitive', () => {
    const { root, commit } = createHost();

    commit('a');
    commit('b');
    commit('a');

    expect(root.textContent).toBe('a');
  });

  it('keeps the same DOM nodes when a cached template comes back', () => {
    const { root, commit } = createHost();

    commit(viewA());
    const firstA = root.querySelector('p.a');
    expect(firstA?.textContent).toBe('A');

    commit(viewB());
    expect(root.querySelector('p.a')).toBeNull();
    expect(root.querySelector('p.b')?.textContent).toBe('B');

    commit(viewA());
    expect(root.querySelector('p.a')).toBe(firstA);
    expect(root.querySelector('p.b')).toBeNull();
  });

  it('re-commits values into the cached part on the way back', () => {
    const { root, commit } = createHost();

    commit(counter(1));
    const span = root.querySelector('span.count');
    expect(span?.textContent).toBe('1');

    commit(viewB());
    commit(counter(2));

    expect(root.querySelector('span.count')).toBe(span);
    expect(span?.textContent).toBe('2');
  });

  it('does not move anything when the same template key is committed twice', () => {
    const { root, commit } = createHost();

    commit(counter(1));
    const span = root.querySelector('span.count');

    commit(counter(5));

    expect(root.querySelector('span.count')).toBe(span);
    expect(span?.textContent).toBe('5');
    expect(root.textContent).toBe('5');
  });

  it('keys template literals by their strings, not by object identity', () => {
    const { root, commit } = createHost();

    commit(counter(1));
    commit(counter(2));
    commit(counter(3));

    expect(root.querySelectorAll('span.count')).toHaveLength(1);
    expect(root.textContent).toBe('3');
  });

  it('clears every cached part and the live nodes on destroy', () => {
    const { root, startNode, endNode, commit } = createHost();

    commit(viewA());
    commit(viewB());
    const destroy = commit(viewA()) as () => void;

    destroy();

    expect(root.textContent).toBe('');
    expect(root.querySelector('p.a')).toBeNull();
    expect(root.firstChild).toBe(startNode);
    expect(root.lastChild).toBe(endNode);
  });

  it('rebuilds parts after a destroy because the cache was reset', () => {
    const { root, commit } = createHost();

    commit(viewA());
    const firstA = root.querySelector('p.a');
    const destroy = commit(viewA()) as () => void;
    destroy();

    commit(viewA());

    const secondA = root.querySelector('p.a');
    expect(secondA).not.toBeNull();
    expect(secondA).not.toBe(firstA);
  });

  it('bridges the host element onto the parked fragment', () => {
    const { container, root, commit } = createHost(true);

    commit(viewA());
    const parked = root.querySelector('p.a') as HTMLElement;
    commit(viewB());

    const fragment = parked.getRootNode();
    expect(fragment).toBeInstanceOf(DocumentFragment);
    expect(getFragmentHost(fragment as DocumentFragment)).toBe(container);
  });

  it('forwards context events from a parked fragment to the root node', () => {
    const { root, commit } = createHost(true);

    commit(viewA());
    const parked = root.querySelector('p.a') as HTMLElement;
    commit(viewB());

    const subscribed: Array<CustomEvent<any>> = [];
    const unsubscribed: Array<CustomEvent<any>> = [];
    root.addEventListener(contextSubscribeEvent.type, event =>
      subscribed.push(event as CustomEvent)
    );
    root.addEventListener(contextUnsubscribeEvent.type, event =>
      unsubscribed.push(event as CustomEvent)
    );

    const detail = { context: createContext(1), observer: () => {} };
    parked.dispatchEvent(contextSubscribeEvent(detail));
    parked.dispatchEvent(contextUnsubscribeEvent(detail));

    expect(subscribed).toHaveLength(1);
    expect(subscribed[0].detail).toBe(detail);
    expect(unsubscribed).toHaveLength(1);
    expect(unsubscribed[0].detail).toBe(detail);
  });

  it('stops forwarding context events once destroyed', () => {
    const { root, commit } = createHost(true);

    commit(viewA());
    const parked = root.querySelector('p.a') as HTMLElement;
    const destroy = commit(viewB()) as () => void;

    const subscribed: Array<CustomEvent<any>> = [];
    root.addEventListener(contextSubscribeEvent.type, event =>
      subscribed.push(event as CustomEvent)
    );

    destroy();
    parked.dispatchEvent(
      contextSubscribeEvent({ context: createContext(1), observer: () => {} })
    );

    expect(subscribed).toHaveLength(0);
  });

  it('renders through the template pipeline and cleans up on unmount', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const view = (value: any) => html`<div>${cache(value)}</div>`;

    render(container, view(viewA()));
    await nextTick(() => {});
    const firstA = container.querySelector('p.a');
    expect(firstA?.textContent).toBe('A');

    render(container, view(viewB()));
    await nextTick(() => {});
    expect(container.querySelector('p.b')?.textContent).toBe('B');

    render(container, view(viewA()));
    await nextTick(() => {});
    expect(container.querySelector('p.a')).toBe(firstA);

    render(container, null);
    expect(container.textContent).toBe('');
    container.remove();
  });
});
