import { execFileSync, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat as nodeStat,
  symlink,
  utimes,
  writeFile,
} from 'node:fs/promises';
import {
  connect,
  createServer,
  type Server,
  type Socket as NetSocket,
} from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import { Effect, Fiber, FileSystem, Layer, Stream } from 'effect';
import { Socket } from 'effect/unstable/socket';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createMemoryFs } from '@/__test-utils__/memoryFs';
import { PRIVATE_MODE, specPipePath } from '@/__test-utils__/platform';
import { isPlatformReason } from '@/errors';
import * as NodeFs from '@/io/fileSystem';
import {
  connectPipe,
  fromNetSocket,
  HubUnreachable,
  isAccessDenied,
} from '@/io/netSocket';
import { isAlive, ProcessInfo } from '@/io/process';
import * as Process from '@/io/process';
import { StderrLogger } from '@/logger';
import { realPath } from '@/paths';
import { listDiskDocuments } from '@/session/disk';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'erd-io-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const node = Layer.mergeAll(NodeFs.layer, NodePath.layer, Process.layer);
const onNode = <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof node>>
) => Effect.runPromise(Effect.provide(effect, node));

/** A SystemError as os.getPriority throws one, its errno name under info. */
function systemError(code: string): Error {
  return Object.assign(new Error(`uv_os_getpriority returned ${code}`), {
    code: 'ERR_SYSTEM_ERROR',
    info: { code, syscall: 'uv_os_getpriority' },
  });
}

function failWith(error: Error): (pid: number) => number {
  return () => {
    throw error;
  };
}

describe('the process', () => {
  it('reads what the process is', async () => {
    const info = await Effect.runPromise(
      Effect.provide(ProcessInfo, Process.layer)
    );
    const ids = await Effect.runPromise(
      Effect.all([info.randomId, info.randomId])
    );

    expect(info.platform).toBe(process.platform);
    expect(info.cwd).toBe(process.cwd());
    expect(info.homeDir).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('tells a live pid from a dead one', () => {
    expect(isAlive(process.pid)).toBe(true);
    expect(isAlive(2 ** 22 + 12345)).toBe(false);
  });

  it.each([
    ['alive', 'is granted', () => 0],
    ['dead', 'is refused', failWith(systemError('EPERM'))],
    ['dead', 'finds no process', failWith(systemError('ESRCH'))],
    ['alive', 'fails any other way', failWith(new Error('ENOMEM'))],
  ])(
    'counts a pid Windows refuses to signal %s when the least query right %s, as agent-hub-host does',
    (verdict, _, query) => {
      const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
        throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
      });

      expect(isAlive(4, 'win32', query)).toBe(verdict === 'alive');
      kill.mockRestore();
    }
  );

  it('asks no query where the signal decides: POSIX, a pid Windows finds no process for, and one it may signal', () => {
    const query = vi.fn(() => 0);
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
    });

    // Another user's process on POSIX, which a lock in this user's home never names.
    expect(isAlive(4, 'darwin', query)).toBe(false);
    expect(isAlive(4, 'linux', query)).toBe(false);
    kill.mockImplementation(() => {
      throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
    });
    expect(isAlive(4, 'win32', query)).toBe(false);
    kill.mockImplementation(() => true);
    expect(isAlive(4, 'win32', query)).toBe(true);
    expect(query).not.toHaveBeenCalled();
    kill.mockRestore();
  });

  it('asks the real query of this machine when the signal is refused on Windows, and never on POSIX', () => {
    const kill = vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' });
    });

    // os.getPriority opens this process on Windows and finds no process for the other pid.
    expect(isAlive(process.pid)).toBe(process.platform === 'win32');
    expect(isAlive(2 ** 22 + 12344)).toBe(false);
    kill.mockRestore();
  });

  it('answers the specs from fixed values, ids counted per layer', async () => {
    const [first, second] = await Effect.runPromise(
      Effect.gen(function* () {
        const one = yield* Effect.provide(ProcessInfo, Process.layerTest());
        const other = yield* Effect.provide(
          ProcessInfo,
          Process.layerTest({ cwd: '/elsewhere' })
        );
        return [one, other] as const;
      })
    );

    expect(first).toMatchObject({
      cwd: '/work',
      homeDir: '/home/agent',
      platform: 'linux',
    });
    expect(first.isAlive(process.pid)).toBe(false);
    expect(second.cwd).toBe('/elsewhere');
    expect(await Effect.runPromise(first.randomId)).toBe('id1');
    expect(await Effect.runPromise(first.randomId)).toBe('id2');
    expect(await Effect.runPromise(second.randomId)).toBe('id1');
  });
});

