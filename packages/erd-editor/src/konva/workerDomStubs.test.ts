import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vite-plus/test';

/**
 * What this realm answered before the stubs were given the chance to install.
 * Captured at module scope because a static import of the module under test
 * would already have run by the time the first case does.
 */
const before = {
  node: Reflect.get(globalThis, 'Node'),
  htmlElement: Reflect.get(globalThis, 'HTMLElement'),
  createElement: document.createElement,
};

describe('the worker dom stubs stay out of a realm that has a document', () => {
  it('leaves konva rasterising on the canvas the document builds', async () => {
    await import('@/konva/workerDomStubs');

    expect(document.createElement).toBe(before.createElement);
    expect(document.createElement('canvas')).toBeInstanceOf(HTMLCanvasElement);
  });

  it('leaves the two constructors instanceof answers by', async () => {
    await import('@/konva/workerDomStubs');

    expect(Reflect.get(globalThis, 'Node')).toBe(before.node);
    expect(Reflect.get(globalThis, 'HTMLElement')).toBe(before.htmlElement);
  });

  it('found a realm that really does have all three', () => {
    expect(typeof document).toBe('object');
    expect(before.node).toBeTypeOf('function');
    expect(before.createElement).toBeTypeOf('function');
  });
});

describe('the raster backend is a global, not a patched module', () => {
  it('imports no konva module, so no copy of one can be the wrong copy', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'konva', 'workerDomStubs.ts'),
      'utf8'
    );
    const specifiers = [
      ...source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*'([^']+)'/g),
    ].map(([, specifier]) => specifier);

    expect(specifiers.filter(name => name.startsWith('konva'))).toEqual([]);
    expect(source).toContain('new OffscreenCanvas(');
  });
});

describe('the worker dom stubs install over a realm that has no document', () => {
  async function withNoDocument<T>(run: () => Promise<T>): Promise<T> {
    const savedDocument = Reflect.get(globalThis, 'document');
    const savedNode = Reflect.get(globalThis, 'Node');
    const savedHTMLElement = Reflect.get(globalThis, 'HTMLElement');
    Reflect.deleteProperty(globalThis, 'document');
    vi.resetModules();

    try {
      return await run();
    } finally {
      Reflect.set(globalThis, 'document', savedDocument);
      Reflect.set(globalThis, 'Node', savedNode);
      Reflect.set(globalThis, 'HTMLElement', savedHTMLElement);
      vi.resetModules();
    }
  }

  it('stubs a document that answers no element to a query', () =>
    withNoDocument(async () => {
      await import('@/konva/workerDomStubs');
      const stub = Reflect.get(globalThis, 'document') as Document;

      expect(stub.querySelector('.anything')).toBeNull();
      expect(stub.querySelectorAll('.anything')).toEqual([]);
    }));

  it('stubs a canvas element with the offscreen backend konva rasterises on', () =>
    withNoDocument(async () => {
      await import('@/konva/workerDomStubs');
      const stub = Reflect.get(globalThis, 'document') as Document;

      const canvas = stub.createElement('canvas') as unknown as {
        style: Record<string, string>;
      };

      expect(canvas).toBeInstanceOf(OffscreenCanvas);
      expect(canvas.style).toEqual({});
    }));

  it('stubs every other tag with an event target that holds text content', () =>
    withNoDocument(async () => {
      await import('@/konva/workerDomStubs');
      const stub = Reflect.get(globalThis, 'document') as Document;

      const element = stub.createElement('style') as unknown as {
        textContent: string;
        addEventListener: EventTarget['addEventListener'];
      };

      expect(element).toBeInstanceOf(EventTarget);
      expect(element.textContent).toBe('');
      expect(typeof element.addEventListener).toBe('function');
    }));

  it('answers false to every instanceof check against Node and HTMLElement', () =>
    withNoDocument(async () => {
      await import('@/konva/workerDomStubs');
      const stub = Reflect.get(globalThis, 'document') as Document;
      const Node = Reflect.get(globalThis, 'Node') as new () => unknown;
      const HTMLElement = Reflect.get(
        globalThis,
        'HTMLElement'
      ) as new () => unknown;

      const element = stub.createElement('div');

      expect(Node).toBe(HTMLElement);
      expect(element instanceof Node).toBe(false);
      expect(stub instanceof Node).toBe(false);
    }));
});
