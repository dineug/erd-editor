import {
  createSchema,
  ERDEditorSchemaV3,
  setSettingLock,
  toJson,
} from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  CanvasType,
  Database,
  Language,
  LockSettingType,
  NameCase,
  NameViewMode,
  Show,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  endScreenSettingsAction,
  initialLoadJsonAction,
  loadJsonAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeDatabaseAction,
  changeLanguageAction,
  changeLockSettingsAction,
  changeNameViewModeAction,
  changeShowAction,
  changeTableNameCaseAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { restoreScreenSettingsAction$ } from '@/engine/modules/settings/generator.actions';
import {
  endScreenBaseline,
  keepScreenBaseline,
} from '@/engine/modules/settings/screenBaseline';
import { createStore, Store } from '@/engine/store';
import { attachActionTag, Tag } from '@/engine/tag';

const stores: Store[] = [];

function make(): Store {
  const store = createStore(
    { toWidth: text => text.length * 10, clock: new Clock() },
    false
  );
  stores.push(store);
  return store;
}

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
});

const screen = <A extends AnyAction>(action: A) =>
  attachActionTag(Tag.screen, action);

const shared = <A extends AnyAction>(action: A, version: number) => ({
  ...attachActionTag(Tag.shared, action),
  version,
});

const local = <A extends AnyAction>(action: A, version: number) => ({
  ...action,
  version,
});

/** A document's text with its settings as given, every other field a new document's. */
function loadOf(edit: (settings: ERDEditorSchemaV3['settings']) => void) {
  const schema = createSchema();
  edit(schema.settings);
  return toJson(schema);
}

const unlock = (
  lockSettings: number,
  ...bits: Array<Parameters<typeof setSettingLock>[1]>
) => bits.reduce((acc, bit) => setSettingLock(acc, bit, false), lockSettings);

describe('a screen turn of a readonly reader', () => {
  const CODE_SETTINGS = [
    ['language', changeLanguageAction, Language.Kotlin],
    ['tableNameCase', changeTableNameCaseAction, NameCase.snakeCase],
    ['columnNameCase', changeColumnNameCaseAction, NameCase.snakeCase],
    ['bracketType', changeBracketTypeAction, BracketType.backtick],
  ] as const;

  it.each(CODE_SETTINGS)(
    'writes %s on the screen alone, outside its register, keeping the first value aside',
    (field, create, value) => {
      const store = make();
      const before = store.state.settings[field];

      store.dispatchSync(screen(create({ value })));
      store.dispatchSync(screen(create({ value: before })));
      store.dispatchSync(screen(create({ value })));

      expect(store.state.settings[field]).toBe(value);
      expect(store.state.editor.screenBaseline).toEqual({ [field]: before });
      expect(store.state.lww['settings.code']).toBeUndefined();
    }
  );

  it('writes the database on the screen, keeping the document’s', () => {
    const store = make();

    store.dispatchSync(
      screen(changeDatabaseAction({ value: Database.PostgreSQL }))
    );

    expect(store.state.settings.database).toBe(Database.PostgreSQL);
    expect(store.state.editor.screenBaseline).toEqual({
      database: Database.MySQL,
    });
  });

  it('sets the show bits on the screen with everything a show change does there', () => {
    const store = make();
    const before = store.state.settings.show;
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 1 } }),
      selectAction({ m1: SelectType.memo })
    );

    store.dispatchSync(
      screen(changeShowAction({ show: Show.hideMemo, value: true }))
    );

    expect(store.state.settings.show).toBe(before | Show.hideMemo);
    expect(store.state.editor.selectedMap).toEqual({});
    expect(store.state.editor.screenBaseline).toEqual({ show: before });
  });

  it('moves to a tab on the screen, remembering the tab it left', () => {
    const store = make();
    store.state.editor.drawTableGroup = true;

    store.dispatchSync(
      screen(changeCanvasTypeAction({ value: CanvasType.schemaSQL }))
    );
    store.dispatchSync(
      screen(changeCanvasTypeAction({ value: CanvasType.settings }))
    );

    expect(store.state.settings.canvasType).toBe(CanvasType.settings);
    expect(store.state.editor.lastCanvasType).toBe(CanvasType.schemaSQL);
    expect(store.state.editor.drawTableGroup).toBe(false);
    expect(store.state.editor.screenBaseline).toEqual({
      canvasType: CanvasType.ERD,
    });
  });

  it.each([
    ['scrollTo', scrollToAction({ originX: 40, originY: -20 })],
    ['streamScrollTo', streamScrollToAction({ movementX: 5, movementY: 6 })],
    ['changeZoomLevel', changeZoomLevelAction({ value: 0.5 })],
    ['streamZoomLevel', streamZoomLevelAction({ value: -0.2 })],
  ])(
    'keeps the whole viewport aside on a %s, the three fields one unit',
    (_, action) => {
      const store = make();

      store.dispatchSync(screen(action));
      store.dispatchSync(
        screen(scrollToAction({ originX: 900, originY: 900 }))
      );

      expect(store.state.settings.originX).toBe(900);
      expect(store.state.editor.screenBaseline).toEqual({
        viewport: { originX: 0, originY: 0, zoomLevel: 1 },
      });
    }
  );

  it('shows a name view on its own store alone, outside the register, shared or not', () => {
    const store = make();
    const editorId = store.state.editor.id;

    store.dispatchSync(
      screen(
        changeNameViewModeAction({
          value: NameViewMode.logical,
          shared: true,
          editorId,
        })
      )
    );
    store.dispatchSync(
      screen(
        changeNameViewModeAction({
          value: NameViewMode.both,
          shared: false,
          editorId: 'another',
        })
      )
    );

    expect(store.state.settings.nameViewMode).toBe(NameViewMode.logical);
    expect(store.state.lww['settings.nameViewMode']).toBeUndefined();
    expect(store.state.editor.screenBaseline).toEqual({
      nameViewMode: NameViewMode.physical,
    });
  });
});

