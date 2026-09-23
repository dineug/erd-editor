import { posix } from 'node:path';

import {
  ByteSize,
  Effect,
  FileSystem,
  Layer,
  Option,
  Path,
  PlatformError,
} from 'effect';

export type MemoryFile = { data: string; mtimeMs: number; mode: number };

/** The permission bits a file gets when nothing asks for others: 0o666 under a 022 umask. */
export const DEFAULT_MODE = 0o644;

const ERRNO: Partial<Record<PlatformError.SystemErrorTag, string>> = {
  NotFound: 'ENOENT',
  AlreadyExists: 'EEXIST',
  PermissionDenied: 'EACCES',
  BadResource: 'EISDIR',
  Unknown: 'EINVAL',
};

/**
 * A failure the way the node layer reports one: a reason tag, with the system
 * error under it as the cause, whose message a refusal quotes.
 */
export function fsError(
  tag: PlatformError.SystemErrorTag,
  method: string,
  path: string,
  code = ERRNO[tag] ?? 'EIO'
): PlatformError.PlatformError {
  return PlatformError.systemError({
    _tag: tag,
    module: 'FileSystem',
    method,
    pathOrDescriptor: path,
    cause: Object.assign(new Error(`${code}: ${path}`), { code }),
  });
}

type WriteOptions = {
  readonly flag?: FileSystem.OpenFlag | undefined;
  readonly mode?: number | undefined;
};

/** Every call the server makes, each replaceable, so a spec can make one fail or wait. */
export type MemoryFsCalls = {
  readFileString: (
    path: string
  ) => Effect.Effect<string, PlatformError.PlatformError>;
  writeFileString: (
    path: string,
    data: string,
    options?: WriteOptions
  ) => Effect.Effect<void, PlatformError.PlatformError>;
  rename: (
    from: string,
    to: string
  ) => Effect.Effect<void, PlatformError.PlatformError>;
  remove: (path: string) => Effect.Effect<void, PlatformError.PlatformError>;
  stat: (
    path: string
  ) => Effect.Effect<FileSystem.File.Info, PlatformError.PlatformError>;
  readDirectory: (
    path: string
  ) => Effect.Effect<string[], PlatformError.PlatformError>;
  realPath: (
    path: string
  ) => Effect.Effect<string, PlatformError.PlatformError>;
  readLink: (
    path: string
  ) => Effect.Effect<string, PlatformError.PlatformError>;
};

export type MemoryFs = {
  readonly files: Map<string, MemoryFile>;
  readonly dirs: Set<string>;
  /** Symlinks: a path starting with a key resolves under its value. */
  readonly links: Map<string, string>;
  /** Every path written, a rename's target included, in order. */
  readonly writes: string[];
  readonly calls: MemoryFsCalls;
  /** A hook run before stat answers, so a spec can change a file mid-call. */
  beforeStat: ((path: string) => void) | null;
  /** Writes as another program would; mode applies only to a new file. */
  put: (path: string, data: string, mode?: number) => void;
  /** Makes a directory and every missing parent. */
  mkdir: (path: string) => void;
  read: (path: string) => string;
  readonly layer: Layer.Layer<FileSystem.FileSystem | Path.Path>;
};

function info(
  type: FileSystem.File.Type,
  size: number,
  mtimeMs: number,
  mode: number
): FileSystem.File.Info {
  return {
    type,
    mtime: Option.some(new Date(mtimeMs)),
    atime: Option.none(),
    birthtime: Option.none(),
    dev: 0,
    ino: Option.none(),
    mode,
    nlink: Option.none(),
    uid: Option.none(),
    gid: Option.none(),
    rdev: Option.none(),
    size: ByteSize.bytes(size),
    blksize: Option.none(),
    blocks: Option.none(),
  };
}

