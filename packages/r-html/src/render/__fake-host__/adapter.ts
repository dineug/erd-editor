import {
  createFakeNode,
  detach,
  dispatchFakeEvent,
  FakeNode,
  insertInto,
  isFakeNode,
} from '@/render/__fake-host__/tree';
import type { HostAdapter } from '@/render/adapter';
import type { Context } from '@/render/part/node/component/observableComponent';

export type FakeHostOps = Record<string, number>;

export interface FakeHost {
  adapter: HostAdapter;
  ops: FakeHostOps;
  resetOps(): void;
}

function countCalls(adapter: HostAdapter, ops: FakeHostOps): HostAdapter {
  const counted: Record<string, any> = {};

  for (const name of Object.keys(adapter)) {
    const method = Reflect.get(adapter, name) as (...args: any[]) => any;
    ops[name] = 0;
    counted[name] = (...args: any[]) => {
      ops[name] += 1;
      ops.total += 1;
      return method(...args);
    };
  }

  return counted as HostAdapter;
}

/**
 * A host that is not the DOM, built only from what the adapter contract says a
 * host owes. Every call it receives is counted, so a spec can assert the shape
 * of the work rather than the wall clock.
 */
export function createFakeHost(): FakeHost {
  const bridges = new Map<FakeNode, FakeNode>();

  const rootOf = (node: FakeNode): FakeNode => {
    let current = node;
    while (current.parent) current = current.parent;
    return bridges.get(current) ?? current;
  };

  const adapter: HostAdapter = {
    createElement: (name: string) => createFakeNode('element', name),
    createText: (value: string) => createFakeNode('text', '', value),
    createMarker: (value: string) => createFakeNode('marker', '', value),
    createFragment: () => createFakeNode('fragment'),
    createEventBus: () => createFakeNode('eventBus'),

    insertBefore(newChild: FakeNode, refChild: FakeNode) {
      if (!refChild.parent) return;

      insertInto(refChild.parent, newChild, refChild);
    },
    appendChild(parent: FakeNode, newChild: FakeNode) {
      insertInto(parent, newChild, null);
    },
    prependChild(parent: FakeNode, newChild: FakeNode) {
      insertInto(parent, newChild, parent.first);
    },
    removeChild(node: FakeNode) {
      detach(node);
    },
    parentOf: (node: FakeNode) => node.parent,
    nextSiblingOf: (node: FakeNode) => node.next,

    setText(node: FakeNode, value: string) {
      node.data = value;
    },
    setAttribute(
      node: FakeNode,
      name: string,
      value: any,
      isSingleMarker: boolean
    ) {
      node.attrs.set(name, isSingleMarker ? value : String(value));
    },
    removeAttribute(node: FakeNode, name: string) {
      node.attrs.delete(name);
    },

    isHostNode: isFakeNode,
    isMarker: (value: any): value is FakeNode =>
      isFakeNode(value) && value.kind === 'marker',
    isText: (value: any): value is FakeNode =>
      isFakeNode(value) && value.kind === 'text',
    isElement: (value: any): value is FakeNode =>
      isFakeNode(value) && value.kind === 'element',
    isFragment: (value: any): value is FakeNode =>
      isFakeNode(value) && value.kind === 'fragment',

    addEventListener(
      node: FakeNode,
      type: string,
      listener: any,
      options?: any
    ) {
      node.listeners.push({ type, listener, options });
    },
    removeEventListener(
      node: FakeNode,
      type: string,
      listener: any,
      options?: any
    ) {
      const { listeners } = node;
      const index = listeners.findIndex(
        entry =>
          entry.type === type &&
          entry.listener === listener &&
          entry.options === options
      );

      index === -1 || listeners.splice(index, 1);
    },

    getRoot: rootOf,
    createComponentContext(startNode: FakeNode, eventBus: FakeNode): Context {
      return {
        host: rootOf(startNode) as unknown as HTMLElement,
        get parentElement() {
          return startNode.parent as unknown as HTMLElement | null;
        },
        dispatchEvent: (event: Event) => dispatchFakeEvent(eventBus, event),
      };
    },
    bridgeFragment(fragment: FakeNode, root: FakeNode) {
      bridges.set(fragment, root);

      return () => {
        bridges.delete(fragment);
      };
    },
  };

  const ops: FakeHostOps = { total: 0 };
  const counted = countCalls(adapter, ops);

  return {
    adapter: counted,
    ops,
    resetOps: () => {
      for (const name of Object.keys(ops)) {
        ops[name] = 0;
      }
    },
  };
}
