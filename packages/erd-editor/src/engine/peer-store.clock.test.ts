// @vitest-environment node

import { type LWW, toJson } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { addColumn, play, renameTable } from '@/__test-utils__/peerScenarios';
import {
  createSeedValue,
  createUserStore,
  SEED,
  type SeededStore,
} from '@/__test-utils__/peerSeed';
import { counterOf, versionOf } from '@/__test-utils__/version';
import { RelationshipType } from '@/constants/schema';
import { slotOf } from '@/engine/clock';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  editMemoAction,
  editTableGroupAction,
  selectAction,
  sharedMouseTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { loadJsonAction$ } from '@/engine/modules/editor/generator.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { removeMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import { Tag } from '@/engine/tag';

const cleanups: Array<() => void> = [];

afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
});

/**
 * A session that has run for a while: the user renamed a table several times,
 * so the LWW register for that name holds a version the file does not carry.
 */
function busyUser(): { user: SeededStore; version: number; snapshot: string } {
  const user = createUserStore(createSeedValue());
  cleanups.push(user.destroy);

  for (let i = 1; i <= 5; i++) {
    user.rxStore.dispatchSync(
      changeTableNameAction({ id: SEED.users, value: `users_v${i}` })
    );
  }

  return {
    user,
    version: user.rxStore.context.clock.getVersion(),
    snapshot: toJson(user.rxStore.state),
  };
}

function latePeer(snapshot: string): PeerStore {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  cleanups.push(peer.destroy);
  peer.setInitialValue(snapshot);
  return peer;
}

const nameOf = (user: SeededStore) =>
  user.rxStore.state.collections.tableEntities[SEED.users].name;

const rename = (peer: PeerStore) =>
  play(peer, renameTable(SEED.users, 'renamed_by_agent'));

describe('a late peer edits past the versions it never saw (AC-E6)', () => {
  it('is outvoted without a clock hint, which is what both paths fix', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    rename(peer);

    expect(counterOf(version)).toBeGreaterThan(3);
    expect(nameOf(user)).toBe('users_v5');
  });

  it('lands through the snapshot version handed to mergeClock', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    // One way only, so no mergeLWW answer can reach the peer.
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    peer.mergeClock(version);
    const report = rename(peer);

    expect(report.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });

  it('lands through the mergeLWW answer to its first subscription', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    user.sharedStore.subscribe(actions => peer.receive(actions));
    peer.subscribe(actions => user.sharedStore.dispatchSync(actions));

    expect(peer.state.lww[SEED.users]).toBeDefined();
    const report = rename(peer);

    expect(report.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });

  it('asks again for the first subscriber a headless dispatch came before', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    play(peer, addColumn(SEED.empty));

    user.sharedStore.subscribe(actions => peer.receive(actions));
    const handshake: string[] = [];
    peer.subscribe(actions => {
      handshake.push(...actions.map(({ type }) => type));
      user.sharedStore.dispatchSync(actions);
    });
    const report = rename(peer);

    expect(handshake[0]).toBe('editor.getLWW');
    expect(report.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });
});

