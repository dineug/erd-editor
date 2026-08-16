import { AnyAction } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CanvasType,
  ColumnType,
  Database,
  Language,
  NameCase,
  SaveSettingType,
  Show,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ActionType } from '@/engine/modules/settings/actions';
import {
  actions,
  changeBracketTypeAction,
  changeCanvasTypeAction,
  changeColumnNameCaseAction,
  changeColumnOrderAction,
  changeDatabaseAction,
  changeDatabaseNameAction,
  changeIgnoreSaveSettingsAction,
  changeLanguageAction,
  changeMaxWidthCommentAction,
  changeRelationshipDataTypeSyncAction,
  changeRelationshipOptimizationAction,
  changeShowAction,
  changeTableNameCaseAction,
  changeZoomLevelAction,
  resizeAction,
  scrollToAction,
  settingsReducers,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { createStore, Store } from '@/engine/store';
import { Tag } from '@/engine/tag';

const toWidth = (text: string) => text.length * 10;

function createTestStore(): Store {
  return createStore({ toWidth, clock: new Clock() });
}

function tag(action: AnyAction, tags: number): AnyAction {
  return { ...action, tags };
}

describe('settings/atom.actions', () => {
  let store: Store;

  beforeEach(() => {
    store = createTestStore();
    // deterministic viewport: scroll ranges become [-1000, 0] x [-1200, 0]
    store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));
  });

  describe('changeDatabaseName', () => {
    it('writes the name and records the LWW replace version', () => {
      store.dispatchSync(changeDatabaseNameAction({ value: 'sakila' }));

      expect(store.state.settings.databaseName).toBe('sakila');
      expect(store.state.lww['settings.databaseName']).toEqual([
        'settings',
        -1,
        -1,
        { databaseName: 0 },
      ]);
    });

    it('falls back to the clock version when the action carries none', () => {
      store.context.clock.merge(7);
      store.dispatchSync(changeDatabaseNameAction({ value: 'clocked' }));

      expect(store.state.lww['settings.databaseName'][3].databaseName).toBe(7);
      expect(store.state.settings.databaseName).toBe('clocked');
    });

    it('ignores a stale write and accepts an equal or newer version', () => {
      store.dispatchSync({
        ...changeDatabaseNameAction({ value: 'v5' }),
        version: 5,
      });
      expect(store.state.settings.databaseName).toBe('v5');

      store.dispatchSync({
        ...changeDatabaseNameAction({ value: 'v3-stale' }),
        version: 3,
      });
      expect(store.state.settings.databaseName).toBe('v5');
      expect(store.state.lww['settings.databaseName'][3].databaseName).toBe(5);

      store.dispatchSync({
        ...changeDatabaseNameAction({ value: 'v5-again' }),
        version: 5,
      });
      expect(store.state.settings.databaseName).toBe('v5-again');

      store.dispatchSync({
        ...changeDatabaseNameAction({ value: 'v9' }),
        version: 9,
      });
      expect(store.state.settings.databaseName).toBe('v9');
      expect(store.state.lww['settings.databaseName'][3].databaseName).toBe(9);
    });
  });

  describe('resize', () => {
    it('clamps both dimensions into the canvas range', () => {
      store.dispatchSync(resizeAction({ width: 3000, height: 4000 }));
      expect(store.state.settings.width).toBe(3000);
      expect(store.state.settings.height).toBe(4000);

      store.dispatchSync(resizeAction({ width: 1, height: 999_999 }));
      expect(store.state.settings.width).toBe(CANVAS_SIZE_MIN);
      expect(store.state.settings.height).toBe(CANVAS_SIZE_MAX);
    });
  });

  describe('changeZoomLevel', () => {
    it('clamps the zoom level into range', () => {
      store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
      expect(store.state.settings.zoomLevel).toBe(0.5);

      store.dispatchSync(changeZoomLevelAction({ value: 10 }));
      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);

      store.dispatchSync(changeZoomLevelAction({ value: -1 }));
      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MIN);
    });

    it('rounds to two decimals', () => {
      store.dispatchSync(changeZoomLevelAction({ value: 0.123456 }));
      expect(store.state.settings.zoomLevel).toBe(0.12);
    });

    it('is a no-op for following-tagged actions', () => {
      store.dispatchSync(
        tag(changeZoomLevelAction({ value: 0.4 }), Tag.following)
      );
      expect(store.state.settings.zoomLevel).toBe(1);
    });

    it('still applies when tagged with something other than following', () => {
      store.dispatchSync(
        tag(changeZoomLevelAction({ value: 0.4 }), Tag.changeOnly)
      );
      expect(store.state.settings.zoomLevel).toBe(0.4);
    });
  });

  describe('streamZoomLevel', () => {
    it('accumulates on top of the current zoom level', () => {
      store.dispatchSync(streamZoomLevelAction({ value: -0.3 }));
      expect(store.state.settings.zoomLevel).toBe(0.7);

      store.dispatchSync(streamZoomLevelAction({ value: -0.3 }));
      expect(store.state.settings.zoomLevel).toBe(0.4);
    });

    it('clamps the accumulated value', () => {
      store.dispatchSync(streamZoomLevelAction({ value: -5 }));
      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MIN);

      store.dispatchSync(streamZoomLevelAction({ value: 5 }));
      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
    });

    it('is a no-op for following-tagged actions', () => {
      store.dispatchSync(
        tag(streamZoomLevelAction({ value: -0.5 }), Tag.following)
      );
      expect(store.state.settings.zoomLevel).toBe(1);
    });
  });

  describe('scrollTo', () => {
    it('clamps the scroll offsets against viewport minus canvas size', () => {
      store.dispatchSync(scrollToAction({ scrollTop: -300, scrollLeft: -250 }));
      expect(store.state.settings.scrollTop).toBe(-300);
      expect(store.state.settings.scrollLeft).toBe(-250);

      store.dispatchSync(scrollToAction({ scrollTop: 500, scrollLeft: 500 }));
      expect(store.state.settings.scrollTop).toBe(0);
      expect(store.state.settings.scrollLeft).toBe(0);

      store.dispatchSync(
        scrollToAction({ scrollTop: -99_999, scrollLeft: -99_999 })
      );
      expect(store.state.settings.scrollTop).toBe(800 - 2000);
      expect(store.state.settings.scrollLeft).toBe(1000 - 2000);
    });

    it('rounds to four decimals', () => {
      store.dispatchSync(
        scrollToAction({ scrollTop: -1.123456789, scrollLeft: -2.987654321 })
      );
      expect(store.state.settings.scrollTop).toBe(-1.1235);
      expect(store.state.settings.scrollLeft).toBe(-2.9877);
    });

    it('is a no-op for following-tagged actions', () => {
      store.dispatchSync(
        tag(scrollToAction({ scrollTop: -10, scrollLeft: -10 }), Tag.following)
      );
      expect(store.state.settings.scrollTop).toBe(0);
      expect(store.state.settings.scrollLeft).toBe(0);
    });
  });

  describe('streamScrollTo', () => {
    it('accumulates movement and clamps the result', () => {
      store.dispatchSync(
        streamScrollToAction({ movementX: -100, movementY: -200 })
      );
      expect(store.state.settings.scrollLeft).toBe(-100);
      expect(store.state.settings.scrollTop).toBe(-200);

      store.dispatchSync(
        streamScrollToAction({ movementX: -100, movementY: -200 })
      );
      expect(store.state.settings.scrollLeft).toBe(-200);
      expect(store.state.settings.scrollTop).toBe(-400);

      store.dispatchSync(
        streamScrollToAction({ movementX: 99_999, movementY: 99_999 })
      );
      expect(store.state.settings.scrollLeft).toBe(0);
      expect(store.state.settings.scrollTop).toBe(0);
    });

    it('is a no-op for following-tagged actions', () => {
      store.dispatchSync(
        tag(
          streamScrollToAction({ movementX: -50, movementY: -50 }),
          Tag.following
        )
      );
      expect(store.state.settings.scrollLeft).toBe(0);
      expect(store.state.settings.scrollTop).toBe(0);
    });
  });

  describe('changeShow', () => {
    it('sets and unsets a single show bit', () => {
      const initial = store.state.settings.show;
      expect(initial & Show.tableComment).toBe(Show.tableComment);

      store.dispatchSync(
        changeShowAction({ show: Show.tableComment, value: false })
      );
      expect(store.state.settings.show & Show.tableComment).toBe(0);

      store.dispatchSync(
        changeShowAction({ show: Show.tableComment, value: true })
      );
      expect(store.state.settings.show).toBe(initial);
    });
  });

  describe('changeDatabase', () => {
    it('accepts a known database', () => {
      store.dispatchSync(changeDatabaseAction({ value: Database.PostgreSQL }));
      expect(store.state.settings.database).toBe(Database.PostgreSQL);
    });

    it('ignores an unknown database', () => {
      store.dispatchSync(changeDatabaseAction({ value: 0b1010101 }));
      expect(store.state.settings.database).toBe(Database.MySQL);
    });
  });

  describe('changeCanvasType', () => {
    it('stores the canvas type verbatim', () => {
      store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.schemaSQL })
      );
      expect(store.state.settings.canvasType).toBe(CanvasType.schemaSQL);
    });

    it('does not validate the value (unknown types are stored as-is)', () => {
      store.dispatchSync(changeCanvasTypeAction({ value: 'not-a-canvas' }));
      expect(store.state.settings.canvasType).toBe('not-a-canvas');
    });

    it('is a no-op for following-tagged actions', () => {
      store.dispatchSync(
        tag(
          changeCanvasTypeAction({ value: CanvasType.settings }),
          Tag.following
        )
      );
      expect(store.state.settings.canvasType).toBe(CanvasType.ERD);
    });
  });

  describe('changeLanguage', () => {
    it('accepts a known language and ignores an unknown one', () => {
      store.dispatchSync(changeLanguageAction({ value: Language.Kotlin }));
      expect(store.state.settings.language).toBe(Language.Kotlin);

      store.dispatchSync(changeLanguageAction({ value: 0b1010101010 }));
      expect(store.state.settings.language).toBe(Language.Kotlin);
    });
  });

  describe('changeTableNameCase / changeColumnNameCase', () => {
    it('accepts known name cases', () => {
      store.dispatchSync(
        changeTableNameCaseAction({ value: NameCase.snakeCase })
      );
      store.dispatchSync(
        changeColumnNameCaseAction({ value: NameCase.snakeCase })
      );

      expect(store.state.settings.tableNameCase).toBe(NameCase.snakeCase);
      expect(store.state.settings.columnNameCase).toBe(NameCase.snakeCase);
    });

    it('ignores unknown name cases', () => {
      store.dispatchSync(changeTableNameCaseAction({ value: 0b1010101 }));
      store.dispatchSync(changeColumnNameCaseAction({ value: 0b1010101 }));

      expect(store.state.settings.tableNameCase).toBe(NameCase.pascalCase);
      expect(store.state.settings.columnNameCase).toBe(NameCase.camelCase);
    });
  });

  describe('changeBracketType', () => {
    it('accepts a known bracket type and ignores an unknown one', () => {
      store.dispatchSync(
        changeBracketTypeAction({ value: BracketType.backtick })
      );
      expect(store.state.settings.bracketType).toBe(BracketType.backtick);

      store.dispatchSync(changeBracketTypeAction({ value: 0b1010101 }));
      expect(store.state.settings.bracketType).toBe(BracketType.backtick);
    });
  });

  describe('boolean toggles', () => {
    it('changeRelationshipDataTypeSync assigns the raw value', () => {
      store.dispatchSync(
        changeRelationshipDataTypeSyncAction({ value: false })
      );
      expect(store.state.settings.relationshipDataTypeSync).toBe(false);

      store.dispatchSync(changeRelationshipDataTypeSyncAction({ value: true }));
      expect(store.state.settings.relationshipDataTypeSync).toBe(true);
    });

    it('changeRelationshipOptimization assigns the raw value', () => {
      store.dispatchSync(changeRelationshipOptimizationAction({ value: true }));
      expect(store.state.settings.relationshipOptimization).toBe(true);

      store.dispatchSync(
        changeRelationshipOptimizationAction({ value: false })
      );
      expect(store.state.settings.relationshipOptimization).toBe(false);
    });
  });

  describe('changeColumnOrder', () => {
    it('moves the value in front of the target when moving backwards', () => {
      const before = [...store.state.settings.columnOrder];
      expect(before[0]).toBe(ColumnType.columnName);
      expect(before[6]).toBe(ColumnType.columnComment);

      store.dispatchSync(
        changeColumnOrderAction({
          value: ColumnType.columnComment,
          target: ColumnType.columnName,
        })
      );

      expect(store.state.settings.columnOrder).toEqual([
        ColumnType.columnComment,
        ColumnType.columnName,
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
      ]);
    });

    it('lands one slot past the target when moving forwards, because the target index is read before the removal', () => {
      store.dispatchSync(
        changeColumnOrderAction({
          value: ColumnType.columnName,
          target: ColumnType.columnComment,
        })
      );

      expect(store.state.settings.columnOrder).toEqual([
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
        ColumnType.columnComment,
        ColumnType.columnName,
      ]);
    });

    it('ignores a move onto itself', () => {
      const before = [...store.state.settings.columnOrder];
      store.dispatchSync(
        changeColumnOrderAction({
          value: ColumnType.columnName,
          target: ColumnType.columnName,
        })
      );
      expect(store.state.settings.columnOrder).toEqual(before);
    });

    it('ignores unknown column types on either side', () => {
      const before = [...store.state.settings.columnOrder];

      store.dispatchSync(
        changeColumnOrderAction({
          value: 0b1000000000,
          target: ColumnType.columnName,
        })
      );
      store.dispatchSync(
        changeColumnOrderAction({
          value: ColumnType.columnName,
          target: 0b1000000000,
        })
      );

      expect(store.state.settings.columnOrder).toEqual(before);
    });

    it('ignores column types missing from the current order', () => {
      const ctx: EngineContext = { toWidth, clock: new Clock() };
      const reducer = Reflect.get(
        settingsReducers,
        ActionType.changeColumnOrder
      );

      const missingValue: any = {
        settings: { columnOrder: [ColumnType.columnName] },
      };
      reducer(
        missingValue,
        changeColumnOrderAction({
          value: ColumnType.columnDataType,
          target: ColumnType.columnName,
        }) as any,
        ctx
      );
      expect(missingValue.settings.columnOrder).toEqual([
        ColumnType.columnName,
      ]);

      const missingTarget: any = {
        settings: { columnOrder: [ColumnType.columnName] },
      };
      reducer(
        missingTarget,
        changeColumnOrderAction({
          value: ColumnType.columnName,
          target: ColumnType.columnDataType,
        }) as any,
        ctx
      );
      expect(missingTarget.settings.columnOrder).toEqual([
        ColumnType.columnName,
      ]);
    });
  });

  describe('changeMaxWidthComment', () => {
    it('keeps the -1 sentinel untouched', () => {
      store.dispatchSync(changeMaxWidthCommentAction({ value: 120 }));
      expect(store.state.settings.maxWidthComment).toBe(120);

      store.dispatchSync(changeMaxWidthCommentAction({ value: -1 }));
      expect(store.state.settings.maxWidthComment).toBe(-1);
    });

    it('clamps any other value into the comment width range', () => {
      store.dispatchSync(changeMaxWidthCommentAction({ value: 0 }));
      expect(store.state.settings.maxWidthComment).toBe(60);

      store.dispatchSync(changeMaxWidthCommentAction({ value: 9999 }));
      expect(store.state.settings.maxWidthComment).toBe(200);
    });
  });

  describe('changeIgnoreSaveSettings', () => {
    it('sets and clears the requested bit', () => {
      store.dispatchSync(
        changeIgnoreSaveSettingsAction({
          saveSettingType: SaveSettingType.scroll,
          value: true,
        })
      );
      expect(store.state.settings.ignoreSaveSettings).toBe(
        SaveSettingType.scroll
      );

      store.dispatchSync(
        changeIgnoreSaveSettingsAction({
          saveSettingType: SaveSettingType.zoomLevel,
          value: true,
        })
      );
      expect(store.state.settings.ignoreSaveSettings).toBe(
        SaveSettingType.scroll | SaveSettingType.zoomLevel
      );

      store.dispatchSync(
        changeIgnoreSaveSettingsAction({
          saveSettingType: SaveSettingType.scroll,
          value: false,
        })
      );
      expect(store.state.settings.ignoreSaveSettings).toBe(
        SaveSettingType.zoomLevel
      );
    });
  });

  it('exports every action creator through the actions bag', () => {
    expect(Object.keys(actions).sort()).toEqual(
      [
        'changeBracketTypeAction',
        'changeCanvasTypeAction',
        'changeColumnNameCaseAction',
        'changeColumnOrderAction',
        'changeDatabaseAction',
        'changeDatabaseNameAction',
        'changeIgnoreSaveSettingsAction',
        'changeLanguageAction',
        'changeMaxWidthCommentAction',
        'changeRelationshipDataTypeSyncAction',
        'changeRelationshipOptimizationAction',
        'changeShowAction',
        'changeTableNameCaseAction',
        'changeZoomLevelAction',
        'resizeAction',
        'scrollToAction',
        'streamScrollToAction',
        'streamZoomLevelAction',
      ].sort()
    );
  });
});
