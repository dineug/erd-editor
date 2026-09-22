import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { isAlive, nodeIo } from '@/io';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'erd-io-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('nodeIo, the one real binding', () => {
  it('reads what the process is', () => {
    expect(nodeIo.platform()).toBe(process.platform);
    expect(nodeIo.cwd()).toBe(process.cwd());
    expect(nodeIo.homedir()).toBeTruthy();
    expect(nodeIo.randomId()).not.toBe(nodeIo.randomId());
  });

  it('writes, creates exclusively, stats, renames, lists and unlinks', async () => {
    const a = join(dir, 'a.erd.json');
    const b = join(dir, 'b.erd.json');

    await nodeIo.writeFile(a, 'one');
    await expect(nodeIo.createFile(a, 'two')).rejects.toMatchObject({
      code: 'EEXIST',
    });
    await nodeIo.createFile(b, 'two');
    expect(await nodeIo.readFile(b)).toBe('two');
    expect(await nodeIo.stat(a)).toMatchObject({ size: 3 });

    await nodeIo.rename(a, join(dir, 'c.erd.json'));
    await nodeIo.unlink(b);
    expect(await nodeIo.readdir(dir)).toEqual([
      { name: 'c.erd.json', directory: false },
    ]);
    expect(await readFile(join(dir, 'c.erd.json'), 'utf8')).toBe('one');
  });

  it('creates a file with the permission bits asked for, and stats them alone', async () => {
    const path = join(dir, 'private.erd.json');

    await nodeIo.writeFile(path, 'x', 0o600);
    expect(await nodeIo.stat(path)).toMatchObject({ size: 1, mode: 0o600 });
  });

  it('resolves symlinks', async () => {
    await nodeIo.writeFile(join(dir, 'real.erd.json'), '{}');
    await symlink(join(dir, 'real.erd.json'), join(dir, 'link.erd.json'));

    expect(await nodeIo.realpath(join(dir, 'link.erd.json'))).toBe(
      await nodeIo.realpath(join(dir, 'real.erd.json'))
    );
  });

  it('tells a live pid from a dead one', () => {
    expect(isAlive(process.pid)).toBe(true);
    expect(nodeIo.isAlive(2 ** 22 + 12345)).toBe(false);
  });
});

describe('connect over a real unix socket', () => {
  let server: Server | null = null;

  afterEach(async () => {
    await new Promise<void>(resolve =>
      server ? server.close(() => resolve()) : resolve()
    );
    server = null;
  });

  it('exchanges text both ways and reports the close', async () => {
    const pipe = join(dir, 'hub.sock');
    server = createServer(socket => {
      socket.setEncoding('utf8');
      socket.on('data', chunk => {
        socket.write(`echo ${chunk}`);
        socket.end();
      });
    });
    await new Promise<void>(resolve => server!.listen(pipe, resolve));

    const socket = await nodeIo.connect(pipe);
    const received: string[] = [];
    const closed = new Promise<void>(resolve => socket.onClose(resolve));
    socket.onData(chunk => received.push(chunk));
    socket.write('hi');
    await closed;

    expect(received.join('')).toBe('echo hi');
    socket.end();
  });

  it('rejects when nothing listens', async () => {
    await expect(nodeIo.connect(join(dir, 'none.sock'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
