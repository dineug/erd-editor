import { isObject } from '@/helpers/is-type';

const FAKE_NODE = Symbol('r-html/fake-host/node');

export type FakeNodeKind =
  | 'element'
  | 'text'
  | 'marker'
  | 'fragment'
  | 'eventBus';

export interface FakeListener {
  type: string;
  listener: Function;
  options: any;
}

/**
 * A node of the in-memory tree the fake host renders into. Siblings are a
 * doubly linked chain rather than an array so the order the adapter answers
 * for is the only order there is.
 */
export interface FakeNode {
  readonly [FAKE_NODE]: true;
  kind: FakeNodeKind;
  name: string;
  data: string;
  attrs: Map<string, any>;
  listeners: FakeListener[];
  parent: FakeNode | null;
  prev: FakeNode | null;
  next: FakeNode | null;
  first: FakeNode | null;
  last: FakeNode | null;
}

export function createFakeNode(
  kind: FakeNodeKind,
  name = '',
  data = ''
): FakeNode {
  return {
    [FAKE_NODE]: true,
    kind,
    name,
    data,
    attrs: new Map<string, any>(),
    listeners: [],
    parent: null,
    prev: null,
    next: null,
    first: null,
    last: null,
  };
}

export const isFakeNode = (value: any): value is FakeNode =>
  isObject(value) && Reflect.get(value, FAKE_NODE) === true;

export function detach(node: FakeNode) {
  const parent = node.parent;
  if (!parent) return;

  node.prev ? (node.prev.next = node.next) : (parent.first = node.next);
  node.next ? (node.next.prev = node.prev) : (parent.last = node.prev);
  node.parent = null;
  node.prev = null;
  node.next = null;
}

function link(parent: FakeNode, node: FakeNode, before: FakeNode | null) {
  detach(node);
  node.parent = parent;
  node.prev = before ? before.prev : parent.last;
  node.next = before;
  node.prev ? (node.prev.next = node) : (parent.first = node);
  node.next ? (node.next.prev = node) : (parent.last = node);
}

/**
 * The one placement primitive, and the whole of the fragment splice clause: a
 * fragment hands over its children in their current order and is left empty,
 * anything else moves itself.
 */
export function insertInto(
  parent: FakeNode,
  newChild: FakeNode,
  before: FakeNode | null
) {
  if (newChild === before) return;

  if (newChild.kind === 'fragment') {
    let child = newChild.first;

    while (child) {
      const next = child.next;
      link(parent, child, before);
      child = next;
    }

    return;
  }

  link(parent, newChild, before);
}

export function childrenOf(node: FakeNode): FakeNode[] {
  const children: FakeNode[] = [];
  let child = node.first;

  while (child) {
    children.push(child);
    child = child.next;
  }

  return children;
}

export function dispatchFakeEvent(
  node: FakeNode,
  event: { type: string }
): boolean {
  node.listeners
    .filter(entry => entry.type === event.type)
    .forEach(entry => entry.listener.call(node, event));

  return true;
}

/**
 * A readable picture of a subtree. Markers print as a hash so a spec can pin
 * the interleaving of real nodes and part boundaries, not just the text.
 */
export function serialize(node: FakeNode): string {
  if (node.kind === 'text') return node.data;
  if (node.kind === 'marker') return '#';

  const children = childrenOf(node).map(serialize).join('');
  if (node.kind !== 'element') return children;

  const attrs = [...node.attrs.entries()]
    .map(([name, value]) => ` ${name}="${String(value)}"`)
    .join('');

  return `<${node.name}${attrs}>${children}</${node.name}>`;
}

export function textOf(node: FakeNode): string {
  return node.kind === 'text'
    ? node.data
    : childrenOf(node).map(textOf).join('');
}
