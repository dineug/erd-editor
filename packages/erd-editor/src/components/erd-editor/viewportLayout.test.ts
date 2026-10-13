import type { AnyAction } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import { TOOLBAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { ActionType } from '@/engine/modules/editor/actions';
import {
  changeOpenMapAction,
  changeViewportAction,
  changeZenModeAction,
} from '@/engine/modules/editor/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import type { Unsubscribe } from '@/internal-types';

import {
  applyViewport,
  editorWidthOf,
  hasToolbar,
  layoutOf,
  measureRoot,
  observeViewport,
} from './viewportLayout';

let app: AppContext;
let stopObserving: Unsubscribe;
let viewportDispatches: number;

const viewport = () => ({ ...app.store.state.editor.viewport });

beforeEach(() => {
  app = createTestAppContext();
  stopObserving = observeViewport(app.store);
  viewportDispatches = 0;
  app.store.subscribe((actions: AnyAction[]) => {
    viewportDispatches += actions.filter(
      action => action.type === ActionType.changeViewport
    ).length;
  });
});

afterEach(() => {
  stopObserving();
  app.store.destroy();
});

describe('hasToolbar', () => {
  it('keeps the toolbar unless zen mode is on over the ERD canvas', () => {
    const { state } = app.store;
    expect(hasToolbar(state)).toBe(true);

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    expect(hasToolbar(state)).toBe(false);

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );
    expect(hasToolbar(state)).toBe(true);
  });
});

describe('applyViewport', () => {
  it('sizes the viewport to the measured root less the toolbar', () => {
    measureRoot(app.store, { width: 1200, height: 800 });

    expect(viewport()).toEqual({
      width: 1200,
      height: 800 - TOOLBAR_HEIGHT,
    });
    expect(layoutOf(app.store).observed).toEqual({ width: 1200, height: 800 });
    expect(viewportDispatches).toBe(1);
  });

  it('applies zen mode inside the batch that turns it on, before anything renders', () => {
    measureRoot(app.store, { width: 1200, height: 800 });

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    expect(viewport()).toEqual({ width: 1200, height: 800 });

    app.store.dispatchSync(changeZenModeAction({ value: false }));
    expect(viewport()).toEqual({ width: 1200, height: 800 - TOOLBAR_HEIGHT });
  });

  it('gives the toolbar back on another tab while zen mode stays on', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    app.store.dispatchSync(changeZenModeAction({ value: true }));

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.generatorCode })
    );

    expect(viewport()).toEqual({ width: 1200, height: 800 - TOOLBAR_HEIGHT });
  });

  it('reads a host hidden later, measured at no height, as a viewport of none', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    measureRoot(app.store, { width: 0, height: 0 });

    expect(viewport()).toEqual({ width: 0, height: 0 });
  });

  it('compares its inputs first and writes nothing when none moved (AC-S17)', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    viewportDispatches = 0;

    applyViewport(app.store);
    measureRoot(app.store, { width: 1200, height: 800 });
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );

    expect(viewportDispatches).toBe(0);
  });

  it('dispatches nothing when its inputs moved but the viewport it would write is held', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    viewportDispatches = 0;

    app.store.dispatchSync(changeOpenMapAction({ [Open.diffViewer]: true }));

    expect(viewport()).toEqual({ width: 1200, height: 800 - TOOLBAR_HEIGHT });
    expect(viewportDispatches).toBe(0);
  });

  it('leaves a viewport a spec put in alone until an input moves', () => {
    app.store.dispatchSync(changeViewportAction({ width: 640, height: 480 }));
    app.store.dispatchSync(
      changeOpenMapAction({ [Open.tableProperties]: true })
    );

    expect(viewport()).toEqual({ width: 640, height: 480 });
  });

  it('stops applying once the subscription is dropped', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    stopObserving();

    app.store.dispatchSync(changeZenModeAction({ value: true }));

    expect(viewport()).toEqual({ width: 1200, height: 800 - TOOLBAR_HEIGHT });
  });
});

describe('layoutOf', () => {
  it('keeps one layout per store for the life of the store', () => {
    const other = createTestAppContext();

    expect(layoutOf(app.store)).toBe(layoutOf(app.store));
    expect(layoutOf(other.store)).not.toBe(layoutOf(app.store));
    expect(layoutOf(other.store)).toEqual({
      observed: { width: 0, height: 0 },
      reach: 0,
    });

    other.store.destroy();
  });
});

describe('editorWidthOf', () => {
  it('reads the viewport width while no panel takes any of it', () => {
    app.store.dispatchSync(changeViewportAction({ width: 639, height: 480 }));
    expect(editorWidthOf(app.store)).toBe(639);

    measureRoot(app.store, { width: 900, height: 700 });
    expect(editorWidthOf(app.store)).toBe(900);
  });
});
