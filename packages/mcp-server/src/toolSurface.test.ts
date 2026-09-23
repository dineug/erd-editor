import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import {
  connectMcp,
  type ListedTools,
  type McpHarness,
  RpcError,
} from '@/__test-utils__/mcp';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import { SERVER_VERSION } from '@/server';
import { SQL_VENDORS } from '@/tools/read';
import { actionTools } from '@/tools/registry';
import { isDestructive, SESSION_TOOL_NAMES } from '@/tools/toolkit';

const DOCUMENT = '/work/a.erd.json';

let mcp: McpHarness;
let tools: ListedTools['tools'];

beforeAll(async () => {
  const io = createMemoryHost();
  io.put(DOCUMENT, emptyDocument());
  mcp = await connectMcp({ host: io });
  const listed = await mcp.listTools();
  tools = listed.tools;
  // An observation, not a gate: the bytes every agent reads before its first call.
  console.info(
    `tools/list: ${tools.length} tools, ${new TextEncoder().encode(JSON.stringify(listed)).length} bytes`
  );
});

afterAll(async () => {
  await mcp.close();
});

const tool = (name: string) => {
  const found = tools.find(candidate => candidate.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return found;
};

/** A call's JSON-RPC error; fails the spec when the call was answered. */
const rpcError = async (name: string, args: Record<string, unknown>) => {
  const error = await mcp.call(name, args).then(
    () => null,
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(RpcError);
  return error as RpcError;
};

/** The four hints every listed tool carries, the MCP defaults filled in. */
const hints = (readOnlyHint: boolean, destructiveHint: boolean) => ({
  readOnlyHint,
  destructiveHint,
  idempotentHint: false,
  openWorldHint: true,
});

describe('the tool surface (AC-M8)', () => {
  it('is the eight session tools and every registry tool: 61 in all', () => {
    expect(tools.map(({ name }) => name).sort()).toEqual(
      [...SESSION_TOOL_NAMES, ...actionTools.map(({ name }) => name)].sort()
    );
    expect(SESSION_TOOL_NAMES).toHaveLength(8);
    expect(actionTools).toHaveLength(53);
    expect(tools).toHaveLength(61);
  });

  it('lists the session toolkit, then the read tools, then the registry, in its order', () => {
    expect(tools.map(({ name }) => name)).toEqual([
      'erd_list_documents',
      'erd_open_document',
      'erd_save',
      'erd_undo',
      'erd_redo',
      'erd_read',
      'erd_list',
      'erd_get',
      ...actionTools.map(({ name }) => name),
    ]);
  });

  it('gives erd_read the three formats and the vendor list', () => {
    const { properties, required } = tool('erd_read').inputSchema as any;

    expect(properties.format.enum).toEqual(['snapshot', 'sql', 'json']);
    expect(properties.vendor.enum).toEqual([...SQL_VENDORS]);
    expect(required).toEqual(['path', 'format']);
  });

  it('warns in the json format that it is large and never to write the file', () => {
    const { description } = (tool('erd_read').inputSchema as any).properties
      .format;

    expect(description).toMatch(/whole raw \.erd\.json document, larger/);
    expect(description).toMatch(/never write this into the file/);
    expect(tool('erd_read').description).toMatch(/prefer erd_list and erd_get/);
  });

  it('gives erd_list the path alone and erd_get a list of ids per kind', () => {
    const list = tool('erd_list').inputSchema as any;
    const get = tool('erd_get').inputSchema as any;

    expect(Object.keys(list.properties)).toEqual(['path']);
    expect(list.required).toEqual(['path']);
    expect(Object.keys(get.properties)).toEqual([
      'path',
      'tableIds',
      'relationshipIds',
      'indexIds',
      'memoIds',
    ]);
    expect(get.required).toEqual(['path']);
    expect(get.properties.tableIds).toMatchObject({
      type: 'array',
      items: { type: 'string' },
    });
  });

  it('adds a required path to every edit tool beside its registry arguments', () => {
    for (const { name, args } of actionTools) {
      const { properties, required } = tool(name).inputSchema as any;
      expect(Object.keys(properties)).toEqual([
        'path',
        ...args.map(arg => arg.name),
      ]);
      expect(required).toEqual([
        'path',
        ...args.filter(arg => arg.required).map(arg => arg.name),
      ]);
    }
  });

  it('marks reads read-only and removals and imports destructive, the other hints at their defaults', () => {
    expect(tool('erd_read').annotations).toEqual(hints(true, true));
    expect(tool('erd_list').annotations).toEqual(hints(true, true));
    expect(tool('erd_get').annotations).toEqual(hints(true, true));
    expect(tool('erd_list_documents').annotations).toEqual(hints(true, true));
    expect(tool('erd_add_table').annotations).toEqual(hints(false, false));
    expect(tool('erd_save').annotations).toEqual(hints(false, false));

    const destructive = tools
      .filter(
        ({ annotations }) =>
          annotations.destructiveHint && !annotations.readOnlyHint
      )
      .map(({ name }) => name);
    expect(destructive).toEqual([
      'erd_remove_table',
      'erd_remove_columns',
      'erd_remove_relationship',
      'erd_remove_index',
      'erd_remove_index_column',
      'erd_remove_memo',
      'erd_import_sql',
      'erd_import_graphql',
      'erd_import_dbml',
      'erd_import_aml',
      'erd_import_json',
    ]);
    expect(destructive.every(isDestructive)).toBe(true);
  });

  it('describes every tool and every property', () => {
    for (const { description, inputSchema } of tools) {
      expect(description).toBeTruthy();
      for (const property of Object.values<any>(inputSchema.properties ?? {})) {
        expect(property.description).toBeTruthy();
      }
    }
  });

  it('closes the arguments of every edit tool and read tool, and of no other session tool', () => {
    const closed = tools
      .filter(({ inputSchema }) => inputSchema.additionalProperties === false)
      .map(({ name }) => name);

    expect(closed).toEqual([
      'erd_read',
      'erd_list',
      'erd_get',
      ...actionTools.map(({ name }) => name),
    ]);
  });

  it('keeps every input schema inline, with no $defs', () => {
    expect(tools.filter(({ inputSchema }) => '$defs' in inputSchema)).toEqual(
      []
    );
  });

  it('introduces itself with the server name, version and instructions', () => {
    const { result } = mcp.initialize;

    expect(result.serverInfo).toEqual({
      name: 'erd-editor',
      version: SERVER_VERSION,
    });
    expect(result.instructions).toMatch(/Find ids with erd_list/);
    expect(result.instructions).toMatch(/with erd_get/);
  });
});

describe('tool arguments', () => {
  it('refuses arguments of the wrong shape with -32602 before a session is touched', async () => {
    const error = await rpcError('erd_move_table', {
      path: DOCUMENT,
      tableId: 't',
      x: 'left',
      y: 1,
    });

    expect(error.code).toBe(-32602);
    expect(error.message).toMatch(/erd_move_table.*\n.*\["x"\]/);
    expect(mcp.manager.paths()).toEqual([]);
  });

  it('refuses an argument an edit tool does not take with -32602', async () => {
    const error = await rpcError('erd_add_table', {
      path: DOCUMENT,
      bogus: 1,
    });

    expect(error.code).toBe(-32602);
    expect(error.message).toMatch(/excess property\n.*\["bogus"\]/);
    expect(mcp.manager.paths()).toEqual([]);
  });

  it('refuses an unknown argument and an unknown format of erd_read with -32602', async () => {
    const unknown = await rpcError('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
      bogus: 1,
    });
    const format = await rpcError('erd_read', {
      path: DOCUMENT,
      format: 'yaml',
    });

    expect([unknown.code, format.code]).toEqual([-32602, -32602]);
    expect(unknown.message).toMatch(/^Invalid parameters for tool 'erd_read'/);
    expect(format.message).toMatch(/\["format"\]/);
    expect(mcp.manager.paths()).toEqual([]);
  });

  it('refuses a session tool argument of the wrong shape or a missing one with an isError result', async () => {
    const create = await mcp.call('erd_open_document', {
      path: DOCUMENT,
      create: 'yes',
    });
    const missing = await mcp.call('erd_undo', {});

    expect([create.isError, missing.isError]).toEqual([true, true]);
    expect([create.json.error.code, missing.json.error.code]).toEqual([
      'invalidArgs',
      'invalidArgs',
    ]);
    expect(create.json.error.message).toMatch(
      /^Invalid arguments for tool erd_open_document: .*\n.*\["create"\]/
    );
    expect(missing.json.error.message).toMatch(
      /^Invalid arguments for tool erd_undo: .*\n.*\["path"\]/
    );
    expect(create.structured).toBeUndefined();
    expect(mcp.manager.paths()).toEqual([]);
  });

  it('answers a tool name it does not list with -32602', async () => {
    const error = await rpcError('erd_nope', {});

    expect(error.code).toBe(-32602);
    expect(error.message).toBe("Tool 'erd_nope' not found");
  });

  it('lets erd_list_documents ignore a key it does not take', async () => {
    const plain = await mcp.call('erd_list_documents', {});
    const extra = await mcp.call('erd_list_documents', { bogus: 1 });

    expect(extra.isError).toBe(false);
    expect(extra.text).toBe(plain.text);
    expect(plain.json.documents.map(({ path }: any) => path)).toEqual([
      DOCUMENT,
    ]);
  });
});
