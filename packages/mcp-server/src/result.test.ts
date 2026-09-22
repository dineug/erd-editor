import {
  actionTools,
  AgentToolError,
  toolByName,
} from '@dineug/erd-editor/agent.js';
import { PeerStoreError } from '@dineug/erd-editor/peer.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { SessionError } from '@/errors';
import { type SessionManager } from '@/session/manager';
import { ToolError } from '@/tools/errors';
import { registerEditTool } from '@/tools/register';
import {
  errorResult,
  jsonResult,
  NO_ENTRY_NOTE,
  textResult,
  toolRunResult,
  UNCHANGED_NOTE,
  undoResult,
} from '@/tools/result';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const run = (tool: string, batches: number, historyEntries: number) => ({
  mode: 'live' as const,
  path: '/work/a.erd.json',
  notes: [],
  run: { tool, actions: [], createdIds: [], batches, historyEntries },
});

const body = (result: ReturnType<typeof jsonResult>) =>
  JSON.parse((result.content[0] as { text: string }).text);

describe('tool results', () => {
  it('leaves out empty notes and keeps the rest compact', () => {
    expect(jsonResult({ a: 1, notes: [] }).content).toEqual([
      { type: 'text', text: '{"a":1}' },
    ]);
    expect(body(jsonResult({ a: 1, notes: ['n'] }))).toEqual({
      a: 1,
      notes: ['n'],
    });
  });

  it('puts a read in its own block and notes in a second one', () => {
    expect(textResult('DDL', []).content).toHaveLength(1);
    expect(textResult('DDL', ['n']).content[1]).toEqual({
      type: 'text',
      text: '{"notes":["n"]}',
    });
  });

  it('says why erd_undo will pass a call over', () => {
    const setting = toolByName.get('erd_set_database_name')!;
    const flag = toolByName.get('erd_set_column_unique')!;

    expect(body(toolRunResult(setting, run(setting.name, 1, 0)))).toMatchObject(
      {
        undoable: false,
        undoNote: expect.stringMatching(/keeps no undo entry/),
      }
    );
    expect(body(toolRunResult(flag, run(flag.name, 0, 0))).undoNote).toBe(
      UNCHANGED_NOTE
    );
    expect(body(toolRunResult(flag, run(flag.name, 1, 0))).undoNote).toBe(
      NO_ENTRY_NOTE
    );
    expect(body(toolRunResult(flag, run(flag.name, 1, 1)))).not.toHaveProperty(
      'undoable'
    );
  });

  it('carries a count mismatch through', () => {
    const tool = toolByName.get('erd_add_table')!;
    const outcome = run(tool.name, 2, 1);
    Object.assign(outcome.run, {
      mismatch: { expectedBatches: '1', expectedHistory: '1' },
    });

    expect(body(toolRunResult(tool, outcome)).mismatch).toEqual({
      expectedBatches: '1',
      expectedHistory: '1',
    });
  });

  it('names what an undo or redo passed over, or that nothing was left', () => {
    const outcome = (label: string | null, skipped: string[]) => ({
      mode: 'headless' as const,
      path: '/work/a.erd.json',
      notes: [],
      result: { label, entries: label ? 1 : 0, skipped },
    });

    expect(
      body(
        undoResult('erd_undo', outcome('erd_add_table', ['erd_set_database']))
      )
    ).toEqual({
      tool: 'erd_undo',
      mode: 'headless',
      toolName: 'erd_add_table',
      entries: 1,
      skipped: ['erd_set_database'],
    });
    expect(body(undoResult('erd_redo', outcome(null, []))).notes).toEqual([
      'Nothing to redo: this agent has no edit left to redo on this document.',
    ]);
  });

  it('turns refusals into coded errors, and anything else into a logged internal one', () => {
    const coded = [
      new ToolError('notFound', 'erd_add_column', 'no table'),
      new PeerStoreError('readonly', 'erd_add_table'),
      new AgentToolError('invalidArgs', 'erd_read', 'vendor applies to sql'),
      new SessionError('blocked', 'hub off'),
    ].map(error => body(errorResult(error)));
    expect(coded).toEqual([
      { error: { code: 'notFound', message: 'no table' } },
      {
        error: {
          code: 'readonly',
          message: 'the document is readonly, so no edit was made',
        },
      },
      { error: { code: 'invalidArgs', message: 'vendor applies to sql' } },
      { error: { code: 'blocked', message: 'hub off' } },
    ]);

    const internal = errorResult(new TypeError('bug'));
    expect(internal.isError).toBe(true);
    expect(body(internal)).toEqual({
      error: { code: 'internal', message: 'bug' },
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('edit tool registration', () => {
  it('refuses a registry tool whose own argument is named path', () => {
    const server = new McpServer({ name: 't', version: '0' });
    const clash = {
      ...actionTools[0],
      name: 'erd_clash',
      args: [
        { name: 'path', kind: { type: 'string' as const }, required: true },
      ],
    };

    expect(() => registerEditTool(server, {} as SessionManager, clash)).toThrow(
      /erd_clash has an argument named path/
    );
  });
});
