import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { createServer, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

import { toSvg } from '@dineug/erd-editor/svg.js';
import {
  HUB_PROTOCOL_VERSION,
  lockDirPath,
  lockFilePath,
} from '@dineug/erd-editor-agent-hub';
import { describe, expect, it } from 'vite-plus/test';

import {
  documentFromSql,
  emptyDocument,
  SHOP_SQL,
} from '@/__test-utils__/documents';

const packageDir = join(import.meta.dirname, '..');
const manifest = JSON.parse(
  readFileSync(join(packageDir, 'package.json'), 'utf8')
);
const bin = join(packageDir, manifest.bin['erd-editor-mcp']);

/**
 * The gzip size, level 9, the built file may reach, since npx downloads it on
 * every cold start: 600,000 bytes, set by the owner as a regression watch with
 * room for features to come. Sizes by this spec's zlib: AGENTS.md.
 */
const BUNDLE_GZIP_BUDGET = 600_000;

/**
 * The specifiers of the import statements that open an ESM file, where the
 * bundler hoists every static import. Scanning the whole text would also hit
 * an import the bundle only quotes, inside a string or a template.
 */
function leadingImports(source: string): string[] {
  const statement =
    /^\s*import\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+)["']\s*;?/;
  const specifiers: string[] = [];
  let rest = source.replace(/^#!.*\n/, '');
  for (let match = statement.exec(rest); match; match = statement.exec(rest)) {
    specifiers.push(match[1]);
    rest = rest.slice(match[0].length);
  }
  return specifiers;
}

/**
 * Talks to the built file over stdio, one JSON-RPC line at a time, and ends
 * stdin once every request has its response. A notification the server sends
 * on its own, such as tools/list_changed, is a line too, so ids are counted.
 */
function exchange(
  file: string,
  messages: object[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<{ lines: any[]; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], {
      cwd: tmpdir(),
      ...options,
    });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      const responses = stdout
        .split('\n')
        .slice(0, -1)
        .filter(line => 'id' in JSON.parse(line));
      if (responses.length >= messages.filter(m => 'id' in m).length) {
        child.stdin.end();
      }
    });
    child.on('error', reject);
    child.on('close', code => {
      resolve({
        lines: stdout
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line)),
        code,
      });
    });
    for (const message of messages) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }
  });
}

describe('the built single file (AC-M9, AC-P7)', () => {
  it('exists where package.json bin points, readable and runnable, the one file of dist', () => {
    expect(existsSync(bin)).toBe(true);
    expect(statSync(bin).size).toBeGreaterThan(0);
    expect(readdirSync(dirname(bin))).toEqual(['erd-editor-mcp.js']);
  });

  it('starts with the shebang line', () => {
    expect(readFileSync(bin, 'utf8').split('\n')[0]).toBe(
      '#!/usr/bin/env node'
    );
  });

  it('imports nothing but node builtins, statically or by a dynamic import', () => {
    const source = readFileSync(bin, 'utf8');
    const imports = leadingImports(source);
    const builtins = new Set(builtinModules);

    expect(imports.length).toBeGreaterThan(0);
    expect(
      imports.filter(
        specifier => !specifier.startsWith('node:') && !builtins.has(specifier)
      )
    ).toEqual([]);
    expect(source.match(/(?<![\w$.])import\s*\(\s*["'`]/g)).toBeNull();
  });

  it('stays within its gzip budget', () => {
    const gzip = gzipSync(readFileSync(bin), { level: 9 }).length;
    // An observation beside the gate, for the size table in AGENTS.md.
    console.info(`erd-editor-mcp.js: gzip level 9 ${gzip} bytes`);
    expect(gzip).toBeLessThanOrEqual(BUNDLE_GZIP_BUDGET);
  });

  it('carries neither ws nor undici, nor the effect modules that reach a dynamic import', () => {
    const source = readFileSync(bin, 'utf8');

    expect(source.match(/Sec-WebSocket-Accept/g)).toBeNull();
    expect(source.match(/undici/gi)).toBeNull();
    expect(source.match(/SchemaAOTCompiler|Migrator/g)).toBeNull();
  });

  it('answers initialize and tools/list over stdio from a folder with no node_modules, then exits when stdin ends', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'erd-mcp-bin-'));
    const lone = join(dir, 'erd-editor-mcp.js');
    await copyFile(bin, lone);

    const { lines, code } = await exchange(lone, [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'bin-test', version: '1.0.0' },
        },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ]);

    const byId = new Map(lines.map(line => [line.id, line]));
    expect(byId.get(1).result.serverInfo).toEqual({
      name: 'erd-editor',
      version: manifest.version,
    });
    expect(byId.get(2).result.tools).toHaveLength(78);
    expect(lines.every(line => line.jsonrpc === '2.0')).toBe(true);
    expect(code).toBe(0);
    await rm(dir, { recursive: true, force: true });
  }, 20_000);

  it('refuses on Windows a new document named with a colon, which Node would write as a stream of another file, and creates it elsewhere', async () => {
    const home = await mkdtemp(join(tmpdir(), 'erd-mcp-home-'));
    const cwd = await mkdtemp(join(tmpdir(), 'erd-mcp-cwd-'));

    try {
      const { lines } = await exchange(
        bin,
        [
          {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-06-18',
              capabilities: {},
              clientInfo: { name: 'bin-test', version: '1.0.0' },
            },
          },
          { jsonrpc: '2.0', method: 'notifications/initialized' },
          {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'erd_open_document',
              arguments: { path: 'orders:v2.erd', create: true },
            },
          },
        ],
        { cwd, env: { ...process.env, HOME: home, USERPROFILE: home } }
      );
      const { result } = lines.find(line => line.id === 2);

      if (process.platform === 'win32') {
        expect(result.isError).toBe(true);
        expect(JSON.parse(result.content[0].text).error.code).toBe(
          'invalidPath'
        );
        expect(await readdir(cwd)).toEqual([]);
      } else {
        expect(result.isError).toBeFalsy();
        expect(await readdir(cwd)).toEqual(['orders:v2.erd']);
      }
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(cwd, { recursive: true, force: true });
    }
  }, 20_000);
});

