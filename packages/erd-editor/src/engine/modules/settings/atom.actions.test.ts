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
  getScrollRanges,
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

  /**
   * Where a scene point lands on screen, written out longhand rather than read
   * back from the helper the reducer clamps with, so the two have to agree
   * instead of restating one another.
   */
  const toScreen = (
    scene: number,
    scroll: number,
    size: number,
    zoomLevel: number
  ) => scene * zoomLevel + scroll + (size * (1 - zoomLevel)) / 2;

  /**
   * That placement inverted at the middle of the screen. The range is written
   * on this point, so every property below reads it rather than the offset the
   * reducer happens to store.
   */
  const atCentre = (
    scroll: number,
    size: number,
    zoomLevel: number,
    viewportLength: number
  ) => (viewportLength / 2 - scroll - (size * (1 - zoomLevel)) / 2) / zoomLevel;

  /** The scroll that puts a scene point under the middle of the screen. */
  const toScroll = (
    centre: number,
    size: number,
    zoomLevel: number,
    viewportLength: number
  ) => viewportLength / 2 - centre * zoomLevel - (size * (1 - zoomLevel)) / 2;

  describe('the scroll range the zoom draws', () => {
    const VIEWPORT_WIDTH = 1000;
    const VIEWPORT_HEIGHT = 800;

    const grid: Array<[number, number]> = [];
    for (const size of [2_000, 8_000, 20_000]) {
      for (const zoomLevel of [0.1, 0.5, 1, 1.2, 1.5]) {
        grid.push([size, zoomLevel]);
      }
    }

    function place(size: number, zoomLevel: number) {
      store.dispatchSync(resizeAction({ width: size, height: size }));
      store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
    }

    /** How far in from an edge the middle of the screen is held, in scene units. */
    const halfScreen = (viewportLength: number, zoomLevel: number) =>
      viewportLength / (2 * Math.max(1, zoomLevel));

    it.each(grid)(
      'ends the travel with the screen edge on the document at size %s zoom %s',
      (size, zoomLevel) => {
        place(size, zoomLevel);
        const insetX = halfScreen(VIEWPORT_WIDTH, zoomLevel);
        const insetY = halfScreen(VIEWPORT_HEIGHT, zoomLevel);

        store.dispatchSync(
          scrollToAction({ scrollTop: 1_000_000, scrollLeft: 1_000_000 })
        );
        const { scrollLeft: atStart, scrollTop: atTop } = store.state.settings;

        expect(atCentre(atStart, size, zoomLevel, VIEWPORT_WIDTH)).toBeCloseTo(
          Math.min(insetX, size - insetX),
          3
        );
        expect(atCentre(atTop, size, zoomLevel, VIEWPORT_HEIGHT)).toBeCloseTo(
          Math.min(insetY, size - insetY),
          3
        );

        store.dispatchSync(
          scrollToAction({ scrollTop: -1_000_000, scrollLeft: -1_000_000 })
        );
        const { scrollLeft: atEnd, scrollTop: atBottom } = store.state.settings;

        expect(atCentre(atEnd, size, zoomLevel, VIEWPORT_WIDTH)).toBeCloseTo(
          Math.max(insetX, size - insetX),
          3
        );
        expect(
          atCentre(atBottom, size, zoomLevel, VIEWPORT_HEIGHT)
        ).toBeCloseTo(Math.max(insetY, size - insetY), 3);
      }
    );

    /**
     * The magnifying half of the range, which the pre-canvas clamp had no term
     * for: at zoom 1.5 the 2000 box draws 3000 wide and starts 500 to the left
     * of the scroll, so the offset has to go positive to show the left edge.
     */
    it('lets the scroll go positive once the zoom magnifies', () => {
      place(2_000, 1.5);

      store.dispatchSync(
        scrollToAction({ scrollTop: 1_000_000, scrollLeft: 1_000_000 })
      );
      expect(store.state.settings.scrollLeft).toBe(500);
      expect(store.state.settings.scrollTop).toBe(500);

      store.dispatchSync(
        scrollToAction({ scrollTop: -1_000_000, scrollLeft: -1_000_000 })
      );
      expect(store.state.settings.scrollLeft).toBe(1000 - 3000 + 500);
      expect(store.state.settings.scrollTop).toBe(800 - 3000 + 500);
    });

    /**
     * The pre-canvas range written longhand. A magnifying zoom is the half of
     * the travel that was already right, so the new range has to hand back the
     * same bits there rather than merely the same neighbourhood.
     */
    const preCanvasRange = (
      size: number,
      zoomLevel: number,
      viewportLength: number
    ) => {
      const drawn = size * zoomLevel;
      const offset = (size - drawn) / 2;

      return {
        min:
          Math.min(viewportLength - size, viewportLength - drawn - offset) + 0,
        max: Math.max(0, -offset) + 0,
      };
    };

    it.each([1, 1.1, 1.25, 1.5])(
      'is the pre-canvas range bit for bit at zoom %s',
      zoomLevel => {
        const off: string[] = [];

        for (const size of [2_000, 8_000, 20_000]) {
          for (const viewport of [
            { width: 640, height: 480 },
            { width: 1_000, height: 800 },
            { width: 1_440, height: 900 },
          ]) {
            const { left, top } = getScrollRanges(
              { width: size, height: size, zoomLevel },
              viewport
            );
            const expected = {
              left: preCanvasRange(size, zoomLevel, viewport.width),
              top: preCanvasRange(size, zoomLevel, viewport.height),
            };

            for (const axis of ['left', 'top'] as const) {
              for (const end of ['min', 'max'] as const) {
                if (Object.is({ left, top }[axis][end], expected[axis][end])) {
                  continue;
                }
                off.push(
                  `size ${size} viewport ${viewport.width}x${viewport.height} ${axis}.${end}: ${{ left, top }[axis][end]} not ${expected[axis][end]}`
                );
              }
            }
          }
        }

        expect(off).toEqual([]);
      }
    );

    /**
     * The shrinking half, which is where the defect lived. The screen's own
     * edges stay on the document, so the two offsets close in on each other by
     * the zoom instead of holding the unzoomed box's pair.
     */
    it.each([1, 0.9, 0.5, 0.25, CANVAS_ZOOM_MIN])(
      'closes the travel in by the zoom at zoom %s',
      zoomLevel => {
        place(2_000, zoomLevel);
        const { left, top } = getScrollRanges(
          store.state.settings,
          store.state.editor.viewport
        );
        const ends = (viewportLength: number) => ({
          min: ((viewportLength - 2_000) * (1 + zoomLevel)) / 2,
          max: ((viewportLength - 2_000) * (1 - zoomLevel)) / 2,
        });

        expect(left.min).toBeCloseTo(ends(VIEWPORT_WIDTH).min, 9);
        expect(left.max).toBeCloseTo(ends(VIEWPORT_WIDTH).max, 9);
        expect(top.min).toBeCloseTo(ends(VIEWPORT_HEIGHT).min, 9);
        expect(top.max).toBeCloseTo(ends(VIEWPORT_HEIGHT).max, 9);
      }
    );

    it('is the pre-canvas clamp exactly at zoom 1', () => {
      place(2_000, 1);
      const { left, top } = getScrollRanges(
        store.state.settings,
        store.state.editor.viewport
      );

      expect(left).toEqual({ min: VIEWPORT_WIDTH - 2_000, max: 0 });
      expect(top).toEqual({ min: VIEWPORT_HEIGHT - 2_000, max: 0 });
    });

    /**
     * The defect this range closes. Shrinking used to leave the whole document
     * past one end of the travel, and the reader was handed an empty canvas
     * with the minimap the only way back to it.
     */
    it('keeps the document on screen at both ends of every travel', () => {
      const blank: string[] = [];
      const zooms = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.25, 1.5];

      for (const size of [2_000, 6_000, 20_000]) {
        for (const viewport of [
          { width: 1_440, height: 900 },
          { width: 1_024, height: 768 },
          { width: 520, height: 420 },
        ]) {
          for (const zoomLevel of zooms) {
            const ranges = getScrollRanges(
              { width: size, height: size, zoomLevel },
              viewport
            );
            const axes = [
              ['left', ranges.left, viewport.width],
              ['top', ranges.top, viewport.height],
            ] as const;

            for (const [axis, range, viewportLength] of axes) {
              for (const end of ['min', 'max'] as const) {
                const near = toScreen(0, range[end], size, zoomLevel);
                const far = toScreen(size, range[end], size, zoomLevel);
                const shown = Math.min(far, viewportLength) - Math.max(near, 0);

                if (shown > 0) continue;
                blank.push(
                  `size ${size} viewport ${viewport.width}x${viewport.height} zoom ${zoomLevel} ${axis}.${end}: the document covers ${shown} of the screen`
                );
              }
            }
          }
        }
      }

      expect(blank).toEqual([]);
    });

    /**
     * What holds a zoom round trip together: below zoom 1 the run of the
     * document the middle of the screen can reach is the same at every zoom,
     * so no walk down and back can trim it.
     */
    it('holds the reachable middle of the screen fixed below zoom 1', () => {
      const drift: string[] = [];

      for (const zoomLevel of [CANVAS_ZOOM_MIN, 0.25, 0.5, 0.75, 0.9, 1]) {
        place(2_000, zoomLevel);
        const { left } = getScrollRanges(
          store.state.settings,
          store.state.editor.viewport
        );
        const low = atCentre(left.max, 2_000, zoomLevel, VIEWPORT_WIDTH);
        const high = atCentre(left.min, 2_000, zoomLevel, VIEWPORT_WIDTH);

        if (Math.abs(low - VIEWPORT_WIDTH / 2) > 1e-9) {
          drift.push(
            `zoom ${zoomLevel} reaches ${low}, not ${VIEWPORT_WIDTH / 2}`
          );
        }
        if (Math.abs(high - (2_000 - VIEWPORT_WIDTH / 2)) > 1e-9) {
          drift.push(
            `zoom ${zoomLevel} reaches ${high}, not ${2_000 - VIEWPORT_WIDTH / 2}`
          );
        }
      }

      expect(drift).toEqual([]);
    });

    /**
     * The reversibility that follows, stated on the reducer: a zoom gesture
     * moves the scroll so the middle of the screen holds its scene point, and
     * a trip to the floor and back has to leave the offsets where it found them.
     */
    it.each([0, -120, -500, -1_000])(
      'brings a scroll of %s back from the zoom floor unchanged',
      scrollLeft => {
        place(2_000, 1);
        store.dispatchSync(
          scrollToAction({ scrollLeft, scrollTop: scrollLeft })
        );

        const before = {
          scrollLeft: store.state.settings.scrollLeft,
          scrollTop: store.state.settings.scrollTop,
        };
        const centreX = atCentre(before.scrollLeft, 2_000, 1, VIEWPORT_WIDTH);
        const centreY = atCentre(before.scrollTop, 2_000, 1, VIEWPORT_HEIGHT);

        for (const zoomLevel of [
          0.75,
          0.5,
          0.25,
          CANVAS_ZOOM_MIN,
          0.25,
          0.5,
          0.75,
          1,
        ]) {
          store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
          store.dispatchSync(
            scrollToAction({
              scrollLeft: toScroll(centreX, 2_000, zoomLevel, VIEWPORT_WIDTH),
              scrollTop: toScroll(centreY, 2_000, zoomLevel, VIEWPORT_HEIGHT),
            })
          );

          expect(
            atCentre(
              store.state.settings.scrollLeft,
              2_000,
              zoomLevel,
              VIEWPORT_WIDTH
            )
          ).toBeCloseTo(centreX, 6);
        }

        expect(store.state.settings.scrollLeft).toBe(before.scrollLeft);
        expect(store.state.settings.scrollTop).toBe(before.scrollTop);
      }
    );

    /**
     * A screen wider than the whole canvas turns the two ends around. The clamp
     * keeps whichever end it applies last, so the pair is sorted and what stays
     * inside is the document rather than the screen.
     */
    it('sorts the two ends on a screen wider than the canvas', () => {
      const wrong: string[] = [];
      const viewport = { width: 3_000, height: 3_000 };

      for (const zoomLevel of [0.1, 0.5, 1, 1.2, 1.5]) {
        const { left } = getScrollRanges(
          { width: 2_000, height: 2_000, zoomLevel },
          viewport
        );

        if (left.min > left.max) {
          wrong.push(
            `zoom ${zoomLevel} reads min ${left.min} above max ${left.max}`
          );
        }

        for (const end of ['min', 'max'] as const) {
          const near = toScreen(0, left[end], 2_000, zoomLevel);
          const far = toScreen(2_000, left[end], 2_000, zoomLevel);

          if (near < -1e-9 || far > viewport.width + 1e-9) {
            wrong.push(
              `zoom ${zoomLevel} ${end} puts the canvas at ${near} to ${far}, outside the screen`
            );
          }
        }
      }

      expect(wrong).toEqual([]);
    });

    it('pins the scroll inside that sorted range', () => {
      place(2_000, 1);
      store.dispatchSync(changeViewportAction({ width: 3_000, height: 3_000 }));

      store.dispatchSync(scrollToAction({ scrollLeft: -500, scrollTop: -500 }));
      expect(store.state.settings.scrollLeft).toBe(0);
      expect(store.state.settings.scrollTop).toBe(0);
    });

    it('keeps the unzoomed range and its sign exactly as it was', () => {
      place(2_000, 1);

      store.dispatchSync(scrollToAction({ scrollTop: 500, scrollLeft: 500 }));
      expect(Object.is(store.state.settings.scrollTop, 0)).toBe(true);
      expect(Object.is(store.state.settings.scrollLeft, 0)).toBe(true);

      store.dispatchSync(
        scrollToAction({ scrollTop: -99_999, scrollLeft: -99_999 })
      );
      expect(store.state.settings.scrollTop).toBe(800 - 2000);
      expect(store.state.settings.scrollLeft).toBe(1000 - 2000);
    });

    it('carries the same range into the streaming reducer', () => {
      place(2_000, 1.5);

      store.dispatchSync(
        streamScrollToAction({ movementX: 99_999, movementY: 99_999 })
      );
      expect(store.state.settings.scrollLeft).toBe(500);
      expect(store.state.settings.scrollTop).toBe(500);

      store.dispatchSync(
        streamScrollToAction({ movementX: -99_999, movementY: -99_999 })
      );
      expect(store.state.settings.scrollLeft).toBe(-1500);
      expect(store.state.settings.scrollTop).toBe(-1700);
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
        'resizeAction',
        'scrollToAction',
        'streamScrollToAction',
        'streamZoomLevelAction',
      ].sort()
    );
  });
});
