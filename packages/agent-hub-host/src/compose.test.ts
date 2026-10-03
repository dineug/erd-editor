import { Context, Effect, Layer, ManagedRuntime } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createHubHandler,
  createMemoryDocuments,
  createMemoryHost,
  createMemoryHub,
  flush,
} from '@/__test-utils__/hubLayers';
import { nodeHubServices, withDocumentHub } from '@/compose';
import * as LockFile from '@/lockFile';
import { DocumentHub, layer as documentHubLayer } from '@/services/DocumentHub';
import { HubDocuments, HubHandlerService, HubHost } from '@/services/HubHost';

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
  vi.useRealTimers();
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

  it('lets a host give up at its dispose timeout on a hub close a listen that never returns holds', async () => {
    const io = createMemoryHub();
    io.listen.mockImplementationOnce(() => Effect.never);
    const runtime = ManagedRuntime.make(
      withDocumentHub(
        Layer.mergeAll(
          Layer.succeed(HubHost, createMemoryHost()),
          Layer.succeed(HubDocuments, createMemoryDocuments()),
          Layer.succeed(HubHandlerService, createHubHandler())
        ),
        documentHubLayer.pipe(
          Layer.provide(LockFile.layer),
          Layer.provide(io.layer)
        )
      )
    );
    await runtime.runPromise(Effect.void);
    await flush();
    expect(io.listen).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    let settled = false;

    // Both hosts' bound, Effect.timeout at 5 seconds. A parallel scope on the
    // way to the hub would close it on a fiber this interrupt never reaches.
    const disposing = Effect.runPromise(
      runtime.disposeEffect.pipe(
        Effect.as('closed'),
        Effect.timeout('5 seconds'),
        Effect.catchTag('TimeoutError', () => Effect.succeed('gave up'))
      )
    ).finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(disposing).resolves.toBe('gave up');
  });
});
