import {
  createHostTemplate,
  type DOMTemplateLiterals,
  type HostAdapter,
  type HostNode,
} from '@dineug/r-html';
import { Container } from 'konva/lib/Container';
import { Group } from 'konva/lib/Group';
import { Layer } from 'konva/lib/Layer';
import { Node as KonvaNode } from 'konva/lib/Node';
import { Circle } from 'konva/lib/shapes/Circle';
import { Line } from 'konva/lib/shapes/Line';
import { Path } from 'konva/lib/shapes/Path';
import { Rect } from 'konva/lib/shapes/Rect';
import { Text } from 'konva/lib/shapes/Text';
import { Stage } from 'konva/lib/Stage';

import {
  currentEpoch,
  markDirty,
  onBeforeFlush,
  requestFlush,
} from '@/konva/batchDraw';

const SLOT = Symbol('r-html/konva-slot');
const LEDGER = Symbol('r-html/konva-ledger');
const VIRTUAL = Symbol('r-html/konva-virtual');
const FRAGMENT = Symbol('r-html/konva-fragment');

/**
 * The name the minimap Stage carries, and the whole reach of the id ban below.
 * An id scan over Konva.stages is ambiguous the moment two stages spell one id,
 * so ids belong to the main canvas and the minimap locates by name.
 */
export const MINIMAP_STAGE_NAME = 'minimap';

/**
 * Attributes a konva node never carries. The first two commit through an
 * HTMLElement check a konva node never passes, and z-order is the ledger's,
 * routed by setAttrs through setZIndex behind the host's back.
 */
const BANNED_ATTRIBUTES = new Set(['class', 'style', 'zIndex']);

type VirtualKind = 'marker' | 'text';

/**
 * A node the konva tree cannot hold. Markers and the transient placeholder a
 * marker-only child compiles to live in the ledger alone, so a shape tree never
 * carries a sentinel of ours.
 */
interface VirtualNode {
  kind: VirtualKind;
  data: string;
}

/**
 * One node's place among its siblings. The links are the answer nextSiblingOf
 * and parentOf give, which is why neither has to scan.
 */
interface Slot {
  node: HostNode;
  parent: HostNode | null;
  prev: Slot | null;
  next: Slot | null;
  doomed: boolean;
}

/**
 * One parent's membership. It is dirty from the change that touched it until
 * the commit that writes it back, and the epoch stamp keeps a second call
 * inside one commit from recomputing what the first already wrote.
 */
interface Ledger {
  first: Slot | null;
  last: Slot | null;
  dirty: boolean;
  reconciledAt: number;
}

/**
 * What the marker bench reads. A reconcile gone quadratic is invisible from
 * outside the host, so the counters name the shape of the work itself rather
 * than a wall clock.
 */
export interface HostStats {
  reconcile: number;
  scan: number;
  attach: number;
  drop: number;
  order: number;
  setZIndex: number;
}

export const hostStats: HostStats = {
  reconcile: 0,
  scan: 0,
  attach: 0,
  drop: 0,
  order: 0,
  setZIndex: 0,
};

export function resetHostStats(): void {
  for (const key of Object.keys(hostStats) as Array<keyof HostStats>) {
    hostStats[key] = 0;
  }
}

const KONVA_TAG_FACTORY: Record<string, () => KonvaNode> = {
  'k-layer': () => new Layer(),
  'k-group': () => new Group(),
  'k-rect': () => new Rect(),
  'k-text': () => new Text(),
  'k-path': () => new Path(),
  'k-line': () => new Line(),
  'k-circle': () => new Circle(),
};

function noValidate() {}

function domOnly(): never {
  throw new Error(
    '[konva-host] a DOM-only directive reached the konva host. innerHTML and vCSSStyleSheet read the DOM through the module helpers, which a konva node has nothing to answer with'
  );
}

/**
 * A ledger-only node, plus the tripwire that makes a DOM-only directive fail
 * loudly. Anything walking these by nextSibling or parentNode is reading the
 * DOM off a konva tree, which would otherwise no-op in silence.
 */
function createVirtual(kind: VirtualKind, data = ''): HostNode {
  const node: VirtualNode = { kind, data };
  Reflect.set(node, VIRTUAL, kind);
  Object.defineProperty(node, 'nextSibling', { get: domOnly });
  Object.defineProperty(node, 'parentNode', { get: domOnly });
  return node;
}

const virtualKindOf = (value: any): VirtualKind | null =>
  value && typeof value === 'object'
    ? ((Reflect.get(value, VIRTUAL) as VirtualKind | undefined) ?? null)
    : null;

const isKonva = (value: any): value is KonvaNode => value instanceof KonvaNode;

const isFragmentNode = (value: any): value is Group =>
  isKonva(value) && Reflect.get(value, FRAGMENT) === true;

