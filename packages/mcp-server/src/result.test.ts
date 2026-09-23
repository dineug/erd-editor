import { PeerStoreError } from '@dineug/erd-editor/peer.js';
import * as Schema from 'effect/Schema';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { emptyDocument } from '@/__test-utils__/documents';
import { connectMcp, type McpHarness } from '@/__test-utils__/mcp';
import { createMemoryHost, type MemoryHost } from '@/__test-utils__/memoryHost';
import { SessionError } from '@/errors';
import { ToolError } from '@/tools/errors';
import { actionTools, toolByName } from '@/tools/registry';
import {
  errorResult,
  isRefusal,
  jsonBody,
  NO_ENTRY_NOTE,
  refusal,
  textResult,
  toolRunResult,
  UNCHANGED_NOTE,
  undoResult,
} from '@/tools/result';
import {
  EditToolkit,
  SessionToolkit,
  ToolRefusal,
  toTool,
} from '@/tools/toolkit';

/** The text block the SDK-based server's jsonResult wrote for a payload, kept here as the reference. */
function referenceText(payload: Record<string, unknown>): string {
  const { notes, ...rest } = payload;
  const body =
    Array.isArray(notes) && notes.length ? { ...rest, notes } : { ...rest };
  return JSON.stringify(body);
}

/** The text block the SDK-based server's errorResult wrote for a refusal. */
const referenceRefusal = (code: string, message: string) =>
  JSON.stringify({ error: { code, message } });

/** The text the toolkit writes for a success value: the value encoded by the tool's schema. */
const written = (schema: Schema.Top, value: unknown) =>
  JSON.stringify(
    Schema.encodeUnknownSync(schema as Schema.Codec<unknown>)(value)
  );

const run = (tool: string, batches: number, historyEntries: number) => ({
  mode: 'live' as const,
  path: '/work/a.erd.json',
  notes: [] as string[],
  run: { tool, actions: [], createdIds: [], batches, historyEntries },
});

describe('tool results', () => {
  it('leaves out empty notes and keeps the rest in order', () => {
    expect(jsonBody({ a: 1, notes: [] })).toEqual({ a: 1 });
    expect(JSON.stringify(jsonBody({ notes: ['n'], a: 1 }))).toBe(
      '{"a":1,"notes":["n"]}'
    );
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

    expect(toolRunResult(setting, run(setting.name, 1, 0))).toMatchObject({
      undoable: false,
      undoNote: expect.stringMatching(/keeps no undo entry/),
    });
    expect(toolRunResult(flag, run(flag.name, 0, 0)).undoNote).toBe(
      UNCHANGED_NOTE
    );
    expect(toolRunResult(flag, run(flag.name, 1, 0)).undoNote).toBe(
      NO_ENTRY_NOTE
    );
    expect(toolRunResult(flag, run(flag.name, 1, 1))).not.toHaveProperty(
      'undoable'
    );
  });

  it('carries a count mismatch through', () => {
    const tool = toolByName.get('erd_add_table')!;
    const outcome = run(tool.name, 2, 1);
    Object.assign(outcome.run, {
      mismatch: { expectedBatches: '1', expectedHistory: '1' },
    });

    expect(toolRunResult(tool, outcome).mismatch).toEqual({
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
      undoResult('erd_undo', outcome('erd_add_table', ['erd_set_database']))
    ).toEqual({
      tool: 'erd_undo',
      mode: 'headless',
      toolName: 'erd_add_table',
      entries: 1,
      skipped: ['erd_set_database'],
    });
    expect(undoResult('erd_redo', outcome(null, [])).notes).toEqual([
      'Nothing to redo: this agent has no edit left to redo on this document.',
    ]);
  });

  it('gives refusals their code, and anything else the internal one', () => {
    const coded = [
      new ToolError('notFound', 'erd_add_column', 'no table'),
      new PeerStoreError('readonly', 'erd_add_table'),
      new ToolError('invalidArgs', 'erd_read', 'vendor applies to sql'),
      new SessionError('blocked', 'hub off'),
    ];
    expect(coded.every(isRefusal)).toBe(true);
    expect(coded.map(refusal)).toEqual([
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

    expect(isRefusal(new TypeError('bug'))).toBe(false);
    expect(refusal(new TypeError('bug'))).toEqual({
      error: { code: 'internal', message: 'bug' },
    });
  });

  it('writes a refusal as its own isError result for erd_read', () => {
    const result = errorResult(refusal(new SessionError('blocked', 'no')));

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: 'text', text: referenceRefusal('blocked', 'no') },
    ]);
  });
});

