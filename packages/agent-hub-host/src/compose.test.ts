import { Context, Effect, Layer, ManagedRuntime } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { nodeHubServices, withDocumentHub } from '@/compose';
import { DocumentHub } from '@/services/DocumentHub';

class Documents extends Context.Service<Documents, { readonly name: string }>()(
  'spec/Documents'
) {}

const documents = Layer.succeed(Documents, { name: 'open documents' });

const hubDouble = DocumentHub.of({
  setDocuments: async () => undefined,
  close: async () => undefined,
  releaseSync: () => undefined,
});

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the hub over the node layers', () => {
  it('composes the machine services without touching the machine', () => {
    // Building it would bind a socket and write a lock under the real home
    // directory; the memory layers of __test-utils__ are what a spec builds.
    expect(Layer.isLayer(nodeHubServices('2.9.0'))).toBe(true);
  });
});

describe('withDocumentHub', () => {
  it('builds the hub on the documents and serves them both', async () => {
    const built = vi.fn((service: { readonly name: string }) => service.name);
    const runtime = ManagedRuntime.make(
      withDocumentHub(
        documents,
        Layer.effect(
          DocumentHub,
          Effect.map(Effect.service(Documents), service => {
            built(service);
            return hubDouble;
          })
        )
      )
    );

    const served = await runtime.runPromise(Effect.service(Documents));
    await runtime.dispose();

    expect(served.name).toBe('open documents');
    expect(built).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('logs a hub that fails to build and leaves the documents serving', async () => {
    const runtime = ManagedRuntime.make(
      withDocumentHub(
        documents,
        Layer.effect(
          DocumentHub,
          Effect.die(new Error('uv_os_homedir returned ENOENT'))
        )
      )
    );

    const served = await runtime.runPromise(Effect.service(Documents));
    await runtime.dispose();

    expect(served.name).toBe('open documents');
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'could not start the document hub',
      expect.objectContaining({ message: 'uv_os_homedir returned ENOENT' })
    );
  });
});