/** A file system in memory, POSIX paths only, behind the FileSystem and Path services. */
export function createMemoryFs(): MemoryFs {
  const files = new Map<string, MemoryFile>();
  const dirs = new Set<string>(['/']);
  const links = new Map<string, string>();
  const writes: string[] = [];
  let clock = 1_000;

  const addDirs = (path: string) => {
    let dir = posix.dirname(path);
    while (!dirs.has(dir)) {
      dirs.add(dir);
      dir = posix.dirname(dir);
    }
  };

  const resolve = (path: string) => {
    for (const [from, to] of links) {
      if (path === from || path.startsWith(`${from}/`)) {
        return to + path.slice(from.length);
      }
    }
    return path;
  };

  // An existing file keeps its mode, as a write in place does.
  const put = (path: string, data: string, mode = DEFAULT_MODE) => {
    addDirs(path);
    const current = files.get(path);
    files.set(path, { data, mtimeMs: ++clock, mode: current?.mode ?? mode });
  };

  const calls: MemoryFsCalls = {
    readFileString: path =>
      Effect.suspend(() => {
        const file = files.get(resolve(path));
        return file
          ? Effect.succeed(file.data)
          : Effect.fail(fsError('NotFound', 'readFile', path));
      }),
    writeFileString: (path, data, options) =>
      Effect.suspend(() => {
        if (!dirs.has(posix.dirname(path))) {
          return Effect.fail(fsError('NotFound', 'writeFile', path));
        }
        if (options?.flag === 'wx' && (files.has(path) || dirs.has(path))) {
          return Effect.fail(fsError('AlreadyExists', 'writeFile', path));
        }
        writes.push(path);
        put(path, data, options?.mode);
        return Effect.void;
      }),
    // A rename moves the file itself: its size, mtime and mode go with it.
    rename: (from, to) =>
      Effect.suspend(() => {
        const file = files.get(from);
        if (!file) return Effect.fail(fsError('NotFound', 'rename', from));
        files.delete(from);
        writes.push(to);
        files.set(to, file);
        return Effect.void;
      }),
    remove: path =>
      Effect.suspend(() =>
        files.delete(path)
          ? Effect.void
          : Effect.fail(fsError('NotFound', 'remove', path))
      ),
    stat: path =>
      Effect.suspend(() => {
        state.beforeStat?.(path);
        const target = resolve(path);
        const file = files.get(target);
        if (file) {
          return Effect.succeed(
            info('File', file.data.length, file.mtimeMs, 0o100000 | file.mode)
          );
        }
        return dirs.has(target)
          ? Effect.succeed(info('Directory', 0, 1, 0o40755))
          : Effect.fail(fsError('NotFound', 'stat', path));
      }),
    readDirectory: path =>
      Effect.suspend(() => {
        if (!dirs.has(path)) {
          return Effect.fail(fsError('NotFound', 'readDirectory', path));
        }
        const prefix = path.endsWith('/') ? path : `${path}/`;
        const names = new Set<string>();
        for (const entry of [...dirs, ...files.keys(), ...links.keys()]) {
          const name = entry.slice(prefix.length);
          if (entry.startsWith(prefix) && name !== '' && !name.includes('/')) {
            names.add(name);
          }
        }
        return Effect.succeed([...names]);
      }),
    realPath: path =>
      Effect.suspend(() => {
        const target = resolve(path);
        return files.has(target) || dirs.has(target)
          ? Effect.succeed(target)
          : Effect.fail(fsError('NotFound', 'realPath', path));
      }),
    readLink: path =>
      Effect.suspend(() => {
        const target = links.get(path);
        return target === undefined
          ? Effect.fail(fsError('Unknown', 'readLink', path))
          : Effect.succeed(target);
      }),
  };

  const state: MemoryFs = {
    files,
    dirs,
    links,
    writes,
    calls,
    beforeStat: null,
    put,
    mkdir: path => {
      addDirs(path);
      dirs.add(path);
    },
    read: path => {
      const file = files.get(path);
      if (!file) throw new Error(`ENOENT: ${path}`);
      return file.data;
    },
    layer: Layer.merge(
      FileSystem.layerNoop({
        readFileString: path => calls.readFileString(path),
        writeFileString: (path, data, options) =>
          calls.writeFileString(path, data, options),
        rename: (from, to) => calls.rename(from, to),
        remove: path => calls.remove(path),
        stat: path => calls.stat(path),
        readDirectory: path => calls.readDirectory(path),
        realPath: path => calls.realPath(path),
        readLink: path => calls.readLink(path),
      }),
      Path.layer
    ),
  };
  return state;
}
