import { describe, expect, it, vi } from 'vite-plus/test';

import { observable } from '@/observable';
import { nextTick } from '@/observable/scheduler';
import {
  childrenOf,
  createFakeHost,
  createFakeNode,
  dispatchFakeEvent,
  FakeNode,
  serialize,
  textOf,
} from '@/render/__fake-host__';
import { createRef, Ref, ref } from '@/render/directives/attribute/ref';
import { cache } from '@/render/directives/node/cache';
import { repeat } from '@/render/directives/node/repeat';
import {
  createNodeDirectiveProps,
  NodeDirectiveProps,
} from '@/render/directives/nodeDirective';
import { createHostHelper } from '@/render/helper';
import { createHostTemplate } from '@/render/hostTemplate';
import {
  onBeforeFirstUpdate,
  onBeforeMount,
  onBeforeUpdate,
  onFirstUpdated,
  onMounted,
  onUnmounted,
  onUpdated,
} from '@/render/part/node/component/hooks';
import type { FC } from '@/render/part/node/component/observableComponent';
import { html, svg } from '@/template/html';

type RefTuple = [
  Ref<any>,
  (props: { node: any }) => (value: Ref<any>) => (() => void) | void,
];

type CacheTuple = [
  any,
  (props: NodeDirectiveProps) => (value: any) => (() => void) | void,
];

const asRefTuple = (value: unknown) => value as unknown as RefTuple;

const asCacheTuple = (value: unknown) => value as unknown as CacheTuple;

function createDriver() {
  const host = createFakeHost();
  const template = createHostTemplate<FakeNode>(host.adapter);

  return {
    adapter: host.adapter,
    ops: host.ops,
    render: template.render,
    resetOps: host.resetOps,
    root: createFakeNode('element', 'root'),
  };
}

const contents = (node: FakeNode) => childrenOf(node).map(serialize).join('');

function findAll(
  node: FakeNode,
  name: string,
  found: FakeNode[] = []
): FakeNode[] {
  for (const child of childrenOf(node)) {
    child.kind === 'element' && child.name === name && found.push(child);
    findAll(child, name, found);
  }

  return found;
}

const findOne = (node: FakeNode, name: string) => findAll(node, name)[0];

const positionsIn = (nodes: any[], reference: any[]) =>
  nodes.map(node => reference.indexOf(node));

const identity = (length: number) =>
  Array.from({ length }, (_, index) => index);

const rowsOf = (items: string[]) =>
  repeat(
    items,
    item => item,
    item => html`<row>${item}</row>`
  );

const listView = (items: string[]) => html`<list>${rowsOf(items)}</list>`;

describe('fake host node creation', () => {
  it('creates one host element per tag and one host text node per static text', () => {
    const { ops, render, root } = createDriver();

    render(root, html`<box><label>hi</label></box>`);

    expect(contents(root)).toBe('#<box><label>hi</label></box>#');
    expect(ops.createElement).toBe(2);
    expect(ops.createText).toBe(1);
    expect(ops.createFragment).toBe(1);
  });

  it('creates a host marker for every part boundary', () => {
    const { ops, render, root } = createDriver();

    render(root, html`<box>${'x'}</box>`);

    expect(contents(root)).toBe('#<box>#x#</box>#');
    expect(ops.createMarker).toBe(4);
  });

  it('creates a transient host text node for the interpolation marker itself and removes it once the part owns the range', () => {
    const { ops, render, root } = createDriver();

    render(root, html`<box>${'x'}</box>`);

    expect(ops.createText).toBe(2);
    expect(ops.removeChild).toBe(1);
    expect(textOf(root)).toBe('x');
  });
});

