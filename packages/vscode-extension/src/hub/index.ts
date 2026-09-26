import {
  type DocumentHub,
  documentHubLayer,
  nativeFileSystemLayer,
  nodeHubServices,
  withDocumentHub,
} from '@dineug/erd-editor-agent-hub-host';
import { Layer } from 'effect';

import {
  DocumentRegistry,
  type DocumentRegistryService,
} from '@/hub/documentRegistry';
import * as HubHandlers from '@/hub/handlers';
import * as VscodeHost from '@/hub/vscodeHost';

export type {
  HubConnection,
  HubHandler,
} from '@dineug/erd-editor-agent-hub-host';
export {
  DocumentHub,
  nodeHubServices,
} from '@dineug/erd-editor-agent-hub-host';

/** The registry over the native realpath, so its keys are spelled as on disk. */
export const registryLive = (
  registry: DocumentRegistry
): Layer.Layer<DocumentRegistryService> =>
  DocumentRegistry.layer(registry).pipe(Layer.provide(nativeFileSystemLayer));

/** The hub over this machine, serving the registry the runtime already holds. */
export const documentHubLive = (
  version: string
): Layer.Layer<DocumentHub, never, DocumentRegistryService> =>
  documentHubLayer.pipe(
    Layer.provide(HubHandlers.layer),
    Layer.provide(VscodeHost.layer),
    Layer.provide(VscodeHost.registryDocuments),
    Layer.provide(nodeHubServices(version)),
    Layer.provide(nativeFileSystemLayer)
  );

/**
 * The one runtime activate builds and deactivate disposes. The registry comes
 * first and cannot fail; the hub builds on it, and a hub that fails is logged
 * and leaves the registry serving every editor. Finalizers run hub first.
 */
export const extensionLive = <E>(
  registry: Layer.Layer<DocumentRegistryService>,
  hub: Layer.Layer<DocumentHub, E, DocumentRegistryService>
): Layer.Layer<DocumentRegistryService> => withDocumentHub(registry, hub);