describe('a peer seeded again', () => {
  it('drops the registers of the document it held and asks the open window for its own again', () => {
    const { user, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    // An add the window never heard, so only this peer holds its register.
    const [columnId] = play(peer, addColumn(SEED.empty)).createdIds;
    user.sharedStore.subscribe(actions => peer.receive(actions));
    const sent: string[] = [];
    peer.subscribe(actions => {
      sent.push(...actions.map(({ type }) => type));
      user.sharedStore.dispatchSync(actions);
    });
    expect(peer.state.lww[columnId]).toBeDefined();
    sent.length = 0;

    peer.setInitialValue(snapshot);

    expect(sent).toEqual(['editor.getLWW']);
    expect(peer.state.lww[columnId]).toBeUndefined();
    expect(peer.state.lww[SEED.users]).toEqual(
      user.rxStore.state.lww[SEED.users]
    );
  });

  it('reseeds with the window’s registers and version, so its next edit lands with no answer to wait for', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(createSeedValue());
    // An add the window never heard, so only this peer holds its register.
    const [columnId] = play(peer, addColumn(SEED.empty)).createdIds;
    const sent: string[] = [];
    // One way only, so no mergeLWW answer can reach the peer.
    peer.subscribe(actions => {
      sent.push(...actions.map(({ type }) => type));
      user.sharedStore.dispatchSync(actions);
    });
    sent.length = 0;

    peer.reseed(snapshot, {
      lww: user.sharedStore.getLWW(),
      version: user.sharedStore.getVersion(),
    });

    expect(sent).toEqual(['editor.getLWW']);
    expect(peer.state.lww[columnId]).toBeUndefined();
    expect(peer.getLWW()).toEqual(user.sharedStore.getLWW());
    expect(peer.getVersion()).toBe(version);
    const report = rename(peer);
    expect(report.actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });

  it('drops its selection and its focus on a reseed, a table the window removed among them', () => {
    const { user } = busyUser();
    const peer = latePeer(createSeedValue());
    peer.dispatch(
      [
        selectAction({
          [SEED.users]: SelectType.table,
          [SEED.orders]: SelectType.table,
        }),
      ],
      { focus: { tableId: SEED.users, focusType: FocusType.tableName } }
    );
    expect(Object.keys(peer.state.editor.selectedMap)).toHaveLength(2);
    expect(peer.state.editor.focusTable).not.toBeNull();
    user.rxStore.dispatchSync(removeTableAction({ id: SEED.users }));

    peer.reseed(toJson(user.rxStore.state), {
      lww: user.sharedStore.getLWW(),
      version: user.sharedStore.getVersion(),
    });

    expect(peer.state.editor.selectedMap).toEqual({});
    expect(peer.state.editor.focusTable).toBeNull();
    expect(peer.state.doc.tableIds).not.toContain(SEED.users);
  });

  it.each([
    [
      'reseed',
      (peer: PeerStore, user: SeededStore) =>
        peer.reseed(toJson(user.rxStore.state), {
          lww: user.sharedStore.getLWW(),
          version: user.sharedStore.getVersion(),
        }),
    ],
    [
      'setInitialValue',
      (peer: PeerStore, user: SeededStore) =>
        peer.setInitialValue(toJson(user.rxStore.state)),
    ],
  ])(
    'ends its relationship draw and closes its memo and group name editors on a %s, on what the window removed among them',
    (_label, load) => {
      const { user } = busyUser();
      const peer = latePeer(createSeedValue());
      peer.dispatch([
        editMemoAction({ id: SEED.memo }),
        editTableGroupAction({ id: SEED.group }),
        drawStartRelationshipAction({
          relationshipType: RelationshipType.OneN,
        }),
        drawStartAddRelationshipAction({ tableId: SEED.users }),
      ]);
      expect(peer.state.editor.drawRelationship?.start?.tableId).toBe(
        SEED.users
      );
      user.rxStore.dispatchSync(
        removeTableAction({ id: SEED.users }),
        removeMemoAction({ id: SEED.memo })
      );

      load(peer, user);

      expect(peer.state.editor.drawRelationship).toBeNull();
      expect(peer.state.editor.editMemoId).toBeNull();
      expect(peer.state.editor.editTableGroupId).toBeNull();
      expect(peer.state.doc.tableGroupIds).toContain(SEED.group);
      // A draw left armed would start a relationship from the removed table,
      // which the value keeps as a tombstone, at the next press on a table.
      const report = peer.dispatch([selectTableAction$(SEED.orders, false)]);
      expect(report.actions.map(({ type }) => type)).not.toContain(
        'relationship.add'
      );
      expect(peer.state.doc.relationshipIds).toEqual(
        user.rxStore.state.doc.relationshipIds
      );
    }
  );

  it('ends its relationship draw on a replacing load of a value that keeps the drawn table as a tombstone', () => {
    const { user } = busyUser();
    const peer = latePeer(createSeedValue());
    peer.dispatch([
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN }),
      drawStartAddRelationshipAction({ tableId: SEED.users }),
    ]);
    user.rxStore.dispatchSync(removeTableAction({ id: SEED.users }));

    // The runtime value an undo of a load or a clear carries keeps the table.
    peer.dispatch([loadJsonAction$(toJson(user.rxStore.state))]);

    expect(peer.state.editor.drawRelationship).toBeNull();
    const report = peer.dispatch([selectTableAction$(SEED.orders, false)]);
    expect(report.actions.map(({ type }) => type)).not.toContain(
      'relationship.add'
    );
  });

  it('opens the value alone when asked to keep a screen it does not have', () => {
    const { user, snapshot } = busyUser();
    const peer = latePeer(createSeedValue());
    const opened = latePeer(snapshot);

    peer.reseed(snapshot, {
      lww: user.sharedStore.getLWW(),
      version: user.sharedStore.getVersion(),
      keepScreen: true,
    });

    expect(peer.state.editor.screenBaseline).toBeNull();
    expect(peer.value).toBe(opened.value);
    expect(peer.runtimeValue).toBe(opened.runtimeValue);
  });

  it('refuses a reseed once destroyed, and takes no registers or version then', () => {
    const { user, snapshot } = busyUser();
    const peer = latePeer(createSeedValue());
    const lww = user.sharedStore.getLWW();
    const version = peer.getVersion();
    expect(user.sharedStore.getVersion()).toBeGreaterThan(version);
    peer.destroy();

    expect(() =>
      peer.reseed(snapshot, { lww, version: user.sharedStore.getVersion() })
    ).toThrow(
      expect.objectContaining({ code: 'destroyed', operation: 'reseed' })
    );
    peer.mergeLWW(lww, user.sharedStore.getVersion());
    expect(peer.state.lww[SEED.users]).toBeUndefined();
    expect(peer.getVersion()).toBe(version);
  });

  it('asks nobody before anything opened its sink', () => {
    const { snapshot } = busyUser();
    const peer = latePeer(snapshot);
    const sent: string[] = [];

    peer.setInitialValue(snapshot);
    peer.subscribe(actions => sent.push(...actions.map(({ type }) => type)));

    expect(sent).toEqual(['editor.getLWW']);
  });
});

