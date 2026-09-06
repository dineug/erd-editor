import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ActionType } from '@/engine/modules/settings/actions';
import {
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
  streamZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import {
  actions$,
  changeZoomLevelAction$,
  streamZoomLevelAction$,
} from '@/engine/modules/settings/generator.actions';
import { createStore, Store } from '@/engine/store';
import { Point } from '@/internal-types';
import { getOriginToPlace, toScenePoint } from '@/konva/scene/viewport';

const toWidth = (text: string) => text.length * 10;

const VIEWPORT = { width: 1000, height: 800 };
const SCREEN_CENTRE = { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 };

function createTestStore(): Store {
  const store = createStore({ toWidth, clock: new Clock() });
  // canvas 2000x2000, viewport 1000x800 → origin range [-1000, 0] x [-1200, 0]
  store.dispatchSync(changeViewportAction(VIEWPORT));
  return store;
}

/**
 * The origin that keeps the scene point under the middle of the screen where
 * it is once the zoom changes, for a view that started unscrolled at zoom 1:
 * that point is the screen centre itself, so the canon places it back there.
 */
const holdingCentre = (zoomLevel: number) =>
  getOriginToPlace(zoomLevel, SCREEN_CENTRE, SCREEN_CENTRE);

function flatten(store: Store, action: any): AnyAction[] {
  return compositionActionsFlat(store.state, store.context, [action]);
}

describe('settings/generator.actions', () => {
  let store: Store;

  beforeEach(() => {
    store = createTestStore();
  });

  it('exposes both generator actions through actions$', () => {
    expect(Object.keys(actions$).sort()).toEqual([
      'changeZoomLevelAction$',
      'streamZoomLevelAction$',
    ]);
    expect(actions$.changeZoomLevelAction$).toBe(changeZoomLevelAction$);
    expect(actions$.streamZoomLevelAction$).toBe(streamZoomLevelAction$);
  });

  describe('changeZoomLevelAction$', () => {
    it('emits the zoom change followed by a re-centering scroll', () => {
      const emitted = flatten(store, changeZoomLevelAction$(0.5));

      expect(emitted.map(({ type }) => type)).toEqual([
        ActionType.changeZoomLevel,
        ActionType.scrollTo,
      ]);
      expect(emitted[0]).toEqual(changeZoomLevelAction({ value: 0.5 }));
      expect(emitted[1].payload.originX).toBeCloseTo(holdingCentre(0.5).x, 6);
      expect(emitted[1].payload.originY).toBeCloseTo(holdingCentre(0.5).y, 6);
      expect(emitted[1].type).toBe(scrollToAction.type);
    });

    /**
     * The generator asks for the origin that holds the screen centre, and the
     * reducer clamps that against the box the zoom actually draws: 1000 wide at
     * zoom 0.5, exactly the viewport, so the request lands inside the travel.
     */
    it('applies zoom and origin to the store when dispatched', () => {
      store.dispatchSync(changeZoomLevelAction$(0.5));

      expect(store.state.settings.zoomLevel).toBe(0.5);
      expect(store.state.settings.originX).toBe(holdingCentre(0.5).x);
      expect(store.state.settings.originY).toBe(holdingCentre(0.5).y);
    });

    it('adds the movement on top of the existing origin', () => {
      store.dispatchSync(scrollToAction({ originX: -100, originY: -100 }));
      const anchor = toScenePoint(store.state.settings, SCREEN_CENTRE);
      store.dispatchSync(changeZoomLevelAction$(0.5));

      // The middle of the screen sits over scene 600, 500 before the zoom, and
      // holding it there at 0.5 is an origin the travel of the 2000 box has.
      const expected = getOriginToPlace(0.5, anchor, SCREEN_CENTRE);
      expect(store.state.settings.originX).toBe(expected.x);
      expect(store.state.settings.originY).toBe(expected.y);
      expect(store.state.settings.zoomLevel).toBe(0.5);
    });

    /**
     * Magnifying moves the origin the other way: at zoom 1.5 the scene point
     * under the middle of the screen is drawn further from the top left corner,
     * so the origin has to go negative to keep it there.
     */
    it('clamps an out-of-range zoom level and re-centres on the way up', () => {
      store.dispatchSync(changeZoomLevelAction$(10));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
      expect(store.state.settings.originX).toBe(
        holdingCentre(CANVAS_ZOOM_MAX).x
      );
      expect(store.state.settings.originY).toBe(
        holdingCentre(CANVAS_ZOOM_MAX).y
      );
      expect(store.state.settings.originX).toBeLessThan(0);
    });

    it('clamps a below-range zoom level', () => {
      store.dispatchSync(changeZoomLevelAction$(-3));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MIN);
      // The travel a canvas drawn smaller than the screen keeps is the half
      // screen either side of the middle, so the movement lands whole.
      expect(store.state.settings.originX).toBe(
        holdingCentre(CANVAS_ZOOM_MIN).x
      );
      expect(store.state.settings.originY).toBe(
        holdingCentre(CANVAS_ZOOM_MIN).y
      );
    });
  });

  describe('streamZoomLevelAction$', () => {
    it('emits the zoom delta followed by a relative scroll', () => {
      const emitted = flatten(store, streamZoomLevelAction$(-0.5));

      expect(emitted.map(({ type }) => type)).toEqual([
        ActionType.streamZoomLevel,
        ActionType.streamScrollTo,
      ]);
      expect(emitted[0]).toEqual(streamZoomLevelAction({ value: -0.5 }));
      expect(emitted[1].type).toBe(streamScrollToAction.type);
      // From an origin of zero the movement is the whole of the holding origin.
      expect(emitted[1].payload.movementX).toBeCloseTo(holdingCentre(0.5).x, 6);
      expect(emitted[1].payload.movementY).toBeCloseTo(holdingCentre(0.5).y, 6);
    });

    it('applies the delta and the relative movement to the store', () => {
      store.dispatchSync(streamZoomLevelAction$(-0.5));

      expect(store.state.settings.zoomLevel).toBe(0.5);
      expect(store.state.settings.originX).toBe(holdingCentre(0.5).x);
      expect(store.state.settings.originY).toBe(holdingCentre(0.5).y);
    });

    it('accumulates across successive deltas', () => {
      store.dispatchSync(streamZoomLevelAction$(-0.25));
      expect(store.state.settings.zoomLevel).toBe(0.75);

      store.dispatchSync(streamZoomLevelAction$(-0.25));
      expect(store.state.settings.zoomLevel).toBe(0.5);
      // Two notches that each hold the centre compose to the one jump would.
      expect(store.state.settings.originX).toBeCloseTo(holdingCentre(0.5).x, 3);
      expect(store.state.settings.originY).toBeCloseTo(holdingCentre(0.5).y, 3);
    });

    it('stops the delta at the ceiling and re-centres for the zoom it reached', () => {
      store.dispatchSync(streamZoomLevelAction$(5));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
      expect(store.state.settings.originX).toBe(
        holdingCentre(CANVAS_ZOOM_MAX).x
      );
      expect(store.state.settings.originY).toBe(
        holdingCentre(CANVAS_ZOOM_MAX).y
      );
    });

    it('reaches the ceiling in shortcut sized steps', () => {
      for (let step = 0; step < 12; step++) {
        store.dispatchSync(streamZoomLevelAction$(0.04));
      }

      expect(store.state.settings.zoomLevel).toBeCloseTo(1.48, 5);

      store.dispatchSync(streamZoomLevelAction$(0.04));
      store.dispatchSync(streamZoomLevelAction$(0.04));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
    });
  });

  /**
   * The gesture, not the reducer. Every notch moves the origin to hold the
   * middle of the screen still, so walking the zoom down to the floor and back
   * up the same path is a walk to nowhere and has to end where it started.
   */
  describe('a wheel zoom out and back in', () => {
    const NOTCH = 0.03;

    /** The zoom before each notch that moved it, floor included. */
    function wheelToFloor(): number[] {
      const path: number[] = [];

      for (;;) {
        const before = store.state.settings.zoomLevel;
        store.dispatchSync(streamZoomLevelAction$(-NOTCH));
        if (store.state.settings.zoomLevel === before) break;
        path.push(before);
      }

      return path;
    }

    /** The same notches walked backwards, so the zoom retraces its own path. */
    function wheelBack(path: number[]) {
      for (const zoomLevel of [...path].reverse()) {
        store.dispatchSync(
          streamZoomLevelAction$(zoomLevel - store.state.settings.zoomLevel)
        );
      }
    }

    function roundTrip(originX: number, originY: number) {
      store.dispatchSync(scrollToAction({ originX, originY }));
      const before = {
        originX: store.state.settings.originX,
        originY: store.state.settings.originY,
      };

      const path = wheelToFloor();
      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MIN);
      wheelBack(path);
      expect(store.state.settings.zoomLevel).toBeCloseTo(1, 6);

      return { before, after: { ...store.state.settings } };
    }

    /**
     * Every notch holds one scene point still, so the sixty of them compose to
     * the identity rather than to a drift. What is left is the four decimals
     * each movement is rounded to, which cannot add up to a visible pixel.
     */
    it.each([
      [0, 0],
      [-120, -80],
      [-400, -600],
      [-1_000, -1_200],
    ])('returns an origin of %s, %s to where it started', (left, top) => {
      const { before, after } = roundTrip(left, top);

      expect(after.originX).toBeCloseTo(before.originX, 3);
      expect(after.originY).toBeCloseTo(before.originY, 3);
    });

    /**
     * The shape of the regression this guards. The origin used to arrive at
     * the midpoint of the travel whatever it started as, so every row above
     * landed on one pair and the view could not be zoomed back to.
     */
    it('does not gather every starting point onto one midpoint', () => {
      const landings = [-120, -400, -900].map(origin => {
        store = createTestStore();
        return roundTrip(origin, origin).after.originX;
      });

      expect(new Set(landings).size).toBe(landings.length);
      expect(landings).not.toContain((1_000 - 2_000) / 2);
    });
  });

  /**
   * The property the three zoom paths are built on. Whatever the zoom does, the
   * scene point the reader has in the middle of the screen has to be the point
   * that was there before, or the view has moved without being asked to.
   */
  describe('the scene point under the middle of the screen', () => {
    /** Where the middle of the screen falls in the scene, right now. */
    function centre(): Point {
      const {
        settings: { originX, originY, zoomLevel },
        editor: { viewport },
      } = store.state;

      return toScenePoint(
        { originX, originY, zoomLevel },
        { x: viewport.width / 2, y: viewport.height / 2 }
      );
    }

    /**
     * Puts a scene point in the middle of the screen at a given zoom, then says
     * so, since a point the travel cannot reach is a clamp rather than a
     * measurement and every case below has to start from one that can.
     */
    function centreOn(anchor: Point, zoomLevel: number) {
      const { viewport } = store.state.editor;

      store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));

      const origin = getOriginToPlace(zoomLevel, anchor, {
        x: viewport.width / 2,
        y: viewport.height / 2,
      });

      store.dispatchSync(
        scrollToAction({ originX: origin.x, originY: origin.y })
      );

      expect(centre().x).toBeCloseTo(anchor.x, 6);
      expect(centre().y).toBeCloseTo(anchor.y, 6);
    }

    /** Centrable at every zoom in the range, so no case starts on a clamp. */
    const ANCHORS: Point[] = [
      { x: 600, y: 500 },
      { x: 1_000, y: 800 },
      { x: 1_400, y: 1_500 },
    ];

    const JUMPS: Array<[number, number]> = [
      [1, 0.1],
      [1, 0.5],
      [1, 1.5],
      [1.5, 1],
      [1.5, 0.1],
      [0.5, 1.2],
      [0.1, 1],
      [1.2, 1.5],
    ];

    it.each(JUMPS)('survives a toolbar jump from %s to %s', (from, to) => {
      for (const anchor of ANCHORS) {
        centreOn(anchor, from);
        store.dispatchSync(changeZoomLevelAction$(to));

        expect(store.state.settings.zoomLevel).toBe(to);
        expect(centre().x).toBeCloseTo(anchor.x, 3);
        expect(centre().y).toBeCloseTo(anchor.y, 3);
      }
    });

    /** The wheel notch and the shortcut step, walked one at a time. */
    const STEPS = [0.03, 0.04];

    /** Steps the zoom towards a target and stops when a step stops moving it. */
    function walkTo(target: number, step: number) {
      for (;;) {
        const { zoomLevel } = store.state.settings;
        if (Math.abs(zoomLevel - target) < 1e-9) return;

        const delta =
          zoomLevel < target
            ? Math.min(step, target - zoomLevel)
            : Math.max(-step, target - zoomLevel);

        store.dispatchSync(streamZoomLevelAction$(delta));
        if (store.state.settings.zoomLevel === zoomLevel) return;
      }
    }

    it.each(STEPS)(
      'survives a walk to the floor and back in %s steps',
      step => {
        for (const anchor of ANCHORS) {
          centreOn(anchor, 1);
          const before = { ...store.state.settings };

          walkTo(CANVAS_ZOOM_MIN, step);
          expect(store.state.settings.zoomLevel).toBeCloseTo(
            CANVAS_ZOOM_MIN,
            6
          );
          expect(centre().x).toBeCloseTo(anchor.x, 3);
          expect(centre().y).toBeCloseTo(anchor.y, 3);

          walkTo(1, step);
          expect(store.state.settings.zoomLevel).toBeCloseTo(1, 6);
          expect(store.state.settings.originX).toBeCloseTo(before.originX, 3);
          expect(store.state.settings.originY).toBeCloseTo(before.originY, 3);
        }
      }
    );

    it.each(STEPS)(
      'survives a walk to the ceiling and back in %s steps',
      step => {
        for (const anchor of ANCHORS) {
          centreOn(anchor, 1);
          const before = { ...store.state.settings };

          walkTo(CANVAS_ZOOM_MAX, step);
          expect(store.state.settings.zoomLevel).toBeCloseTo(
            CANVAS_ZOOM_MAX,
            6
          );
          expect(centre().x).toBeCloseTo(anchor.x, 3);
          expect(centre().y).toBeCloseTo(anchor.y, 3);

          walkTo(1, step);
          expect(store.state.settings.zoomLevel).toBeCloseTo(1, 6);
          expect(store.state.settings.originX).toBeCloseTo(before.originX, 3);
          expect(store.state.settings.originY).toBeCloseTo(before.originY, 3);
        }
      }
    );

    /**
     * The toolbar box is a single jump rather than a run of notches, and the
     * reader's complaint was about this one: down to a tenth and straight back
     * up used to land a quarter of a screen from where the view had been.
     */
    it('survives a toolbar jump down to the floor and straight back', () => {
      for (const anchor of ANCHORS) {
        centreOn(anchor, 1);
        const before = { ...store.state.settings };

        store.dispatchSync(changeZoomLevelAction$(CANVAS_ZOOM_MIN));
        store.dispatchSync(changeZoomLevelAction$(1));

        expect(store.state.settings.originX).toBeCloseTo(before.originX, 3);
        expect(store.state.settings.originY).toBeCloseTo(before.originY, 3);
      }
    });
  });
});
