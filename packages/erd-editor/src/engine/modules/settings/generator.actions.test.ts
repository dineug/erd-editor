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

const toWidth = (text: string) => text.length * 10;

function createTestStore(): Store {
  const store = createStore({ toWidth, clock: new Clock() });
  // canvas 2000x2000, viewport 1000x800 → scroll range [-1000, 0] x [-1200, 0]
  store.dispatchSync(changeViewportAction({ width: 1000, height: 800 }));
  return store;
}

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
      expect(emitted[1].payload.scrollLeft).toBeCloseTo(-250, 6);
      expect(emitted[1].payload.scrollTop).toBeCloseTo(-300, 6);
      expect(emitted[1].type).toBe(scrollToAction.type);
    });

    /**
     * The generator asks for -250 x -300, and the reducer clamps that against
     * the box the zoom actually draws: 1000 wide at zoom 0.5, exactly the
     * viewport, so the horizontal offset has one legal value and both land on it.
     */
    it('applies zoom and scroll to the store when dispatched', () => {
      store.dispatchSync(changeZoomLevelAction$(0.5));

      expect(store.state.settings.zoomLevel).toBe(0.5);
      expect(store.state.settings.scrollLeft).toBe(-500);
      expect(store.state.settings.scrollTop).toBe(-500);
    });

    it('adds the movement on top of the existing scroll offsets', () => {
      store.dispatchSync(scrollToAction({ scrollLeft: -100, scrollTop: -100 }));
      store.dispatchSync(changeZoomLevelAction$(0.5));

      // centerXRatio = (1000 - (100 + 500)) / 1000 = 0.4
      // centerYRatio = (1000 - (100 + 400)) / 1000 = 0.5
      // Both asked-for offsets sit past the edge of the 1000x1000 drawn box.
      expect(store.state.settings.scrollLeft).toBe(-500);
      expect(store.state.settings.scrollTop).toBe(-500);
      expect(store.state.settings.zoomLevel).toBe(0.5);
    });

    /**
     * Magnifying moves the scroll the other way. At zoom 1.5 the 2000 box draws
     * 3000 wide and starts 500 left of the scroll, so a positive offset is what
     * keeps its top left corner on screen.
     */
    it('clamps an out-of-range zoom level and re-centres on the way up', () => {
      store.dispatchSync(changeZoomLevelAction$(10));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
      expect(store.state.settings.scrollLeft).toBe(250);
      expect(store.state.settings.scrollTop).toBe(300);
    });

    it('clamps a below-range zoom level', () => {
      store.dispatchSync(changeZoomLevelAction$(-3));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MIN);
      // x = y = (2000 - 200) / 2 = 900, and 200 of drawn canvas fits inside
      // either axis of the viewport, so both ends collapse onto their midpoint
      // and the box lands centred rather than against the origin.
      expect(store.state.settings.scrollLeft).toBe(-500);
      expect(store.state.settings.scrollTop).toBe(-600);
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
      expect(emitted[1].payload.movementX).toBeCloseTo(-250, 6);
      expect(emitted[1].payload.movementY).toBeCloseTo(-300, 6);
    });

    it('applies the delta and the relative scroll to the store', () => {
      store.dispatchSync(streamZoomLevelAction$(-0.5));

      expect(store.state.settings.zoomLevel).toBe(0.5);
      expect(store.state.settings.scrollLeft).toBe(-500);
      expect(store.state.settings.scrollTop).toBe(-500);
    });

    it('accumulates across successive deltas', () => {
      store.dispatchSync(streamZoomLevelAction$(-0.25));
      expect(store.state.settings.zoomLevel).toBe(0.75);

      store.dispatchSync(streamZoomLevelAction$(-0.25));
      expect(store.state.settings.zoomLevel).toBe(0.5);
      expect(store.state.settings.scrollLeft).toBeLessThan(0);
      expect(store.state.settings.scrollTop).toBeLessThan(0);
    });

    it('stops the delta at the ceiling and re-centres for the zoom it reached', () => {
      store.dispatchSync(streamZoomLevelAction$(5));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
      expect(store.state.settings.scrollLeft).toBe(250);
      expect(store.state.settings.scrollTop).toBe(300);
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
});