/**
 * Preloaded into the built file, it notes on stderr, as each response is
 * written, whether globalThis.document exists then, and defines nothing itself.
 */
const DOCUMENT_PROBE = `
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => {
  const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
  for (const line of text.split('\\n').filter(Boolean)) {
    try {
      const { id } = JSON.parse(line);
      if (id !== undefined) {
        process.stderr.write('probe ' + JSON.stringify({ id, document: typeof globalThis.document }) + '\\n');
      }
    } catch {}
  }
  return write(chunk, ...rest);
};
`;

/**
 * The built file run as a client would, a JSON-RPC line at a time; request
 * settles with the response of its id, and stderr is kept, a probe's notes included.
 */
function converse(
  file: string,
  options: { cwd: string; env: NodeJS.ProcessEnv; nodeArgs?: string[] }
) {
  const child = spawn(process.execPath, [...(options.nodeArgs ?? []), file], {
    cwd: options.cwd,
    env: options.env,
  });
  const closed = new Promise<number | null>(resolve =>
    child.on('close', code => resolve(code))
  );
  const answers = new Map<number, (message: any) => void>();
  let stdout = '';
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => (stderr += chunk));
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
    const lines = stdout.split('\n');
    stdout = lines.pop() ?? '';
    for (const line of lines.filter(Boolean)) {
      const message = JSON.parse(line);
      answers.get(message.id)?.(message);
    }
  });
  const send = (message: object) =>
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  const request = (id: number, method: string, params: object) =>
    new Promise<any>(resolve => {
      answers.set(id, resolve);
      send({ id, method, params });
    });

  return {
    child,
    closed,
    send,
    request,
    call: (id: number, name: string, args: object) =>
      request(id, 'tools/call', { name, arguments: args }),
    stderr: () => stderr,
  };
}

describe('the built file drawing an svg', () => {
  it('exports to a file and as text from a folder with no node_modules, no document defined before the first export, and reads after it', async () => {
    const home = await realpath(await mkdtemp(join(tmpdir(), 'erd-mcp-home-')));
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'erd-mcp-svg-')));
    const lone = join(dir, 'erd-editor-mcp.js');
    const probe = join(dir, 'probe.mjs');
    const shop = documentFromSql(SHOP_SQL);
    await copyFile(bin, lone);
    await writeFile(probe, DOCUMENT_PROBE);
    await writeFile(join(dir, 'shop.erd.json'), shop);
    const server = converse(lone, {
      cwd: dir,
      env: { ...process.env, HOME: home, USERPROFILE: home },
      nodeArgs: ['--import', pathToFileURL(probe).href],
    });

    try {
      await server.request(1, 'initialize', {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'bin-test', version: '1.0.0' },
      });
      server.send({ method: 'notifications/initialized' });
      const scripts = await server.call(2, 'erd_read', {
        path: 'shop.erd.json',
        format: 'scripts',
      });
      const written = await server.call(3, 'erd_export_svg', {
        path: 'shop.erd.json',
        output: 'shop.svg',
      });
      const inline = await server.call(4, 'erd_export_svg', {
        path: 'shop.erd.json',
      });
      const snapshot = await server.call(5, 'erd_read', {
        path: 'shop.erd.json',
        format: 'snapshot',
      });
      server.child.stdin.end();
      expect(await server.closed).toBe(0);

      const svg = await toSvg(shop);
      expect(scripts.result.content[0].text).toBe('{"before":"","after":""}');
      expect(JSON.parse(written.result.content[0].text)).toMatchObject({
        mode: 'headless',
        path: join(dir, 'shop.erd.json'),
        output: join(dir, 'shop.svg'),
        bytes: Buffer.byteLength(svg, 'utf8'),
      });
      expect(await readFile(join(dir, 'shop.svg'), 'utf8')).toBe(svg);
      expect(inline.result.content.map(({ text }: any) => text)).toEqual([
        svg,
        '{"mode":"headless"}',
      ]);
      expect(
        JSON.parse(snapshot.result.content[0].text)
          .tables.map(({ name }: any) => name)
          .sort()
      ).toEqual(['orders', 'users']);

      const seen = server
        .stderr()
        .split('\n')
        .filter(line => line.startsWith('probe '))
        .map(line => JSON.parse(line.slice('probe '.length)));
      expect(seen).toEqual([
        { id: 1, document: 'undefined' },
        { id: 2, document: 'undefined' },
        { id: 3, document: 'object' },
        { id: 4, document: 'object' },
        { id: 5, document: 'object' },
      ]);
      expect(server.stderr()).not.toMatch(/failed/);
    } finally {
      server.child.kill('SIGKILL');
      await rm(home, { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  }, 20_000);
});

