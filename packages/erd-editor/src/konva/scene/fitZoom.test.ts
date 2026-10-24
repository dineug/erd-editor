import { round } from 'es-toolkit/compat';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  getViewTransform,
  getVisibleCanvasRect,
} from '@/components/erd/minimap/minimapGeometry';
import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { getContentRect } from '@/konva/scene/contentBounds';
import {
  FIT_PADDING,
  fitDocument,
  PREVIEW_ZOOM_MAX,
  previewZoomLevel,
} from '@/konva/scene/fitZoom';
import type { Rect } from '@/konva/scene/metrics';

describe('previewZoomLevel', () => {
  const viewport = { width: 1200, height: 675 };
  const rect = (width: number, height: number): Rect => ({
    x: 0,
    y: 0,
    width,
    height,
  });

  /** The fit before it is rounded or held, written out longhand. */
  const rawFit = ({ width, height }: Rect) =>
    Math.min(
      viewport.width / (width + FIT_PADDING),
      viewport.height / (height + FIT_PADDING)
    );

  it('opens no closer than the ceiling on content the screen dwarfs', () => {
    const content = rect(200, 100);

    expect(rawFit(content)).toBeGreaterThan(PREVIEW_ZOOM_MAX);
    expect(previewZoomLevel(content, viewport)).toBe(PREVIEW_ZOOM_MAX);
  });

  it('opens up to the ceiling a view names instead, and no closer than that', () => {
    const content = rect(200, 100);

    expect(rawFit(content)).toBeGreaterThan(CANVAS_ZOOM_MAX);
    expect(previewZoomLevel(content, viewport, CANVAS_ZOOM_MAX)).toBe(
      CANVAS_ZOOM_MAX
    );
    expect(previewZoomLevel(content, viewport, 1)).toBe(1);
  });

  it('opens no farther than the floor every zoom has on content the screen cannot hold', () => {
    const content = rect(20_000, 20_000);

    expect(rawFit(content)).toBeLessThan(CANVAS_ZOOM_MIN);
    expect(previewZoomLevel(content, viewport)).toBe(CANVAS_ZOOM_MIN);
  });

  it('is the fit itself, rounded to two places, in between', () => {
    for (const content of [
      rect(2_000, 1_500),
      rect(700, 1_800),
      rect(3_333, 300),
    ]) {
      const zoomLevel = previewZoomLevel(content, viewport);
      const fit = rawFit(content);

      expect(fit).toBeGreaterThan(CANVAS_ZOOM_MIN);
      expect(fit).toBeLessThan(PREVIEW_ZOOM_MAX);
      expect(zoomLevel).toBe(round(zoomLevel, 2));
      expect(Math.abs(zoomLevel - fit)).toBeLessThanOrEqual(0.005);
    }
  });

  it('fits the tighter axis, so the whole content is on screen either way', () => {
    const wide = rect(4_000, 100);
    const tall = rect(100, 4_000);

    expect(previewZoomLevel(wide, viewport)).toBe(
      round(viewport.width / (wide.width + FIT_PADDING), 2)
    );
    expect(previewZoomLevel(tall, viewport)).toBe(
      round(viewport.height / (tall.height + FIT_PADDING), 2)
    );
  });
});

describe('fitDocument', () => {
  const VIEWPORT = { width: 1200, height: 800 };
  const START = { zoomLevel: 0.8, originX: 40, originY: -30 };

  let app: AppContext | null = null;

  afterEach(() => {
    app?.store.destroy();
    app = null;
  });

  /** A store standing at START over the screen given, with whatever the case seeds. */
  const createStore = (
    viewport = VIEWPORT,
    options?: Parameters<typeof createTestAppContext>[0]
  ) => {
    app = createTestAppContext(options);
    app.store.dispatchSync(
      changeViewportAction(viewport),
      changeZoomLevelAction({ value: START.zoomLevel }),
      scrollToAction({ originX: START.originX, originY: START.originY })
    );
    return app.store;
  };

  const seedTables = (store: AppContext['store']) =>
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 300, y: 200, zIndex: 1 } }),
      addTableAction({ id: 't2', ui: { x: 2_400, y: 1_600, zIndex: 2 } })
    );

  const standing = (store: AppContext['store']) => {
    const { zoomLevel, originX, originY } = store.state.settings;
    return { zoomLevel, originX, originY };
  };

  const centerOf = ({ x, y, width, height }: Rect) => ({
    x: x + width / 2,
    y: y + height / 2,
  });

  it('opens at the zoom a fit of the content takes, with the canvas ceiling', () => {
    const store = createStore();
    seedTables(store);
    const content = getContentRect(store.state)!;

    fitDocument(store);

    expect(store.state.settings.zoomLevel).toBe(
      previewZoomLevel(content, VIEWPORT, CANVAS_ZOOM_MAX)
    );
  });

  it('centres the content on the screen and shows all of it', () => {
    const store = createStore();
    seedTables(store);
    const content = getContentRect(store.state)!;

    fitDocument(store);

    const visible = getVisibleCanvasRect(getViewTransform(store.state));
    const middle = centerOf(visible);
    expect(middle.x).toBeCloseTo(centerOf(content).x, 3);
    expect(middle.y).toBeCloseTo(centerOf(content).y, 3);
    expect(visible.x).toBeLessThanOrEqual(content.x);
    expect(visible.y).toBeLessThanOrEqual(content.y);
    expect(visible.x + visible.width).toBeGreaterThanOrEqual(
      content.x + content.width
    );
    expect(visible.y + visible.height).toBeGreaterThanOrEqual(
      content.y + content.height
    );
  });

  it('opens a small document up to the canvas ceiling, or to the one given', () => {
    const store = createStore();
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 300, y: 200, zIndex: 1 } })
    );

    fitDocument(store);
    expect(store.state.settings.zoomLevel).toBe(CANVAS_ZOOM_MAX);

    fitDocument(store, 1);
    expect(store.state.settings.zoomLevel).toBe(1);
  });

  it('takes in a memo, which the content counts as the tables are', () => {
    const store = createStore();
    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: -1_000, y: -600, zIndex: 1 } })
    );
    const content = getContentRect(store.state)!;

    fitDocument(store);

    const middle = centerOf(
      getVisibleCanvasRect(getViewTransform(store.state))
    );
    expect(middle.x).toBeCloseTo(centerOf(content).x, 3);
    expect(middle.y).toBeCloseTo(centerOf(content).y, 3);
  });

  it('fits a readonly store too, which lets a zoom and a scroll through', () => {
    let readonly = false;
    const store = createStore(VIEWPORT, { getReadonly: () => readonly });
    seedTables(store);
    readonly = true;

    fitDocument(store);

    expect(standing(store)).not.toEqual(START);
    expect(store.state.settings.zoomLevel).toBe(
      previewZoomLevel(getContentRect(store.state)!, VIEWPORT, CANVAS_ZOOM_MAX)
    );
  });

  it('leaves the zoom and the origin as they are on a screen not yet measured', () => {
    const store = createStore({ width: 0, height: 0 });
    seedTables(store);

    fitDocument(store);

    expect(standing(store)).toEqual(START);
  });

  it('leaves the zoom and the origin as they are over an empty document', () => {
    const store = createStore();

    fitDocument(store);

    expect(standing(store)).toEqual(START);
  });
});
