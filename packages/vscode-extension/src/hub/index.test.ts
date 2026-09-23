import { Layer } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import {
  documentHubLive,
  extensionLive,
  nodeHubServices,
  registryLive,
} from '@/hub';
import { DocumentRegistry } from '@/hub/documentRegistry';

describe('the hub over the node layers', () => {
  it('composes the machine services without touching the machine', () => {
    expect(Layer.isLayer(nodeHubServices('2.9.0'))).toBe(true);
  });

  it('composes the live hub beside a registry without building it', () => {
    const registry = DocumentRegistry.makeUnsafe('linux');

    // Building it would bind a socket and write a lock under the real home
    // directory; the memory layers of hubLayers.ts are what a spec builds.
    expect(
      Layer.isLayer(
        extensionLive(registryLive(registry), documentHubLive('2.9.0'))
      )
    ).toBe(true);
  });
});
