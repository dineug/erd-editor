import { measureTableText } from './nodeTextWidth';

/**
 * Every 2d context method konva may call, each drawing nothing here. A plain
 * object rather than a catch-all, so a property konva probes for, such as a
 * backing store ratio, stays undefined rather than becoming a function.
 */
const CONTEXT_2D_METHODS = [
  'arc',
  'arcTo',
  'beginPath',
  'bezierCurveTo',
  'clearRect',
  'clip',
  'closePath',
  'drawFocusIfNeeded',
  'drawImage',
  'ellipse',
  'fill',
  'fillRect',
  'fillText',
  'lineTo',
  'moveTo',
  'putImageData',
  'quadraticCurveTo',
  'rect',
  'reset',
  'resetTransform',
  'restore',
  'rotate',
  'roundRect',
  'save',
  'scale',
  'setLineDash',
  'setTransform',
  'stroke',
  'strokeRect',
  'strokeText',
  'transform',
  'translate',
] as const;

/** A canvas nothing was drawn on, read back: transparent black. */
const emptyImage = (width = 1, height = 1) => ({
  data: new Uint8ClampedArray(Math.max(1, width * height) * 4),
  width,
  height,
});

const gradient = () => ({ addColorStop: () => undefined });

/** The 2d context of a canvas with no pixels: it measures off the width table and draws nothing. */
function createContext2d(canvas: NodeOffscreenCanvas) {
  const context: Record<string, unknown> = {
    canvas,
    font: '10px sans-serif',
    measureText(this: { font: string }, text: string) {
      return measureTableText(String(text), this.font);
    },
    getImageData: (_x: number, _y: number, width: number, height: number) =>
      emptyImage(width, height),
    createImageData: (width: number, height: number) =>
      emptyImage(width, height),
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => null,
    getLineDash: () => [],
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
    getContextAttributes: () => ({ alpha: true }),
  };
  for (const method of CONTEXT_2D_METHODS) {
    context[method] = () => undefined;
  }
  return context;
}

/**
 * The canvas konva rasterises on and pretext measures with, where Node has
 * none: its one context measures off the width table, so the layout, konva's
 * cut of a line and a memo's wrap all read the same advances.
 */
class NodeOffscreenCanvas {
  width: number;
  height: number;
  private context: Record<string, unknown> | null = null;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(type: string) {
    if (type !== '2d') return null;
    this.context ??= createContext2d(this);
    return this.context;
  }
}

/** What r-html builds a style sheet and konva a stage container from: text content and listeners. */
class NodeElementStub extends EventTarget {
  textContent = '';
}

/** The answer every instanceof against Node and HTMLElement gets here: false, since nothing is a dom node. */
class AbsentDomNode {}

/** The mark of the stub document, the same in every copy of the package one process loads. */
const NODE_REALM = Symbol.for('@dineug/erd-editor/node-realm');

const documentStub = {
  [NODE_REALM]: true,
  // Pretext lays a memo's emoji out in the page where there is one; both
  // null is how it learns there is none and keeps the canvas advance.
  body: null,
  head: null,
  createElement: (tagName: string) => {
    if (tagName !== 'canvas') return new NodeElementStub();
    // Konva writes a style onto whatever canvas it is given.
    return Object.assign(new NodeOffscreenCanvas(1, 1), { style: {} });
  },
};

/** Whether the realm has a document no copy of this module installed, a page's or another stub's. */
export function hasForeignDocument(): boolean {
  return (
    typeof document !== 'undefined' &&
    Reflect.get(document, NODE_REALM) !== true
  );
}

/**
 * Gives a realm with no document what the export scene reads at load and as it
 * draws: a document, a canvas that measures off the width table, and Node and
 * HTMLElement. A realm with a document is left as it is, so a second call adds nothing.
 *
 * @example
 * installNodeRealm();
 * const { renderDocumentSvg } = await import('./renderSvg');
 */
export function installNodeRealm(): void {
  if (typeof document !== 'undefined') return;

  for (const [name, stub] of [
    ['OffscreenCanvas', NodeOffscreenCanvas],
    ['Node', AbsentDomNode],
    ['HTMLElement', AbsentDomNode],
  ] as const) {
    if (Reflect.get(globalThis, name) === undefined) {
      Reflect.set(globalThis, name, stub);
    }
  }
  Reflect.set(globalThis, 'document', documentStub);
}