function slotOf(node: HostNode): Slot {
  const existing = Reflect.get(node, SLOT) as Slot | undefined;
  if (existing) return existing;

  const slot: Slot = {
    node,
    parent: null,
    prev: null,
    next: null,
    doomed: false,
  };
  Reflect.set(node, SLOT, slot);
  return slot;
}

function ledgerOf(parent: HostNode): Ledger {
  const existing = Reflect.get(parent, LEDGER) as Ledger | undefined;
  if (existing) return existing;

  const ledger: Ledger = {
    first: null,
    last: null,
    dirty: false,
    reconciledAt: -1,
  };
  Reflect.set(parent, LEDGER, ledger);
  return ledger;
}

const parentOf = (node: HostNode): HostNode | null =>
  (Reflect.get(node, SLOT) as Slot | undefined)?.parent ?? null;

const nextSiblingOf = (node: HostNode): HostNode | null =>
  (Reflect.get(node, SLOT) as Slot | undefined)?.next?.node ?? null;

const pending = new Set<HostNode>();

const bridges = new WeakMap<HostNode, HostNode>();

function layerOf(node: HostNode): Layer | null {
  let current: HostNode | null = node;

  while (current) {
    if (current instanceof Layer) return current;
    current = parentOf(current);
  }

  return null;
}

function markLayer(node: HostNode) {
  const layer = layerOf(node);
  layer && markDirty(layer);
}

/**
 * Books one parent for the next commit. Nothing is written to konva here, which
 * is the whole point: an insert costs a pointer swap and the tree is rewritten
 * once, at the commit boundary, however many inserts arrived.
 */
function markStructural(parent: HostNode) {
  ledgerOf(parent).dirty = true;
  pending.add(parent);
  markLayer(parent);
  requestFlush();
}

function unlink(slot: Slot) {
  const parent = slot.parent;
  if (!parent) return;

  const ledger = ledgerOf(parent);
  slot.prev ? (slot.prev.next = slot.next) : (ledger.first = slot.next);
  slot.next ? (slot.next.prev = slot.prev) : (ledger.last = slot.prev);
  slot.parent = null;
  slot.prev = null;
  slot.next = null;
  markStructural(parent);
}

/**
 * Puts one slot in its place under a parent. Re-attaching revives a slot a
 * removal doomed, or the old parent's reconcile would destroy a node that has
 * since become another parent's live child.
 */
function link(parent: HostNode, slot: Slot, before: Slot | null) {
  unlink(slot);

  const ledger = ledgerOf(parent);
  slot.parent = parent;
  slot.doomed = false;
  slot.prev = before ? before.prev : ledger.last;
  slot.next = before;
  slot.prev ? (slot.prev.next = slot) : (ledger.first = slot);
  slot.next ? (slot.next.prev = slot) : (ledger.last = slot);
  markStructural(parent);
}

/**
 * The placement half of AC-G9. A fragment is exempt on purpose: every template
 * is assembled inside one before it is spliced into its real parent, so a layer
 * passes through a fragment on its way to the Stage.
 */
function assertPlacement(parent: HostNode, node: HostNode) {
  if (!isKonva(node) || isFragmentNode(parent)) return;

  if (parent instanceof Stage) {
    if (!(node instanceof Layer)) {
      throw new Error(
        `[konva-host] a Stage holds layers only, so ${node.getClassName()} cannot sit at a template root. Make k-layer the root`
      );
    }
    return;
  }

  if (node instanceof Layer) {
    throw new Error('[konva-host] k-layer nests in nothing but a Stage');
  }

  if (isKonva(parent) && !(parent instanceof Container)) {
    throw new Error(
      `[konva-host] ${parent.getClassName()} is a shape and holds no children`
    );
  }
}

/**
 * The one placement primitive, and the whole of the fragment splice clause: a
 * fragment hands over its slots in their current order and is left empty,
 * anything else moves itself.
 */
function insertInto(
  parent: HostNode,
  newChild: HostNode,
  before: HostNode | null
) {
  if (newChild === before) return;

  const beforeSlot = before ? slotOf(before) : null;

  if (!isFragmentNode(newChild)) {
    assertPlacement(parent, newChild);
    link(parent, slotOf(newChild), beforeSlot);
    return;
  }

  const moving: Slot[] = [];
  for (let slot = ledgerOf(newChild).first; slot; slot = slot.next) {
    moving.push(slot);
  }

  for (const slot of moving) {
    assertPlacement(parent, slot.node);
    link(parent, slot, beforeSlot);
  }
}

function releaseNode(node: KonvaNode) {
  pending.delete(node);
  Reflect.deleteProperty(node, SLOT);
  Reflect.deleteProperty(node, LEDGER);
}

