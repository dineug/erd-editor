import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { type Stage, stages } from 'konva/lib/Stage';

import { onBeforeFlush, whenDrawn } from '@/konva/batchDraw';

// Projects every live Konva stage into positioned divs so a Playwright css
// locator can still address the scene. Assertion only: the projection takes no
// pointer event, so nothing the editor does can route through it.

/** The one place the projection is switched on, so the bench never pays for it. */
export const SCENE_MIRROR_FLAG = 'sceneMirror';

const ROOT_CLASS = 'scene-mirror';

/**
 * Class names a minimap node answers to on top of its own. The minimap drew
 * plain table and memo boxes before the port, and the specs count them through
 * those names inside the minimap container.
 */
const CLASS_ALIASES: Record<string, string[]> = {
  'minimap-table': ['table'],
  'minimap-memo': ['memo'],
  'cell-text': ['edit-input'],
};

/**
 * Attributes a node earns from its name alone, for the markers the dom scene
 * spelled as a data attribute rather than a class.
 */
const NAME_ATTRIBUTES: Record<string, Record<string, string>> = {
  'cell-focus-border': { 'data-focus-border-bottom': '' },
  'shared-drag-select': { 'data-testid': 'shared-drag-select' },
  'duplicate-ghost': { 'data-testid': 'duplicate-ghost' },
};

/** Konva attrs projected as a bare data attribute when they are truthy. */
const FLAG_ATTRIBUTES: Array<[string, string]> = [
  ['selected', 'data-selected'],
  ['sharedFocus', 'data-shared-focus'],
  ['sharedSelect', 'data-shared-select'],
];

/** Konva attrs projected with their value. */
const VALUE_ATTRIBUTES: Array<[string, string]> = [
  ['tableId', 'data-table-id'],
];

const ID_PREFIXES = ['table-', 'column-', 'memo-', 'relationship-'];

/**
 * Names the projection draws a dashed svg band inside. The dom marquee was an
 * svg with a short dash on it, and that markup is the handle a spec addresses
 * the band by, so the konva successor has to answer to the same locator.
 */
const BAND_NAMES: readonly string[] = ['drag-select'];

const SVG_NS = 'http://www.w3.org/2000/svg';

type MirrorState = {
  root: HTMLElement;
  elements: Map<number, HTMLElement>;
};

const states = new WeakMap<Stage, MirrorState>();

/** The document id a scene node carries, with the prefix its id convention adds. */
function dataIdOf(node: KonvaNode): string | null {
  const id = node.id();
  if (!id) return null;

  const prefix = ID_PREFIXES.find(candidate => id.startsWith(candidate));
  return prefix ? id.slice(prefix.length) : id;
}

function isContainer(node: KonvaNode): node is Container<KonvaNode> {
  return typeof (node as Container<KonvaNode>).getChildren === 'function';
}

function createElement(root: HTMLElement): HTMLElement {
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.pointerEvents = 'none';
  element.style.userSelect = 'none';
  element.style.margin = '0';
  root.appendChild(element);
  return element;
}

function applyAttributes(
  element: HTMLElement,
  node: KonvaNode,
  names: string[]
) {
  const aliases = names.flatMap(name => CLASS_ALIASES[name] ?? []);
  element.className = [...names, ...aliases].join(' ');

  const wanted = new Map<string, string>();
  const dataId = dataIdOf(node);
  if (dataId !== null) wanted.set('data-id', dataId);
  if (names.length > 1) wanted.set('data-type', names[1]);

  for (const [attr, mirrored] of VALUE_ATTRIBUTES) {
    const value = node.getAttr(attr);
    if (value !== undefined && value !== null && value !== '') {
      wanted.set(mirrored, String(value));
    }
  }

  for (const [attr, mirrored] of FLAG_ATTRIBUTES) {
    if (node.getAttr(attr)) wanted.set(mirrored, '');
  }

  for (const name of names) {
    for (const [attr, value] of Object.entries(NAME_ATTRIBUTES[name] ?? {})) {
      wanted.set(attr, value);
    }
  }

  for (const attr of [...element.getAttributeNames()]) {
    if (attr !== 'class' && attr !== 'style' && !wanted.has(attr)) {
      element.removeAttribute(attr);
    }
  }
  for (const [attr, value] of wanted) {
    if (element.getAttribute(attr) !== value) element.setAttribute(attr, value);
  }
}

