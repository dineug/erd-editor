// @vitest-environment node

import { setSettingLock } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { cloneDeep, pick } from 'es-toolkit';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createSeedValue,
  createUserStore,
  type SeededStore,
} from '@/__test-utils__/peerSeed';
import {
  BracketType,
  Language,
  LockSettingType,
  LockSettingTypeList,
  NameCase,
} from '@/constants/schema';
import { documentJsonOf, runtimeJsonOf } from '@/engine/documentJson';
import {
  changeBracketTypeAction,
  changeColumnNameCaseAction,
  changeLanguageAction,
  changeLockSettingsAction,
  changeTableNameCaseAction,
} from '@/engine/modules/settings/atom.actions';
import { changeLockSettingsAction$ } from '@/engine/modules/settings/generator.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import {
  createReplicationStore,
  type ReplicationStore,
} from '@/engine/replication-store';
import { Tag } from '@/engine/tag';

const CODE = [
  'language',
  'tableNameCase',
  'columnNameCase',
  'bracketType',
] as const;

const CODE_TYPES = [
  'settings.changeLanguage',
  'settings.changeTableNameCase',
  'settings.changeColumnNameCase',
  'settings.changeBracketType',
];

const CODE_LOCKS =
  LockSettingType.language |
  LockSettingType.tableNameCase |
  LockSettingType.columnNameCase |
  LockSettingType.bracketType;

type Code = Record<(typeof CODE)[number], number>;

/** A value of each code setting away from the seed's. */
const OWN: Code = {
  language: Language.TypeScript,
  tableNameCase: NameCase.snakeCase,
  columnNameCase: NameCase.snakeCase,
  bracketType: BracketType.backtick,
};

const changeAll = (values: Code) => [
  changeLanguageAction({ value: values.language }),
  changeTableNameCaseAction({ value: values.tableNameCase }),
  changeColumnNameCaseAction({ value: values.columnNameCase }),
  changeBracketTypeAction({ value: values.bracketType }),
];

/** The seed with its locks set as given: every one on, or every one off. */
function seedWith(locked: boolean): string {
  const value = JSON.parse(createSeedValue());
  value.settings.lockSettings = LockSettingTypeList.reduce(
    (acc, bit) => setSettingLock(acc, bit, locked),
    value.settings.lockSettings ?? 0
  );
  return JSON.stringify(value);
}

type Room = {
  /** An element's store pair, writable. */
  user: SeededStore;
  peer: PeerStore;
  /** The replica the user's host feeds what the user sent and took. */
  replica: ReplicationStore;
  /** What each side sent since the room opened, each batch by its types. */
  sentByUser: AnyAction[][];
  sentByPeer: AnyAction[][];
  destroy: () => void;
};

const rooms: Room[] = [];
const peers: PeerStore[] = [];

/** A peer store on a value, destroyed after the spec. */
function openPeer(value: string, nickname: string): PeerStore {
  const peer = createPeerStore({ nickname });
  peer.setInitialValue(value);
  peers.push(peer);
  return peer;
}

/** A user's window, its replica and a peer store on one value, each batch delivered at once. */
function openRoom(value: string): Room {
  const user = createUserStore(value);
  const peer = createPeerStore({ nickname: 'agent' });
  peer.setInitialValue(value);
  const replica = createReplicationStore({ toWidth: text => text.length });
  replica.setInitialValue(value);
  const sentByUser: AnyAction[][] = [];
  const sentByPeer: AnyAction[][] = [];

  const unsubscribes = [
    user.sharedStore.subscribe(actions => {
      sentByUser.push(cloneDeep(actions));
      replica.dispatchSync(cloneDeep(actions));
      peer.receive(cloneDeep(actions));
    }),
    peer.subscribe(actions => {
      sentByPeer.push(cloneDeep(actions));
      replica.dispatchSync(cloneDeep(actions));
      user.sharedStore.dispatchSync(cloneDeep(actions));
    }),
  ];
  // The join's handshake is behind them both.
  sentByUser.length = 0;
  sentByPeer.length = 0;

  const room = {
    user,
    peer,
    replica,
    sentByUser,
    sentByPeer,
    destroy: () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
      peer.destroy();
      user.destroy();
      replica.destroy();
    },
  };
  rooms.push(room);
  return room;
}