describe('the node file system, as the sessions read its failures', () => {
  it('fails an exclusive create over a file as AlreadyExists, and a read of none as NotFound', async () => {
    const path = join(dir, 'a.erd.json');
    await writeFile(path, 'one');

    const created = await onNode(
      FileSystem.FileSystem.use(fs =>
        fs.writeFileString(path, 'two', { flag: 'wx' })
      ).pipe(Effect.flip)
    );
    const missing = await onNode(
      FileSystem.FileSystem.use(fs =>
        fs.readFileString(join(dir, 'none.erd.json'))
      ).pipe(Effect.flip)
    );

    expect(isPlatformReason(created, 'AlreadyExists')).toBe(true);
    expect(isPlatformReason(missing, 'NotFound')).toBe(true);
  });

  it('resolves a real path the way the disk spells it, and fails a missing one as NotFound', async () => {
    const real = await realpath(dir);
    await mkdir(join(real, 'MixedCase'));
    await writeFile(join(real, 'MixedCase', 'Doc.erd.json'), '{}');
    await symlink(join(real, 'MixedCase'), join(real, 'linked'));
    const spelled = join(real, 'MixedCase', 'Doc.erd.json');
    const typed = join(real, 'mixedcase', 'doc.erd.json');
    // A case-insensitive disk, the default on macOS and Windows, finds the typed one too.
    const insensitive = existsSync(typed);

    expect(await onNode(realPath(join(real, 'linked', 'Doc.erd.json')))).toBe(
      spelled
    );
    expect(await onNode(realPath(typed))).toBe(insensitive ? spelled : typed);
    const missing = await onNode(
      FileSystem.FileSystem.use(fs =>
        fs.realPath(join(real, 'none.erd.json'))
      ).pipe(Effect.flip)
    );
    expect(isPlatformReason(missing, 'NotFound')).toBe(true);
  });

  it('stats size, the permission bits alone and mtime to the fraction of a millisecond', async () => {
    const path = join(dir, 'private.erd.json');
    await writeFile(path, 'x');
    await chmod(path, 0o600);
    // A quarter millisecond past a whole one, which a Date would drop.
    await utimes(path, 1_700_000_000.00025, 1_700_000_000.00025);

    const stat = await onNode(NodeFs.FileStats.use(({ stat }) => stat(path)));
    expect(stat).toEqual({
      size: 1,
      mode: PRIVATE_MODE,
      mtimeMs: (await nodeStat(path)).mtimeMs,
    });
    expect(Math.round((stat.mtimeMs % 1) * 4)).toBe(1);

    const missing = await onNode(
      NodeFs.FileStats.use(({ stat }) => stat(join(dir, 'none.erd.json'))).pipe(
        Effect.flip
      )
    );
    expect(isPlatformReason(missing, 'NotFound')).toBe(true);
  });

  it('gives a file one identity by any path to it, another file another, and a missing one none', async () => {
    const path = join(dir, 'a.erd.json');
    await writeFile(path, '{}');
    await writeFile(join(dir, 'b.erd.json'), '{}');
    await symlink(path, join(dir, 'linked.erd.json'));
    const identity = (of: string) =>
      onNode(NodeFs.FileStats.use(stats => stats.identity(of)));
    const native = await nodeStat(path, { bigint: true });

    expect(await identity(path)).toBe(`${native.dev}:${native.ino}`);
    expect(await identity(join(dir, 'linked.erd.json'))).toBe(
      await identity(path)
    );
    expect(await identity(join(dir, 'b.erd.json'))).not.toBe(
      await identity(path)
    );
    expect(await identity(join(dir, 'none.erd.json'))).toBeNull();
  });

  it('reads the identity off File.Info on any file system, none where it has no ino', async () => {
    const path = join(dir, 'a.erd.json');
    await writeFile(path, '{}');
    const identity = (fs: Layer.Layer<FileSystem.FileSystem>, of: string) =>
      Effect.runPromise(
        NodeFs.FileStats.use(stats => stats.identity(of)).pipe(
          Effect.provide(NodeFs.statsFromFileSystem.pipe(Layer.provide(fs)))
        )
      );
    const { dev, ino } = await nodeStat(path, { bigint: true });

    // An NTFS file id can pass 2^53, which File.Info has no ino for.
    expect(await identity(NodeFileSystem.layer, path)).toBe(
      ino <= BigInt(Number.MAX_SAFE_INTEGER) ? `${dev}:${ino}` : null
    );
    expect(
      await identity(NodeFileSystem.layer, join(dir, 'none.erd.json'))
    ).toBeNull();
    const memory = createMemoryFs();
    memory.put('/a.erd.json', '{}');
    expect(await identity(memory.layer, '/a.erd.json')).toBeNull();
  });

  it('lists the documents of a tree, never walking a symlinked folder', async () => {
    await mkdir(join(dir, 'docs'));
    await mkdir(join(dir, 'node_modules'));
    await writeFile(join(dir, 'a.erd.json'), '{}');
    await writeFile(join(dir, 'docs', 'b.vuerd'), '{}');
    await writeFile(join(dir, 'docs', 'notes.md'), '#');
    await writeFile(join(dir, 'node_modules', 'c.erd'), '{}');
    await symlink(join(dir, 'docs'), join(dir, 'linked'));
    await symlink(join(dir, 'gone'), join(dir, 'dangling.erd'));
    await mkdir(join(dir, '.backup.erd'));

    const listed = await onNode(listDiskDocuments(dir));

    expect(listed.map(({ path }) => path)).toEqual([
      join(dir, 'a.erd.json'),
      join(dir, 'dangling.erd'),
      join(dir, 'docs', 'b.vuerd'),
    ]);
  });

  it('lists nothing under a folder it cannot read', async () => {
    expect(await onNode(listDiskDocuments(join(dir, 'none')))).toEqual([]);
  });

  it('leaves out on Windows the names Node wrote there as given, which Win32 callers read otherwise', async () => {
    await writeFile(join(dir, 'a.erd.json'), '{}');
    await writeFile(join(dir, 'con .erd.json'), '{}');
    await writeFile(join(dir, 'NUL.erd'), '{}');
    await mkdir(join(dir, 'sub.'));
    await writeFile(join(dir, 'sub.', 'x.erd'), '{}');

    const listed = await onNode(listDiskDocuments(dir));

    expect(listed.map(({ path }) => path)).toEqual(
      process.platform === 'win32'
        ? [join(dir, 'a.erd.json')]
        : [
            join(dir, 'a.erd.json'),
            join(dir, 'con .erd.json'),
            join(dir, 'NUL.erd'),
            join(dir, 'sub.', 'x.erd'),
          ]
    );
  });
});

