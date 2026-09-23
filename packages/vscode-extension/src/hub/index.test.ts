import { Layer } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { documentHubLive, nodeHubServices } from '@/hub';
import { DocumentRegistry } from '@/hub/documentRegistry';

import { createMemoryHub } from '../../test/mocks/hubLayers';

describe('the hub over the node layers', () => {
  it('composes the machine services without touching the machine', () => {
    expect(Layer.isLayer(nodeHubServices('2.9.0'))).toBe(true);
  });

  it('composes the live hub around a registry without building it', () => {
    const registry = DocumentRegistry.makeUnsafe(createMemoryHub().registryIo);

    // Building it would bind a socket and write a lock under the real home
    // directory; the memory layers of hubLayers.ts are what a spec builds.
    expect(Layer.isLayer(documentHubLive('2.9.0', registry))).toBe(true);
  });
});