describe('the reader’s own write once writable', () => {
  /** A store whose reader turned every unit on its screen while readonly. */
  function makeHeld() {
    const store = make();
    const editorId = store.state.editor.id;
    store.dispatchSync(
      screen(changeLanguageAction({ value: Language.Kotlin })),
      screen(changeDatabaseAction({ value: Database.PostgreSQL })),
      screen(changeShowAction({ show: Show.tableComment, value: false })),
      screen(changeCanvasTypeAction({ value: CanvasType.schemaSQL })),
      screen(scrollToAction({ originX: 40, originY: 40 })),
      screen(
        changeNameViewModeAction({
          value: NameViewMode.logical,
          shared: false,
          editorId,
        })
      )
    );
    return { store, editorId };
  }

  it('ends each unit it writes and leaves the others held', () => {
    const { store, editorId } = makeHeld();

    store.dispatchSync(
      local(changeLanguageAction({ value: Language.TypeScript }), 10),
      changeDatabaseAction({ value: Database.SQLite }),
      changeShowAction({ show: Show.tableComment, value: true })
    );

    expect(store.state.settings).toMatchObject({
      language: Language.TypeScript,
      database: Database.SQLite,
    });
    // Its lock keeps the language the reader's own, outside the register.
    expect(store.state.lww['settings.code']).toBeUndefined();
    expect(Object.keys(store.state.editor.screenBaseline ?? {}).sort()).toEqual(
      ['canvasType', 'nameViewMode', 'viewport']
    );

    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.ERD }),
      changeNameViewModeAction({
        value: NameViewMode.both,
        shared: false,
        editorId,
      }),
      streamZoomLevelAction({ value: 0.1 })
    );

    expect(store.state.editor.screenBaseline).toBeNull();
    expect(store.state.settings.nameViewMode).toBe(NameViewMode.both);
  });

  it.each([
    scrollToAction({ originX: 1, originY: 1 }),
    streamScrollToAction({ movementX: 1, movementY: 1 }),
    changeZoomLevelAction({ value: 0.9 }),
    streamZoomLevelAction({ value: 0.1 }),
  ])('ends the whole viewport on a $type', action => {
    const store = make();
    store.dispatchSync(screen(changeZoomLevelAction({ value: 0.5 })));

    store.dispatchSync(action);

    expect(store.state.editor.screenBaseline).toBeNull();
  });

  it('ends the name view through a shared switch, which writes the register', () => {
    const { store, editorId } = makeHeld();

    store.dispatchSync(
      local(
        changeNameViewModeAction({
          value: NameViewMode.both,
          shared: true,
          editorId,
        }),
        10
      )
    );

    expect(store.state.settings.nameViewMode).toBe(NameViewMode.both);
    expect(store.state.lww['settings.nameViewMode']).toBeDefined();
    expect(store.state.editor.screenBaseline).not.toHaveProperty(
      'nameViewMode'
    );
  });

  it('keeps every unit through a switch another store’s name view sends', () => {
    const { store } = makeHeld();

    store.dispatchSync(
      changeNameViewModeAction({
        value: NameViewMode.both,
        shared: false,
        editorId: 'another',
      })
    );

    expect(store.state.settings.nameViewMode).toBe(NameViewMode.logical);
    expect(store.state.editor.screenBaseline).toHaveProperty(
      'nameViewMode',
      NameViewMode.physical
    );
  });
});

