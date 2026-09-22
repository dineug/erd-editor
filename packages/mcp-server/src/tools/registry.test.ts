import { createPeerStore } from '@dineug/erd-editor/peer.js';
import { describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import { createSeededPeer } from '@/__test-utils__/seed';
import { actionTools } from '@/tools/registry';
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
  'erd_set_show',
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
