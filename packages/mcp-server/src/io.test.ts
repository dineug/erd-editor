import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
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
import { join } from 'node:path';

import * as NodePath from '@effect/platform-node/NodePath';
import { Effect, Fiber, FileSystem, Layer, Stream } from 'effect';
import { Socket } from 'effect/unstable/socket';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { isPlatformReason } from '@/errors';
import * as NodeFs from '@/io/fileSystem';
import { connectPipe, fromNetSocket, HubUnreachable } from '@/io/netSocket';
import { isAlive, ProcessInfo } from '@/io/process';
import * as Process from '@/io/process';
import { realPath } from '@/paths';
import { listDiskDocuments } from '@/session/disk';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'erd-io-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const node = Layer.mergeAll(NodeFs.layer, NodePath.layer);
const onNode = <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof node>>
) => Effect.runPromise(Effect.provide(effect, node));

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
      mode: 0o600,
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
});

describe('connectPipe over a real unix socket', () => {
  let server: Server | null = null;

  afterEach(async () => {
    await new Promise<void>(resolve =>
      server ? server.close(() => resolve()) : resolve()
    );
    server = null;
  });

  const listen = async (onConnection: (conn: NetSocket) => void) => {
    const pipe = join(dir, 'hub.sock');
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
    });
  });
});