describe('a peer’s registers and clock, read and taken', () => {
  it('hands out a JSON copy of its registers and the version its clock holds', () => {
    const peer = latePeer(createSeedValue());
    rename(peer);
    const held = JSON.parse(JSON.stringify(peer.state.lww));

    const lww = peer.getLWW() as unknown as LWW;
    lww[SEED.users][3].name += 1;
    lww[SEED.users][1] += 1;
    Reflect.deleteProperty(lww, SEED.users);

    expect(peer.state.lww).toEqual(held);
    expect(peer.getLWW()).toEqual(held);
    expect(peer.getVersion()).toBe(peer.state.lww[SEED.users][3].name);
  });

  it('takes a window’s registers and version, sending nothing, so its next edit lands past them', () => {
    const { user, version, snapshot } = busyUser();
    const peer = latePeer(snapshot);
    const sent: AnyAction[][] = [];
    peer.subscribe(actions => {
      sent.push(actions);
      user.sharedStore.dispatchSync(actions);
    });
    sent.length = 0;

    peer.mergeLWW(user.sharedStore.getLWW(), version);

    expect(sent).toEqual([]);
    expect(peer.state.lww[SEED.users]).toEqual(
      user.rxStore.state.lww[SEED.users]
    );
    expect(peer.getVersion()).toBe(version);
    expect(rename(peer).actions[0].version).toBeGreaterThan(version);
    expect(nameOf(user)).toBe('renamed_by_agent');
  });
});

describe('a peer’s clock (AC-T5)', () => {
  const versionsOf = ({ actions }: ReturnType<typeof rename>) =>
    new Set(actions.map(({ version }) => version));

  it('takes the greater of the versions mergeClock hands it, and stamps the next counter at its own slot', () => {
    const peer = latePeer(createSeedValue());

    peer.mergeClock(versionOf(5, 123));
    peer.mergeClock(versionOf(2, 999));

    expect(versionsOf(rename(peer))).toEqual(
      new Set([versionOf(6, slotOf(peer.editorId))])
    );
  });

  it('spends no counter on a tracker it receives, whatever version an editor built before the slot stamped it with', () => {
    const peer = latePeer(createSeedValue());

    peer.receive({
      ...sharedMouseTrackerAction({ x: 1, y: 1 }),
      version: versionOf(40, 7),
      tags: Tag.shared,
      meta: { editorId: 'remote', nickname: 'remote' },
    });

    expect(versionsOf(rename(peer))).toEqual(
      new Set([versionOf(1, slotOf(peer.editorId))])
    );
  });
});
