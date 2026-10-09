import { settingsActions } from '@dineug/erd-editor/peer.js';
import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { stubSessions } from '@/__test-utils__/effect';
import { connectLayer, connectMcp, RpcError } from '@/__test-utils__/mcp';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import { createSeededPeer } from '@/__test-utils__/seed';
import { layerWithSessions } from '@/server';
import { readDocument } from '@/tools/read';
import { ReadParams } from '@/tools/read.tool';
import { toolInputSchema } from '@/tools/schema';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the input schema of a hand-added tool', () => {
  it('is one closed object with erd_read arguments', () => {
    expect(toolInputSchema('erd_read', ReadParams, true)).toMatchObject({
      type: 'object',
      required: ['path', 'format'],
      additionalProperties: false,
    });
  });
});

describe('the DDL erd_read writes', () => {
  const DOCUMENT = '/work/shop.erd.json';

  it('hands the statements and header asked for to the generator', async () => {
    const peer = createSeededPeer();
    peer.dispatch([
      settingsActions.changeDatabaseNameAction({ value: 'shop' }),
      settingsActions.changeDDLScriptAction({
        position: 'before',
        value: 'SET NAMES utf8mb4;',
      }),
    ]);
    const io = createMemoryHost();
    io.put(DOCUMENT, peer.value);
    const mcp = await connectMcp({ host: io });
    const options = { statements: 'recreate', header: 'createAndUse' } as const;

    const sql = await mcp.text('erd_read', {
      path: DOCUMENT,
      format: 'sql',
      vendor: 'MySQL',
      ...options,
    });
    expect(sql).toBe(
      readDocument(peer.state, 'sql', 'MySQL', undefined, options)
    );
    expect(sql).toMatch(
      /^\nCREATE DATABASE IF NOT EXISTS shop;\nUSE shop;\n\nSET NAMES utf8mb4;\n/
    );

    const refused = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'json',
      header: 'use',
    });
    expect(refused.isError).toBe(true);
    expect(refused.json.error).toEqual({
      code: 'invalidArgs',
      message: 'statements and header apply to the sql format only, not json',
    });
    peer.destroy();
    await mcp.close();
  });
});

describe('the scripts erd_read gives', () => {
  const DOCUMENT = '/work/shop.erd.json';

  it('answers the two scripts alone as plain text, and refuses an argument of the sql format', async () => {
    const peer = createSeededPeer();
    peer.dispatch([
      settingsActions.changeDDLScriptAction({
        position: 'after',
        value: 'GRANT SELECT ON users TO PUBLIC;',
      }),
    ]);
    const io = createMemoryHost();
    io.put(DOCUMENT, peer.value);
    const mcp = await connectMcp({ host: io });

    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'scripts',
    });
    expect(read.isError).toBe(false);
    expect(read.texts).toEqual([
      '{"before":"","after":"GRANT SELECT ON users TO PUBLIC;"}',
    ]);
    expect(read.structured).toBeUndefined();

    const refused = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'scripts',
      tableNames: ['users'],
    });
    expect(refused.isError).toBe(true);
    expect(refused.json.error).toEqual({
      code: 'invalidArgs',
      message:
        'tableIds, tableNames and groupNames apply to the sql format only, not scripts; erd_get takes tableIds and tableNames too',
    });
    peer.destroy();
    await mcp.close();
  });
});

describe('a call that fails unexpectedly', () => {
  it('answers erd_read with an internal error for a defect, logged, and keeps serving', async () => {
    const mcp = await connectLayer(
      layerWithSessions(
        stubSessions({ read: () => Effect.die(new TypeError('bug')) })
      ),
      { clientName: 'stub' }
    );

    const error = await mcp
      .call('erd_read', { path: '/work/a.erd.json', format: 'snapshot' })
      .catch((reason: unknown) => reason);

    // The dated protocols answer a handler's internal error with -32603 (effect
    // #8552). PROTOCOLS does not list 2025-11-25, which answers it as an isError
    // result instead.
    expect(error).toBeInstanceOf(RpcError);
    expect(error).toMatchObject({
      code: -32603,
      message: 'Tool execution failed due to an internal server error.',
    });
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'a tool call failed',
      expect.stringContaining('TypeError: bug')
    );
    expect((await mcp.listTools()).tools).toHaveLength(63);
    await mcp.close();
  });

  it('answers an edit tool with the internal code for a rejection that is no refusal, logged', async () => {
    const mcp = await connectLayer(
      layerWithSessions(
        stubSessions({ runTool: () => Effect.fail(new TypeError('bug')) })
      )
    );

    const refused = await mcp.call('erd_add_table', {
      path: '/work/a.erd.json',
    });

    expect(refused.isError).toBe(true);
    expect(refused.json).toEqual({
      error: { code: 'internal', message: 'bug' },
    });
    expect(console.error).toHaveBeenCalledWith(
      '[erd-editor-mcp]',
      'a tool call failed',
      expect.any(TypeError)
    );
    await mcp.close();
  });
});
