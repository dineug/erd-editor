import type { PeerStore } from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import { createSeededPeer, SEED } from '@/__test-utils__/seed';
import { actionTools } from '@/tools/registry';
import { runTool } from '@/tools/run';

const peers: PeerStore[] = [];

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
});

function seededPeer() {
  const peer = createSeededPeer();
  peers.push(peer);
  return peer;
}

const run = (peer: PeerStore, name: string) =>
  runTool(peer, name, TOOL_SCENARIOS[name]);

/**
 * Where each creating tool's new ids now live on the peer, read back from the
 * document so a returned id is checked against what the call really made.
 */
const LISTED: Record<string, (peer: PeerStore) => string[]> = {
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
    name => {
      const peer = seededPeer();
      const before = new Set(LISTED[name](peer));

      const { createdIds } = run(peer, name);

      expect(createdIds.length).toBeGreaterThan(0);
      expect(createdIds.filter(id => before.has(id))).toEqual([]);
      expect(LISTED[name](peer)).toEqual(expect.arrayContaining(createdIds));
    }
  );

  it('returns the new column’s id, which its table now lists', () => {
    const peer = seededPeer();

    const { createdIds } = run(peer, 'erd_add_column');

    expect(peer.state.collections.tableEntities[SEED.empty].columnIds).toEqual(
      createdIds
    );
  });

  it('draws a fresh id on every call', () => {
    const peer = seededPeer();

    const first = runTool(peer, 'erd_add_table', {});
    const second = runTool(peer, 'erd_add_table', {});

    expect(first.createdIds[0]).not.toBe(second.createdIds[0]);
  });

  it('returns no id from a tool that creates nothing', () => {
    for (const tool of actionTools.filter(({ name }) => !(name in LISTED))) {
      const peer = seededPeer();
      const { createdIds } = run(peer, tool.name);

      expect(createdIds, tool.name).toEqual([]);
    }
  });
});