afterEach(() => {
  rooms.splice(0).forEach(room => room.destroy());
  peers.splice(0).forEach(peer => peer.destroy());
});

const codeOf = (settings: Code): Code => pick(settings, CODE);

const savedCodeOf = (value: string) => codeOf(JSON.parse(value).settings);

const sentCode = (batches: AnyAction[][]) =>
  batches.flat().filter(({ type }) => CODE_TYPES.includes(type));

/** A peer store opened on a runtime value, as an agent or a second view joins. */
const lateJoinerOn = (runtimeValue: string) => openPeer(runtimeValue, 'late');

describe('a code setting under its lock', () => {
  const seed = seedWith(true);
  const SEEDED = savedCodeOf(seed);

  it('shows an element’s change on its screen alone, sending nothing, with no undo entry, while every peer, late joiner and the replica hold the locked value', () => {
    const room = openRoom(seed);
    const { rxStore } = room.user;

    rxStore.dispatchSync(...changeAll(OWN));

    expect(codeOf(rxStore.state.settings)).toEqual(OWN);
    expect(sentCode(room.sentByUser)).toEqual([]);
    expect(rxStore.history.size).toBe(0);
    expect(rxStore.state.editor.hasUndo).toBe(false);
    expect(rxStore.state.lww['settings.code']).toBeUndefined();
    expect(codeOf(room.peer.state.settings)).toEqual(SEEDED);
    expect(savedCodeOf(room.replica.value)).toEqual(SEEDED);
    expect(documentJsonOf(rxStore)).toBe(room.peer.value);

    const joiners = [runtimeJsonOf(rxStore), room.peer.runtimeValue].map(
      lateJoinerOn
    );
    for (const joiner of joiners) {
      expect(codeOf(joiner.state.settings)).toEqual(SEEDED);
      expect(joiner.value).toBe(room.peer.value);
    }
  });

  it('shows a peer store’s change on that peer alone, sending nothing, with no undo entry', () => {
    const room = openRoom(seed);

    const report = room.peer.dispatch(changeAll(OWN));

    expect(codeOf(room.peer.state.settings)).toEqual(OWN);
    expect(report.batches).toBe(0);
    expect(report.historyEntries).toBe(0);
    expect(sentCode(room.sentByPeer)).toEqual([]);
    expect(codeOf(room.user.rxStore.state.settings)).toEqual(SEEDED);
    expect(savedCodeOf(room.replica.value)).toEqual(SEEDED);
    expect(lateJoinerOn(room.peer.runtimeValue).value).toBe(
      documentJsonOf(room.user.rxStore)
    );
  });

  it('drops a code setter it receives, as an editor built before the rule sends one, the replica included', () => {
    const room = openRoom(seed);
    const legacy = changeAll(OWN).map(action => ({
      ...action,
      version: room.user.sharedStore.getVersion() + 1,
      tags: Tag.shared,
      meta: { editorId: 'legacy', nickname: 'legacy' },
    }));

    room.user.sharedStore.dispatchSync(cloneDeep(legacy));
    room.peer.receive(cloneDeep(legacy));
    room.replica.dispatchSync(cloneDeep(legacy));

    expect(codeOf(room.user.rxStore.state.settings)).toEqual(SEEDED);
    expect(codeOf(room.peer.state.settings)).toEqual(SEEDED);
    expect(room.user.rxStore.state.lww['settings.code']).toBeUndefined();
    expect(room.peer.state.lww['settings.code']).toBeUndefined();

    // An unlock that carries no value leaves each store showing what it holds,
    // which the replica's file then writes in place of the locked value.
    room.user.rxStore.dispatchSync(
      changeLockSettingsAction({
        lockSettingType: CODE_LOCKS,
        value: false,
        values: {},
      })
    );

    expect(codeOf(room.user.rxStore.state.settings)).toEqual(SEEDED);
    expect(codeOf(room.peer.state.settings)).toEqual(SEEDED);
    expect(savedCodeOf(room.replica.value)).toEqual(SEEDED);
  });

  it('lands one value on a store still locked that hears a setter made after an unlock before the unlock', () => {
    const [unlocker, setter, late] = ['unlocker', 'setter', 'late'].map(
      nickname => openPeer(seed, nickname)
    );
    const sent = { unlocker: [] as AnyAction[][], setter: [] as AnyAction[][] };
    unlocker.subscribe(actions => sent.unlocker.push(cloneDeep(actions)));
    setter.subscribe(actions => sent.setter.push(cloneDeep(actions)));
    sent.unlocker.length = 0;
    sent.setter.length = 0;

    unlocker.dispatch([
      changeLockSettingsAction$(LockSettingType.language, false),
    ]);
    sent.unlocker.forEach(actions => setter.receive(cloneDeep(actions)));
    setter.dispatch([changeLanguageAction({ value: Language.Kotlin })]);
    [...sent.setter, ...sent.unlocker].forEach(actions =>
      late.receive(cloneDeep(actions))
    );
    sent.setter.forEach(actions => unlocker.receive(cloneDeep(actions)));

    // Marked shared, the late store writes it whatever its own lock says.
    expect(sentCode(sent.setter).map(({ payload }) => payload)).toEqual([
      { value: Language.Kotlin, shared: true },
    ]);
    expect(
      [unlocker, setter, late].map(peer => peer.state.settings.language)
    ).toEqual([Language.Kotlin, Language.Kotlin, Language.Kotlin]);
    expect(late.value).toBe(setter.value);
  });

  it.each([
    ['unlocks a setting and then sets it', true],
    ['sets a setting and then unlocks it', false],
  ])(
    'lands one value on every store from one batch that %s, the later at one version',
    (_, unlockFirst) => {
      const room = openRoom(seed);
      const unlock = changeLockSettingsAction$(LockSettingType.language, false);
      const set = changeLanguageAction({ value: Language.Kotlin });

      room.user.rxStore.dispatchSync(
        ...(unlockFirst ? [unlock, set] : [set, unlock])
      );

      // The pipe reads the lock after the batch, so either way round the
      // setter goes out marked shared.
      expect(sentCode(room.sentByUser).map(({ payload }) => payload)).toEqual([
        { value: Language.Kotlin, shared: true },
      ]);
      const shown = room.user.rxStore.state.settings.language;
      expect(shown).toBe(unlockFirst ? Language.Kotlin : SEEDED.language);
      expect(room.peer.state.settings.language).toBe(shown);
      expect(savedCodeOf(room.replica.value).language).toBe(shown);
    }
  );

  it('carries the unlocking peer’s value onto every screen, over a change another made of its own', () => {
    const room = openRoom(seed);
    room.user.rxStore.dispatchSync(...changeAll(OWN));

    room.peer.dispatch([changeLockSettingsAction$(CODE_LOCKS, false)]);

    expect(codeOf(room.user.rxStore.state.settings)).toEqual(SEEDED);
    expect(codeOf(room.peer.state.settings)).toEqual(SEEDED);
    expect(savedCodeOf(room.replica.value)).toEqual(SEEDED);
    expect(documentJsonOf(room.user.rxStore)).toBe(room.peer.value);
  });

  it('carries the unlocker’s own change onto every screen and the file, which held the locked value until then', () => {
    const room = openRoom(seed);
    room.user.rxStore.dispatchSync(...changeAll(OWN));
    expect(codeOf(room.peer.state.settings)).toEqual(SEEDED);
    expect(savedCodeOf(room.replica.value)).toEqual(SEEDED);

    room.user.rxStore.dispatchSync(
      changeLockSettingsAction$(CODE_LOCKS, false)
    );

    expect(codeOf(room.user.rxStore.state.settings)).toEqual(OWN);
    expect(codeOf(room.peer.state.settings)).toEqual(OWN);
    expect(savedCodeOf(room.replica.value)).toEqual(OWN);
    expect(documentJsonOf(room.user.rxStore)).toBe(room.peer.value);
  });
});

describe('a code setting with its lock off', () => {
  const seed = seedWith(false);

  it('is shared as before, sent marked as shared, and saved', () => {
    const room = openRoom(seed);

    room.user.rxStore.dispatchSync(...changeAll(OWN));

    expect(sentCode(room.sentByUser).map(({ payload }) => payload)).toEqual(
      CODE.map(field => ({ value: OWN[field], shared: true }))
    );
    expect(codeOf(room.peer.state.settings)).toEqual(OWN);
    expect(savedCodeOf(room.replica.value)).toEqual(OWN);
    expect(documentJsonOf(room.user.rxStore)).toBe(room.peer.value);
  });
});
