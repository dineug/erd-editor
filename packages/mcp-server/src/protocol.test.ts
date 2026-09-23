import { HUB_PROTOCOL_VERSION } from '@dineug/erd-editor-agent-hub';
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
import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';

const DOCUMENT = '/work/versions.erd.json';

let io: MemoryHost;
let mcp: McpHarness;

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  io = createMemoryHost();
  io.put(DOCUMENT, emptyDocument());
  mcp = await connectMcp({ host: io });
});

afterEach(async () => {
  await mcp.close();
  vi.restoreAllMocks();
});

describe('protocol version mismatch (AC-M5)', () => {
  it('names the extension as the side to update when the lock is older', async () => {
    createFakeHub(io, {
      pid: 9191,
      workspaceFolders: ['/work'],
      lockProtocolVersion: HUB_PROTOCOL_VERSION - 1,
    });

    const refused = await mcp.call('erd_add_table', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('protocolMismatch');
    expect(refused.json.error.message).toContain(
      'Update the ERD Editor extension'
    );
  });

  it('names the MCP server as the side to update when the hub answers hello newer', async () => {
    const hub = createFakeHub(io, {
      pid: 9292,
      workspaceFolders: ['/work'],
      helloProtocolVersion: HUB_PROTOCOL_VERSION + 1,
    });

    const refused = await mcp.call('erd_add_table', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('protocolMismatch');
    expect(refused.json.error.message).toContain(
      'npx -y @dineug/erd-editor-mcp@latest'
    );
    expect(io.read(DOCUMENT)).toBe(emptyDocument());
    hub.destroy();
  });

  it('reports a token the hub refuses', async () => {
    const hub = createFakeHub(io, { pid: 9393, workspaceFolders: ['/work'] });
    io.writeLock(hub.pid, { ...hub.lock(), token: 'stale' });

    const refused = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'json',
    });
    expect(refused.json.error.code).toBe('unauthorized');
    hub.destroy();
  });

  it('reports a hub the lock advertises but nothing listens on, and writes nothing', async () => {
    const hub = createFakeHub(io, { pid: 9494, workspaceFolders: ['/work'] });
    io.servers.delete(hub.pipe);

    const refused = await mcp.call('erd_add_table', { path: DOCUMENT });
    expect(refused.json.error.code).toBe('hubUnreachable');
    expect(io.read(DOCUMENT)).toBe(emptyDocument());
  });
});
