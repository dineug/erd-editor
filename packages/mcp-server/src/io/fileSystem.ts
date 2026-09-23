import { realpath } from 'node:fs/promises';

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Layer from 'effect/Layer';

/**
 * A file system whose realPath is the native realpath, which spells a path the
 * way a case-insensitive disk does, as 0.1.0's did; NodeFileSystem's keeps the
 * spelling typed. A failure is the one fs gives, with its reason tag.
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

/** NodeFileSystem with the native realpath: the file system the server runs on. */
export const layer: Layer.Layer<FileSystem.FileSystem> = Layer.effect(
  FileSystem.FileSystem,
  FileSystem.FileSystem.useSync(withNativeRealPath)
).pipe(Layer.provide(NodeFileSystem.layer));