describe('FileAccess, how a headless write keeps a document open to whom it was', () => {
  /** An icacls /save listing: each name, then its SDDL, in UTF-16LE with CRLF. */
  const listing = (entries: Array<[string, string]>) =>
    entries.map(([name, sddl]) => `${name}\r\n${sddl}\r\n`).join('');
  const INHERITED =
    'D:(A;ID;FA;;;SY)(A;ID;FA;;;BA)(A;ID;FA;;;S-1-5-21-1-2-3-1001)';

  /** FileAccess on the node disk, with the platform and icacls a spec gives. */
  const accessOn = (options: NodeFs.FileAccessOptions) =>
    onNode(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const stats = yield* NodeFs.FileStats;
        return NodeFs.makeFileAccess(fs, stats, options);
      })
    );

  it.each([
    ['one inherited DACL', INHERITED, INHERITED, true],
    [
      'an ACE of its own',
      `${INHERITED}(A;;FR;;;S-1-5-32-545)`,
      INHERITED,
      false,
    ],
    ['inheritance off', 'D:PAI(A;;FA;;;S-1-5-21-1-2-3-1001)', INHERITED, false],
  ])('compares the two DACLs icacls lists: %s is %s', (_, doc, temp, same) => {
    const saved = listing([
      ['.doc.erd.json.id1.tmp', temp],
      ['doc.erd.json', doc],
      ['bdoc.erd.json', INHERITED],
    ]);
    expect(
      NodeFs.sameDacl(saved, 'doc.erd.json', '.doc.erd.json.id1.tmp')
    ).toBe(same);
  });

  it('takes a name icacls did not list for no DACL, never the same one', () => {
    const saved = listing([['doc.erd.json', INHERITED]]);
    expect(
      NodeFs.sameDacl(saved, 'doc.erd.json', '.doc.erd.json.id1.tmp')
    ).toBe(false);
    expect(NodeFs.sameDacl(saved, '.doc.erd.json.id1.tmp', 'none')).toBe(false);
  });

  it('keeps access by the rename on POSIX, without asking icacls', async () => {
    const icacls = vi.fn(async () => undefined);
    const access = await accessOn({ platform: 'linux', icacls });

    expect(
      await Effect.runPromise(access.keepsAccess('/a/.b.tmp', '/a/b'))
    ).toBe(true);
    expect(icacls).not.toHaveBeenCalled();
  });

  it('asks icacls once for the folder on Windows, reads the two names and removes what it saved', async () => {
    const doc = join(dir, 'doc.erd.json');
    const temp = join(dir, '.doc.erd.json.id1.tmp');
    const saved: string[] = [];
    const icacls = vi.fn(async (args: readonly string[]) => {
      saved.push(args[2]);
      await writeFile(
        args[2],
        Buffer.from(
          listing([
            ['.doc.erd.json.id1.tmp', INHERITED],
            ['doc.erd.json', INHERITED],
          ]),
          'utf16le'
        )
      );
    });
    const access = await accessOn({ platform: 'win32', icacls });

    const kept = await Effect.runPromise(
      Effect.all([access.keepsAccess(temp, doc), access.keepsAccess(temp, doc)])
    );
    expect(kept).toEqual([true, true]);
    expect(icacls).toHaveBeenCalledWith([
      join(dir, '*doc.erd.json*'),
      '/save',
      saved[0],
      '/q',
    ]);
    // One file per call, so servers writing in one folder never share it.
    expect(saved[0]).not.toBe(saved[1]);
    expect(saved.map(path => existsSync(path))).toEqual([false, false]);
  });

  it('runs a program as icacls is run, failing on its exit code', async () => {
    const node = NodeFs.runProgram(process.execPath);

    await expect(node(['-e', ''])).resolves.toBeUndefined();
    await expect(node(['-e', 'process.exit(3)'])).rejects.toMatchObject({
      code: 3,
    });
    await expect(
      NodeFs.runProgram(join(dir, 'none.exe'))([])
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('writes in place when icacls fails, and says so once', async () => {
    const logged = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const icacls = vi.fn(async () => {
      throw new Error('spawn icacls.exe ENOENT');
    });
    const access = await accessOn({ platform: 'win32', icacls });
    const keeps = (path: string) =>
      Effect.runPromise(
        access
          .keepsAccess(`${path}.tmp`, path)
          .pipe(Effect.provide(StderrLogger))
      );

    try {
      expect(await keeps(join(dir, 'a.erd.json'))).toBe(false);
      expect(await keeps(join(dir, 'b.erd.json'))).toBe(false);
      expect(icacls).toHaveBeenCalledTimes(2);
      expect(logged).toHaveBeenCalledTimes(1);
      expect(logged).toHaveBeenCalledWith(
        '[erd-editor-mcp]',
        `icacls could not compare the ACL of ${join(dir, 'a.erd.json')}, so it is written in place, as every document is while icacls fails (logged once)`,
        expect.anything()
      );
    } finally {
      logged.mockRestore();
    }
  });

  it('writes in place: the same file, its mode kept, the old tail cut, and the stat of what it wrote', async () => {
    const path = join(dir, 'doc.erd.json');
    await writeFile(path, 'x'.repeat(64));
    await chmod(path, 0o600);
    const before = await nodeStat(path, { bigint: true });
    const access = await accessOn({ platform: process.platform });

    const written = await Effect.runPromise(
      access.writeInPlace(path, '{"테이블":1}')
    );
    const after = await nodeStat(path);
    expect(await readFile(path, 'utf8')).toBe('{"테이블":1}');
    expect((await nodeStat(path, { bigint: true })).ino).toBe(before.ino);
    expect(written).toEqual({
      size: after.size,
      mtimeMs: after.mtimeMs,
      mode: PRIVATE_MODE,
    });
    expect(written.size).toBe(Buffer.byteLength('{"테이블":1}'));
  });

  it('fails an in-place write of a missing file as NotFound', async () => {
    const access = await accessOn({ platform: process.platform });
    const missing = await Effect.runPromise(
      access.writeInPlace(join(dir, 'none.erd.json'), '{}').pipe(Effect.flip)
    );
    expect(isPlatformReason(missing, 'NotFound')).toBe(true);
  });

  // The real icacls exists on Windows alone; the specs above hold the rest.
  it.runIf(process.platform === 'win32')(
    'tells an ACL of its own from the folder one through the real icacls',
    async () => {
      const inherited = join(dir, 'open.erd.json');
      const own = join(dir, 'own.erd.json');
      for (const path of [inherited, own]) {
        await writeFile(path, '{}');
        await writeFile(join(dir, `.${basename(path)}.id1.tmp`), '{}');
      }
      execFileSync(
        join(process.env.SystemRoot!, 'System32', 'icacls.exe'),
        [own, '/grant', '*S-1-5-32-546:(R)'],
        { windowsHide: true }
      );
      const access = await onNode(NodeFs.FileAccess);
      const keeps = (path: string) =>
        Effect.runPromise(
          access.keepsAccess(join(dir, `.${basename(path)}.id1.tmp`), path)
        );

      expect(await keeps(inherited)).toBe(true);
      expect(await keeps(own)).toBe(false);
    },
    15_000
  );
});

describe('connectPipe over a real socket, a named pipe on Windows', () => {
  let server: Server | null = null;

  afterEach(async () => {
    await new Promise<void>(resolve =>
      server ? server.close(() => resolve()) : resolve()
    );
    server = null;
  });

  const listen = async (onConnection: (conn: NetSocket) => void) => {
    const pipe = specPipePath(dir);
    server = createServer(onConnection);
    await new Promise<void>(resolve => server!.listen(pipe, resolve));
    return pipe;
  };

  /** Every chunk the socket reads until it closes, and the error it closed with. */
  const readToEnd = (socket: Socket.Socket) =>
    Effect.gen(function* () {
      const chunks: string[] = [];
      const closed = yield* Stream.fromPull(Socket.readerString(socket)).pipe(
        Stream.runForEach(chunk => Effect.sync(() => void chunks.push(chunk))),
        Effect.flip
      );
      return { text: chunks.join(''), closed };
    });

  it('exchanges text both ways and reports the close', async () => {
    const pipe = await listen(conn => {
      conn.setEncoding('utf8');
      conn.on('data', chunk => {
        conn.write(`echo ${chunk}`);
        conn.end();
      });
    });

    const { text, closed } = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const socket = yield* connectPipe(pipe);
          const writer = yield* socket.writer;
          yield* writer.writeAll(['h', 'i']);
          return yield* readToEnd(socket);
        })
      )
    );

    expect(text).toBe('echo hi');
    expect(closed.reason).toMatchObject({ _tag: 'SocketCloseError' });
  });

  it('keeps a character split across two reads whole', async () => {
    const bytes = Buffer.from('테이블', 'utf8');
    const pipe = await listen(conn => {
      conn.write(bytes.subarray(0, 4));
      setTimeout(() => conn.end(bytes.subarray(4)), 20);
    });

    const { text } = await Effect.runPromise(
      Effect.scoped(Effect.flatMap(connectPipe(pipe), readToEnd))
    );
    expect(text).toBe('테이블');
  });

  it('hangs up at once on a CloseEvent, and writes nothing after it', async () => {
    let hungUp!: () => void;
    const closed = new Promise<void>(resolve => (hungUp = resolve));
    const received: string[] = [];
    const pipe = await listen(conn => {
      conn.setEncoding('utf8');
      conn.on('data', chunk => received.push(String(chunk)));
      conn.on('close', () => hungUp());
    });
    const conn = connect(pipe);
    await new Promise<void>(resolve => conn.once('connect', resolve));

    // Destroyed, not ended: an end would leave the socket open until the hub closes its side.
    const destroyed = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const writer = yield* fromNetSocket(conn).writer;
          yield* writer.write(new Socket.CloseEvent());
          const now = conn.destroyed;
          yield* writer.write('late');
          return now;
        })
      )
    );
    await closed;

    expect(destroyed).toBe(true);
    expect(received).toEqual([]);
  });

  it('reads what is buffered at once, lets a pull go, and fails reads after a reset', async () => {
    const buffered = ['early'];
    const conn = Object.assign(new EventEmitter(), {
      writableEnded: false,
      destroyed: false,
      pause: () => undefined,
      setEncoding: () => undefined,
      read: () => buffered.shift() ?? null,
      write: (_chunk: string, done: (error?: Error) => void) => {
        done(new Error('EPIPE'));
        return true;
      },
      end: () => undefined,
      destroy: () => undefined,
    });
    const socket = fromNetSocket(conn as unknown as NetSocket);

    const outcome = await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const pull = yield* Socket.readerString(socket);
          const first = yield* pull;
          conn.emit('readable');
          const abandoned = yield* Effect.forkChild(pull);
          yield* Effect.yieldNow;
          yield* Fiber.interrupt(abandoned);
          const reading = yield* Effect.forkChild(Effect.flip(pull));
          yield* Effect.yieldNow;
          conn.emit('error', new Error('ECONNRESET'));
          const reset = yield* Fiber.join(reading);
          const again = yield* Effect.flip(pull);
          const writer = yield* socket.writer;
          const written = yield* Effect.flip(writer.write('x'));
          return { first, reset, again, written };
        })
      )
    );

    expect(outcome.first).toEqual(['early']);
    expect(outcome.reset.reason).toMatchObject({ _tag: 'SocketReadError' });
    expect(outcome.again).toBe(outcome.reset);
    expect(outcome.written.reason).toMatchObject({
      _tag: 'SocketWriteError',
    });
  });

  it('fails with HubUnreachable when nothing listens', async () => {
    const pipe = join(dir, 'none.sock');

    const error = await Effect.runPromise(
      Effect.scoped(connectPipe(pipe)).pipe(Effect.flip)
    );
    expect(error).toBeInstanceOf(HubUnreachable);
    expect(error).toMatchObject({
      pipe,
      message: expect.stringContaining('ENOENT'),
      denied: false,
    });
  });

  // Only Windows has a pipe whose descriptor keeps its own user out, and Node
  // cannot give one a descriptor, so PowerShell serves it; elsewhere EPERM is
  // never a denied pipe, which the isAccessDenied table below holds.
  it.runIf(process.platform === 'win32')(
    'marks a pipe Windows keeps this process out of as denied',
    async () => {
      const pipe = specPipePath(dir, 'denied');
      const script = [
        "$ErrorActionPreference = 'Stop'",
        '$security = New-Object System.IO.Pipes.PipeSecurity',
        "$system = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')",
        "$security.AddAccessRule((New-Object System.IO.Pipes.PipeAccessRule($system, 'FullControl', 'Allow')))",
        `$pipe = New-Object System.IO.Pipes.NamedPipeServerStream('${pipe.split('\\').at(-1)}', 'InOut', 1, 'Byte', 'Asynchronous', 0, 0, $security)`,
        "[Console]::Out.WriteLine('listening')",
        '[Console]::In.ReadLine() | Out-Null',
      ].join('; ');
      const owner = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { stdio: ['pipe', 'pipe', 'inherit'] }
      );
      const exited = new Promise<void>(resolve => owner.once('exit', resolve));
      try {
        await new Promise<void>((resolve, reject) => {
          owner.stdout.setEncoding('utf8');
          owner.stdout.on('data', (chunk: string) => {
            if (chunk.includes('listening')) resolve();
          });
          owner.once('exit', code =>
            reject(new Error(`PowerShell exited with ${code}`))
          );
        });

        const error = await Effect.runPromise(
          Effect.scoped(connectPipe(pipe)).pipe(Effect.flip)
        );
        expect(error).toMatchObject({
          pipe,
          message: `connect EPERM ${pipe}`,
          denied: true,
        });
      } finally {
        if (owner.exitCode === null) owner.stdin.end();
        await exited;
      }
    },
    30_000
  );
});

describe('isAccessDenied', () => {
  it.each([
    ['EPERM', 'win32', true],
    ['EPERM', 'linux', false],
    ['EPERM', 'darwin', false],
    ['EACCES', 'win32', false],
    ['ECONNREFUSED', 'win32', false],
    ['ENOENT', 'win32', false],
    [undefined, 'win32', false],
  ])('reads %j on %s as denied: %s', (code, platform, denied) => {
    expect(isAccessDenied(code, platform)).toBe(denied);
  });
});
