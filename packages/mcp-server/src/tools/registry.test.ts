import { createPeerStore } from '@dineug/erd-editor/peer.js';
import { describe, expect, it } from 'vite-plus/test';

import { APPEND_SCENARIOS, TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import { createSeededPeer } from '@/__test-utils__/seed';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import { actionTools } from '@/tools/registry';
import { MAX_DDL_SCRIPT_CHARS } from '@/tools/registry/settings';
import { runTool, type ToolRun } from '@/tools/run';

type Peer = ReturnType<typeof createSeededPeer>;

const onPeer = <T>(peer: Peer, task: (peer: Peer) => T): T => {
  try {
    return task(peer);
  } finally {
    peer.destroy();
  }
};

const onSeed = <T>(task: (peer: Peer) => T): T =>
  onPeer(createSeededPeer(), task);

const onEmpty = <T>(task: (peer: Peer) => T): T =>
  onPeer(createPeerStore({ nickname: 'agent', presence: false }), task);

const run = (name: string): ToolRun =>
  onSeed(peer => runTool(peer, name, TOOL_SCENARIOS[name]));

/** The tools whose generator yields nothing once the value it sets already holds. */
const IDEMPOTENT = [
  'erd_set_column_primary_key',
  'erd_set_column_unique',
  'erd_set_column_not_null',
  'erd_set_column_auto_increment',
  'erd_set_index_unique',
  'erd_set_index_column_order',
  'erd_add_index_column',
];

describe('the registry', () => {
  it('leaves the path argument to the MCP layer, which adds it to every tool', () => {
    for (const tool of actionTools) {
      expect(
        tool.args.every(({ name }) => name !== 'path'),
        tool.name
      ).toBe(true);
    }
  });

  it('runs every tool on the seed inside the batch and history counts it declared', () => {
    for (const { name } of actionTools) {
      const outcome = run(name);
      expect([name, outcome.mismatch]).toEqual([name, undefined]);
      expect(outcome.tool).toBe(name);
    }
  });

  it('runs every import with mode append on the seed inside the counts it declared, in one batch', () => {
    for (const [name, args] of Object.entries(APPEND_SCENARIOS)) {
      const outcome = onSeed(peer => runTool(peer, name, args));
      expect([name, outcome.mismatch, outcome.batches]).toEqual([
        name,
        undefined,
        1,
      ]);
    }
  });

  it('sends nothing for an append of a text that declares no table', () => {
    const outcome = onSeed(peer =>
      runTool(peer, 'erd_import_sql', { value: 'SELECT 1;', mode: 'append' })
    );
    expect(outcome.batches).toBe(0);
    expect(outcome.mismatch).toBeUndefined();
  });

  it('sends nothing the second time a tool sets a value the document already holds', () => {
    for (const name of IDEMPOTENT) {
      const counts = onSeed(peer => [
        runTool(peer, name, TOOL_SCENARIOS[name]).batches,
        runTool(peer, name, TOOL_SCENARIOS[name]).batches,
      ]);
      expect([name, counts]).toEqual([name, [1, 0]]);
    }
  });

  it('sorts nothing in a document with no table', () => {
    const outcome = onEmpty(peer => runTool(peer, 'erd_sort_tables', {}));
    expect(outcome.batches).toBe(0);
    expect(outcome.mismatch).toBeUndefined();
  });
});

describe('erd_set_ddl_script', () => {
  const scripts = (peer: Peer) => peer.state.settings.ddlScripts;

  const refusal = (call: () => unknown): ToolError => {
    try {
      call();
    } catch (error) {
      if (error instanceof ToolError) return error;
      throw error;
    }
    throw new Error('the call was accepted');
  };

  it('sets the script at the position it names and leaves the other', () => {
    onSeed(peer => {
      runTool(peer, 'erd_set_ddl_script', {
        position: 'after',
        sql: 'GRANT SELECT ON users TO app;',
      });

      expect(scripts(peer)).toEqual({
        before: '',
        after: 'GRANT SELECT ON users TO app;',
      });
    });
  });

  it('takes 10,000 characters and refuses one more, leaving the script as it was', () => {
    onSeed(peer => {
      const longest = 'x'.repeat(MAX_DDL_SCRIPT_CHARS);
      runTool(peer, 'erd_set_ddl_script', { position: 'before', sql: longest });

      const tooLong = refusal(() =>
        runTool(peer, 'erd_set_ddl_script', {
          position: 'before',
          sql: `${longest}x`,
        })
      );

      expect(MAX_DDL_SCRIPT_CHARS).toBe(10_000);
      expect(tooLong.code).toBe(ToolErrorCode.invalidArgs);
      expect(tooLong.message).toBe(
        'sql is 10,001 characters, over the 10,000 a script takes'
      );
      expect(scripts(peer).before).toBe(longest);
    });
  });

  it('refuses a position other than before or after', () => {
    onSeed(peer => {
      const bad = refusal(() =>
        runTool(peer, 'erd_set_ddl_script', { position: 'middle', sql: 'x' })
      );

      expect(bad.code).toBe(ToolErrorCode.invalidArgs);
      expect(scripts(peer)).toEqual({ before: '', after: '' });
    });
  });

  it('removes a script with an empty string', () => {
    onSeed(peer => {
      runTool(peer, 'erd_set_ddl_script', { position: 'before', sql: 'a' });
      runTool(peer, 'erd_set_ddl_script', { position: 'before', sql: '' });

      expect(scripts(peer)).toEqual({ before: '', after: '' });
      expect(JSON.parse(peer.value).settings).not.toHaveProperty('ddlScripts');
    });
  });

  it('puts back the script it replaced with one undo, and sets it again with one redo', () => {
    onSeed(peer => {
      runTool(peer, 'erd_set_ddl_script', { position: 'before', sql: 'one' });
      const run = runTool(peer, 'erd_set_ddl_script', {
        position: 'before',
        sql: 'two',
      });

      expect(run.historyEntries).toBe(1);
      expect(peer.undo()).toMatchObject({
        label: 'erd_set_ddl_script',
        entries: 1,
      });
      expect(scripts(peer).before).toBe('one');

      peer.redo();
      expect(scripts(peer).before).toBe('two');
    });
  });
});
