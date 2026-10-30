// @vitest-environment node

import { isSettingLocked, setSettingLock } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { cloneDeep, pick } from 'es-toolkit';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vite-plus/test';

import { createSeedValue } from '@/__test-utils__/peerSeed';
import {
  BracketType,
  CanvasType,
  Database,
  Language,
  LockSettingType,
  LockSettingTypeList,
  NameCase,
  NameViewMode,
  Show,
} from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import { documentJsonOf, runtimeJsonOf } from '@/engine/documentJson';
import {
  changeViewportAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import {
  initialLoadJsonAction$,
  loadJsonAction$,
} from '@/engine/modules/editor/generator.actions';
import {
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeShowAction,
  changeTableNameCaseAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeLockSettingsAction$,
  restoreScreenSettingsAction$,
} from '@/engine/modules/settings/generator.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import {
  createReplicationStore,
  type ReplicationStore,
} from '@/engine/replication-store';
import { createRxStore, type RxStore } from '@/engine/rx-store';
import { createSharedStore, type SharedStore } from '@/engine/shared-store';
import { defaultToWidth } from '@/engine/to-width';
import { toLoadValue } from '@/utils/loadValue';

/** A readonly editor's stores, wired the way an element wires them. */
type Reader = {
  rxStore: RxStore;
  sharedStore: SharedStore;
  /** The replica its host feeds what the element sent and took, when it has one. */
  replica: ReplicationStore | null;
  /** What change$ hands the element, each batch by its types. */
  changes: string[][];
  receive: (actions: AnyAction[]) => void;
  /** What the element does as readonly turns false: one batch, then writable. */
  turnWritable: () => void;
  turnReadonly: () => void;
  destroy: () => void;
};

/** The seed with its locks set as given: every one on, or every one off. */
function seedWith(locked: boolean): string {
  const value = JSON.parse(createSeedValue());
  value.settings.lockSettings = LockSettingTypeList.reduce(
    (acc, bit) => setSettingLock(acc, bit, locked),
    value.settings.lockSettings ?? 0
  );
  return JSON.stringify(value);
}

function openReader(value: string, { replica = false } = {}): Reader {
  let readonly = true;
  const rxStore = createRxStore(
    createEngineContext({ toWidth: defaultToWidth }),
    { observable: false, getReadonly: () => readonly, readonlyEditState: true }
  );
  rxStore.dispatchSync(changeViewportAction({ width: 1200, height: 800 }));
  rxStore.dispatchSync(initialLoadJsonAction$(toLoadValue(value)));
  rxStore.resetHistory();
  const sharedStore = createSharedStore(
    rxStore,
    { getNickname: () => 'reader' },
    { manualStreamFlush: true }
  );
  const replicaStore = replica
    ? createReplicationStore({ toWidth: defaultToWidth })
    : null;
  replicaStore?.setInitialValue(value);

  const changes: string[][] = [];
  const subscription = rxStore.change$.subscribe(actions =>
    changes.push(actions.map(({ type }) => type))
  );

  return {
    rxStore,
    sharedStore,
    replica: replicaStore,
    changes,
    receive: actions => {
      sharedStore.dispatchSync(cloneDeep(actions));
      replicaStore?.dispatchSync(cloneDeep(actions));
    },
    turnWritable: () => {
      readonly = false;
      rxStore.dispatchSync(restoreScreenSettingsAction$());
    },
    turnReadonly: () => {
      readonly = true;
    },
    destroy: () => {
      subscription.unsubscribe();
      sharedStore.destroy();
      rxStore.destroy();
      replicaStore?.destroy();
    },
  };
}

type Session = {
  peer: PeerStore;
  /** The reader who turns settings on its own screen. */
  screen: Reader;
  /** The same reader on the same document, who turns nothing. */
  control: Reader;
  destroy: () => void;
};

const sessions: Session[] = [];

/** A writable peer and two readers of its document, every batch delivered at once. */
function openSession(value: string, { replica = false } = {}): Session {
  const peer = createPeerStore({ nickname: 'agent' });
  peer.setInitialValue(value);
  const screen = openReader(value, { replica });
  const control = openReader(value);
  const readers = [screen, control];

  const unsubscribes = [
    peer.subscribe(actions =>
      readers.forEach(reader => reader.receive(actions))
    ),
    ...readers.map(reader =>
      reader.sharedStore.subscribe(actions => {
        reader.replica?.dispatchSync(cloneDeep(actions));
        peer.receive(cloneDeep(actions));
      })
    ),
  ];

  const session = {
    peer,
    screen,
    control,
    destroy: () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
      readers.forEach(reader => reader.destroy());
      peer.destroy();
    },
  };
  sessions.push(session);
  return session;
}

