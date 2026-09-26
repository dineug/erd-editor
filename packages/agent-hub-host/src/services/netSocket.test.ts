import * as fs from 'node:fs/promises';
import * as net from 'node:net';
import * as os from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';
import { Socket } from 'effect/unstable/socket';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { fromNetSocket } from '@/services/netSocket';

let dir: string;
let server: net.Server;

beforeEach(async () => {
  dir = await fs.mkdtemp(join(os.tmpdir(), 'net-sock-'));
});

afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
  await fs.rm(dir, { recursive: true, force: true });
});

/** A connected pair: hub is the server end, peer the client end. */
async function pair(): Promise<{ hub: net.Socket; peer: net.Socket }> {
  const pipe = join(dir, 'p.sock');
  const accepted = new Promise<net.Socket>(resolve => {
    server = net.createServer(resolve);
  });
  await new Promise<void>(resolve => void server.listen(pipe, resolve));
  const peer = net.connect(pipe);
  await new Promise(resolve => peer.once('connect', resolve));
  return { hub: await accepted, peer };
}

/** Runs f with the socket's writer and reader, then releases both. */
function useSocket<A>(
  conn: net.Socket,
  f: (writer: Socket.Writer, pull: Socket.Reader['pull']) => Promise<A>
): Promise<A> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const socket = fromNetSocket(conn);
        const writer = yield* socket.writer;
        const reader = yield* socket.reader;
        return yield* Effect.promise(() => f(writer, reader.pull));
      })
    )
  );
}

describe('fromNetSocket', () => {
  it('writes one chunk and a batch, and reads what the peer sends', async () => {
    const { hub, peer } = await pair();
    peer.setEncoding('utf8');
    const seen: string[] = [];
    peer.on('data', chunk => void seen.push(chunk as unknown as string));

    const read = await useSocket(hub, async (writer, pull) => {
      await Effect.runPromise(writer.write('one\n'));
      await Effect.runPromise(writer.writeAll(['two\n', 'three\n']));
      peer.write('from the peer\n');
      return Effect.runPromise(pull);
    });

    expect(read.join('')).toBe('from the peer\n');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(seen.join('')).toBe('one\ntwo\nthree\n');
  });

  it('destroys the connection on a close event, without waiting for a flush', async () => {
    const { hub, peer } = await pair();
    const closed = new Promise(resolve => peer.once('close', resolve));

    await useSocket(hub, async writer => {
      await Effect.runPromise(writer.write(new Socket.CloseEvent(1006)));
      expect(hub.destroyed).toBe(true);
    });

    await closed;
  });

  it('answers a write to a connection already gone rather than failing', async () => {
    const { hub } = await pair();
    hub.destroy();

    await useSocket(hub, async writer => {
      await expect(
        Effect.runPromise(writer.write('late\n'))
      ).resolves.toBeUndefined();
    });
  });

  it('swallows a connection error raised before anything reads the socket', async () => {
    const { hub, peer } = await pair();

    fromNetSocket(hub);

    // Without a listener an error event throws where it is emitted, which in
    // the extension is the host's own accept callback.
    expect(() => hub.emit('error', new Error('ECONNRESET'))).not.toThrow();
    hub.destroy();
    peer.destroy();
  });

  it('fails the reader when the connection errors', async () => {
    const { hub } = await pair();

    const failure = await useSocket(hub, async (_writer, pull) => {
      const pulled = Effect.runPromise(Effect.flip(pull));
      hub.emit('error', new Error('ECONNRESET'));
      return pulled;
    });

    expect(failure.reason._tag).toBe('SocketReadError');
  });

  it('fails the reader when the peer hangs up', async () => {
    const { hub, peer } = await pair();

    const failure = await useSocket(hub, async (_writer, pull) => {
      const pulled = Effect.runPromise(Effect.flip(pull));
      peer.end();
      return pulled;
    });

    expect(failure.reason._tag).toBe('SocketCloseError');
  });

  it('waits for drain on a write the kernel buffer cannot take at once', async () => {
    const { hub, peer } = await pair();
    peer.pause();
    const payload = 'x'.repeat(4 * 1024 * 1024);

    await useSocket(hub, async writer => {
      const written = Effect.runPromise(writer.write(payload));
      peer.resume();
      await expect(written).resolves.toBeUndefined();
      expect(hub.writableLength).toBe(0);
    });
  });
});
