import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test';

import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryIo } from '@/__test-utils__/memoryIo';
import { SQL_VENDORS } from '@/tools/read';
import { isDestructive, SESSION_TOOL_NAMES } from '@/tools/register';
import { actionTools } from '@/tools/registry';

let mcp: McpHarness;
let tools: Awaited<ReturnType<McpHarness['client']['listTools']>>['tools'];

beforeAll(async () => {
  mcp = await connectMcp({ io: createMemoryIo() });
  const listed = await mcp.client.listTools();
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

describe('the tool surface (AC-M8)', () => {
  it('is the six session tools and every registry tool: 59 in all', () => {
    expect(tools.map(({ name }) => name)).toEqual([
      ...SESSION_TOOL_NAMES,
      ...actionTools.map(({ name }) => name),
    ]);
    expect(actionTools).toHaveLength(53);
    expect(tools).toHaveLength(59);
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

    expect(description).toMatch(/whole raw \.erd\.json document, large/);
    expect(description).toMatch(/use snapshot for editing/);
    expect(description).toMatch(/never write this into the file/);
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

  it('marks reads read-only and removals and imports destructive', () => {
    expect(tool('erd_read').annotations).toEqual({ readOnlyHint: true });
    expect(tool('erd_list_documents').annotations).toEqual({
      readOnlyHint: true,
    });

    const destructive = tools
      .filter(({ annotations }) => annotations?.destructiveHint)
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

  it('refuses arguments of the wrong shape before a session is touched', async () => {
    const refused = await mcp.call('erd_move_table', {
      path: '/work/a.erd.json',
      tableId: 't',
      x: 'left',
      y: 1,
    });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/Input validation error/);
    expect(mcp.erd.manager.paths()).toEqual([]);
  });

  it('introduces itself with the server name, version and instructions', () => {
    expect(mcp.client.getServerVersion()).toEqual({
      name: 'erd-editor',
      version: '0.1.0',
    });
    expect(mcp.client.getInstructions()).toMatch(/erd_read format snapshot/);
  });
});