describe('a peer’s write under a held screen', () => {
  it('writes a shared code setter’s register and its baseline, the screen kept, and drops one with no flag under the lock', () => {
    const store = make();
    store.dispatchSync(
      screen(changeLanguageAction({ value: Language.Kotlin }))
    );

    store.dispatchSync(
      shared(
        changeLanguageAction({ value: Language.TypeScript, shared: true }),
        5
      )
    );
    store.dispatchSync(
      shared(changeLanguageAction({ value: Language.Swift, shared: true }), 3)
    );
    store.dispatchSync(shared(changeLanguageAction({ value: Language.Go }), 7));

    expect(store.state.settings.language).toBe(Language.Kotlin);
    expect(store.state.editor.screenBaseline).toEqual({
      language: Language.TypeScript,
    });
    expect(store.state.lww['settings.code']?.[3]).toEqual({ language: 5 });
  });

  it('writes the screen while no baseline holds the setting', () => {
    const store = make();
    store.dispatchSync(
      screen(changeDatabaseAction({ value: Database.Oracle }))
    );

    store.dispatchSync(
      shared(
        changeTableNameCaseAction({ value: NameCase.snakeCase, shared: true }),
        5
      ),
      shared(changeDatabaseAction({ value: Database.MSSQL }), 5)
    );

    expect(store.state.settings).toMatchObject({
      tableNameCase: NameCase.snakeCase,
      database: Database.Oracle,
    });
    expect(store.state.editor.screenBaseline).toEqual({
      database: Database.MSSQL,
    });
  });

  it('lands an unlock’s code value in the baseline and its name view on the screen', () => {
    const store = make();
    const editorId = store.state.editor.id;
    store.dispatchSync(
      screen(changeBracketTypeAction({ value: BracketType.doubleQuote })),
      screen(
        changeNameViewModeAction({
          value: NameViewMode.logical,
          shared: false,
          editorId,
        })
      )
    );

    store.dispatchSync(
      shared(
        changeLockSettingsAction({
          lockSettingType:
            LockSettingType.bracketType | LockSettingType.unlockNameViewMode,
          value: false,
          values: {
            bracketType: BracketType.backtick,
            nameViewMode: NameViewMode.both,
          },
        }),
        5
      )
    );

    expect(store.state.settings).toMatchObject({
      bracketType: BracketType.doubleQuote,
      nameViewMode: NameViewMode.both,
    });
    expect(store.state.editor.screenBaseline).toEqual({
      bracketType: BracketType.backtick,
    });
  });

  it('sets the show bits of the baseline alone, releasing nothing shown', () => {
    const store = make();
    const before = store.state.settings.show;
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 0, y: 0, zIndex: 1 } }),
      selectAction({ m1: SelectType.memo }),
      screen(changeShowAction({ show: Show.tableComment, value: false }))
    );

    store.dispatchSync(
      shared(changeShowAction({ show: Show.hideMemo, value: true }), 5),
      shared(changeShowAction({ show: Show.columnComment, value: false }), 5)
    );

    expect(store.state.settings.show).toBe(before & ~Show.tableComment);
    expect(store.state.editor.selectedMap).toEqual({ m1: SelectType.memo });
    expect(store.state.editor.screenBaseline).toEqual({
      show: (before | Show.hideMemo) & ~Show.columnComment,
    });
  });

  it('moves a held tab and viewport in the baseline, a follow of one dropped', () => {
    const store = make();
    store.dispatchSync(
      screen(changeCanvasTypeAction({ value: CanvasType.schemaSQL })),
      screen(scrollToAction({ originX: 40, originY: 40 }))
    );

    store.dispatchSync(
      shared(changeCanvasTypeAction({ value: CanvasType.generatorCode }), 5),
      shared(scrollToAction({ originX: 10, originY: 20 }), 5),
      shared(streamScrollToAction({ movementX: 1, movementY: 2 }), 5),
      shared(changeZoomLevelAction({ value: 0.5 }), 5),
      shared(streamZoomLevelAction({ value: 0.1 }), 5),
      attachActionTag(
        Tag.following,
        scrollToAction({ originX: 999, originY: 999 })
      )
    );

    expect(store.state.settings).toMatchObject({
      canvasType: CanvasType.schemaSQL,
      originX: 40,
      originY: 40,
      zoomLevel: 1,
    });
    expect(store.state.editor.screenBaseline).toEqual({
      canvasType: CanvasType.generatorCode,
      viewport: { originX: 11, originY: 22, zoomLevel: 0.6 },
    });
  });

  it('lands a placement and a tab on the screen while none is held', () => {
    const store = make();

    store.dispatchSync(
      shared(changeCanvasTypeAction({ value: CanvasType.schemaSQL }), 5),
      shared(scrollToAction({ originX: 10, originY: 20 }), 5)
    );

    expect(store.state.settings).toMatchObject({
      canvasType: CanvasType.schemaSQL,
      originX: 10,
    });
    expect(store.state.editor.screenBaseline).toBeNull();
  });

  it('switches a shared name view on the screen and ends its baseline', () => {
    const store = make();
    const editorId = store.state.editor.id;
    store.dispatchSync(
      screen(
        changeNameViewModeAction({
          value: NameViewMode.logical,
          shared: false,
          editorId,
        })
      )
    );

    store.dispatchSync(
      shared(
        changeNameViewModeAction({
          value: NameViewMode.both,
          shared: true,
          editorId: 'peer',
        }),
        5
      )
    );

    expect(store.state.settings.nameViewMode).toBe(NameViewMode.both);
    expect(store.state.editor.screenBaseline).toBeNull();
  });
});