function destroyNode(node: KonvaNode) {
  releaseNode(node);
  node.destroy();
}

/**
 * Hands one node to its parent. A node moving between parents is konva's own
 * moveTo, which is why a parent about to lose children is reconciled first
 * whenever the ledger already knows it owes that work.
 */
function attach(parent: Container, node: KonvaNode) {
  const owner = node.getParent();
  if (owner === parent) return;

  if (owner && pending.has(owner)) {
    ensureReconciled(owner);
  }

  hostStats.attach += 1;
  parent.add(node as any);
}

function sameOrder(children: KonvaNode[], desired: KonvaNode[]) {
  if (children.length !== desired.length) return false;

  for (let index = 0; index < desired.length; index++) {
    if (children[index] !== desired[index]) return false;
  }

  return true;
}

/**
 * Writes the order the ledger holds onto a Stage. Layers are the one case that
 * cannot take the array rewrite below, because a layer's z-order is also the
 * order of its canvas element inside the container.
 */
function orderLayers(stage: Stage, desired: KonvaNode[]) {
  desired.forEach((node, index) => {
    if (stage.children[index] === node) return;

    hostStats.setZIndex += 1;
    node.setZIndex(index);
  });
}

/**
 * Writes the order the ledger holds onto an ordinary container in one pass.
 * setZIndex per node would be the same write repeated once per sibling, which
 * is the quadratic reorder this host exists to avoid.
 */
function orderChildren(parent: Container, desired: KonvaNode[]) {
  const children = parent.children;
  children.length = 0;

  for (let index = 0; index < desired.length; index++) {
    const node = desired[index];
    children.push(node as any);
    node.index = index;
  }
}

/**
 * Invariant I1 for one parent: the ledger owns membership, and the order of the
 * real nodes it holds is written back onto the konva children. Order that drifted
 * meanwhile, from a moveToTop or a remove behind the host's back, is restored here.
 */
function reconcile(parent: HostNode) {
  hostStats.reconcile += 1;
  if (!(parent instanceof Container)) return;

  const desired: KonvaNode[] = [];
  for (let slot = ledgerOf(parent).first; slot; slot = slot.next) {
    hostStats.scan += 1;
    isKonva(slot.node) && desired.push(slot.node);
  }

  for (const node of desired) {
    attach(parent, node);
  }

  const keep = new Set<KonvaNode>(desired);
  const dropped = parent.children.filter(child => !keep.has(child));
  if (!dropped.length && sameOrder(parent.children, desired)) return;

  hostStats.order += 1;

  if (parent instanceof Stage) {
    dropped.forEach(node => node.remove());
    orderLayers(parent, desired);
  } else {
    dropped.forEach(node => {
      node.parent = null;
      node.index = 0;
      node.remove();
    });
    orderChildren(parent, desired);
  }

  for (const node of dropped) {
    hostStats.drop += 1;
    slotOf(node).doomed && destroyNode(node);
  }
}

/**
 * At most one reconcile per parent per commit. The epoch stamp is the batchDraw
 * flush counter, so a parent pulled forward by another parent's attach is not
 * reconciled twice in the same commit.
 */
function ensureReconciled(parent: HostNode) {
  const ledger = ledgerOf(parent);
  if (!ledger.dirty && ledger.reconciledAt === currentEpoch()) return;

  ledger.dirty = false;
  ledger.reconciledAt = currentEpoch();
  reconcile(parent);
}

onBeforeFlush(() => {
  for (const parent of pending) {
    ensureReconciled(parent);
  }

  pending.clear();
});

function rootOf(node: HostNode): HostNode {
  let current = node;
  let parent = parentOf(current);

  while (parent) {
    current = parent;
    parent = parentOf(current);
  }

  return bridges.get(current) ?? current;
}

/**
 * The id half of the P0-2 convention, enforced where an id is written. Only a
 * node of the main canvas may carry one, so a minimap that borrowed an id could
 * not make an id scan over the live stages ambiguous.
 */
function assertIdConvention(node: KonvaNode, value: any) {
  if (!value) return;

  const root = rootOf(node);
  if (isKonva(root) && root.hasName(MINIMAP_STAGE_NAME)) {
    throw new Error(
      `[konva-host] id "${value}" is not the minimap's to carry. Locate a minimap node by name plus a tableId attr`
    );
  }
}

