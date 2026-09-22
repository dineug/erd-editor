import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { connect, type Socket as NetSocket } from 'node:net';
import * as os from 'node:os';
import { join } from 'node:path';

import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import type { Done } from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Queue from 'effect/Queue';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import * as Socket from 'effect/unstable/socket/Socket';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { authorizePath } from '@/hub/authz';
import {
  HubEnvironment,
  layer as hubEnvironmentLayer,
  makeNodeEnvironment,
} from '@/hub/services/HubEnvironment';
import {
  HubListener,
  layer as hubListenerLayer,
} from '@/hub/services/HubListener';
import { nodeRegistryIo } from '@/hub/services/registryIo';

const env = makeNodeEnvironment('2.9.0');

let dir: string;

beforeEach(async () => {
  // Short on purpose: the socket path below has to stay under sun_path.
  dir = await fs.mkdtemp(join(os.tmpdir(), 'hub-io-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/** Collects everything the peer sends until it closes the connection. */
function readUntilEnd(client: NetSocket): Promise<string> {
  client.setEncoding('utf8');
  return new Promise(resolve => {
    let text = '';
    client.on('data', chunk => {
      text += chunk;
    });
    client.on('close', () => resolve(text));
  });
}

describe('HubEnvironment over node', () => {
  it('reports the home, temp directory, platform, pid and extension version', () => {
    expect(env.homeDir).toBe(os.homedir());
    expect(env.tmpDir).toBe(os.tmpdir());
    expect(env.platform).toBe(process.platform);
    expect(env.pid).toBe(process.pid);
    expect(env.version).toBe('2.9.0');
  });

  it('builds its layer from this machine', async () => {
    const built = await Effect.runPromise(
      Effect.service(HubEnvironment).pipe(
        Effect.provide(hubEnvironmentLayer('3.0.0'))
      )
    );

    expect(built.version).toBe('3.0.0');
    expect(built.pid).toBe(process.pid);
  });

  it('hands out a fresh UUID token on every call', async () => {
    const first = await Effect.runPromise(env.randomToken);

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(await Effect.runPromise(env.randomToken)).not.toBe(first);
  });

  it('tells this live process from one that has exited', () => {
    const exited = spawnSync(process.execPath, ['-e', '']);

    expect(env.isAlive(process.pid)).toBe(true);
    expect(env.isAlive(exited.pid)).toBe(false);
  });

  it('lstats a dangling symlink that realpath cannot resolve', async () => {
    const link = join(dir, 'dangling');
    await fs.symlink(join(dir, 'nowhere'), link);

    await expect(Effect.runPromise(env.lstat(link))).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(env.lstat(join(dir, 'nowhere')))
    ).rejects.toMatchObject({ reason: 'NotFound' });
  });

  it('keeps any other errno apart from a missing entry', async () => {
    const file = join(dir, 'a.erd.json');
    await fs.writeFile(file, '{}');

    await expect(
      Effect.runPromise(env.lstat(join(file, 'under-a-file')))
    ).rejects.toMatchObject({ reason: 'Other' });
  });
});

describe('nodeRegistryIo', () => {
  it('resolves a symlink, and falls back to the path it was given', async () => {
    const target = join(dir, 'target');
    await fs.mkdir(target);
    await fs.symlink(target, join(dir, 'link'));

    expect(await nodeRegistryIo.realPath(join(dir, 'link'))).toBe(
      await fs.realpath(target)
    );
    expect(await nodeRegistryIo.realPath(join(dir, 'gone'))).toBe(
      join(dir, 'gone')
    );
    expect(nodeRegistryIo.platform).toBe(process.platform);
  });
});

/** Everything the listener spec needs of one accepted connection. */
function echoLines(socket: Socket.Socket, received: string[]) {
  return Effect.gen(function* () {
    const out = yield* Queue.unbounded<string, Done>();

    yield* Stream.fromQueue(out).pipe(
      Stream.pipeThroughChannel(Socket.toChannelString<never>(socket)),
      Stream.runForEach(text =>
        Effect.sync(() => {
          received.push(text);
          if (!received.join('').endsWith('\n')) return;
          Queue.offerUnsafe(out, 'ok\n');
          Queue.endUnsafe(out);
        })
      ),
      Effect.ignore
    );
  });
}

describe('HubListener over node:net', () => {
  const listener = Effect.runSync(
    Effect.service(HubListener).pipe(Effect.provide(hubListenerLayer))
  );

  /** Binds pipe, echoing one line back, until the returned close is called. */
  async function serve(pipe: string, received: string[]) {
    const scope = Effect.runSync(Scope.make());
    const connections = await Effect.runPromise(
      listener.listen(pipe).pipe(Effect.provideService(Scope.Scope, scope))
    );

    await Effect.runPromise(
      connections.pipe(
        Stream.runForEach(socket =>
          echoLines(socket, received).pipe(Effect.scoped, Effect.forkIn(scope))
        ),
        Effect.forkIn(scope)
      )
    );
    return () => Effect.runPromise(Scope.close(scope, Exit.void));
  }

  it('serves text both ways, with a character split across two writes', async () => {
    const pipe = join(dir, 'hub.sock');
    const received: string[] = [];
    const close = await serve(pipe, received);

    const client = connect(pipe);
    const reply = readUntilEnd(client);
    const bytes = Buffer.from('한\n');
    client.write(bytes.subarray(0, 1));
    client.write(bytes.subarray(1));

    expect(await reply).toBe('ok\n');
    expect(received.join('')).toBe('한\n');

    await close();
  });

  it('carries a payload larger than one read without losing a character', async () => {
    const pipe = join(dir, 'hub.sock');
    const received: string[] = [];
    const close = await serve(pipe, received);
    const payload = `${'테이블'.repeat(30_000)}\n`;

    const client = connect(pipe);
    const reply = readUntilEnd(client);
    client.write(Buffer.from(payload));

    expect(await reply).toBe('ok\n');
    expect(received.join('')).toBe(payload);
    expect(received.length).toBeGreaterThan(1);

    await close();
  });

  it('hangs up every peer when its scope closes, so nothing is left connected', async () => {
    const pipe = join(dir, 'hub.sock');
    const close = await serve(pipe, []);
    const client = connect(pipe);
    const ended = readUntilEnd(client);

    await close();

    expect(await ended).toBe('');
    await expect(fs.stat(pipe)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails with the pipe it could not bind', async () => {
    const scope = Effect.runSync(Scope.make());

    await expect(
      Effect.runPromise(
        listener
          .listen(join(dir, 'missing', 'hub.sock'))
          .pipe(Effect.provideService(Scope.Scope, scope))
      )
    ).rejects.toMatchObject({
      _tag: 'HubListenError',
      pipe: join(dir, 'missing', 'hub.sock'),
    });

    await Effect.runPromise(Scope.close(scope, Exit.void));
  });
});

describe('authorizePath over the real file system', () => {
  it('refuses both ways a write could follow a symlink out of the workspace', async () => {
    const root = await fs.realpath(dir);
    const ws = join(root, 'ws');
    const outside = join(root, 'outside');
    await fs.mkdir(ws);
    await fs.mkdir(outside);
    await fs.symlink(
      join(outside, 'planted.erd.json'),
      join(ws, 'schema.erd.json')
    );
    await fs.symlink(outside, join(ws, 'link'));
    const scope = { folders: [ws], documents: [] };
    const authorize = (path: string) =>
      Effect.runPromise(
        authorizePath(env.platform, scope, path).pipe(
          Effect.provide(
            Layer.mergeAll(
              NodeFileSystem.layer,
              Layer.succeed(HubEnvironment, env)
            )
          )
        )
      );

    await expect(authorize(join(ws, 'schema.erd.json'))).rejects.toMatchObject({
      code: HubErrorCode.outsideWorkspace,
    });
    await expect(
      authorize(`${ws}/missing/../link/x.erd.json`)
    ).rejects.toMatchObject({ code: HubErrorCode.outsideWorkspace });
    await expect(
      authorize(join(ws, 'link', 'x.erd.json'))
    ).rejects.toMatchObject({ code: HubErrorCode.outsideWorkspace });
    await expect(authorize(join(ws, 'new', 'b.erd.json'))).resolves.toBe(
      join(ws, 'new', 'b.erd.json')
    );
    expect(await fs.readdir(outside)).toEqual([]);
  });
});
