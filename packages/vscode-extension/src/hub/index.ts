import { Cause, Effect, Layer } from 'effect';

import {
  DocumentRegistry,
  type DocumentRegistryService,
} from '@/hub/documentRegistry';
import * as HubHandlers from '@/hub/handlers';
import * as LockFile from '@/hub/lockFile';
import { DocumentHub } from '@/hub/services/DocumentHub';
import * as DocumentHubService from '@/hub/services/DocumentHub';
import * as HubEnvironment from '@/hub/services/HubEnvironment';
import * as HubListener from '@/hub/services/HubListener';
import * as HubLogger from '@/hub/services/HubLogger';
import * as NativeFileSystem from '@/hub/services/nativeFileSystem';

export type { HubConnection, HubHandler } from '@/hub/server';
export { DocumentHub } from '@/hub/services/DocumentHub';

/**
 * Everything the hub needs of this machine. A unit suite provides its own in
 * place of these and must not provide the node layers, which would bind a
 * socket and write a lock under the real home directory.
 */
export const nodeHubServices = (
  version: string
): Layer.Layer<
  HubEnvironment.HubEnvironment | HubListener.HubListener | LockFile.LockFile
> =>
  LockFile.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        HubEnvironment.layer(version),
        HubListener.layer,
        NativeFileSystem.layer
      )
    )
  );

/** The registry over the native realpath, so its keys are spelled as on disk. */
export const registryLive = (
  registry: DocumentRegistry
): Layer.Layer<DocumentRegistryService> =>
  DocumentRegistry.layer(registry).pipe(Layer.provide(NativeFileSystem.layer));

/** The hub over this machine, serving the registry the runtime already holds. */
export const documentHubLive = (
  version: string
): Layer.Layer<DocumentHub, never, DocumentRegistryService> =>
  DocumentHubService.layer.pipe(
    Layer.provide(HubHandlers.layer),
    Layer.provide(nodeHubServices(version)),
    Layer.provide(NativeFileSystem.layer)
  );

/**
 * The one runtime activate builds and deactivate disposes. The registry comes
 * first and cannot fail; the hub builds on it, and a hub that fails is logged
 * and leaves the registry serving every editor. Finalizers run hub first.
 */
export const extensionLive = <E>(
  registry: Layer.Layer<DocumentRegistryService>,
  hub: Layer.Layer<DocumentHub, E, DocumentRegistryService>
): Layer.Layer<DocumentRegistryService> =>
  hub.pipe(
    // Never called for an interrupted build, so a dispose mid-build logs nothing.
    Layer.catchCause(cause =>
      Layer.effectDiscard(
        Effect.logWarning(
          'could not start the document hub',
          Cause.squash(cause)
        )
      )
    ),
    Layer.provideMerge(registry),
    Layer.provideMerge(HubLogger.layer)
  );