export const konvaAdapter: HostAdapter = {
  createElement(name: string) {
    const factory = KONVA_TAG_FACTORY[name.toLowerCase()];
    if (!factory) {
      throw new Error(`[konva-host] unknown konva tag <${name}>`);
    }

    return factory();
  },
  createText: (value: string) => createVirtual('text', value),
  createMarker: (value: string) => createVirtual('marker', value),
  createFragment() {
    const fragment = new Group();
    Reflect.set(fragment, FRAGMENT, true);
    // A fragment is a staging area that never draws, so konva's rule about what
    // a Group may hold says nothing about what a template may be parked in.
    Reflect.set(fragment, '_validateAdd', noValidate);
    return fragment;
  },
  createEventBus: () => new EventTarget(),

  insertBefore(newChild: HostNode, refChild: HostNode) {
    const parent = parentOf(refChild);
    if (!parent) return;

    insertInto(parent, newChild, refChild);
  },
  appendChild(parent: HostNode, newChild: HostNode) {
    insertInto(parent, newChild, null);
  },
  prependChild(parent: HostNode, newChild: HostNode) {
    insertInto(parent, newChild, ledgerOf(parent).first?.node ?? null);
  },
  removeChild(node: HostNode) {
    const slot = slotOf(node);
    unlink(slot);
    if (!isKonva(node)) return;

    slot.doomed = true;
    node.getParent() || destroyNode(node);
  },
  parentOf,
  nextSiblingOf,

  setText(node: HostNode, value: string) {
    if (virtualKindOf(node) !== 'text') {
      throw new Error('[konva-host] a konva tree has no text node to write');
    }

    (node as VirtualNode).data = value;
  },
  setAttribute(
    node: HostNode,
    name: string,
    value: any,
    isSingleMarker: boolean
  ) {
    if (!isKonva(node)) return;

    if (BANNED_ATTRIBUTES.has(name)) {
      throw new Error(
        `[konva-host] "${name}" is not a konva attribute a template may write`
      );
    }

    const next = isSingleMarker ? value : String(value);
    name === 'id' && assertIdConvention(node, next);
    if (node.attrs[name] === next) return;

    node.setAttrs({ [name]: next });
    markLayer(node);
  },
  removeAttribute(node: HostNode, name: string) {
    if (!isKonva(node) || node.attrs[name] === undefined) return;

    node.setAttrs({ [name]: undefined });
    markLayer(node);
  },

  isHostNode: (value: any): value is HostNode =>
    isKonva(value) || virtualKindOf(value) !== null,
  isMarker: (value: any): value is HostNode =>
    virtualKindOf(value) === 'marker',
  isText: (value: any): value is HostNode => virtualKindOf(value) === 'text',
  isElement: (value: any): value is HostNode =>
    isKonva(value) && !isFragmentNode(value),
  isFragment: (value: any): value is HostNode => isFragmentNode(value),

  addEventListener(node: HostNode, type: string, listener: any, options?: any) {
    isKonva(node)
      ? node.on(`${type}.rhtml`, listener)
      : (node as EventTarget).addEventListener(type, listener, options);
  },
  removeEventListener(
    node: HostNode,
    type: string,
    listener: any,
    options?: any
  ) {
    isKonva(node)
      ? node.off(`${type}.rhtml`, listener)
      : (node as EventTarget).removeEventListener(type, listener, options);
  },

  getRoot: rootOf,
  createComponentContext(startNode: HostNode, eventBus: HostNode) {
    const targetOf = () => {
      const root = rootOf(startNode);
      return root instanceof Stage ? root.container() : eventBus;
    };

    return {
      // Resolved per read, never captured: a template is assembled inside a
      // fragment and spliced afterwards, so a context made on the way in would
      // hold the bus for the life of the component.
      get host() {
        // The one EventTarget fallback cast: a scene rendered outside a Stage
        // has no container element, and the bus answers dispatchEvent anyway.
        return targetOf() as unknown as HTMLElement;
      },
      // Null on purpose, and not for want of a live parent: useContext prefers
      // this over host, and a konva parent is never an HTMLElement, so leaving
      // it null is what keeps host the single answer to where the DI target is.
      get parentElement() {
        return null;
      },
      dispatchEvent: (event: Event) =>
        (eventBus as EventTarget).dispatchEvent(event),
    };
  },
  bridgeFragment(fragment: HostNode, root: HostNode) {
    bridges.set(fragment, root);

    return () => {
      bridges.delete(fragment);
    };
  },
};

/** Spelt out rather than inferred: the inferred one names an r-html internal. */
type KonvaTag = (
  strings: TemplateStringsArray,
  ...values: any[]
) => DOMTemplateLiterals;

const konvaTemplate = createHostTemplate<Stage>(konvaAdapter);

export const konva: KonvaTag = konvaTemplate.html;

export function renderKonva(
  stage: Stage,
  templateLiterals?: DOMTemplateLiterals | null
): void {
  if (!(stage instanceof Stage)) {
    throw new Error('[konva-host] a konva template renders into a Stage');
  }

  konvaTemplate.render(stage, templateLiterals);
}
