/**
 * What konva and r-html construct that a worker realm has no constructor for.
 * A style element takes textContent, and a stage container takes listeners,
 * so one class with an event target and that property answers both.
 */
class WorkerElementStub extends EventTarget {
  textContent = '';
}

/**
 * The answer every instanceof against Node and HTMLElement gets here, which is
 * false for everything. A dom branch reached in this realm has no document to
 * walk into, so being no dom node at all is the honest answer and the safe one.
 */
class AbsentDomNode {}

/**
 * The backend konva rasterises on. Konva reaches it through createElement
 * rather than through its own seam because a bundler is free to hand konva a
 * second copy of its Util module, and a global is the one thing both copies see.
 */
function createOffscreenCanvasElement() {
  const canvas = new OffscreenCanvas(1, 1) as OffscreenCanvas & {
    style?: Record<string, string>;
  };
  // Konva's Canvas writes style onto whatever it is given, and an
  // OffscreenCanvas carries no such property.
  canvas.style ??= {};
  return canvas;
}

const documentStub = {
  createElement: (tagName: string) =>
    tagName === 'canvas'
      ? createOffscreenCanvasElement()
      : new WorkerElementStub(),
};

// A realm with a document needs none of this, and installing it where one
// exists would hand the editor's own scene an offscreen backend. The guard is
// konva's own test for the same condition, in Util.ensureBrowser.
if (typeof document === 'undefined') {
  Reflect.set(globalThis, 'document', documentStub);
  Reflect.set(globalThis, 'Node', AbsentDomNode);
  Reflect.set(globalThis, 'HTMLElement', AbsentDomNode);
}
