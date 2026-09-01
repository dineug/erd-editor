import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { type Stage, stages } from 'konva/lib/Stage';

import { onBeforeFlush, whenDrawn } from '@/konva/batchDraw';
import { toThemeVariableName } from '@/themes/tokens';

// Projects every live Konva stage into positioned elements so a Playwright css
// locator can still address the scene, and routes a pointer event dispatched on
// one of those elements back onto the stage the element stands for.

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
  'relationship-route': ['route'],
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

/**
 * Konva attrs projected as a css custom property, which is where the dom scene
 * published a peer's colour for a spec to read back off the element.
 */
const STYLE_ATTRIBUTES: Array<[string, string]> = [
  ['sharedSelect', '--shared-select'],
  ['sharedFocus', '--shared-focus'],
];

const ID_PREFIXES = ['table-', 'column-', 'memo-', 'relationship-'];

/**
 * Names the projection draws a dashed svg band inside. The dom marquee was an
 * svg with a short dash on it, and that markup is the handle a spec addresses
 * the band by, so the konva successor has to answer to the same locator.
 */
const BAND_NAMES: readonly string[] = ['drag-select'];

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * The svg tag one konva shape answers to. The dom scene drew its connectors in
 * svg and the specs count those by tag name, so each of the three keeps a
 * namespaced marker inside the box the projection places for it.
 */
const SVG_TAGS: Record<string, string> = {
  Line: 'line',
  Circle: 'circle',
  Path: 'path',
};

/** What a colour is when the scene paints nothing, as konva takes it. */
const TRANSPARENT = 'transparent';

/**
 * The palette tokens a mirrored element is labelled with. A column key was a
 * class in the dom scene and is only a paint colour in the konva one, so the
 * token that colour resolved from is what the projection can name it by.
 */
const PAINT_TOKENS = ['keyPK', 'keyFK', 'keyPFK'];

/** Pointer events the projection routes back onto the stage. */
const ROUTED_EVENTS = [
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
  'mousemove',
];

type MirrorElement = HTMLElement;

