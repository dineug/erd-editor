import {
  DocumentHub,
  documentHubLayer,
  type DocumentHubShape,
  HubDocuments,
  type HubEnvironment,
  HubHandlerService,
  HubHost,
  type HubHostShape,
  type HubListener,
  type LockFile,
  warnUnsafe,
  withDocumentHub,
} from '@dineug/erd-editor-agent-hub-host';
import { Context, Effect, FileSystem, Layer, ManagedRuntime } from 'effect';

import { createDocumentHandler } from '@/hub/handlers';
import { type DocumentRegistry } from '@/hub/registry';
import { type HubTab, type HubVault } from '@/hub/types';

/** How long disposing waits for the lock and the pipe to go. */
const DISPOSE_TIMEOUT = '5 seconds';

/** What the hub needs of this machine: nodeHubServices and the native file system in the plugin. */
export type HubMachine = Layer.Layer<
  HubEnvironment | HubListener | LockFile | FileSystem.FileSystem
>;

/** One hub for this vault window, which the plugin starts once and disposes once. */
export type HubRuntime = {
  /** Builds the hub; resolves when it serves or has logged why it could not. */
  readonly start: () => Promise<void>;
  /** Tells nobody anything: deletes the lock and the pipe, then closes the rest. Never rejects. */
  readonly dispose: () => Promise<void>;
  /** Deletes the lock and the socket before it returns, for a window going down unawaited. */
  readonly releaseSync: () => void;
};

export type HubRuntimeOptions<T extends HubTab> = {
  readonly registry: DocumentRegistry<T>;
  readonly vault: HubVault;
  readonly host: HubHostShape;
  /** The file system the handler reads documents through. */
  readonly fileSystem: Layer.Layer<FileSystem.FileSystem>;
  readonly machine: HubMachine;
};

/**
 * The registry's hub over this machine. The registry lives outside it, from
 * plugin load on, so a hub that fails to build or is turned off leaves every
 * tab working and its versions observed.
 */
export function createHubRuntime<T extends HubTab>(
  options: HubRuntimeOptions<T>
): HubRuntime {
  const { registry, vault, host } = options;
  let hub: DocumentHubShape | null = null;

  const documents = Layer.mergeAll(
    Layer.succeed(HubHost, host),
    Layer.succeed(HubDocuments, {
      setPublisher: publisher => registry.setPublisher(publisher),
    }),
    Layer.effect(
      HubHandlerService,
      Effect.map(Effect.service(FileSystem.FileSystem), fs =>
        createDocumentHandler(registry, vault, fs)
      )
    ).pipe(Layer.provide(options.fileSystem))
  );
  const runtime = ManagedRuntime.make(
    withDocumentHub(
      documents,
      documentHubLayer.pipe(
        Layer.tap(context =>
          Effect.sync(() => {
            hub = Context.get(context, DocumentHub);
          })
        ),
        Layer.provide(options.machine)
      )
    )
  );

  return {
    // The hub logs its own failure to build, so this exit fails only when a
    // dispose interrupted the build.
    start: () => runtime.runPromiseExit(Effect.void).then(() => undefined),
    dispose: () =>
      Effect.runPromise(
        runtime.disposeEffect.pipe(
          Effect.timeout(DISPOSE_TIMEOUT),
          Effect.catchCause(cause =>
            Effect.sync(() =>
              warnUnsafe('could not close the document hub', cause)
            )
          )
        )
      ),
    releaseSync: () => hub?.releaseSync(),
  };
}