describe('the text blocks against the reference writers', () => {
  const outcome = (notes: string[]) => ({
    ...run('erd_add_table', 1, 1),
    notes,
    run: {
      tool: 'erd_add_table',
      actions: [],
      createdIds: ['t1'],
      batches: 2,
      historyEntries: 0,
      mismatch: { expectedBatches: '1', expectedHistory: '1' },
    },
  });

  it.each(actionTools.map(({ name }) => [name]))(
    '%s encodes to the reference bytes, with and without its optional keys',
    name => {
      const tool = toolByName.get(name)!;
      const { successSchema } = EditToolkit.tools[name];

      for (const notes of [[], ['a note']]) {
        const body = toolRunResult(tool, outcome(notes));
        expect(written(successSchema, body)).toBe(
          referenceText({
            tool: 'erd_add_table',
            mode: 'live',
            createdIds: ['t1'],
            batches: 2,
            historyEntries: 0,
            undoable: false,
            undoNote: body.undoNote,
            mismatch: { expectedBatches: '1', expectedHistory: '1' },
            notes,
          })
        );
      }
      const plain = toolRunResult(tool, {
        ...run(name, 1, 1),
        run: { ...run(name, 1, 1).run, createdIds: ['t1'] },
      });
      expect(written(successSchema, plain)).toBe(
        referenceText({
          tool: name,
          mode: 'live',
          createdIds: ['t1'],
          batches: 1,
          historyEntries: 1,
          notes: [],
        })
      );
    }
  );

  it('encodes the five session toolkit results to the reference bytes', () => {
    const { tools } = SessionToolkit;
    const document = {
      path: '/work/a.erd.json',
      open: true,
      active: false,
      dirty: true,
      readonly: false,
    };
    const list = { mode: 'live', documents: [document], notes: ['n'] };
    const open = {
      mode: 'headless',
      path: '/work/a.erd.json',
      created: true,
      opened: false,
      notes: [],
    };
    const save = { tool: 'erd_save', mode: 'live', saved: true, notes: [] };
    const reverted = undoResult('erd_undo', {
      mode: 'live',
      path: '/work/a.erd.json',
      notes: ['n'],
      result: { label: 'erd_add_table', entries: 1, skipped: ['erd_x'] },
    });
    const empty = undoResult('erd_redo', {
      mode: 'live',
      path: '/work/a.erd.json',
      notes: [],
      result: { label: null, entries: 0, skipped: [] },
    });

    expect(
      written(tools.erd_list_documents.successSchema, jsonBody(list))
    ).toBe(referenceText(list));
    expect(written(tools.erd_open_document.successSchema, jsonBody(open))).toBe(
      referenceText(open)
    );
    expect(written(tools.erd_save.successSchema, jsonBody(save))).toBe(
      referenceText(save)
    );
    expect(written(tools.erd_undo.successSchema, reverted)).toBe(
      referenceText({
        tool: 'erd_undo',
        mode: 'live',
        toolName: 'erd_add_table',
        entries: 1,
        skipped: ['erd_x'],
        notes: ['n'],
      })
    );
    expect(written(tools.erd_redo.successSchema, empty)).toBe(
      referenceText({
        tool: 'erd_redo',
        mode: 'live',
        toolName: null,
        entries: 0,
        notes: [
          'Nothing to redo: this agent has no edit left to redo on this document.',
        ],
      })
    );
  });

  it('encodes a refusal to the reference bytes', () => {
    const refused = refusal(new ToolError('notFound', 'erd_x', 'no table t'));

    expect(written(ToolRefusal, refused)).toBe(
      referenceRefusal('notFound', 'no table t')
    );
  });
});

describe('the results a client receives', () => {
  const DOCUMENT = '/work/a.erd.json';
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

  it('writes an edit, an undo, a save and a listing as the reference text, the same value structured beside', async () => {
    const added = await mcp.call('erd_add_table', { path: DOCUMENT });
    const [tableId] = added.json.createdIds;
    const undone = await mcp.call('erd_undo', { path: DOCUMENT });
    const saved = await mcp.call('erd_save', { path: DOCUMENT });
    const listed = await mcp.call('erd_list_documents');

    expect(added.text).toBe(
      referenceText({
        tool: 'erd_add_table',
        mode: 'headless',
        createdIds: [tableId],
        batches: 1,
        historyEntries: 1,
        notes: [],
      })
    );
    expect(undone.text).toBe(
      referenceText({
        tool: 'erd_undo',
        mode: 'headless',
        toolName: 'erd_add_table',
        entries: 1,
        notes: [],
      })
    );
    expect(saved.json).toMatchObject({ tool: 'erd_save', saved: true });
    expect(saved.text).toBe(referenceText(saved.json));
    expect(listed.text).toBe(
      referenceText({
        mode: 'headless',
        documents: [
          {
            path: DOCUMENT,
            open: false,
            active: false,
            dirty: false,
            readonly: false,
          },
        ],
        notes: [],
      })
    );
    for (const outcome of [added, undone, saved, listed]) {
      expect(outcome.structured).toEqual(outcome.json);
    }
  });

  it('writes a refusal as an isError result with no structured content', async () => {
    const refused = await mcp.call('erd_add_column', {
      path: DOCUMENT,
      tableId: 'missing',
    });

    expect(refused.isError).toBe(true);
    expect(refused.texts).toEqual([refused.text]);
    expect(refused.structured).toBeUndefined();
    expect(refused.json.error.code).toBe('notFound');
    expect(refused.text).toBe(
      referenceRefusal('notFound', refused.json.error.message)
    );
    // A refusal is the caller's to act on, not the server's to log.
    expect(console.error).not.toHaveBeenCalled();
  });

  it('writes an erd_read refusal as the reference text, and a read as plain text', async () => {
    const refused = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
      vendor: 'MySQL',
    });
    const read = await mcp.call('erd_read', {
      path: DOCUMENT,
      format: 'snapshot',
    });

    expect(refused).toMatchObject({ isError: true, structured: undefined });
    expect(refused.texts).toEqual([
      referenceRefusal(
        'invalidArgs',
        'vendor applies to the sql format only, not snapshot'
      ),
    ]);
    expect(read).toMatchObject({ isError: false, structured: undefined });
    expect(read.json.tables).toEqual([]);
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('edit tool declaration', () => {
  it('refuses a registry tool whose own argument is named path', () => {
    const clash = {
      ...actionTools[0],
      name: 'erd_clash',
      args: [
        { name: 'path', kind: { type: 'string' as const }, required: true },
      ],
    };

    expect(() => toTool(clash)).toThrow(/erd_clash has an argument named path/);
  });
});