/**
 * What a reader's realm answers for Node, which r-html's observable checks each
 * value against: an element's page has one, so a load onto a measured screen
 * reads the scene's view state there as it does here, and a peer never does.
 */
class AbsentNode {}

beforeAll(() => {
  Reflect.set(globalThis, 'Node', AbsentNode);
});

afterAll(() => {
  Reflect.deleteProperty(globalThis, 'Node');
});

let reducerErrors: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.useFakeTimers();
  reducerErrors = vi.spyOn(console, 'error');
});

afterEach(() => {
  sessions.splice(0).forEach(session => session.destroy());
  vi.useRealTimers();
  // A store logs what a reducer throws rather than throwing it.
  expect(reducerErrors).not.toHaveBeenCalled();
  reducerErrors.mockRestore();
});

/** Lets the hooks a batch schedules and the change event's window run out. */
const settle = () => vi.advanceTimersByTime(300);

/** Every setting readonly lets through and the show bits, turned away from the seed's. */
function turnScreen({ rxStore }: Reader) {
  rxStore.dispatchSync(
    changeLanguageAction({ value: Language.Kotlin }),
    changeTableNameCaseAction({ value: NameCase.snakeCase }),
    changeColumnNameCaseAction({ value: NameCase.snakeCase }),
    changeBracketTypeAction({ value: BracketType.backtick }),
    changeDatabaseAction({ value: Database.PostgreSQL }),
    changeShowAction({ show: Show.columnComment, value: false }),
    changeCanvasTypeAction({ value: CanvasType.schemaSQL }),
    toNameViewModeAction(rxStore.state, NameViewMode.logical, true),
    scrollToAction({ originX: 40, originY: 40 }),
    changeZoomLevelAction({ value: 0.5 })
  );
  settle();
}

/**
 * The runtime value with each relationship's anchors left out, which stand on
 * the tables as the screen draws them, its name view and show bits included.
 */
function runtimeWithoutAnchors({ rxStore }: Reader) {
  const document = JSON.parse(runtimeJsonOf(rxStore));
  Object.values<any>(document.collections.relationshipEntities).forEach(
    relationship =>
      [relationship.start, relationship.end].forEach(side => {
        delete side.x;
        delete side.y;
        delete side.direction;
      })
  );
  return document;
}

/** The file form, the runtime value and the registers are what turning nothing leaves. */
function expectSameDocument({ screen, control }: Session) {
  expect(documentJsonOf(screen.rxStore)).toBe(documentJsonOf(control.rxStore));
  expect(runtimeWithoutAnchors(screen)).toEqual(runtimeWithoutAnchors(control));
  expect(screen.rxStore.state.lww).toEqual(control.rxStore.state.lww);
}

const RESTORED = [
  'language',
  'tableNameCase',
  'columnNameCase',
  'bracketType',
  'database',
  'show',
] as const;

/**
 * Both readers turn writable: the settings given back match, so does the
 * document, and the host heard the peer's changes alone on both.
 */
function expectSameOnceWritable(session: Session) {
  session.screen.turnWritable();
  session.control.turnWritable();
  settle();

  expect(pick(session.screen.rxStore.state.settings, RESTORED)).toEqual(
    pick(session.control.rxStore.state.settings, RESTORED)
  );
  expectSameDocument(session);
  expect(session.screen.changes).toEqual(session.control.changes);
}

