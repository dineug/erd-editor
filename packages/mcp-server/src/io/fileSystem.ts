import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import type { Platform } from '@dineug/erd-editor-agent-hub';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import type { PlatformError } from 'effect';
import { Context, Effect, FileSystem, Layer, Option } from 'effect';

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
  /** Which file path names, as dev:ino, the same through every spelling of it; null when it cannot be read. */
  readonly identity: (path: string) => Effect.Effect<string | null>;
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
    FileStats.of({
      stat: path => fs.stat(path).pipe(Effect.map(fromInfo)),
      identity: path =>
        fs.stat(path).pipe(
          Effect.map(info =>
            Option.match(info.ino, {
              onNone: () => null,
              onSome: ino => `${info.dev}:${ino}`,
            })
          ),
          Effect.orElseSucceed(() => null)
        ),
    })
  )
);

/**
 * node's stat, mtimeMs fraction and all; a failure is the one fs gives, with
 * its reason tag. The identity takes a bigint stat, since File.Info has no ino
 * past 2^53, which an NTFS file id can pass.
 */
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
    identity: path =>
      Effect.tryPromise(() => stat(path, { bigint: true })).pipe(
        Effect.map(native => `${native.dev}:${native.ino}`),
        Effect.orElseSucceed(() => null)
      ),
  });

export type FileAccessShape = {
  /** Whether renaming temp over path leaves who may open path as it was. */
  readonly keepsAccess: (temp: string, path: string) => Effect.Effect<boolean>;
  /** Writes text into path itself, so its ACL and attributes stay; the stat after. */
  readonly writeInPlace: (
    path: string,
    text: string
  ) => Effect.Effect<FileStat, PlatformError.PlatformError>;
};

/**
 * How a headless write keeps a document's access. A rename carries the mode
 * bits on POSIX, but on Windows the renamed file takes the folder's inherited
 * ACL, so a document with an ACL of its own is written in place instead.
 */
export class FileAccess extends Context.Service<FileAccess, FileAccessShape>()(
  '@dineug/erd-editor-mcp/FileAccess'
) {}

/** Runs icacls with args; rejects when it cannot start, fails or runs too long. */
export type RunIcacls = (args: readonly string[]) => Promise<void>;

/** Windows' own icacls, never one found first on the PATH. */
const ICACLS = join(
  process.env.SystemRoot ?? 'C:\\Windows',
  'System32',
  'icacls.exe'
);

/** A program run with no shell and no window, for 5 s at most. */
export const runProgram =
  (file: string): RunIcacls =>
  args =>
    new Promise((resolve, reject) =>
      execFile(file, [...args], { windowsHide: true, timeout: 5_000 }, error =>
        error ? reject(error) : resolve()
      )
    );

/**
 * Whether an icacls /save listing, a name line then its SDDL line, gives the
 * two names one DACL; a name it does not list has none to compare.
 */
export function sameDacl(listing: string, a: string, b: string): boolean {
  const lines = listing.split(/\r?\n/);
  const dacl = new Map<string, string>();
  for (let i = 0; i + 1 < lines.length; i += 2) {
    dacl.set(lines[i], lines[i + 1]);
  }
  const first = dacl.get(a);
  return first !== undefined && first === dacl.get(b);
}

export type FileAccessOptions = {
  platform: Platform;
  icacls?: RunIcacls;
};

/**
 * FileAccess on a file system and its stat. On Windows one icacls /save over
 * the folder compares the document's DACL with its fresh temp file's; when it
 * fails, the write goes in place, logged once.
 */
export const makeFileAccess = (
  fs: FileSystem.FileSystem,
  stats: FileStatsShape,
  { platform, icacls = runProgram(ICACLS) }: FileAccessOptions
): FileAccessShape => {
  let warned = false;

  const compare = (temp: string, path: string) =>
    Effect.suspend(() => {
      const save = join(tmpdir(), `erd-editor-mcp-acl-${randomUUID()}`);
      return Effect.tryPromise(() =>
        icacls([
          join(dirname(path), `*${basename(path)}*`),
          '/save',
          save,
          '/q',
        ])
      ).pipe(
        Effect.andThen(fs.readFile(save)),
        Effect.map(bytes =>
          sameDacl(
            new TextDecoder('utf-16le').decode(bytes),
            basename(path),
            basename(temp)
          )
        ),
        Effect.ensuring(Effect.ignore(fs.remove(save)))
      );
    }).pipe(
      Effect.catch(error => {
        if (warned) return Effect.succeed(false);
        warned = true;
        return Effect.logWarning(
          `icacls could not compare the ACL of ${path}, so it is written in place, as every document is while icacls fails (logged once)`,
          error
        ).pipe(Effect.as(false));
      })
    );

  return FileAccess.of({
    keepsAccess: (temp, path) =>
      platform === 'win32' ? compare(temp, path) : Effect.succeed(true),

    // The text goes over the old bytes before the cut, so a reader meanwhile
    // finds the old document or text that does not parse, never a blank file.
    writeInPlace: (path, text) =>
      Effect.scoped(
        Effect.gen(function* () {
          const file = yield* fs.open(path, { flag: 'r+' });
          const bytes = new TextEncoder().encode(text);
          yield* file.writeAll(bytes);
          yield* file.truncate(bytes.length);
        })
      ).pipe(Effect.andThen(stats.stat(path))),
  });
};

/** NodeFileSystem with the native realpath, node's own stat and FileAccess: the disk the server runs on. */
export const layer: Layer.Layer<
  FileSystem.FileSystem | FileStats | FileAccess
> = Layer.mergeAll(
  Layer.effect(
    FileSystem.FileSystem,
    FileSystem.FileSystem.useSync(withNativeRealPath)
  ),
  Layer.effect(FileStats, FileSystem.FileSystem.useSync(withNativeStat)),
  Layer.effect(
    FileAccess,
    FileSystem.FileSystem.useSync(fs =>
      makeFileAccess(fs, withNativeStat(fs), { platform: process.platform })
    )
  )
).pipe(Layer.provide(NodeFileSystem.layer));
