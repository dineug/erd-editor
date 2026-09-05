/**
 * happy-dom does not implement every browser API the editor touches.
 * Fill in the small set of globals that would otherwise throw on import.
 */

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverMock {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

if (!('ResizeObserver' in globalThis)) {
  Reflect.set(globalThis, 'ResizeObserver', ResizeObserverMock);
}

if (!('IntersectionObserver' in globalThis)) {
  Reflect.set(globalThis, 'IntersectionObserver', IntersectionObserverMock);
}

if (!('matchMedia' in globalThis)) {
  Reflect.set(globalThis, 'matchMedia', (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

if (!('requestIdleCallback' in globalThis)) {
  Reflect.set(
    globalThis,
    'requestIdleCallback',
    (cb: (deadline: any) => void) =>
      setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 0)
  );
  Reflect.set(globalThis, 'cancelIdleCallback', (id: any) => clearTimeout(id));
}

/**
 * Every CanvasRenderingContext2D method, so a drawing call lands on a no-op and
 * a property read Konva probes for, such as backingStorePixelRatio, stays
 * undefined rather than becoming a function.
 */
const CONTEXT_2D_METHODS = [
  'arc',
  'arcTo',
  'beginPath',
  'bezierCurveTo',
  'clearRect',
  'clip',
  'closePath',
  'createConicGradient',
  'createImageData',
  'createLinearGradient',
  'createPattern',
  'createRadialGradient',
  'drawFocusIfNeeded',
  'drawImage',
  'ellipse',
  'fill',
  'fillRect',
  'fillText',
  'getContextAttributes',
  'getImageData',
  'getLineDash',
  'getTransform',
  'isPointInPath',
  'isPointInStroke',
  'lineTo',
  'measureText',
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
];

/** The calls whose result something reads back; every other method returns undefined. */
const CONTEXT_2D_ANSWERS: Record<string, (...args: any[]) => unknown> = {
  measureText: (text: string) => ({ width: text.length * 10 }),
  getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  createImageData: () => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  }),
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  createConicGradient: () => ({ addColorStop() {} }),
  createPattern: () => null,
  getLineDash: () => [],
  getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  isPointInPath: () => false,
  isPointInStroke: () => false,
  getContextAttributes: () => ({ alpha: true }),
};

/**
 * happy-dom returns no 2D context, so Konva threw while building every Stage a
 * DOM spec mounted and r-html logged the throw. This context draws nothing and
 * measures text the way the test app context does, ten pixels a character.
 */
function createContext2DStub(canvas: HTMLCanvasElement) {
  const context: Record<string, unknown> = { canvas };
  for (const method of CONTEXT_2D_METHODS) {
    context[method] = CONTEXT_2D_ANSWERS[method] ?? (() => undefined);
  }
  return context;
}

if (
  typeof HTMLCanvasElement !== 'undefined' &&
  document.createElement('canvas').getContext('2d') === null
) {
  const contexts = new WeakMap<HTMLCanvasElement, unknown>();
  const getContext = HTMLCanvasElement.prototype.getContext;

  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
    ...rest: any[]
  ) {
    if (type !== '2d') return getContext.call(this, type, ...rest);
    if (!contexts.has(this)) contexts.set(this, createContext2DStub(this));
    return contexts.get(this);
  } as typeof HTMLCanvasElement.prototype.getContext;
}
