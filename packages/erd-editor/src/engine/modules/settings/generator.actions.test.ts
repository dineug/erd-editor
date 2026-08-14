import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { beforeEach, describe, expect, it } from 'vitest';

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

    it('applies zoom and scroll to the store when dispatched', () => {
      store.dispatchSync(changeZoomLevelAction$(0.5));

      expect(store.state.settings.zoomLevel).toBe(0.5);
      expect(store.state.settings.scrollLeft).toBe(-250);
      expect(store.state.settings.scrollTop).toBe(-300);
    });

    it('adds the movement on top of the existing scroll offsets', () => {
      store.dispatchSync(scrollToAction({ scrollLeft: -100, scrollTop: -100 }));
      store.dispatchSync(changeZoomLevelAction$(0.5));

      // centerXRatio = (1000 - (100 + 500)) / 1000 = 0.4
      // centerYRatio = (1000 - (100 + 400)) / 1000 = 0.5
      expect(store.state.settings.scrollLeft).toBe(-100 + -200);
      expect(store.state.settings.scrollTop).toBe(-100 + -250);
      expect(store.state.settings.zoomLevel).toBe(0.5);
    });

    it('clamps an out-of-range zoom level and computes no movement', () => {
      store.dispatchSync(changeZoomLevelAction$(10));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
      expect(store.state.settings.scrollLeft).toBe(0);
      expect(store.state.settings.scrollTop).toBe(0);
    });

    it('clamps a below-range zoom level', () => {
      store.dispatchSync(changeZoomLevelAction$(-3));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MIN);
      // x = y = (2000 - 200) / 2 = 900
      expect(store.state.settings.scrollLeft).toBe(-450);
      expect(store.state.settings.scrollTop).toBe(-540);
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
      expect(store.state.settings.scrollLeft).toBe(-250);
      expect(store.state.settings.scrollTop).toBe(-300);
    });

    it('accumulates across successive deltas', () => {
      store.dispatchSync(streamZoomLevelAction$(-0.25));
      expect(store.state.settings.zoomLevel).toBe(0.75);

      store.dispatchSync(streamZoomLevelAction$(-0.25));
      expect(store.state.settings.zoomLevel).toBe(0.5);
      expect(store.state.settings.scrollLeft).toBeLessThan(0);
      expect(store.state.settings.scrollTop).toBeLessThan(0);
    });

    it('produces no movement once the zoom level is already clamped', () => {
      store.dispatchSync(streamZoomLevelAction$(5));

      expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);
      expect(store.state.settings.scrollLeft).toBe(0);
      expect(store.state.settings.scrollTop).toBe(0);
    });
  });
});