describe.each([
  ['every lock on', true],
  ['every lock off', false],
])('a readonly reader’s screen, %s', (_, locked) => {
  const value = seedWith(locked);

  it('leaves the document the reader without a screen holds through a peer’s code setters', () => {
    const session = openSession(value);
    turnScreen(session.screen);

    session.peer.dispatch([
      changeLanguageAction({ value: Language.TypeScript }),
      changeColumnNameCaseAction({ value: NameCase.pascalCase }),
      changeDatabaseAction({ value: Database.SQLite }),
      changeShowAction({ show: Show.tableComment, value: false }),
    ]);
    settle();

    expect(session.screen.rxStore.state.settings).toMatchObject({
      language: Language.Kotlin,
      database: Database.PostgreSQL,
    });
    expectSameDocument(session);
    expectSameOnceWritable(session);
    // Under their locks the peer's code setters are its own screen, sent to no one.
    expect(session.peer.state.settings.language).toBe(Language.TypeScript);
    expect(session.screen.rxStore.state.settings).toMatchObject({
      language: locked
        ? JSON.parse(value).settings.language
        : Language.TypeScript,
      database: Database.SQLite,
      canvasType: CanvasType.schemaSQL,
      nameViewMode: NameViewMode.logical,
    });
  });

  it('leaves it through the values a peer’s unlock carries', () => {
    const session = openSession(value);
    session.peer.dispatch([
      changeLanguageAction({ value: Language.TypeScript }),
      changeBracketTypeAction({ value: BracketType.doubleQuote }),
    ]);
    turnScreen(session.screen);

    session.peer.dispatch([
      changeLockSettingsAction$(
        LockSettingType.language |
          LockSettingType.bracketType |
          LockSettingType.unlockNameViewMode,
        false
      ),
    ]);
    settle();

    expectSameDocument(session);
    expect(session.screen.rxStore.state.settings).toMatchObject({
      language: Language.Kotlin,
      bracketType: BracketType.backtick,
      nameViewMode: NameViewMode.physical,
    });
    expectSameOnceWritable(session);
  });

  it('leaves it through a peer’s load, a locked setting off its lock among the screen’s', () => {
    const session = openSession(value);
    session.peer.dispatch([
      changeLanguageAction({ value: Language.TypeScript }),
    ]);
    turnScreen(session.screen);

    const loaded = JSON.parse(value);
    Object.assign(loaded.settings, {
      language: Language.Swift,
      database: Database.Oracle,
      show: Show.tableComment | Show.columnDataType,
      canvasType: CanvasType.generatorCode,
      nameViewMode: NameViewMode.both,
      originX: 300,
    });
    session.peer.dispatch([loadJsonAction({ value: JSON.stringify(loaded) })]);
    settle();

    expect(session.screen.rxStore.state.settings).toMatchObject({
      language: Language.Kotlin,
      database: Database.PostgreSQL,
      canvasType: CanvasType.schemaSQL,
      originX: 300,
    });
    expectSameDocument(session);
    expectSameOnceWritable(session);
  });

  it('leaves it through a peer’s load that turns each lock the other way', () => {
    const session = openSession(value);
    turnScreen(session.screen);

    const loaded = JSON.parse(value);
    loaded.settings.lockSettings = LockSettingTypeList.reduce(
      (acc, bit) => setSettingLock(acc, bit, !locked),
      loaded.settings.lockSettings
    );
    Object.assign(loaded.settings, {
      language: Language.Swift,
      bracketType: BracketType.singleQuote,
      nameViewMode: NameViewMode.both,
    });
    session.peer.dispatch([loadJsonAction({ value: JSON.stringify(loaded) })]);
    settle();

    expectSameDocument(session);
    expectSameOnceWritable(session);
  });

  it('keeps the document a readonly mount opened, through a scroll and a language', () => {
    const empty = openSession(toLoadValue(''));
    [empty.screen, empty.control].forEach(({ rxStore }) => {
      rxStore.dispatchSync(initialLoadJsonAction$(toLoadValue(value)));
      rxStore.resetHistory();
    });
    settle();

    empty.screen.rxStore.dispatchSync(
      scrollToAction({ originX: -200, originY: 90 }),
      changeLanguageAction({ value: Language.Kotlin })
    );
    settle();

    expect(empty.screen.rxStore.state.settings.language).toBe(Language.Kotlin);
    expectSameDocument(empty);
    expect(documentJsonOf(empty.screen.rxStore)).toBe(
      documentJsonOf(openSession(value).control.rxStore)
    );
  });

  it('keeps the value through the first readonly scroll', () => {
    const { screen } = openSession(value);
    const before = documentJsonOf(screen.rxStore);

    screen.rxStore.dispatchSync(scrollToAction({ originX: 40, originY: 40 }));

    expect(screen.rxStore.state.settings.originX).toBe(40);
    expect(documentJsonOf(screen.rxStore)).toBe(before);
  });
});

const PLACEMENT = ['originX', 'originY', 'zoomLevel'] as const;

const placement = (json: string) => pick(JSON.parse(json).settings, PLACEMENT);

describe('a wheel pan once writable again, every lock off', () => {
  it('lands on the replica where the screen stands, which the value and the change then hold', () => {
    const { screen } = openSession(seedWith(false), { replica: true });
    const replicaChanges: Array<{ changed: boolean }> = [];
    screen.replica!.on({ change: change => replicaChanges.push(change) });
    screen.rxStore.dispatchSync(
      scrollToAction({ originX: 40, originY: -30 }),
      changeZoomLevelAction({ value: 0.5 })
    );
    settle();
    expect(replicaChanges).toEqual([]);

    screen.turnWritable();
    screen.rxStore.dispatchSync(
      streamScrollToAction({ movementX: 25, movementY: 5 })
    );
    screen.sharedStore.flushStreamBuffers();
    settle();

    const live = { originX: 65, originY: -25, zoomLevel: 0.5 };
    expect(pick(screen.rxStore.state.settings, PLACEMENT)).toEqual(live);
    expect(placement(documentJsonOf(screen.rxStore))).toEqual(live);
    expect(placement(screen.replica!.value)).toEqual(live);
    expect(screen.replica!.value).toBe(documentJsonOf(screen.rxStore));
    expect(replicaChanges[replicaChanges.length - 1]?.changed).toBe(true);
    expect(screen.changes).toEqual([
      [
        'settings.scrollTo',
        'settings.changeZoomLevel',
        'settings.streamScrollTo',
      ],
    ]);
  });
});

