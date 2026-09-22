// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { TOOL_SCENARIOS } from '@/__test-utils__/agentScenarios';
import {
  comparable,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/agentSeed';
import { actionTools } from '@/agent/registry';
import {
  changeTableNameAction,
  sortTableAction,
} from '@/engine/modules/table/atom.actions';
import { changeColumnCommentAction } from '@/engine/modules/table-column/atom.actions';

const sessions: Session[] = [];

function open(options?: Parameters<typeof createSession>[0]) {
  const session = createSession(options);
  sessions.push(session);
  return session;
}

afterEach(() => {
  sessions.splice(0).forEach(session => session.destroy());
});

/** Both sides' documents, meta aside, since each replica stamps its own. */
const sides = ({ peer, user }: Session) => [
  comparable(peer.value),
  comparable(toJson(user.rxStore.state)),
];

const expectConverged = (session: Session) => {
  const [peer, user] = sides(session);
  expect(peer).toEqual(user);
};

describe('a peer and a user store converge (AC-E5)', () => {
  it.each(actionTools.map(({ name }) => name))(
    'after %s both sides serialize the same document',
    async name => {
      const session = open();
      await settle();

      const run = await session.peer.runTool(name, TOOL_SCENARIOS[name]);
      await settle();

      expect(run.batches).toBeGreaterThan(0);
      expectConverged(session);
    }
  );

  it.each(['erd_change_table_color', 'erd_change_memo_color'])(
    'converges after %s though the compressor sends it without a version',
    async name => {
      const session = open();
      await settle();

      await session.peer.runTool(name, TOOL_SCENARIOS[name]);
      await settle();

      const color = session.sent
        .flat()
        .find(({ type }) => type.endsWith('.changeColor'));

      expect(color?.version).toBeUndefined();
      expectConverged(session);
    }
  );

  it('converges on a color the stream compressor sent without a version', async () => {
    const session = open();
    await settle();

    const run = await session.peer.runTool('erd_change_table_color', {
      tableId: SEED.orders,
      color: '#00aa55',
    });
    await settle();

    const sentColor = session.sent
      .flat()
      .find(action => action.type === 'table.changeColor');

    expect(run.batches).toBe(1);
    expect(sentColor?.version).toBeUndefined();
    expect(session.user.rxStore.state.collections.tableEntities).toMatchObject({
      [SEED.orders]: { ui: { color: '#00aa55' } },
    });
    expectConverged(session);
  });

  it('converges when the user edits while the agent adds a column', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();

    session.user.rxStore.dispatchSync(
      changeTableNameAction({ id: SEED.orders, value: 'purchases' })
    );
    const run = await session.peer.runTool('erd_add_column', {
      tableId: SEED.orders,
    });

    expect(session.peer.state.collections.tableEntities[SEED.orders].name).toBe(
      'orders'
    );
    session.deliver();
    await settle();

    const orders = session.peer.state.collections.tableEntities[SEED.orders];
    expect(orders.name).toBe('purchases');
    expect(orders.columnIds).toContain(run.createdIds[0]);
    expectConverged(session);
  });

  it('converges when both sides edit different fields of one column', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();

    session.user.rxStore.dispatchSync(
      changeColumnCommentAction({
        id: SEED.userName,
        tableId: SEED.users,
        value: 'from the user',
      })
    );
    await session.peer.runTool('erd_change_column_name', {
      tableId: SEED.users,
      columnId: SEED.userName,
      value: 'from_the_agent',
    });
    session.deliver();
    await settle();

    expect(
      session.peer.state.collections.tableColumnEntities[SEED.userName]
    ).toMatchObject({ name: 'from_the_agent', comment: 'from the user' });
    expectConverged(session);
  });

  it('converges over a run of tools and the undo of the last one', async () => {
    const session = open();
    await settle();

    const { peer } = session;
    const added = await peer.runTool('erd_add_table', {});
    const tableId = added.createdIds[0];
    await peer.runTool('erd_change_table_name', { tableId, value: 'audit' });
    const column = await peer.runTool('erd_add_column', { tableId });
    await peer.runTool('erd_set_column_primary_key', {
      tableId,
      columnId: column.createdIds[0],
      value: true,
    });
    await peer.undo();
    await settle();

    expectConverged(session);
  });
});

describe('a layout converges although the two sides measure text apart', () => {
  /** Roughly what a canvas measures at the element's 12 px font. */
  const canvasToWidth = (text: string) => Math.round(text.length * 6.5) + 2;

  const positions = (state: Session['peer']['state']) =>
    state.doc.tableIds.map(id => {
      const { x, y } = state.collections.tableEntities[id].ui;
      return [id, x, y];
    });

  it('places the tables a sort lays out at the same points on both sides', async () => {
    const session = open({ userToWidth: canvasToWidth });
    await settle();
    const { peer, user } = session;

    for (const tableId of [SEED.users, SEED.orders, SEED.empty]) {
      await peer.runTool('erd_change_table_name', {
        tableId,
        value: `${tableId}_with_a_name_long_enough_to_set_the_width`,
      });
    }
    await settle();
    const before = positions(peer.state);

    const run = await peer.runTool('erd_sort_tables', {});
    await settle();

    expect(run.mismatch).toBeUndefined();
    expect(positions(peer.state)).not.toEqual(before);
    expect(positions(user.rxStore.state)).toEqual(positions(peer.state));

    await peer.undo();
    await settle();

    expect(positions(peer.state)).toEqual(before);
    expect(positions(user.rxStore.state)).toEqual(before);
  });

  it('puts each table where the engine’s own sort puts it on one replica', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();
    const { peer, user } = session;
    const before = positions(peer.state);

    await peer.runTool('erd_sort_tables', {});
    user.rxStore.dispatchSync(sortTableAction());

    expect(positions(peer.state)).not.toEqual(before);
    expect(positions(peer.state)).toEqual(positions(user.rxStore.state));
  });
});