type MirrorState = {
  root: HTMLElement;
  elements: Map<number, MirrorElement>;
  nodes: WeakMap<Element, KonvaNode>;
  retired: MirrorElement[];
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

/** The colour a node paints its own outline with, or null for one that paints none. */
function ownStroke(node: KonvaNode): string | null {
  const stroke = node.getAttr('stroke');

  return typeof stroke === 'string' && stroke && stroke !== TRANSPARENT
    ? stroke
    : null;
}

/** The dash the dom scene wrote as one stroke-dasharray number. */
function dashOf(node: KonvaNode): string | null {
  const dash = node.getAttr('dash');
  if (!Array.isArray(dash) || dash.length === 0) return null;

  const unique = [...new Set(dash.map(Number))];
  return unique.length === 1 ? String(unique[0]) : dash.join(' ');
}

/** The token each palette colour resolves from, read off the stage container. */
function paintTokensOf(stage: Stage): Map<string, string> {
  const tokens = new Map<string, string>();
  const container = stage.container();
  if (!container.isConnected) return tokens;

  const style = getComputedStyle(container);

  for (const token of PAINT_TOKENS) {
    const value = style.getPropertyValue(toThemeVariableName(token)).trim();
    if (value && !tokens.has(value)) tokens.set(value, token);
  }

  return tokens;
}

// Pointer events are taken rather than refused: a locator click is dropped
// unless the element it names answers the hit test. Neither this nor the root
// declares one, so grab mode still turns the whole canvas transparent.

function createElement(parent: MirrorElement): MirrorElement {
  const element = document.createElement('div');

  element.style.position = 'absolute';
  element.style.userSelect = 'none';
  element.style.margin = '0';
  parent.appendChild(element);

  return element;
}

/**
 * The namespaced twin a connector shape earns, so a tag selector still counts
 * it. An svg element outside an svg root lays out no box, which is why the box
 * stays a div and the marker inside it is what carries the tag.
 */
function applyMarker(
  element: MirrorElement,
  node: KonvaNode,
  classes: string,
  dash: string | null
) {
  const tag = SVG_TAGS[node.className];
  if (!tag) return;

  let marker = element.firstElementChild;
  if (!marker || marker.localName !== tag) {
    marker = document.createElementNS(SVG_NS, tag);
    element.insertBefore(marker, element.firstChild);
  }

  marker.setAttribute('class', classes);
  if (dash === null) {
    marker.removeAttribute('stroke-dasharray');
  } else {
    marker.setAttribute('stroke-dasharray', dash);
  }
}

function applyAttributes(
  element: MirrorElement,
  node: KonvaNode,
  names: string[],
  stroke: string | null,
  tokens: Map<string, string>
) {
  const aliases = names.flatMap(name => CLASS_ALIASES[name] ?? []);
  const classes = [...names, ...aliases].join(' ');
  element.setAttribute('class', classes);

  const wanted = new Map<string, string>();
  const dataId = dataIdOf(node);
  if (dataId !== null) wanted.set('data-id', dataId);
  if (names.length > 1) wanted.set('data-type', names[1]);

  const dash = dashOf(node);
  if (dash !== null) wanted.set('stroke-dasharray', dash);
  applyMarker(element, node, classes, dash);

  const token = stroke === null ? undefined : tokens.get(stroke);
  if (token) wanted.set('data-paint-token', token);

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

  element.style.removeProperty('stroke');
  if (stroke !== null) element.style.setProperty('stroke', stroke);

  for (const [attr, property] of STYLE_ATTRIBUTES) {
    const value = node.getAttr(attr);
    element.style.removeProperty(property);
    if (typeof value === 'string' && value) {
      element.style.setProperty(property, value);
    }
  }
}

/** The dashed svg a band name earns, sized to the element the projection placed. */
function applyBand(element: MirrorElement, names: string[]) {
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
  element: MirrorElement,
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

/** Where a mirrored node sits on screen, in the coordinates a pointer arrives in. */
function screenBoxOf(node: KonvaNode, stage: Stage) {
  const rect = node.getClientRect({ relativeTo: stage as never });
  const origin = stage.container().getBoundingClientRect();

  return {
    x: origin.x + rect.x,
    y: origin.y + rect.y,
    width: rect.width,
    height: rect.height,
  };
}

type Box = { x: number; y: number; width: number; height: number };

const isInside = (box: Box, x: number, y: number) =>
  x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

/**
 * Where to aim a press meant for one node. A node half off screen has a centre
 * the stage never hit tests, so the part of it the stage can still see is what
 * the point is taken from.
 */
function aimAt(box: Box, stage: Stage) {
  const view = stage.container().getBoundingClientRect();
  const left = Math.max(box.x, view.left);
  const top = Math.max(box.y, view.top);
  const right = Math.min(box.x + box.width, view.right);
  const bottom = Math.min(box.y + box.height, view.bottom);

  return right > left && bottom > top
    ? { x: (left + right) / 2, y: (top + bottom) / 2 }
    : { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Re-dispatches a synthetic press on the stage, centred on the node the element
 * stands for. A konva scene resolves what was pressed from the coordinates
 * alone, and a dispatchEvent carries none, so the projection supplies them.
 *
 * @example
 * routeSyntheticPointer(stage, state);
 */
function routeSyntheticPointer(stage: Stage, state: MirrorState) {
  const nodeOf = (target: EventTarget | null): KonvaNode | null => {
    let element = target instanceof Element ? target : null;

    while (element && element !== state.root) {
      const node = state.nodes.get(element);
      if (node) return node;
      element = element.parentElement;
    }

    return null;
  };

  const handle = (event: Event) => {
    // A real press already carries the coordinates konva hit tests with, and it
    // reaches the stage by bubbling through the content div the projection
    // hangs in, so only a dispatched one is rewritten here.
    if (event.isTrusted) return;

    const mouse = event as MouseEvent;
    const node = nodeOf(event.target);
    if (!node) return;

    const box = screenBoxOf(node, stage);
    if (isInside(box, mouse.clientX, mouse.clientY)) return;

    const aim = aimAt(box, stage);

    event.stopPropagation();
    stage.content.dispatchEvent(
      new MouseEvent(event.type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: mouse.button,
        buttons: mouse.buttons,
        detail: mouse.detail,
        altKey: mouse.altKey,
        ctrlKey: mouse.ctrlKey,
        metaKey: mouse.metaKey,
        shiftKey: mouse.shiftKey,
        clientX: aim.x,
        clientY: aim.y,
      })
    );
  };

  for (const type of ROUTED_EVENTS) {
    state.root.addEventListener(type, handle);
  }
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
    content.appendChild(root);
    state = { root, elements: new Map(), nodes: new WeakMap(), retired: [] };
    states.set(stage, state);
    routeSyntheticPointer(stage, state);
  }

  // A press re-renders the scene inside its own dispatch, so an element the
  // press landed on is gone before the routing above the stage asks what it
  // was. Detaching one pass late leaves that target where the walk can find it.
  for (const element of state.retired.splice(0)) element.remove();

  const live = new Set<number>();
  const tokens = paintTokensOf(stage);

  // A reorder leaves konva's children in the new order and the projection's in
  // the old one, so the slot each element belongs in is carried down the walk
  // and an element that is not already in it is moved there.
  const cursors = new Map<MirrorElement, number>();

  const placeAt = (parent: MirrorElement, element: MirrorElement) => {
    const index = cursors.get(parent) ?? 0;
    cursors.set(parent, index + 1);

    // Entities keep the order they were first drawn in. The dom scene raised
    // one with a z-index and left the markup alone, and a spec that reads the
    // first table means the first one in the document either way.
    if (parent === state.root) return;

    if (parent.children[index] === element) return;
    parent.insertBefore(element, parent.children[index] ?? null);
  };

  const visit = (
    node: KonvaNode,
    parent: MirrorElement,
    origin: Origin
  ): string | null => {
    if (!node.visible()) return null;

    const names = node.name().trim().split(/\s+/).filter(Boolean);
    let element: MirrorElement | null = null;
    let host = parent;
    let hostOrigin = origin;

    if (names.length) {
      const key = node._id;
      element = state.elements.get(key) ?? null;
      if (!element || !element.isConnected) {
        element = createElement(parent);
        state.elements.set(key, element);
      }
      placeAt(parent, element);

      state.nodes.set(element, node);
      applyBand(element, names);
      hostOrigin = place(element, node, stage, origin);
      if (node.className === 'Text') {
        element.textContent = String(node.getAttr('text') ?? '');
      }

      live.add(key);
      host = element;
    }

    // The colour a group is labelled by is the one its own shapes paint with:
    // a scene icon is a group of paths, and the palette token behind those
    // paths is the whole of what the dom scene spelled as a class on the icon.
    let stroke = ownStroke(node);

    if (isContainer(node)) {
      for (const child of node.getChildren()) {
        const childStroke = visit(child, host, hostOrigin);
        stroke = stroke ?? childStroke;
      }
    }

    if (element) applyAttributes(element, node, names, stroke, tokens);

    return stroke;
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
    // Stripped of its identity at once, so no locator counts a node the scene
    // has already dropped, and detached on the pass after this one. What is
    // left under it went with it, so the marker and the strays lose theirs too.
    for (const attr of [...element.getAttributeNames()]) {
      if (attr !== 'style') element.removeAttribute(attr);
    }
    for (const stray of element.querySelectorAll('*')) {
      stray.removeAttribute('class');
    }
    state.elements.delete(key);
    state.retired.push(element);
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