/** The dashed svg a band name earns, sized to the element the projection placed. */
function applyBand(element: HTMLElement, names: string[]) {
  const band = element.querySelector('svg');

  if (!names.some(name => BAND_NAMES.includes(name))) {
    band?.remove();
    return;
  }
  if (band) return;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke-dasharray', '3');

  svg.appendChild(rect);
  element.appendChild(svg);
}

type Origin = { x: number; y: number };

/**
 * Places one element and answers where it sits in stage space. The projection
 * nests elements the way the scene nests nodes, so a child is offset from the
 * box its parent was given rather than from the stage.
 */
function place(
  element: HTMLElement,
  node: KonvaNode,
  stage: Stage,
  origin: Origin
): Origin {
  const rect = node.getClientRect({ relativeTo: stage as never });
  element.style.left = `${rect.x - origin.x}px`;
  element.style.top = `${rect.y - origin.y}px`;
  element.style.width = `${Math.max(rect.width, 0)}px`;
  element.style.height = `${Math.max(rect.height, 0)}px`;

  return { x: rect.x, y: rect.y };
}

function syncStage(stage: Stage) {
  const content = stage.content;
  if (!content || !content.isConnected) return;

  let state = states.get(stage);
  if (!state || !state.root.isConnected) {
    const root = document.createElement('div');
    root.className = ROOT_CLASS;
    root.style.position = 'absolute';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    content.appendChild(root);
    state = { root, elements: new Map() };
    states.set(stage, state);
  }

  const live = new Set<number>();

  // A reorder leaves konva's children in the new order and the projection's in
  // the old one, so the slot each element belongs in is carried down the walk
  // and an element that is not already in it is moved there.
  const cursors = new Map<HTMLElement, number>();

  const placeAt = (parent: HTMLElement, element: HTMLElement) => {
    const index = cursors.get(parent) ?? 0;
    cursors.set(parent, index + 1);

    if (parent.children[index] === element) return;
    parent.insertBefore(element, parent.children[index] ?? null);
  };

  const visit = (node: KonvaNode, parent: HTMLElement, origin: Origin) => {
    if (!node.visible()) return;

    const names = node.name().trim().split(/\s+/).filter(Boolean);
    let host = parent;
    let hostOrigin = origin;

    if (names.length) {
      const key = node._id;
      let element = state.elements.get(key);
      if (!element || !element.isConnected) {
        element = createElement(parent);
        state.elements.set(key, element);
      }
      placeAt(parent, element);

      applyAttributes(element, node, names);
      applyBand(element, names);
      hostOrigin = place(element, node, stage, origin);
      if (node.className === 'Text') {
        element.textContent = String(node.getAttr('text') ?? '');
      }

      live.add(key);
      host = element;
    }

    if (isContainer(node)) {
      for (const child of node.getChildren()) visit(child, host, hostOrigin);
    }
  };

  const stageOrigin: Origin = { x: 0, y: 0 };

  for (const layer of stage.getChildren()) {
    if (!layer.visible()) continue;
    if (isContainer(layer)) {
      for (const child of layer.getChildren()) {
        visit(child, state.root, stageOrigin);
      }
    }
  }

  for (const [key, element] of state.elements) {
    if (live.has(key)) continue;
    element.remove();
    state.elements.delete(key);
  }
}

/**
 * Starts the projection on two clocks: the commit hook keeps it in step with the
 * store, so a spec reading a box straight after a dispatch never races a frame,
 * and the frame loop catches what a tween moves without a commit.
 */
export function installSceneMirror(): void {
  // A konva node exists as soon as the host creates it and answers a hit test
  // only once its layer has drawn, so a spec that means to click one waits on
  // the commit through this rather than on the node being there.
  Reflect.set(window, '__erdWhenDrawn', whenDrawn);

  // The live stage list comes off konva/lib/Stage rather than the Core barrel.
  // Core assigns registry entries the editor's own konva/lib graph never gets,
  // so naming it here repairs the page under test instead of measuring it.
  const sync = () => {
    for (const stage of stages) syncStage(stage);
  };

  // Registered after the host's own reconcile, so the tree it walks is the one
  // the commit settled on rather than the one it started from.
  onBeforeFlush(sync);

  const tick = () => {
    sync();
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}
