import { Cause, Effect, Layer } from 'effect';

import * as LockFile from '@/lockFile';
import { type DocumentHub } from '@/services/DocumentHub';
import * as HubEnvironment from '@/services/HubEnvironment';
import * as HubListener from '@/services/HubListener';
import * as HubLogger from '@/services/HubLogger';
import * as NativeFileSystem from '@/services/nativeFileSystem';

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
 * The one runtime a host builds and disposes. Its documents come first and
 * cannot fail; the hub builds on them, and a hub that fails is logged and
 * leaves the documents serving every editor. Finalizers run hub first.
 */
export const withDocumentHub = <R, E>(
  documents: Layer.Layer<R>,
  hub: Layer.Layer<DocumentHub, E, R>
): Layer.Layer<R> =>
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
    Layer.provideMerge(documents),
    Layer.provideMerge(HubLogger.layer)
  );
