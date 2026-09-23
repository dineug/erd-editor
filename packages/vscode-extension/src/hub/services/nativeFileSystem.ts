import { realpath } from 'node:fs/promises';

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Layer from 'effect/Layer';

/**
 * A file system whose realPath is the native realpath, which spells a path the
 * way the disk does. NodeFileSystem's keeps the spelling given, so the lock
 * and the MCP server, which resolves natively, would name one folder two ways.
 */
export const withNativeRealPath = (
  fs: FileSystem.FileSystem
): FileSystem.FileSystem =>
  FileSystem.FileSystem.of({
    ...fs,
    realPath: path =>
      Effect.tryPromise(() => realpath(path)).pipe(
        Effect.catch(() => fs.realPath(path))
      ),
  });

/** NodeFileSystem with the native realpath; a failure is NodeFileSystem's own, reason tag and all. */
export const layer: Layer.Layer<FileSystem.FileSystem> = Layer.effect(
  FileSystem.FileSystem,
  FileSystem.FileSystem.useSync(withNativeRealPath)
).pipe(Layer.provide(NodeFileSystem.layer));
