// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { hasForeignDocument, installNodeRealm } from './nodeRealm';
import { measureTableText } from './nodeTextWidth';

const GLOBALS = ['document', 'OffscreenCanvas', 'Node', 'HTMLElement'] as const;

type CanvasStub = {
  width: number;
  height: number;
  style: Record<string, string>;
  getContext: (type: string) => Record<string, any> | null;
};

const globalOf = (name: (typeof GLOBALS)[number]): unknown =>
  Reflect.get(globalThis, name);

const realmDocument = () =>
  globalOf('document') as {
    body: null;
    head: null;
    createElement: (tagName: string) => unknown;
  };

beforeEach(() => {
  for (const name of GLOBALS) expect(globalOf(name)).toBeUndefined();
});

afterEach(() => {
  for (const name of GLOBALS) Reflect.deleteProperty(globalThis, name);
});

describe('installNodeRealm in a realm with no document', () => {
  it('installs a document with neither a body nor a head', () => {
    installNodeRealm();

    expect(realmDocument().body).toBeNull();
    expect(realmDocument().head).toBeNull();
    expect(hasForeignDocument()).toBe(false);
  });

  it('installs once, however often it is called', () => {
    installNodeRealm();
    const installed = GLOBALS.map(globalOf);
    installNodeRealm();

    expect(GLOBALS.map(globalOf)).toEqual(installed);
    for (const [index, name] of GLOBALS.entries()) {
      expect(globalOf(name)).toBe(installed[index]);
    }
  });

  it('builds a canvas whose one 2d context measures off the width table', () => {
    installNodeRealm();
    const canvas = realmDocument().createElement('canvas') as CanvasStub;
    const OffscreenCanvas = globalOf('OffscreenCanvas') as new (
      width: number,
      height: number
    ) => CanvasStub;

    expect(canvas).toBeInstanceOf(OffscreenCanvas);
    expect(canvas.style).toEqual({});
    expect(canvas.getContext('webgl')).toBeNull();

    const context = canvas.getContext('2d')!;
    expect(canvas.getContext('2d')).toBe(context);
    expect(context.canvas).toBe(canvas);
    expect(context.font).toBe('10px sans-serif');
    expect(context.measureText('users')).toEqual(
      measureTableText('users', '10px sans-serif')
    );

    context.font = 'bold 12px sans-serif';
    expect(context.measureText('users')).toEqual(
      measureTableText('users', 'bold 12px sans-serif')
    );
  });

  it('gives pretext the same canvas through the global it reads', () => {
    installNodeRealm();
    const OffscreenCanvas = globalOf('OffscreenCanvas') as new (
      width: number,
      height: number
    ) => CanvasStub;
    const canvas = new OffscreenCanvas(3, 2);

    expect(canvas.width).toBe(3);
    expect(canvas.height).toBe(2);
    expect(canvas.getContext('2d')!.measureText('😀').width).toBe(12.5);
  });

  it('draws nothing, and reads back a canvas nothing was drawn on', () => {
    installNodeRealm();
    const canvas = realmDocument().createElement('canvas') as CanvasStub;
    const context = canvas.getContext('2d')!;

    for (const method of ['beginPath', 'fillRect', 'fillText', 'save']) {
      expect(context[method]()).toBeUndefined();
    }
    expect(context.backingStorePixelRatio).toBeUndefined();
    expect(context.getImageData(0, 0, 2, 3).data).toEqual(
      new Uint8ClampedArray(24)
    );
    expect(context.createImageData(0, 0).data).toHaveLength(4);
    expect(
      context.createLinearGradient().addColorStop(0, 'red')
    ).toBeUndefined();
    expect(context.createRadialGradient()).toHaveProperty('addColorStop');
    expect(context.createConicGradient()).toHaveProperty('addColorStop');
    expect(context.createPattern()).toBeNull();
    expect(context.getLineDash()).toEqual([]);
    expect(context.getTransform()).toEqual({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
    });
    expect(context.isPointInPath()).toBe(false);
    expect(context.isPointInStroke()).toBe(false);
    expect(context.getContextAttributes()).toEqual({ alpha: true });
  });

  it('builds every other tag as an event target that holds text content', () => {
    installNodeRealm();
    const element = realmDocument().createElement('style') as EventTarget & {
      textContent: string;
    };

    expect(element).toBeInstanceOf(EventTarget);
    expect(element.textContent).toBe('');
  });

  it('answers false to every instanceof against Node and HTMLElement', () => {
    installNodeRealm();
    const Node = globalOf('Node') as new () => unknown;
    const HTMLElement = globalOf('HTMLElement') as new () => unknown;

    expect(Node).toBe(HTMLElement);
    expect(realmDocument().createElement('div') instanceof Node).toBe(false);
    expect(realmDocument() instanceof HTMLElement).toBe(false);
  });

  it('keeps a Node, HTMLElement or OffscreenCanvas the realm already has', () => {
    class Held {}
    for (const name of GLOBALS.slice(1)) Reflect.set(globalThis, name, Held);

    installNodeRealm();

    expect(realmDocument().body).toBeNull();
    for (const name of GLOBALS.slice(1)) expect(globalOf(name)).toBe(Held);
  });
});

describe('installNodeRealm in a realm that has a document', () => {
  it('installs nothing and calls that document foreign', () => {
    const page = { body: {}, head: {} };
    Reflect.set(globalThis, 'document', page);

    installNodeRealm();

    expect(globalOf('document')).toBe(page);
    for (const name of GLOBALS.slice(1)) expect(globalOf(name)).toBeUndefined();
    expect(hasForeignDocument()).toBe(true);
  });

  it('calls the stub another copy of the package installed its own, and installs nothing', () => {
    const copy = {
      [Symbol.for('@dineug/erd-editor/node-realm')]: true,
      body: null,
      head: null,
    };
    Reflect.set(globalThis, 'document', copy);

    installNodeRealm();

    expect(globalOf('document')).toBe(copy);
    expect(hasForeignDocument()).toBe(false);
  });

  it('calls no document foreign where there is none', () => {
    expect(hasForeignDocument()).toBe(false);
  });
});
