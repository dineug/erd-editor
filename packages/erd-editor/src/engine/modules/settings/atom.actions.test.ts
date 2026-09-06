import { AnyAction } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
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
  clampScrollMovement,
  getContentScrollRanges,
  getScrollRanges,
  scrollToAction,
  settingsReducers,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import { createStore, Store } from '@/engine/store';
import { Tag } from '@/engine/tag';
import { getContentRect } from '@/konva/scene/contentBounds';
import { freezeView, thawView } from '@/konva/scene/viewFreeze';

const toWidth = (text: string) => text.length * 10;

const VIEWPORT_WIDTH = 1000;
const VIEWPORT_HEIGHT = 800;

/** A table at a scene point, which is what gives the origin any travel at all. */
const seedTable = (store: Store, id: string, x: number, y: number) => {
  store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
};

/** The content's two edges on each axis, read off the box the range is built on. */
const edges = (store: Store) => {
  const rect = getContentRect(store.state)!;

  return {
    x: [rect.x, rect.x + rect.width] as const,
    y: [rect.y, rect.y + rect.height] as const,
  };
};

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
    store.dispatchSync(
      changeViewportAction({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT })
    );
  });

  afterEach(() => {
    thawView(store.state);
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
    /**
     * An absolute request names the origin it means, and the range follows it:
     * the minimap, a jump to a table and a replayed history entry all rely on
     * landing exactly where they asked, however far from the content that is.
     */
    it('honours a request far outside the content and widens the range to it', () => {
      seedTable(store, 't', 0, 0);
      const before = getContentScrollRanges(store.state);

      store.dispatchSync(scrollToAction({ originX: -40_000, originY: 12_345 }));

      expect(store.state.settings.originX).toBe(-40_000);
      expect(store.state.settings.originY).toBe(12_345);
      expect(-40_000).toBeLessThan(before.left.min);
      expect(12_345).toBeGreaterThan(before.top.max);
      expect(getScrollRanges(store.state).left.min).toBe(-40_000);
      expect(getScrollRanges(store.state).top.max).toBe(12_345);
    });

    it('rounds to four decimals', () => {
      store.dispatchSync(
        scrollToAction({ originY: -1.123456789, originX: -2.987654321 })
      );
      expect(store.state.settings.originY).toBe(-1.1235);
      expect(store.state.settings.originX).toBe(-2.9877);
    });

    it('is a no-op for following-tagged actions', () => {
      store.dispatchSync(
        tag(scrollToAction({ originY: -10, originX: -10 }), Tag.following)
      );
      expect(store.state.settings.originY).toBe(0);
      expect(store.state.settings.originX).toBe(0);
    });

    it('never touches the legacy scroll pair', () => {
      // A pair the default would not tell apart from a zeroing reducer.
      store.state.settings.scrollLeft = -300;
      store.state.settings.scrollTop = -400;
      seedTable(store, 't', 1_000, 1_000);

      store.dispatchSync(scrollToAction({ originY: -300, originX: -250 }));
      store.dispatchSync(
        streamScrollToAction({ movementX: -100, movementY: -200 })
      );

      expect(store.state.settings.originX).toBe(-350);
      expect(store.state.settings.originY).toBe(-500);
      expect(store.state.settings.scrollLeft).toBe(-300);
      expect(store.state.settings.scrollTop).toBe(-400);
    });
  });

  describe('streamScrollTo', () => {
    /**
     * A pan has no edge: the wheel, the grab and the touch pan each carry the
     * origin as far as they are moved, past the content on either side, and
     * the hull every aid is drawn from follows the origin out rather than holding it.
     */
    it('writes the origin unclamped past the content on both sides', () => {
      seedTable(store, 't', 1_000, 1_000);
      const pure = getContentScrollRanges(store.state);

      store.dispatchSync(
        streamScrollToAction({ movementX: -100, movementY: -200 })
      );
      expect(store.state.settings.originX).toBe(-100);
      expect(store.state.settings.originY).toBe(-200);

      store.dispatchSync(
        streamScrollToAction({ movementX: 99_999, movementY: 99_999 })
      );
      const past = { x: -100 + 99_999, y: -200 + 99_999 };
      expect(past.x).toBeGreaterThan(pure.left.max);
      expect(past.y).toBeGreaterThan(pure.top.max);
      expect(store.state.settings.originX).toBe(past.x);
      expect(store.state.settings.originY).toBe(past.y);
      expect(getScrollRanges(store.state).left.max).toBe(past.x);
      expect(getScrollRanges(store.state).top.max).toBe(past.y);

      store.dispatchSync(
        streamScrollToAction({ movementX: -199_998, movementY: -199_998 })
      );
      const before = { x: past.x - 199_998, y: past.y - 199_998 };
      expect(before.x).toBeLessThan(pure.left.min);
      expect(before.y).toBeLessThan(pure.top.min);
      expect(store.state.settings.originX).toBe(before.x);
      expect(store.state.settings.originY).toBe(before.y);
      expect(getScrollRanges(store.state).left.min).toBe(before.x);
      expect(getScrollRanges(store.state).top.min).toBe(before.y);
      expect(getContentScrollRanges(store.state)).toEqual(pure);
    });

    it('rounds to four decimals', () => {
      seedTable(store, 't', 1_000, 1_000);

      store.dispatchSync(
        streamScrollToAction({
          movementX: -1.123456789,
          movementY: -2.987654321,
        })
      );

      expect(store.state.settings.originX).toBe(-1.1235);
      expect(store.state.settings.originY).toBe(-2.9877);
    });

    it('is a no-op for following-tagged actions', () => {
      seedTable(store, 't', 1_000, 1_000);

      store.dispatchSync(
        tag(
          streamScrollToAction({ movementX: -50, movementY: -50 }),
          Tag.following
        )
      );
      expect(store.state.settings.originX).toBe(0);
      expect(store.state.settings.originY).toBe(0);
    });
  });

  /**
   * Where a scene point lands on screen, written out longhand rather than read
   * back from the canon the ranges are built on, so the two have to agree
   * instead of restating one another.
   */
  const toScreen = (scene: number, origin: number, zoomLevel: number) =>
    scene * zoomLevel + origin;

  describe('the travel the content draws', () => {
    const ZOOMS = [0.1, 0.5, 1, 1.2, 1.5];
    const PLACES: Array<[number, number]> = [
      [0, 0],
      [1_000, 1_000],
      [-4_000, -2_500],
      [30_000, -12_000],
    ];
    const grid: Array<[number, number, number]> = [];
    for (const zoomLevel of ZOOMS) {
      for (const [x, y] of PLACES) {
        grid.push([zoomLevel, x, y]);
      }
    }

    /**
     * The screen-space statement of the pure range: at its minimum the far edge
     * of the content sits on the screen's near edge, at its maximum the near
     * edge sits on the screen's far edge, on each axis.
     */
    it.each(grid)(
      'ends where the content edges meet the screen edges at zoom %s for a table at %s,%s',
      (zoomLevel, x, y) => {
        seedTable(store, 't', x, y);
        store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
        const content = edges(store);
        const { left, top } = getContentScrollRanges(store.state);

        expect(toScreen(content.x[1], left.min, zoomLevel)).toBeCloseTo(0, 6);
        expect(toScreen(content.x[0], left.max, zoomLevel)).toBeCloseTo(
          VIEWPORT_WIDTH,
          6
        );
        expect(toScreen(content.y[1], top.min, zoomLevel)).toBeCloseTo(0, 6);
        expect(toScreen(content.y[0], top.max, zoomLevel)).toBeCloseTo(
          VIEWPORT_HEIGHT,
          6
        );
      }
    );

    it.each(ZOOMS)(
      'spans the content at zoom %s plus one screen',
      zoomLevel => {
        seedTable(store, 'a', -3_000, 500);
        seedTable(store, 'b', 7_000, -900);
        store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
        const content = edges(store);
        const { left, top } = getContentScrollRanges(store.state);

        expect(left.max - left.min).toBeCloseTo(
          (content.x[1] - content.x[0]) * zoomLevel + VIEWPORT_WIDTH,
          6
        );
        expect(top.max - top.min).toBeCloseTo(
          (content.y[1] - content.y[0]) * zoomLevel + VIEWPORT_HEIGHT,
          6
        );
      }
    );

    it('is the pure range itself while the origin stands inside it', () => {
      seedTable(store, 't', 1_000, 1_000);
      store.dispatchSync(scrollToAction({ originX: -500, originY: -300 }));

      expect(getScrollRanges(store.state)).toEqual(
        getContentScrollRanges(store.state)
      );
    });

    it('widens to hold the origin wherever an absolute request put it', () => {
      seedTable(store, 't', 0, 0);
      const pure = getContentScrollRanges(store.state);

      store.dispatchSync(scrollToAction({ originX: 40_000, originY: -40_000 }));
      const hull = getScrollRanges(store.state);

      expect(hull.left).toEqual({ min: pure.left.min, max: 40_000 });
      expect(hull.top).toEqual({ min: -40_000, max: pure.top.max });
      expect(getContentScrollRanges(store.state)).toEqual(pure);
    });

    /**
     * The hull follows a stream wherever it goes: from far outside the content
     * a wheel walks back toward it and the hull closes in behind, and a wheel
     * the other way walks further out with the hull widening ahead of it.
     */
    it('follows a stream in toward the content and out past it with the hull', () => {
      seedTable(store, 't', 0, 0);
      const pure = getContentScrollRanges(store.state);
      store.dispatchSync(scrollToAction({ originX: 40_000, originY: 0 }));

      store.dispatchSync(
        streamScrollToAction({ movementX: -100, movementY: 0 })
      );
      expect(store.state.settings.originX).toBe(39_900);
      expect(getScrollRanges(store.state).left.max).toBe(39_900);

      store.dispatchSync(
        streamScrollToAction({ movementX: 500, movementY: 0 })
      );
      expect(store.state.settings.originX).toBe(40_400);
      expect(getScrollRanges(store.state).left.max).toBe(40_400);

      store.dispatchSync(
        streamScrollToAction({ movementX: -99_999, movementY: 0 })
      );
      expect(store.state.settings.originX).toBe(40_400 - 99_999);
      expect(getScrollRanges(store.state).left).toEqual({
        min: 40_400 - 99_999,
        max: pure.left.max,
      });
    });

    it('offers no travel on an empty document, standing wherever a pan has moved the origin', () => {
      store.dispatchSync(scrollToAction({ originX: -640, originY: 480 }));

      expect(getContentScrollRanges(store.state)).toEqual({
        left: { min: -640, max: -640 },
        top: { min: 480, max: 480 },
      });
      expect(getScrollRanges(store.state)).toEqual(
        getContentScrollRanges(store.state)
      );

      store.dispatchSync(
        streamScrollToAction({ movementX: -100, movementY: 100 })
      );
      expect(store.state.settings.originX).toBe(-740);
      expect(store.state.settings.originY).toBe(580);
      expect(getScrollRanges(store.state)).toEqual({
        left: { min: -740, max: -740 },
        top: { min: 580, max: 580 },
      });
    });

    /**
     * Deleting everything while far away leaves the view where it was rather
     * than snapping it anywhere: there is nothing left to snap to, and a table
     * created next lands under the pointer where the reader is looking.
     */
    it('keeps the origin where deleting the last entity found it, and pans on from there', () => {
      seedTable(store, 't', 0, 0);
      store.dispatchSync(
        scrollToAction({ originX: -40_000, originY: -30_000 })
      );

      store.dispatchSync(removeTableAction({ id: 't' }));

      expect(store.state.settings.originX).toBe(-40_000);
      expect(store.state.settings.originY).toBe(-30_000);
      expect(getScrollRanges(store.state)).toEqual({
        left: { min: -40_000, max: -40_000 },
        top: { min: -30_000, max: -30_000 },
      });

      store.dispatchSync(
        streamScrollToAction({ movementX: 500, movementY: 500 })
      );
      expect(store.state.settings.originX).toBe(-40_000 + 500);
      expect(store.state.settings.originY).toBe(-30_000 + 500);
    });

    it.each([
      [0, 0],
      [0, 800],
      [1_000, 0],
      [-1, 800],
    ])(
      'has no travel and cuts no step while the screen reads %s x %s',
      (width, height) => {
        seedTable(store, 't', 0, 0);
        store.dispatchSync(scrollToAction({ originX: 120, originY: -80 }));
        store.dispatchSync(changeViewportAction({ width, height }));

        expect(getContentScrollRanges(store.state)).toEqual({
          left: { min: 120, max: 120 },
          top: { min: -80, max: -80 },
        });
        expect(
          clampScrollMovement(store.state, {
            movementX: -123_456.5,
            movementY: 654_321.25,
          })
        ).toEqual({ movementX: -123_456.5, movementY: 654_321.25 });

        store.dispatchSync(
          streamScrollToAction({ movementX: -123_456, movementY: 654_321 })
        );
        expect(store.state.settings.originX).toBe(120 - 123_456);
        expect(store.state.settings.originY).toBe(-80 + 654_321);
      }
    );

    /**
     * The one gesture the hull gates is a thumb or handle drag, and it gates it
     * here: a step that would carry the origin past the end of the travel is
     * cut to land on the end, one inside the travel is handed back as it is.
     */
    it('cuts the step of a drag to the end of the hull on either side', () => {
      seedTable(store, 't', 1_000, 1_000);
      store.dispatchSync(scrollToAction({ originX: -100, originY: -400 }));
      const { left, top } = getScrollRanges(store.state);
      expect(getContentScrollRanges(store.state)).toEqual({ left, top });
      expect(left.min).toBeLessThan(-100 - 50);
      expect(top.max).toBeGreaterThan(-400 + 75);

      expect(
        clampScrollMovement(store.state, { movementX: -50, movementY: 75 })
      ).toEqual({ movementX: -50, movementY: 75 });
      expect(
        clampScrollMovement(store.state, {
          movementX: -99_999,
          movementY: 99_999,
        })
      ).toEqual({ movementX: left.min + 100, movementY: top.max + 400 });
      expect(
        clampScrollMovement(store.state, {
          movementX: 99_999,
          movementY: -99_999,
        })
      ).toEqual({ movementX: left.max + 100, movementY: top.min + 400 });
    });

    it('hands back no step out from an origin a pan left past the content, and the whole step back in', () => {
      seedTable(store, 't', 0, 0);
      store.dispatchSync(scrollToAction({ originX: 40_000, originY: -40_000 }));

      expect(
        clampScrollMovement(store.state, { movementX: 500, movementY: -500 })
      ).toEqual({ movementX: 0, movementY: 0 });
      expect(
        clampScrollMovement(store.state, { movementX: -500, movementY: 500 })
      ).toEqual({ movementX: -500, movementY: 500 });
    });

    /**
     * A drag is cut to the hull it began with: the origin it started from is
     * held inside the hull for the drag's duration, so a step back out reaches
     * that origin and no further, and the thaw is what lets the hull close in.
     */
    it('cuts a frozen drag to the hull it began with, until the thaw', () => {
      seedTable(store, 't', 0, 0);
      store.dispatchSync(scrollToAction({ originX: 40_000, originY: 0 }));

      freezeView(store.state);
      store.dispatchSync(
        streamScrollToAction({ movementX: -1_000, movementY: 0 })
      );
      expect(store.state.settings.originX).toBe(39_000);
      expect(
        clampScrollMovement(store.state, { movementX: 5_000, movementY: 0 })
      ).toEqual({ movementX: 40_000 - 39_000, movementY: 0 });

      thawView(store.state);

      expect(
        clampScrollMovement(store.state, { movementX: 5_000, movementY: 0 })
      ).toEqual({ movementX: 0, movementY: 0 });
    });

    it('never reads a minimum above its maximum', () => {
      const wrong: string[] = [];

      for (const [zoomLevel, x, y] of grid) {
        for (const viewport of [
          { width: 320, height: 200 },
          { width: 1_000, height: 800 },
          { width: 5_000, height: 5_000 },
        ]) {
          const own = createTestStore();
          own.dispatchSync(changeViewportAction(viewport));
          own.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
          seedTable(own, 't', x, y);
          own.dispatchSync(scrollToAction({ originX: -x, originY: y }));

          for (const ranges of [
            getContentScrollRanges(own.state),
            getScrollRanges(own.state),
          ]) {
            if (
              ranges.left.min > ranges.left.max ||
              ranges.top.min > ranges.top.max
            ) {
              wrong.push(
                `zoom ${zoomLevel} table ${x},${y} viewport ${viewport.width}x${viewport.height}: ${JSON.stringify(ranges)}`
              );
            }
          }
        }
      }

      expect(wrong).toEqual([]);
    });

    /**
     * A drag scales against the travel it started with. Holding the origin it
     * began from inside the hull keeps that travel fixed while the origin
     * closes in on the content, and the drop lets the hull collapse to it.
     */
    it('holds the range a frozen drag began with until the view is thawed', () => {
      seedTable(store, 't', 0, 0);
      store.dispatchSync(scrollToAction({ originX: 40_000, originY: 0 }));
      const start = getScrollRanges(store.state);

      freezeView(store.state);
      store.dispatchSync(
        streamScrollToAction({ movementX: -1_000, movementY: 0 })
      );

      expect(store.state.settings.originX).toBe(39_000);
      expect(getScrollRanges(store.state)).toEqual(start);

      thawView(store.state);

      expect(getScrollRanges(store.state).left.max).toBe(39_000);
    });

    it('still holds an origin an absolute request moved past the frozen anchor', () => {
      seedTable(store, 't', 0, 0);
      freezeView(store.state);

      store.dispatchSync(scrollToAction({ originX: 40_000, originY: -40_000 }));
      const { left, top } = getScrollRanges(store.state);

      expect(left.max).toBe(40_000);
      expect(top.min).toBe(-40_000);
      thawView(store.state);
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
      store.dispatchSync(changeDatabaseAction({ value: 85 }));
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

      store.dispatchSync(changeLanguageAction({ value: 682 }));
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
      store.dispatchSync(changeTableNameCaseAction({ value: 85 }));
      store.dispatchSync(changeColumnNameCaseAction({ value: 85 }));

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

      store.dispatchSync(changeBracketTypeAction({ value: 85 }));
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
          value: 512,
          target: ColumnType.columnName,
        })
      );
      store.dispatchSync(
        changeColumnOrderAction({
          value: ColumnType.columnName,
          target: 512,
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
        'scrollToAction',
        'streamScrollToAction',
        'streamZoomLevelAction',
      ].sort()
    );
  });
});
