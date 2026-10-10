import { bHas, relationshipActions } from '@dineug/erd-editor/peer.js';
import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { settle } from '@/__test-utils__/mcp';
import { TOOL_SCENARIOS } from '@/__test-utils__/scenarios';
import {
  createPeerSession,
  type PeerSession,
  SEED,
} from '@/__test-utils__/seed';
import { entityReader, readDocument } from '@/tools/read';
import { actionTools } from '@/tools/registry';
import { runTool } from '@/tools/run';

const { ColumnUIKey } = SchemaV3Constants;

const sessions: PeerSession[] = [];

afterEach(() => {
  sessions.splice(0).forEach(session => session.destroy());
});

/** The hooks a load or an edit schedules land on timers of a few milliseconds. */
const quiet = () => settle(30);

/**
 * Two peer stores take each other's batches through receive and converge; the
 * convergence with the element side's store is kept by erd-editor's
 * engine/peer-store.converge.test.ts.
 */
describe('two peers converge over every tool (AC-E5)', () => {
  it.each(actionTools.map(({ name }) => name))(
    'after %s both sides serialize the same document',
    async name => {
      const session = createPeerSession();
      sessions.push(session);
      await quiet();

      const run = runTool(session.agent, name, TOOL_SCENARIOS[name]);
      await quiet();

      expect(run.batches).toBeGreaterThan(0);
      expect(JSON.parse(session.agent.value)).toEqual(
        JSON.parse(session.other.value)
      );
    }
  );
});

/**
 * No tool sends relationship.changeColumns, the edit the editor's Map Columns
 * dialog makes, but an agent joined to that editor takes it like any batch.
 */
describe('a mapping the editor changes reaches the agent', () => {
  it('erd_get and erd_read show the columns the relationship now ends on', async () => {
    const session = createPeerSession();
    sessions.push(session);
    await quiet();

    const start = { tableId: SEED.users, columnIds: [SEED.userId] };
    const end = { tableId: SEED.orders, columnIds: [SEED.orderId] };
    session.other.dispatch([
      relationshipActions.changeRelationshipColumnsAction({
        id: SEED.relationship,
        start,
        end,
      }),
    ]);
    await quiet();

    const { state } = session.agent;
    const mapping = {
      id: SEED.relationship,
      relationshipType: 'OneN',
      start,
      end,
    };
    const got = JSON.parse(
      entityReader({ relationshipIds: [SEED.relationship] }).render(state)
    );
    expect(got.relationships).toEqual([expect.objectContaining(mapping)]);
    const snapshot = JSON.parse(readDocument(state, 'snapshot'));
    expect(snapshot.relationships).toEqual([expect.objectContaining(mapping)]);

    // What the engine reads off the mapping follows it on the agent's side:
    // the foreign key mark moves to the new end column, and a relationship
    // ending on the child's whole primary key becomes identifying.
    const { collections } = JSON.parse(readDocument(state, 'json'));
    const isForeignKey = (columnId: string) =>
      bHas(
        collections.tableColumnEntities[columnId].ui.keys,
        ColumnUIKey.foreignKey
      );
    expect(isForeignKey(SEED.orderId)).toBe(true);
    expect(isForeignKey(SEED.orderUser)).toBe(false);
    expect(
      collections.relationshipEntities[SEED.relationship].identification
    ).toBe(true);
    expect(JSON.parse(session.agent.value)).toEqual(
      JSON.parse(session.other.value)
    );
  });
});
