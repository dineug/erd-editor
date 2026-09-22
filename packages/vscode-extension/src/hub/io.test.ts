import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { connect, type Socket } from 'node:net';
import * as os from 'node:os';
import { join } from 'node:path';

import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { authorizePath } from '@/hub/authz';
import { type HubSocket, nodeHubIo } from '@/hub/io';

let dir: string;

beforeEach(async () => {
  // Short on purpose: the socket path below has to stay under sun_path.
  dir = await fs.mkdtemp(join(os.tmpdir(), 'hub-io-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function modeOf(stats: { mode: number }) {
  return stats.mode & 0o777;
}

/** Collects everything the peer sends until it closes the connection. */
function readUntilEnd(client: Socket): Promise<string> {
  client.setEncoding('utf8');
  return new Promise(resolve => {
    let text = '';
    client.on('data', chunk => {
      text += chunk;
    });
    client.on('close', () => resolve(text));
  });
}

describe('nodeHubIo', () => {
  it('reports the home, temp directory, platform and pid of this process', () => {
    expect(nodeHubIo.homedir()).toBe(os.homedir());
    expect(nodeHubIo.tmpdir()).toBe(os.tmpdir());
    expect(nodeHubIo.platform()).toBe(process.platform);
    expect(nodeHubIo.pid()).toBe(process.pid);
  });

  it('hands out a fresh UUID token on every call', () => {
    const first = nodeHubIo.randomToken();

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(nodeHubIo.randomToken()).not.toBe(first);
  });

  it('creates the directory and its parents with the mode, and accepts one that exists', async () => {
    const nested = join(dir, 'a', 'b');

    await nodeHubIo.mkdir(nested, 0o700);
    await nodeHubIo.mkdir(nested, 0o700);

    expect(modeOf(await fs.stat(nested))).toBe(0o700);
  });

  it('writes a file with the mode, then reads, lists, stats, renames and deletes it', async () => {
    const path = join(dir, 'lock.json.tmp');
    const renamed = join(dir, 'lock.json');

    await nodeHubIo.writeFile(path, '{"hub":true}', 0o600);
    expect(modeOf(await fs.stat(path))).toBe(0o600);
    expect(await nodeHubIo.readFile(path)).toBe('{"hub":true}');
    expect(await nodeHubIo.readdir(dir)).toEqual(['lock.json.tmp']);
    expect((await nodeHubIo.stat(path)).mtimeMs).toBeGreaterThan(0);

    await nodeHubIo.rename(path, renamed);
    // rename keeps the mode of the file it moves, which is what makes the
    // lock's atomic rewrite safe.
    expect(modeOf(await fs.stat(renamed))).toBe(0o600);

    await nodeHubIo.unlink(renamed);
    await expect(nodeHubIo.readFile(renamed)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('resolves a symlink with realpath', async () => {
    const target = join(dir, 'target');
    await fs.mkdir(target);
    await fs.symlink(target, join(dir, 'link'));

    expect(await nodeHubIo.realpath(join(dir, 'link'))).toBe(
      await fs.realpath(target)
    );
  });

  it('lstats a dangling symlink that realpath cannot resolve', async () => {
    const link = join(dir, 'dangling');
    await fs.symlink(join(dir, 'nowhere'), link);

    await expect(nodeHubIo.realpath(link)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(nodeHubIo.lstat(link)).resolves.toBeDefined();
    await expect(nodeHubIo.lstat(join(dir, 'nowhere'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('lets authorizePath refuse both ways a write could follow a symlink out of the workspace', async () => {
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
      authorizePath(nodeHubIo, nodeHubIo.platform(), scope, path);

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

  it('tells this live process from one that has exited', () => {
    const exited = spawnSync(process.execPath, ['-e', '']);

    expect(nodeHubIo.isAlive(process.pid)).toBe(true);
    expect(nodeHubIo.isAlive(exited.pid)).toBe(false);
  });

  it('serves a unix socket: text both ways, a UTF-8 character split across writes, end and close', async () => {
    const pipe = join(dir, 'hub.sock');
    const received: string[] = [];
    let serverSawClose = false;
    const handle = await nodeHubIo.listen(pipe, (socket: HubSocket) => {
      socket.onClose(() => {
        serverSawClose = true;
      });
      socket.onData(chunk => {
        received.push(chunk);
        if (received.join('') === '한\n') {
          socket.write('ok\n');
          socket.end();
        }
      });
    });

    const client = connect(pipe);
    const reply = readUntilEnd(client);
    const bytes = Buffer.from('한\n');
    client.write(bytes.subarray(0, 1));
    client.write(bytes.subarray(1));

    expect(await reply).toBe('ok\n');
    expect(received.join('')).toBe('한\n');
    await expect.poll(() => serverSawClose).toBe(true);

    await handle.close();
    await expect(fs.stat(pipe)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('destroys a connection at once', async () => {
    const pipe = join(dir, 'hub.sock');
    const handle = await nodeHubIo.listen(pipe, socket => socket.destroy());

    const client = connect(pipe);
    expect(await readUntilEnd(client)).toBe('');

    await handle.close();
  });

  it('rejects when the socket path cannot be bound', async () => {
    // The code differs by platform and sandbox (ENOENT, EACCES), the failure does not.
    await expect(
      nodeHubIo.listen(join(dir, 'missing', 'hub.sock'), () => undefined)
    ).rejects.toThrow(/^listen /);
  });
});