/**
 * The built file on a hub over a real socket that answers until an edit's
 * batch arrives and never after, so the call waits on it with the focus the
 * call moved queued behind; stop is how the server is then asked to end.
 */
async function stopWithCallInFlight(stop: 'stdin' | 'SIGINT') {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'erd-mcp-home-')));
  const cwd = await realpath(await mkdtemp(join(tmpdir(), 'erd-mcp-cwd-')));
  const document = join(cwd, 'a.erd.json');
  const initialValue = emptyDocument();
  await writeFile(document, initialValue);
  const pipe =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\erd-mcp-bin-test-${process.pid}`
      : join(home, 'hub.sock');

  let heldEdit!: () => void;
  const edited = new Promise<void>(resolve => (heldEdit = resolve));
  const sockets: Socket[] = [];
  const hub = createServer(socket => {
    sockets.push(socket);
    let buffer = '';
    let holding = false;
    socket.setEncoding('utf8');
    socket.on('error', () => undefined);
    socket.on('data', chunk => {
      const lines = (buffer + chunk).split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines.filter(Boolean)) {
        const { id, method, params } = JSON.parse(line);
        if (
          method === 'applyActions' &&
          JSON.stringify(params).includes('memo.add')
        ) {
          holding = true;
          heldEdit();
        }
        if (holding) continue;
        const result =
          method === 'hello'
            ? {
                protocolVersion: HUB_PROTOCOL_VERSION,
                ide: 'vscode',
                version: '2.9.0',
              }
            : method === 'openDocument'
              ? { path: params.path, opened: false, webviews: 1 }
              : method === 'join'
                ? { initialValue, snapshotVersion: 0, readonly: false }
                : { webviews: 1 };
        socket.write(`${JSON.stringify({ id, ok: true, method, result })}\n`);
      }
    });
  });
  await new Promise<void>(resolve => hub.listen(pipe, resolve));
  await mkdir(lockDirPath(home), { recursive: true, mode: 0o700 });
  await writeFile(
    lockFilePath(home, process.pid),
    JSON.stringify({
      pipe,
      workspaceFolders: [cwd],
      documents: [document],
      ide: 'vscode',
      version: '2.9.0',
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: 'token',
      hub: true,
    }),
    { mode: 0o600 }
  );

  const { child, closed, send, request } = converse(bin, {
    cwd,
    env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  const pause = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms));

  try {
    await request(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'bin-test', version: '1.0.0' },
    });
    send({ method: 'notifications/initialized' });
    const table = await request(2, 'tools/call', {
      name: 'erd_add_table',
      arguments: { path: 'a.erd.json' },
    });
    expect(JSON.parse(table.result.content[0].text).mode).toBe('live');
    // Past the 100 ms a peer holds a focus back, so the next call queues one behind its edit.
    await pause(150);
    send({
      id: 3,
      method: 'tools/call',
      params: { name: 'erd_add_memo', arguments: { path: 'a.erd.json' } },
    });
    await edited;
    await pause(50);

    const start = Date.now();
    if (stop === 'stdin') child.stdin.end();
    else child.kill('SIGINT');
    const code = await Promise.race([closed, pause(5_000).then(() => 'alive')]);
    return { code, ms: Date.now() - start };
  } finally {
    child.kill('SIGKILL');
    for (const socket of sockets) socket.destroy();
    hub.close();
    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

describe('the built file with an edit in flight on a hub that stopped answering', () => {
  const exitsWith = async (stop: 'stdin' | 'SIGINT', code: number) => {
    const exit = await stopWithCallInFlight(stop);
    console.info(`erd-editor-mcp.js: exit on ${stop} after ${exit.ms} ms`);
    expect(exit.code).toBe(code);
  };

  it('exits when stdin ends it, with 0', () => exitsWith('stdin', 0), 20_000);

  // Node's kill is TerminateProcess on Windows whatever the signal, so no
  // handler runs there; a Ctrl+C reaches a process only through its console,
  // and manager.test.ts's signal case holds the shutdown it would start.
  it.skipIf(process.platform === 'win32')(
    'exits when SIGINT ends it, with 130',
    () => exitsWith('SIGINT', 130),
    20_000
  );
});
