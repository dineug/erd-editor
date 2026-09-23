import { type Platform } from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';

import { realpathOrSelf } from '@/hub/authz';
import * as NativeFileSystem from '@/hub/services/nativeFileSystem';

/**
 * What the registry needs of the machine before the hub's runtime exists: the
 * provider registers documents from the moment activate returns, while the hub
 * layer is still building.
 */
export type RegistryIo = {
  readonly platform: Platform;
  readonly realPath: (path: string) => Promise<string>;
};

export const nodeRegistryIo: RegistryIo = {
  platform: process.platform as Platform,
  realPath: path =>
    Effect.runPromise(
      realpathOrSelf(path).pipe(Effect.provide(NativeFileSystem.layer))
    ),
};
