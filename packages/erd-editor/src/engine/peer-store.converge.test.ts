// @vitest-environment node

import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  addColumn,
  addTable,
  colorMemo,
  colorTable,
  moveTable,
  type PeerScenario,
  play,
  renameColumn,
  renameTable,
  resizeMemo,
  setColumnNotNull,
  setColumnPrimaryKey,
  setDatabase,
  sortTables,
} from '@/__test-utils__/peerScenarios';
import {
  comparable,
  createSession,
  SEED,
  type Session,
  settle,
} from '@/__test-utils__/peerSeed';
import { Database } from '@/constants/schema';
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

/** One edit per shape a dispatch takes, as the undoable spec measures them. */
const SCENARIOS: Record<string, () => PeerScenario> = {
  addTable: () => addTable(),
  renameTable: () => renameTable(SEED.users, 'members'),
  colorTable: () => colorTable(SEED.users, '#ff8800'),
  moveTable: () => moveTable(SEED.users, 40, 60),
  sortTables: () => sortTables(),
  addColumn: () => addColumn(SEED.empty),
  renameColumn: () => renameColumn(SEED.users, SEED.userName, 'full_name'),
  setColumnNotNull: () => setColumnNotNull(SEED.users, SEED.userName, true),
  setColumnPrimaryKey: () =>
    setColumnPrimaryKey(SEED.users, SEED.userName, true),
  colorMemo: () => colorMemo(SEED.memo, '#336699'),
  resizeMemo: () => resizeMemo(SEED.memo, 320, 240),
  setDatabase: () => setDatabase(Database.PostgreSQL),
};

/** Both sides' documents, meta aside, since each replica stamps its own. */
const sides = ({ peer, user }: Session) => [
  comparable(peer.value),
  comparable(toJson(user.rxStore.state)),
];

const expectConverged = (session: Session) => {
  const [peer, user] = sides(session);
  expect(peer).toEqual(user);
};

describe('a peer store and an element’s store converge (AC-E5)', () => {
  it.each(Object.keys(SCENARIOS))(
    'after %s both sides serialize the same document',
    async name => {
      const session = open();
      await settle();

      const report = play(session.peer, SCENARIOS[name]());
      await settle();

      expect(report.batches).toBe(1);
      expectConverged(session);
    }
  );

  it('converges on a color the stream compressor sent without a version', async () => {
    const session = open();
    await settle();

    const report = play(session.peer, colorTable(SEED.users, '#00aa55'));
    await settle();

    const sentColor = session.sent
      .flat()
      .find(action => action.type === 'table.changeColor');

    expect(report.batches).toBe(1);
    expect(sentColor?.version).toBeUndefined();
    expect(session.user.rxStore.state.collections.tableEntities).toMatchObject({
      [SEED.users]: { ui: { color: '#00aa55' } },
    });
    expectConverged(session);
  });

  it('converges when the user edits while the peer adds a column', async () => {
    const session = open({ held: true });
    session.deliver();
    await settle();

    session.user.rxStore.dispatchSync(
      changeTableNameAction({ id: SEED.orders, value: 'purchases' })
    );
    const report = play(session.peer, addColumn(SEED.orders));

    expect(session.peer.state.collections.tableEntities[SEED.orders].name).toBe(
      'orders'
    );
    session.deliver();
    await settle();

    const orders = session.peer.state.collections.tableEntities[SEED.orders];
    expect(orders.name).toBe('purchases');
    expect(orders.columnIds).toContain(report.createdIds[0]);
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
    play(
      session.peer,
      renameColumn(SEED.users, SEED.userName, 'from_the_peer')
    );
    session.deliver();
    await settle();

    expect(
      session.peer.state.collections.tableColumnEntities[SEED.userName]
    ).toMatchObject({ name: 'from_the_peer', comment: 'from the user' });
    expectConverged(session);
  });

  it('converges over a run of edits and the undo of the last one', async () => {
    const session = open();
    await settle();

    const { peer } = session;
    const added = play(peer, addTable());
    const tableId = added.createdIds[0];
    play(peer, renameTable(tableId, 'audit'));
    const column = play(peer, addColumn(tableId));
    play(peer, setColumnPrimaryKey(tableId, column.createdIds[0], true));
    peer.undo();
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
      play(
        peer,
        renameTable(tableId, `${tableId}_with_a_name_long_enough_to_set_width`)
      );
    }
    await settle();
    const before = positions(peer.state);

    const report = play(peer, sortTables());
    await settle();

    expect(report.historyEntries).toBe(1);
    expect(positions(peer.state)).not.toEqual(before);
    expect(positions(user.rxStore.state)).toEqual(positions(peer.state));

    peer.undo();
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

    play(peer, sortTables());
    user.rxStore.dispatchSync(sortTableAction());

    expect(positions(peer.state)).not.toEqual(before);
    expect(positions(peer.state)).toEqual(positions(user.rxStore.state));
  });
});
