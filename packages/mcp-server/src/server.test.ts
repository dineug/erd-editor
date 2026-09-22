import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { createFakeHub } from '@/__test-utils__/fakeHub';
import { connectMcp } from '@/__test-utils__/mcp';
import { createMemoryIo } from '@/__test-utils__/memoryIo';
import {
  createErdMcpServer,
  DEFAULT_CLIENT_NAME,
  SERVER_VERSION,
  startStdioServer,
  SWEEP_INTERVAL_MS,
} from '@/server';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Lines the server wrote to its stdout, parsed. */
function responses(stdout: PassThrough) {
  const lines: any[] = [];
  let buffer = '';
  stdout.setEncoding('utf8');
  stdout.on('data', chunk => {
    buffer += chunk;
    const parts = buffer.split('\n');
    buffer = parts.pop()!;
    lines.push(...parts.filter(Boolean).map(line => JSON.parse(line)));
  });
  return lines;
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 200 && !check(); i++) {
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};

describe('the server', () => {
  it('carries the version package.json publishes', () => {
    const manifest = JSON.parse(
      readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')
    );
    expect(SERVER_VERSION).toBe(manifest.version);
    expect(SWEEP_INTERVAL_MS).toBe(60_000);
  });

  it('builds on the real io unless told otherwise', async () => {
    const erd = createErdMcpServer();
    expect(erd.manager.paths()).toEqual([]);
    await erd.close();
    await erd.close();
  });

  it.each([
    ['codex', 'codex'],
    ['', DEFAULT_CLIENT_NAME],
  ])('introduces client %j to the hub as %j', async (clientName, expected) => {
    const io = createMemoryIo();
    io.put('/work/a.erd.json', emptyDocument());
    const hub = createFakeHub(io, { pid: 5656, workspaceFolders: ['/work'] });
    const mcp = await connectMcp({ io, clientName });

    await mcp.ok('erd_add_table', { path: '/work/a.erd.json' });
    expect([...hub.connections].map(({ client }) => client)).toEqual([
      expected,
    ]);
    await mcp.close();
    hub.destroy();
  });

  it('serves MCP over stdio and closes every session when stdin ends', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    const io = createMemoryIo();
    io.put('/work/a.erd.json', emptyDocument());
    const lines = responses(stdout);

    const erd = await startStdioServer({ stdin, stdout, io });
    const send = (message: object) =>
      stdin.write(`${JSON.stringify(message)}\n`);
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'stdio-test', version: '1' },
      },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'erd_add_table',
        arguments: { path: '/work/a.erd.json' },
      },
    });
    await until(() => lines.length >= 2);

    expect(lines[0].result.serverInfo.name).toBe('erd-editor');
    expect(JSON.parse(lines[1].result.content[0].text).mode).toBe('headless');
    expect(erd.manager.paths()).toEqual(['/work/a.erd.json']);

    const closeAll = vi.spyOn(erd.manager, 'closeAll');
    stdin.end();
    await until(() => erd.manager.paths().length === 0);
    expect(erd.manager.paths()).toEqual([]);
    await erd.close();
    expect(closeAll).toHaveBeenCalledTimes(1);
  });

  it('sweeps idle sessions on a timer and logs a sweep that fails', async () => {
    vi.useFakeTimers();
    const erd = await startStdioServer({
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      io: createMemoryIo(),
      sweepIntervalMs: 10,
    });
    const sweep = vi
      .spyOn(erd.manager, 'sweep')
      .mockRejectedValueOnce(new Error('stuck'))
      .mockResolvedValue([]);

    await vi.advanceTimersByTimeAsync(25);
    expect(sweep).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'idle sweep failed',
      expect.any(Error)
    );
    await erd.close();
  });

  it('logs a shutdown that fails', async () => {
    const stdin = new PassThrough();
    const erd = await startStdioServer({
      stdin,
      stdout: new PassThrough(),
      io: createMemoryIo(),
    });
    vi.spyOn(erd.manager, 'closeAll').mockRejectedValue(new Error('stuck'));

    stdin.end();
    await until(() => vi.mocked(console.error).mock.calls.length > 0);
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'shutdown failed',
      expect.any(Error)
    );
  });
});