describe('a load that replaces the document', () => {
  /** A store whose reader turned the language, the tab, the show bits, the database and the view. */
  function makeHeld(lockSettings?: number) {
    const store = make();
    if (lockSettings !== undefined) {
      store.dispatchSync(
        initialLoadJsonAction({
          value: loadOf(settings => {
            settings.lockSettings = lockSettings;
          }),
        })
      );
    }
    const editorId = store.state.editor.id;
    store.dispatchSync(
      screen(changeLanguageAction({ value: Language.Kotlin })),
      screen(changeCanvasTypeAction({ value: CanvasType.schemaSQL })),
      screen(changeShowAction({ show: Show.tableComment, value: false })),
      screen(changeDatabaseAction({ value: Database.PostgreSQL })),
      screen(scrollToAction({ originX: 40, originY: 40 })),
      screen(
        changeNameViewModeAction({
          value: NameViewMode.logical,
          shared: false,
          editorId,
        })
      )
    );
    return store;
  }

  const LOADED = (settings: ERDEditorSchemaV3['settings']) => {
    settings.language = Language.Swift;
    settings.lockedValues.language = Language.Swift;
    settings.canvasType = CanvasType.generatorCode;
    settings.lockedValues.canvasType = CanvasType.generatorCode;
    settings.show = Show.tableComment | Show.columnDataType;
    settings.database = Database.SQLite;
    settings.originX = 300;
    settings.originY = 300;
    settings.lockedValues.originX = 300;
    settings.lockedValues.originY = 300;
    settings.nameViewMode = NameViewMode.both;
    settings.lockedValues.nameViewMode = NameViewMode.both;
  };

  it('keeps a locked screen and its baseline, and takes the rest into the baseline', () => {
    const store = makeHeld();
    const baseline = { ...store.state.editor.screenBaseline };

    store.dispatchSync(
      shared(
        loadJsonAction({
          value: loadOf(settings => {
            LOADED(settings);
            settings.lockSettings = unlock(
              settings.lockSettings,
              LockSettingType.canvasType
            );
          }),
        }),
        5
      )
    );

    expect(store.state.settings).toMatchObject({
      language: Language.Kotlin,
      canvasType: CanvasType.schemaSQL,
      show: baseline.show! & ~Show.tableComment,
      database: Database.PostgreSQL,
      originX: 300,
      nameViewMode: NameViewMode.logical,
    });
    expect(store.state.editor.screenBaseline).toEqual({
      language: baseline.language,
      canvasType: CanvasType.generatorCode,
      show: Show.tableComment | Show.columnDataType,
      database: Database.SQLite,
      nameViewMode: baseline.nameViewMode,
    });
  });

  it('lands an unlocked name view and a setting the load unlocks', () => {
    const store = makeHeld(
      unlock(63, LockSettingType.language) | LockSettingType.unlockNameViewMode
    );

    store.dispatchSync(
      shared(
        loadJsonAction({
          value: loadOf(settings => {
            LOADED(settings);
            settings.lockSettings = unlock(
              settings.lockSettings,
              LockSettingType.language
            );
            settings.lockSettings |= LockSettingType.unlockNameViewMode;
          }),
        }),
        5
      )
    );

    expect(store.state.settings.nameViewMode).toBe(NameViewMode.both);
    expect(store.state.settings.language).toBe(Language.Kotlin);
    expect(store.state.editor.screenBaseline).toMatchObject({
      language: Language.Swift,
    });
    expect(store.state.editor.screenBaseline).not.toHaveProperty(
      'nameViewMode'
    );
  });

  it('keeps the baseline of a setting the load locks', () => {
    const store = makeHeld(unlock(63, LockSettingType.language));
    const held = store.state.editor.screenBaseline?.language;

    store.dispatchSync(shared(loadJsonAction({ value: loadOf(LOADED) }), 5));

    expect(store.state.settings.language).toBe(Language.Kotlin);
    expect(store.state.editor.screenBaseline?.language).toBe(held);
  });

  it('ends the viewport’s and each unlocked unit’s baseline on the reader’s own load, which lands as it always did, and keeps a locked unit’s', () => {
    const store = makeHeld();
    const baseline = { ...store.state.editor.screenBaseline };

    store.dispatchSync(local(loadJsonAction({ value: loadOf(LOADED) }), 5));

    expect(store.state.editor.screenBaseline).toEqual({
      language: baseline.language,
      canvasType: baseline.canvasType,
      nameViewMode: baseline.nameViewMode,
    });
    expect(store.state.settings).toMatchObject({
      language: Language.Kotlin,
      canvasType: CanvasType.schemaSQL,
      nameViewMode: NameViewMode.logical,
      show: Show.tableComment | Show.columnDataType,
      database: Database.SQLite,
      originX: 300,
    });
  });

  it('ends the baseline of each unit the reader’s own load unlocks, which shows the loaded value', () => {
    const store = makeHeld();
    const baseline = { ...store.state.editor.screenBaseline };

    store.dispatchSync(
      local(
        loadJsonAction({
          value: loadOf(settings => {
            LOADED(settings);
            settings.lockSettings =
              unlock(settings.lockSettings, LockSettingType.canvasType) |
              LockSettingType.unlockNameViewMode;
          }),
        }),
        5
      )
    );

    expect(store.state.editor.screenBaseline).toEqual({
      language: baseline.language,
    });
    expect(store.state.settings).toMatchObject({
      canvasType: CanvasType.generatorCode,
      nameViewMode: NameViewMode.both,
    });
  });

  it('drops every baseline on a load that opens a document', () => {
    const store = makeHeld();

    store.dispatchSync(initialLoadJsonAction({ value: loadOf(LOADED) }));

    expect(store.state.editor.screenBaseline).toBeNull();
    expect(store.state.settings.language).toBe(Language.Swift);
  });

  it('holds nothing more on a peer’s load that ends the last units held', () => {
    const store = make();
    store.dispatchSync(screen(scrollToAction({ originX: 4, originY: 4 })));

    store.dispatchSync(shared(loadJsonAction({ value: loadOf(LOADED) }), 5));

    expect(store.state.editor.screenBaseline).toBeNull();
  });
});

