import { realpath, stat } from 'node:fs/promises';

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as FileSystem from 'effect/FileSystem';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import type * as PlatformError from 'effect/PlatformError';

/**
 * A file system whose realPath is the native realpath, which spells a path the
 * way a case-insensitive disk does; NodeFileSystem's keeps the spelling typed.
 * A failure is the one fs gives, with its reason tag.
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

/** Size and mtime tell a change; mode is the permission bits alone. */
export type FileStat = { size: number; mtimeMs: number; mode: number };

/** File.Info as a FileStat, mtime to the whole millisecond a Date holds. */
export const fromInfo = (info: FileSystem.File.Info): FileStat => ({
  size: Number(info.size),
  mtimeMs: Option.match(info.mtime, {
    onNone: () => 0,
    onSome: mtime => mtime.getTime(),
  }),
  mode: info.mode & 0o777,
});

export type FileStatsShape = {
  readonly stat: (
    path: string
  ) => Effect.Effect<FileStat, PlatformError.PlatformError>;
};

/**
 * The stat a headless session tells an outside write by. On node its mtime
 * keeps the fraction of a millisecond, which File.Info drops:
 * two writes of one size in one millisecond differ only there.
 */
export class FileStats extends Context.Service<FileStats, FileStatsShape>()(
  '@dineug/erd-editor-mcp/FileStats'
) {}

/** FileStats on a FileSystem's own stat, to the millisecond: the specs' disk in memory. */
export const statsFromFileSystem: Layer.Layer<
  FileStats,
  never,
  FileSystem.FileSystem
> = Layer.effect(
  FileStats,
  FileSystem.FileSystem.useSync(fs =>
    FileStats.of({ stat: path => fs.stat(path).pipe(Effect.map(fromInfo)) })
  )
);

/** node's stat, mtimeMs fraction and all; a failure is the one fs gives, with its reason tag. */
const withNativeStat = (fs: FileSystem.FileSystem) =>
  FileStats.of({
    stat: path =>
      Effect.tryPromise(() => stat(path)).pipe(
        Effect.map((native): FileStat => ({
          size: native.size,
          mtimeMs: native.mtimeMs,
          mode: native.mode & 0o777,
        })),
        Effect.catch(() => fs.stat(path).pipe(Effect.map(fromInfo)))
      ),
  });

/** NodeFileSystem with the native realpath and node's own stat: the disk the server runs on. */
export const layer: Layer.Layer<FileSystem.FileSystem | FileStats> =
  Layer.mergeAll(
    Layer.effect(
      FileSystem.FileSystem,
      FileSystem.FileSystem.useSync(withNativeRealPath)
    ),
    Layer.effect(FileStats, FileSystem.FileSystem.useSync(withNativeStat))
  ).pipe(Layer.provide(NodeFileSystem.layer));