describe('an undo once writable again, every lock off', () => {
  it.each([
    [
      'a pan',
      streamScrollToAction({ movementX: 100, movementY: 0 }),
      { originX: 400, originY: 500, zoomLevel: 0.5 },
    ],
    [
      'a zoom',
      changeZoomLevelAction({ value: 0.8 }),
      { originX: 500, originY: 500, zoomLevel: 1 },
    ],
  ])(
    'of %s made before the screen lands on the replica where the screen stands',
    (_, write, live) => {
      const { screen } = openSession(seedWith(false), { replica: true });
      screen.turnWritable();
      screen.rxStore.dispatchSync(write);
      screen.sharedStore.flushStreamBuffers();
      settle();
      expect(screen.rxStore.history.hasUndo()).toBe(true);
      expect(screen.replica!.value).toBe(documentJsonOf(screen.rxStore));

      screen.turnReadonly();
      screen.rxStore.dispatchSync(
        scrollToAction({ originX: 500, originY: 500 }),
        changeZoomLevelAction({ value: 0.5 })
      );
      settle();
      screen.turnWritable();
      screen.rxStore.undo();
      screen.sharedStore.flushStreamBuffers();
      settle();

      expect(pick(screen.rxStore.state.settings, PLACEMENT)).toEqual(live);
      expect(placement(documentJsonOf(screen.rxStore))).toEqual(live);
      expect(placement(screen.replica!.value)).toEqual(live);
      expect(screen.replica!.value).toBe(documentJsonOf(screen.rxStore));
      expect(screen.rxStore.state.editor.screenBaseline).toBeNull();
    }
  );
});

describe('the reader’s own load once writable again', () => {
  /** A reader with a replica who turned the tab, the name view and the viewport while readonly. */
  function openTurned(value: string) {
    const session = openSession(value, { replica: true });
    const { rxStore } = session.screen;
    rxStore.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL }),
      toNameViewModeAction(rxStore.state, NameViewMode.logical, true),
      scrollToAction({ originX: 40, originY: -30 }),
      changeZoomLevelAction({ value: 0.5 })
    );
    settle();
    session.screen.turnWritable();
    settle();
    return session;
  }

  /** What the element's two values say against what its replica holds. */
  function expectReplicaAgrees({ rxStore, replica }: Reader) {
    expect(documentJsonOf(rxStore)).toBe(replica!.value);
    expect(JSON.parse(runtimeJsonOf(rxStore)).settings).toEqual(
      JSON.parse(replica!.runtimeValue).settings
    );
  }

  it('keeps the document’s tab under the tab lock, so a peer’s unlock leaves the value on the replica’s tab', () => {
    const value = seedWith(true);
    const { screen, peer } = openTurned(value);

    screen.rxStore.dispatchSync(loadJsonAction$(toLoadValue(value)));
    screen.sharedStore.flushStreamBuffers();
    settle();
    peer.dispatch([
      changeLockSettingsAction$(LockSettingType.canvasType, false),
    ]);
    settle();

    const replicaLocks = JSON.parse(screen.replica!.value).settings
      .lockSettings;
    for (const lockSettings of [
      screen.rxStore.state.settings.lockSettings,
      replicaLocks,
    ]) {
      expect(isSettingLocked(lockSettings, LockSettingType.canvasType)).toBe(
        false
      );
    }
    expect(screen.rxStore.state.settings.canvasType).toBe(CanvasType.schemaSQL);
    expect(JSON.parse(documentJsonOf(screen.rxStore)).settings.canvasType).toBe(
      CanvasType.ERD
    );
    expectReplicaAgrees(screen);
  });

  it('ends the viewport’s baseline and each unlocked unit’s, which show what the load holds', () => {
    const value = seedWith(false);
    const { screen } = openTurned(value);
    const loaded = JSON.parse(value);
    Object.assign(loaded.settings, {
      canvasType: CanvasType.generatorCode,
      nameViewMode: NameViewMode.both,
    });

    screen.rxStore.dispatchSync(
      loadJsonAction$(toLoadValue(JSON.stringify(loaded)))
    );
    screen.sharedStore.flushStreamBuffers();
    settle();

    expect(screen.rxStore.state.editor.screenBaseline).toBeNull();
    expect(screen.rxStore.state.settings).toMatchObject({
      canvasType: CanvasType.generatorCode,
      nameViewMode: NameViewMode.both,
    });
    expect(placement(documentJsonOf(screen.rxStore))).toEqual(placement(value));
    expectReplicaAgrees(screen);
  });
});