describe('endScreenSettings', () => {
  it('drops the units named, and the baseline once none is held', () => {
    const store = make();
    store.dispatchSync(
      screen(changeLanguageAction({ value: Language.Kotlin })),
      screen(changeDatabaseAction({ value: Database.PostgreSQL }))
    );

    store.dispatchSync(
      endScreenSettingsAction({ units: ['language', 'show'] })
    );
    expect(store.state.editor.screenBaseline).toEqual({
      database: Database.MySQL,
    });

    store.dispatchSync(endScreenSettingsAction({ units: ['database'] }));
    expect(store.state.editor.screenBaseline).toBeNull();

    store.dispatchSync(endScreenSettingsAction({ units: ['viewport'] }));
    expect(store.state.editor.screenBaseline).toBeNull();
  });

  it('keeps the value first kept aside, whoever keeps it again', () => {
    const store = make();
    keepScreenBaseline(store.state, 'viewport');
    store.state.settings.originX = 70;
    keepScreenBaseline(store.state, 'viewport');
    endScreenBaseline(store.state.editor);

    expect(store.state.editor.screenBaseline?.viewport?.originX).toBe(0);
  });
});

describe('restoreScreenSettingsAction$', () => {
  const dispatched = (store: Store) => {
    const batches: AnyAction[][] = [];
    const unsubscribe = store.subscribe(actions => batches.push(actions));
    store.dispatchSync(restoreScreenSettingsAction$());
    unsubscribe();
    return batches;
  };

  it('sends the document’s values back through their own setters as the screen’s, then ends them', () => {
    const store = make();
    const before = { ...store.state.settings };
    store.dispatchSync(
      screen(changeLanguageAction({ value: Language.Kotlin })),
      screen(changeTableNameCaseAction({ value: NameCase.snakeCase })),
      screen(changeColumnNameCaseAction({ value: NameCase.snakeCase })),
      screen(changeBracketTypeAction({ value: BracketType.backtick })),
      screen(changeDatabaseAction({ value: Database.PostgreSQL })),
      screen(changeShowAction({ show: Show.tableComment, value: false })),
      screen(changeShowAction({ show: Show.hideMemo, value: true })),
      screen(changeCanvasTypeAction({ value: CanvasType.schemaSQL })),
      screen(scrollToAction({ originX: 40, originY: 40 }))
    );

    const batches = dispatched(store);

    expect(batches).toHaveLength(1);
    expect(
      batches[0].map(({ type, payload, tags }) => [type, payload, tags])
    ).toEqual([
      ['settings.changeLanguage', { value: before.language }, Tag.screen],
      [
        'settings.changeTableNameCase',
        { value: before.tableNameCase },
        Tag.screen,
      ],
      [
        'settings.changeColumnNameCase',
        { value: before.columnNameCase },
        Tag.screen,
      ],
      ['settings.changeBracketType', { value: before.bracketType }, Tag.screen],
      ['settings.changeDatabase', { value: before.database }, Tag.screen],
      [
        'settings.changeShow',
        { show: Show.tableComment, value: true },
        Tag.screen,
      ],
      [
        'settings.changeShow',
        { show: Show.hideMemo, value: false },
        Tag.screen,
      ],
      [
        'editor.endScreenSettings',
        {
          units: [
            'language',
            'tableNameCase',
            'columnNameCase',
            'bracketType',
            'database',
            'show',
          ],
        },
        undefined,
      ],
    ]);
    expect(store.state.settings).toMatchObject({
      language: before.language,
      database: before.database,
      show: before.show,
      canvasType: CanvasType.schemaSQL,
      originX: 40,
    });
    expect(Object.keys(store.state.editor.screenBaseline ?? {}).sort()).toEqual(
      ['canvasType', 'viewport']
    );
  });

  it('sends no setter for a value the screen holds already', () => {
    const store = make();
    const { language } = store.state.settings;
    store.dispatchSync(
      screen(changeLanguageAction({ value: Language.Kotlin })),
      screen(changeLanguageAction({ value: language }))
    );

    const [batch] = dispatched(store);

    expect(batch.map(({ type }) => type)).toEqual(['editor.endScreenSettings']);
    expect(store.state.editor.screenBaseline).toBeNull();
  });

  it('sends nothing while it holds none of the settings it gives back', () => {
    const store = make();
    expect(dispatched(store)).toEqual([]);

    store.dispatchSync(screen(scrollToAction({ originX: 40, originY: 40 })));
    expect(dispatched(store)).toEqual([]);
  });
});