describe('fake host insertion and removal', () => {
  it('inserts a node for each added item and leaves the standing ones alone', () => {
    const { ops, render, resetOps, root } = createDriver();

    render(root, listView(['a', 'b']));
    const before = findAll(root, 'row');
    resetOps();

    render(root, listView(['a', 'b', 'c']));

    const after = findAll(root, 'row');
    expect(after.map(textOf)).toEqual(['a', 'b', 'c']);
    expect(positionsIn(after.slice(0, 2), before)).toEqual([0, 1]);
    expect(ops.createElement).toBe(1);
  });

  it('removes only the nodes of a dropped item', () => {
    const { ops, render, resetOps, root } = createDriver();

    render(root, listView(['a', 'b', 'c']));
    const before = findAll(root, 'row');
    resetOps();

    render(root, listView(['a', 'c']));

    const after = findAll(root, 'row');
    expect(after.map(textOf)).toEqual(['a', 'c']);
    expect(positionsIn(after, before)).toEqual([0, 2]);
    expect(ops.createElement).toBe(0);
    expect(ops.removeChild).toBeGreaterThan(0);
  });

  it('empties the container when the template goes away', () => {
    const { render, root } = createDriver();

    render(root, listView(['a', 'b']));
    render(root, null);

    expect(childrenOf(root)).toHaveLength(0);
  });
});

describe('fake host keyed repeat', () => {
  it('reorders by moving the existing host nodes, never by rebuilding them', () => {
    const { ops, render, resetOps, root } = createDriver();

    render(root, listView(['a', 'b', 'c', 'd']));
    const before = findAll(root, 'row');
    resetOps();

    render(root, listView(['d', 'c', 'b', 'a']));

    const after = findAll(root, 'row');
    expect(after.map(textOf)).toEqual(['d', 'c', 'b', 'a']);
    expect(positionsIn(after, before)).toEqual([3, 2, 1, 0]);
    expect(ops.createElement).toBe(0);
    expect(ops.createMarker).toBe(0);
    expect(ops.createText).toBe(0);
    expect(ops.removeChild).toBe(0);
  });

  it('leaves the markers of a reordered list where a fresh render of that order would put them', () => {
    const moved = createDriver();
    const fresh = createDriver();

    moved.render(moved.root, listView(['a', 'b', 'c']));
    moved.render(moved.root, listView(['c', 'a', 'b']));
    fresh.render(fresh.root, listView(['c', 'a', 'b']));

    expect(contents(moved.root)).toBe(contents(fresh.root));
  });
});

describe('fake host attribute diff', () => {
  it('hands the committed value to the host raw when the attribute is one whole marker', () => {
    const { render, root } = createDriver();

    render(root, html`<box data-x=${42}></box>`);

    expect(findOne(root, 'box').attrs.get('data-x')).toBe(42);
  });

  it('merges the markers into a string when the attribute holds more than one', () => {
    const { render, root } = createDriver();

    render(root, html`<box data-x="a-${1}-${2}"></box>`);

    expect(findOne(root, 'box').attrs.get('data-x')).toBe('a-1-2');
  });

  it('skips the host write when the committed values did not change', () => {
    const { ops, render, resetOps, root } = createDriver();
    const view = (id: string) => html`<box data-x=${id}></box>`;

    render(root, view('a'));
    resetOps();
    render(root, view('a'));

    expect(ops.setAttribute).toBe(0);

    render(root, view('b'));

    expect(ops.setAttribute).toBe(1);
    expect(findOne(root, 'box').attrs.get('data-x')).toBe('b');
  });

  it('removes the attribute through the host when a boolean binding turns falsy', () => {
    const { ops, render, resetOps, root } = createDriver();
    const view = (on: boolean) => html`<box ?hidden=${on}></box>`;

    render(root, view(true));

    expect(findOne(root, 'box').attrs.get('hidden')).toBe('');

    resetOps();
    render(root, view(false));

    expect(findOne(root, 'box').attrs.has('hidden')).toBe(false);
    expect(ops.removeAttribute).toBe(1);
  });

  it('writes a static attribute through the host as a string', () => {
    const { render, root } = createDriver();

    render(root, html`<box id="a"></box>`);

    expect(findOne(root, 'box').attrs.get('id')).toBe('a');
  });
});

