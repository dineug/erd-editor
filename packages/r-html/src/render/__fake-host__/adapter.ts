import {
  createFakeNode,
  detach,
  dispatchFakeEvent,
  FakeNode,
  insertInto,
  isFakeNode,
} from '@/render/__fake-host__/tree';
import type { HostAdapter, HostNode } from '@/render/adapter';
import type { Context } from '@/render/part/node/component/observableComponent';

export type FakeHostOps = Record<string, number>;

export interface FakeHost {
  adapter: HostAdapter;
  ops: FakeHostOps;
  resetOps(): void;
}

const asNode = (value: HostNode) => value as FakeNode;

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

    insertBefore(newChild: HostNode, refChild: HostNode) {
      const ref = asNode(refChild);
      if (!ref.parent) return;

      insertInto(ref.parent, asNode(newChild), ref);
    },
    appendChild(parent: HostNode, newChild: HostNode) {
      insertInto(asNode(parent), asNode(newChild), null);
    },
    prependChild(parent: HostNode, newChild: HostNode) {
      const target = asNode(parent);
      insertInto(target, asNode(newChild), target.first);
    },
    removeChild(node: HostNode) {
      detach(asNode(node));
    },
    parentOf: (node: HostNode) => asNode(node).parent,
    nextSiblingOf: (node: HostNode) => asNode(node).next,

    setText(node: HostNode, value: string) {
      asNode(node).data = value;
    },
    setAttribute(
      node: HostNode,
      name: string,
      value: any,
      isSingleMarker: boolean
    ) {
      asNode(node).attrs.set(name, isSingleMarker ? value : String(value));
    },
    removeAttribute(node: HostNode, name: string) {
      asNode(node).attrs.delete(name);
    },

    isHostNode: isFakeNode,
    isMarker: (value: any): value is HostNode =>
      isFakeNode(value) && value.kind === 'marker',
    isText: (value: any): value is HostNode =>
      isFakeNode(value) && value.kind === 'text',
    isElement: (value: any): value is HostNode =>
      isFakeNode(value) && value.kind === 'element',
    isFragment: (value: any): value is HostNode =>
      isFakeNode(value) && value.kind === 'fragment',

    addEventListener(
      node: HostNode,
      type: string,
      listener: any,
      options?: any
    ) {
      asNode(node).listeners.push({ type, listener, options });
    },
    removeEventListener(
      node: HostNode,
      type: string,
      listener: any,
      options?: any
    ) {
      const listeners = asNode(node).listeners;
      const index = listeners.findIndex(
        entry =>
          entry.type === type &&
          entry.listener === listener &&
          entry.options === options
      );

      index === -1 || listeners.splice(index, 1);
    },

    getRoot: (node: HostNode) => rootOf(asNode(node)),
    createComponentContext(startNode: HostNode, eventBus: HostNode): Context {
      const start = asNode(startNode);
      const bus = asNode(eventBus);

      return {
        host: rootOf(start) as unknown as HTMLElement,
        get parentElement() {
          return start.parent as unknown as HTMLElement | null;
        },
        dispatchEvent: (event: Event) => dispatchFakeEvent(bus, event),
      };
    },
    bridgeFragment(fragment: HostNode, root: HostNode) {
      const parked = asNode(fragment);
      bridges.set(parked, asNode(root));

      return () => {
        bridges.delete(parked);
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
