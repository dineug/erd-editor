// The scenario pnpm dist-shape runs the viewer's UMD file in on happy-dom: a
// viewer mounted, its language switched to Korean, every request counted. The
// one file carries every dictionary, so the switch must need no request.

const TEXT_METHODS = ['measureText'];

let requests = 0;
let shadow = null;

/** A 2D context that draws nothing, so Konva can build a stage where happy-dom has none. */
function context2d(canvas) {
  return new Proxy(
    { canvas },
    {
      get(target, name) {
        if (name in target) return target[name];
        if (TEXT_METHODS.includes(name)) {
          return text => ({ width: String(text).length * 8 });
        }
        if (name === 'getImageData' || name === 'createImageData') {
          return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
        }
        if (name === 'getTransform') {
          return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        }
        if (name.startsWith?.('create') && name.endsWith('Gradient')) {
          return () => ({ addColorStop() {} });
        }
        if (name === 'getLineDash') return () => [];
        return () => undefined;
      },
      set(target, name, value) {
        target[name] = value;
        return true;
      },
    }
  );
}

/** Stubs what a mounted view reaches that happy-dom leaves out, and counts each request a script makes. */
export function before() {
  const fetch = globalThis.fetch;
  globalThis.fetch = (...args) => {
    requests++;
    return fetch(...args);
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (...args) {
    requests++;
    return open.apply(this, args);
  };

  const attachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const root = attachShadow.call(this, init);
    if (this.localName === 'erd-viewer') shadow = root;
    return root;
  };

  const contexts = new WeakMap();
  HTMLCanvasElement.prototype.getContext = function (type) {
    if (type !== '2d') return null;
    if (!contexts.has(this)) contexts.set(this, context2d(this));
    return contexts.get(this);
  };
  globalThis.requestIdleCallback ??= callback =>
    setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }));
  globalThis.cancelIdleCallback ??= id => clearTimeout(id);
}

const settle = async () => {
  for (let round = 0; round < 5; round++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

/** What the view shows: the language its root names and the title of its Fit button. */
function read() {
  const root = shadow?.querySelector('.erd-view');
  return {
    lang: root?.getAttribute('lang') ?? null,
    fit: shadow?.querySelector('.view-fit')?.getAttribute('title') ?? null,
  };
}

export async function after() {
  const viewer = document.createElement('erd-viewer');
  viewer.setAttribute('style', 'display: block; width: 800px; height: 600px');
  document.body.append(viewer);
  await settle();
  const english = read();

  await viewer.setLocale('ko-KR');
  await settle();

  return { english, korean: read(), requests };
}
