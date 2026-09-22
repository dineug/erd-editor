// @vitest-environment node

import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { type AgentPeer, createAgentPeer } from '@/agent/peer';
import { actionTools } from '@/agent/registry';

const peers: AgentPeer[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function seededPeer() {
  const peer = createAgentPeer({ nickname: 'agent', presence: false });
  peers.push(peer);
  peer.setInitialValue(createSeedValue());
  return peer;
}

const run = (peer: AgentPeer, name: string) =>
  peer.runTool(name, TOOL_SCENARIOS[name]);

/**
 * Where each creating tool's new ids now live on the peer, read back from the
 * document so a returned id is checked against what the call really made.
 */
const LISTED: Record<string, (peer: AgentPeer) => string[]> = {
  erd_add_table: peer => peer.state.doc.tableIds,
  erd_add_column: peer =>
    peer.state.collections.tableEntities[SEED.empty].columnIds,
  erd_add_memo: peer => peer.state.doc.memoIds,
  erd_add_index: peer => peer.state.doc.indexIds,
  erd_add_index_column: peer =>
    peer.state.collections.indexEntities[SEED.index].indexColumnIds,
  erd_add_relationship: peer => [
    ...peer.state.doc.relationshipIds,
    ...peer.state.collections.tableEntities[SEED.empty].columnIds,
    ...peer.state.collections.tableEntities[SEED.users].columnIds,
  ],
  erd_link_columns: peer => peer.state.doc.relationshipIds,
};

describe('creation tools hand back the ids they drew (AC-E7)', () => {
  it.each(Object.keys(LISTED))(
    '%s returns new ids the document now lists',
    async name => {
      const peer = seededPeer();
      const before = new Set(LISTED[name](peer));

      const { createdIds } = await run(peer, name);

      expect(createdIds.length).toBeGreaterThan(0);
      expect(createdIds.filter(id => before.has(id))).toEqual([]);
      expect(LISTED[name](peer)).toEqual(expect.arrayContaining(createdIds));
    }
  );

  it('returns the new column’s id, which its table now lists', async () => {
    const peer = seededPeer();

    const { createdIds } = await run(peer, 'erd_add_column');

    expect(peer.state.collections.tableEntities[SEED.empty].columnIds).toEqual(
      createdIds
    );
  });

  it('draws a fresh id on every call', async () => {
    const peer = seededPeer();

    const first = await peer.runTool('erd_add_table', {});
    const second = await peer.runTool('erd_add_table', {});

    expect(first.createdIds[0]).not.toBe(second.createdIds[0]);
  });

  it('returns no id from a tool that creates nothing', async () => {
    for (const tool of actionTools.filter(({ name }) => !(name in LISTED))) {
      const peer = seededPeer();
      const { createdIds } = await run(peer, tool.name);

      expect(createdIds, tool.name).toEqual([]);
    }
  });
});