describe('fake host events', () => {
  it('binds, rebinds and unbinds a handler through the host', () => {
    const { ops, render, resetOps, root } = createDriver();
    const first = vi.fn();
    const second = vi.fn();
    const view = (handle: () => void) => html`<box @click=${handle}></box>`;

    render(root, view(first));
    const box = findOne(root, 'box');
    dispatchFakeEvent(box, { type: 'click' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(box.listeners).toHaveLength(1);

    resetOps();
    render(root, view(second));
    dispatchFakeEvent(box, { type: 'click' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(ops.addEventListener).toBe(1);
    expect(ops.removeEventListener).toBe(1);

    render(root, null);

    expect(box.listeners).toHaveLength(0);
  });

  it('leaves an unrelated event type untouched', () => {
    const { render, root } = createDriver();
    const handle = vi.fn();

    render(root, html`<box @click=${handle}></box>`);
    dispatchFakeEvent(findOne(root, 'box'), { type: 'blur' });

    expect(handle).not.toHaveBeenCalled();
  });
});

describe('fake host conditional rendering', () => {
  const alpha = () => html`<alpha>a</alpha>`;
  const beta = () => html`<beta>b</beta>`;

  it('swaps the rendered branch when the condition flips', () => {
    const { render, root } = createDriver();
    const view = (flag: boolean) => html`<box>${flag ? alpha() : beta()}</box>`;

    render(root, view(true));

    expect(contents(root)).toBe('#<box>#<alpha>a</alpha>#</box>#');

    render(root, view(false));

    expect(contents(root)).toBe('#<box>#<beta>b</beta>#</box>#');
    expect(findAll(root, 'alpha')).toHaveLength(0);
  });

  it('drops the branch entirely when the condition yields nothing', () => {
    const { render, root } = createDriver();
    const view = (flag: boolean) => html`<box>${flag ? alpha() : null}</box>`;

    render(root, view(true));
    render(root, view(false));

    expect(contents(root)).toBe('#<box>##</box>#');
  });
});

describe('fake host component lifecycle', () => {
  it('runs every lifecycle hook in order over the host tree', async () => {
    const { render, root } = createDriver();
    const calls: string[] = [];
    const state = observable({ text: 'a' });
    const Comp: FC<any, any> = () => {
      onBeforeMount(() => calls.push('beforeMount'));
      onMounted(() => calls.push('mounted'));
      onUnmounted(() => calls.push('unmounted'));
      onBeforeFirstUpdate(() => calls.push('beforeFirstUpdate'));
      onFirstUpdated(() => calls.push('firstUpdated'));
      onBeforeUpdate(() => calls.push('beforeUpdate'));
      onUpdated(() => calls.push('updated'));
      return () => html`<span>${state.text}</span>`;
    };

    render(root, html`<${Comp} />`);

    expect(calls).toEqual([
      'beforeMount',
      'beforeFirstUpdate',
      'firstUpdated',
      'mounted',
    ]);
    expect(textOf(root)).toBe('a');

    state.text = 'b';
    await nextTick(() => {});

    expect(calls.slice(4)).toEqual(['beforeUpdate', 'updated']);
    expect(textOf(root)).toBe('b');

    render(root, null);

    expect(calls.at(-1)).toBe('unmounted');
    expect(childrenOf(root)).toHaveLength(0);
  });

  it('builds the component context and its event bus from the host', () => {
    const { ops, render, root } = createDriver();
    const seen: Array<any> = [];
    const handle = vi.fn();
    const Comp: FC<any, any> = (_props, ctx) => {
      seen.push(ctx);
      return () => html`<span>ok</span>`;
    };

    render(root, html`<${Comp} @ping=${handle} />`);

    expect(ops.createEventBus).toBe(1);
    expect(ops.createComponentContext).toBe(1);
    expect(seen[0].host).toBe(root);
    expect(seen[0].parentElement).toBe(root);

    seen[0].dispatchEvent({ type: 'ping' });

    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('re-renders the component when a prop changes', async () => {
    const { render, root } = createDriver();
    const Comp: FC<any, any> = props => () => html`<span>${props.label}</span>`;
    const view = (label: string) => html`<${Comp} .label=${label} />`;

    render(root, view('one'));

    expect(textOf(root)).toBe('one');

    render(root, view('two'));
    await nextTick(() => {});

    expect(textOf(root)).toBe('two');
  });
});

describe('fake host ref directive', () => {
  it('hands the host node to a ref and clears it on destroy', () => {
    const { render, root } = createDriver();
    const boxRef = createRef<FakeNode>();

    render(root, html`<box ${ref(boxRef)}></box>`);

    expect(boxRef.value).toBe(findOne(root, 'box'));

    render(root, null);

    expect(boxRef.value).toBeNull();
  });

  it('binds the host node the directive creator was built with', () => {
    const { adapter } = createFakeHost();
    const node = adapter.createElement('box') as FakeNode;
    const boxRef = createRef<FakeNode>();

    asRefTuple(ref(boxRef))[1]({ node })(boxRef);

    expect(boxRef.value).toBe(node);
  });
});

function createCacheDriver() {
  const host = createFakeHost();
  const helper = createHostHelper(host.adapter);
  const root = createFakeNode('element', 'root');
  const startNode = host.adapter.createMarker('') as FakeNode;
  const endNode = host.adapter.createMarker('') as FakeNode;

  host.adapter.appendChild(root, startNode);
  host.adapter.appendChild(root, endNode);

  const directive = asCacheTuple(cache(null))[1](
    createNodeDirectiveProps(startNode, endNode, helper)
  );

  return {
    adapter: host.adapter,
    commit: (value: any) => directive(asCacheTuple(cache(value))[0]),
    endNode,
    helper,
    root,
    startNode,
  };
}

const cachedRows = (items: string[]) =>
  html`<head-row></head-row>${rowsOf(items)}<foot-row></foot-row>`;

describe('fake host cache directive', () => {
  it('swaps a cached branch out and hands the same nodes back', () => {
    const { commit, root } = createCacheDriver();
    const alpha = () => html`<alpha>a</alpha>`;
    const beta = () => html`<beta>b</beta>`;

    commit(alpha());
    const first = findOne(root, 'alpha');

    commit(beta());

    expect(findAll(root, 'alpha')).toHaveLength(0);
    expect(textOf(root)).toBe('b');

    commit(alpha());

    expect(findOne(root, 'alpha')).toBe(first);
    expect(textOf(root)).toBe('a');
  });

  it('parks the whole range into one fragment that answers as a parent', () => {
    const { adapter, commit, endNode, helper, startNode } = createCacheDriver();

    commit(cachedRows(['a', 'b', 'c']));
    const before = helper.rangeNodes(startNode, endNode) as FakeNode[];
    const markers = before.filter(node => node.kind === 'marker');
    const elements = before.filter(node => node.kind === 'element');

    expect(markers.length).toBeGreaterThan(0);
    expect(elements.length).toBeGreaterThan(0);

    commit(html`<other></other>`);
    const parked = before[0].parent as FakeNode;

    expect(adapter.isFragment(parked)).toBe(true);
    expect(before.every(node => node.parent === parked)).toBe(true);
    expect(positionsIn(childrenOf(parked), before)).toEqual(
      identity(before.length)
    );
  });

  it('restores the parked range with its markers and nodes in the same order', () => {
    const { commit, endNode, helper, startNode } = createCacheDriver();

    commit(cachedRows(['a', 'b', 'c']));
    const before = helper.rangeNodes(startNode, endNode) as FakeNode[];

    commit(html`<other></other>`);
    commit(cachedRows(['a', 'b', 'c']));
    const after = helper.rangeNodes(startNode, endNode) as FakeNode[];

    expect(after).toHaveLength(before.length);
    expect(positionsIn(after, before)).toEqual(identity(before.length));
  });
});

describe('fake host fragment splice', () => {
  function createSpliceFixture() {
    const { adapter } = createFakeHost();
    const parent = createFakeNode('element', 'parent');
    const fragment = adapter.createFragment() as FakeNode;
    const first = adapter.createElement('first') as FakeNode;
    const second = adapter.createElement('second') as FakeNode;

    adapter.appendChild(fragment, first);
    adapter.appendChild(fragment, second);

    return { adapter, first, fragment, parent, second };
  }

  it('splices the children of a fragment on appendChild and leaves it empty', () => {
    const { adapter, first, fragment, parent, second } = createSpliceFixture();

    adapter.appendChild(parent, fragment);

    expect(positionsIn(childrenOf(parent), [first, second])).toEqual([0, 1]);
    expect(childrenOf(fragment)).toHaveLength(0);
  });

  it('splices the children of a fragment on insertBefore at the reference', () => {
    const { adapter, first, fragment, parent, second } = createSpliceFixture();
    const anchor = adapter.createElement('anchor') as FakeNode;
    adapter.appendChild(parent, anchor);

    adapter.insertBefore(fragment, anchor);

    expect(positionsIn(childrenOf(parent), [first, second, anchor])).toEqual([
      0, 1, 2,
    ]);
    expect(childrenOf(fragment)).toHaveLength(0);
  });

  it('splices the children of a fragment on prependChild at the front', () => {
    const { adapter, first, fragment, parent, second } = createSpliceFixture();
    const anchor = adapter.createElement('anchor') as FakeNode;
    adapter.appendChild(parent, anchor);

    adapter.prependChild(parent, fragment);

    expect(positionsIn(childrenOf(parent), [first, second, anchor])).toEqual([
      0, 1, 2,
    ]);
    expect(childrenOf(fragment)).toHaveLength(0);
  });

  it('inserts the node itself when it is not a fragment', () => {
    const { adapter, first, fragment, parent, second } = createSpliceFixture();

    adapter.appendChild(parent, first);

    expect(positionsIn(childrenOf(parent), [first])).toEqual([0]);
    expect(positionsIn(childrenOf(fragment), [second])).toEqual([0]);
  });

  it('treats an insert before the node itself as a no-op, the way the DOM does', () => {
    const { adapter, first, fragment, second } = createSpliceFixture();

    adapter.insertBefore(first, first);

    expect(positionsIn(childrenOf(fragment), [first, second])).toEqual([0, 1]);
  });

  it('ignores an insert next to a node that has no parent', () => {
    const { adapter, parent } = createSpliceFixture();
    const orphan = adapter.createElement('orphan') as FakeNode;
    const node = adapter.createElement('node') as FakeNode;

    adapter.insertBefore(node, orphan);

    expect(node.parent).toBeNull();
    expect(childrenOf(parent)).toHaveLength(0);
  });
});

describe('fake host discrimination and roots', () => {
  it('answers its own discriminators for the nodes it creates', () => {
    const { adapter } = createFakeHost();

    expect(adapter.isHostNode(adapter.createElement('box'))).toBe(true);
    expect(adapter.isHostNode({})).toBe(false);
    expect(adapter.isElement(adapter.createElement('box'))).toBe(true);
    expect(adapter.isText(adapter.createText('x'))).toBe(true);
    expect(adapter.isMarker(adapter.createMarker(''))).toBe(true);
    expect(adapter.isFragment(adapter.createFragment())).toBe(true);
    expect(adapter.isElement(adapter.createMarker(''))).toBe(false);
  });

  it('keeps a parked fragment answering for the root it was bridged to', () => {
    const { adapter } = createFakeHost();
    const root = createFakeNode('element', 'root');
    const fragment = adapter.createFragment() as FakeNode;
    const node = adapter.createElement('box') as FakeNode;
    adapter.appendChild(fragment, node);

    expect(adapter.getRoot(node)).toBe(fragment);

    const unbridge = adapter.bridgeFragment(fragment, root);

    expect(adapter.getRoot(node)).toBe(root);

    unbridge();

    expect(adapter.getRoot(node)).toBe(fragment);
  });

  it('walks the sibling chain and the parent link the way rangeNodes needs', () => {
    const { adapter } = createFakeHost();
    const helper = createHostHelper(adapter);
    const parent = createFakeNode('element', 'parent');
    const startNode = adapter.createMarker('') as FakeNode;
    const middle = adapter.createElement('middle') as FakeNode;
    const endNode = adapter.createMarker('') as FakeNode;

    adapter.appendChild(parent, startNode);
    adapter.appendChild(parent, middle);
    adapter.appendChild(parent, endNode);

    expect(
      positionsIn(helper.rangeNodes(startNode, endNode), [middle])
    ).toEqual([0]);
    expect(adapter.nextSiblingOf(endNode)).toBeNull();
    expect(adapter.parentOf(middle)).toBe(parent);
    expect(adapter.parentOf(parent)).toBeNull();
    expect(helper.removeNode(parent)).toBeNull();
  });

  it('sets text through the host and serializes it back', () => {
    const { adapter } = createFakeHost();
    const node = adapter.createText('a') as FakeNode;

    adapter.setText(node, 'b');

    expect(node.data).toBe('b');
    expect(serialize(node)).toBe('b');
  });

  it('hands back the shared tags beside its own render', () => {
    const template = createHostTemplate<FakeNode>(createFakeHost().adapter);

    expect(template.html).toBe(html);
    expect(template.svg).toBe(svg);
    expect(typeof template.render).toBe('function');
  });
});

describe('fake host reconciliation cost', () => {
  const numbersOf = (length: number) =>
    Array.from({ length }, (_, index) => index);

  const numberView = (items: number[]) =>
    html`<list
      >${repeat(
        items,
        item => item,
        item => item
      )}</list
    >`;

  function measure(size: number) {
    const { ops, render, resetOps, root } = createDriver();
    const items = numbersOf(size);

    resetOps();
    render(root, numberView(items));
    const insert = ops.total;
    const list = findOne(root, 'list');
    const inserted = textOf(list);

    resetOps();
    render(root, numberView([...items].reverse()));

    return {
      hostNodes: childrenOf(list).length,
      insert,
      inserted,
      reordered: textOf(list),
      reorder: {
        createMarker: ops.createMarker,
        createText: ops.createText,
        removeChild: ops.removeChild,
        total: ops.total,
      },
    };
  }

  it('keeps the host work of inserting 1000 nodes within a constant per node', () => {
    const { hostNodes, insert, inserted } = measure(1000);

    expect(inserted.startsWith('01234')).toBe(true);
    expect(hostNodes).toBe(1000 * 3 + 2);
    expect(insert).toBeGreaterThan(1000 * 5);
    expect(insert).toBeLessThanOrEqual(1000 * 40);
  });

  it('reverses 1000 nodes by moving them, never by rebuilding them', () => {
    const { reorder, reordered } = measure(1000);

    expect(reordered.startsWith('999998997')).toBe(true);
    expect(reorder.createMarker).toBe(0);
    expect(reorder.createText).toBe(0);
    expect(reorder.removeChild).toBe(0);
    expect(reorder.total).toBeGreaterThan(1000 * 5);
    expect(reorder.total).toBeLessThanOrEqual(1000 * 30);
  });

  it('grows host work with the node count linearly rather than quadratically', () => {
    const small = measure(250);
    const large = measure(1000);

    expect(large.insert / small.insert).toBeGreaterThan(3);
    expect(large.insert / small.insert).toBeLessThan(6);
    expect(large.reorder.total / small.reorder.total).toBeGreaterThan(3);
    expect(large.reorder.total / small.reorder.total).toBeLessThan(6);
  });
});
