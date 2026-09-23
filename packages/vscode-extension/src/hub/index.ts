import * as Layer from 'effect/Layer';

import {
  type DocumentRegistry,
  DocumentRegistryService,
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

/**
 * The hub under one runtime: activate builds it, deactivate disposes it, and
 * the finalizers delete the lock before they close the pipe.
 */
export const documentHubLive = (
  version: string,
  registry: DocumentRegistry
): Layer.Layer<DocumentHub> =>
  DocumentHubService.layer.pipe(
    Layer.provide(HubHandlers.layer),
    Layer.provide(Layer.succeed(DocumentRegistryService, registry)),
    Layer.provide(nodeHubServices(version)),
    Layer.provide(NativeFileSystem.layer),
    Layer.provideMerge(HubLogger.layer)
  );
