import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

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
