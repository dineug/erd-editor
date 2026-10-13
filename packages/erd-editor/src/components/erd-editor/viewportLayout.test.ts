import type { AnyAction } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import type { AppContext } from '@/components/appContext';
import {
  closeExplorer,
  openExplorer,
  setExplorerWidth,
} from '@/components/explorer/explorerCommands';
import { explorerViewOf } from '@/components/explorer/explorerView';
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
  insetPastExplorer,
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

describe('the Explorer beside the canvas', () => {
  const reach = () => layoutOf(app.store).reach;

  it('starts closed, taking nothing from the canvas (AC-S1)', () => {
    measureRoot(app.store, { width: 1200, height: 800 });

    expect(explorerViewOf(app.store).open).toBe(false);
    expect(reach()).toBe(0);
    expect(viewport().width).toBe(1200);
  });

  it('takes its width from the canvas as it opens, and moves no origin and writes no history (AC-S4)', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    const { originX, originY } = app.store.state.settings;
    const undo = app.store.history.hasUndo();

    openExplorer(app.store);

    expect(reach()).toBe(260);
    expect(viewport()).toEqual({ width: 940, height: 800 - TOOLBAR_HEIGHT });
    expect(editorWidthOf(app.store)).toBe(1200);
    expect(app.store.state.settings.originX).toBe(originX);
    expect(app.store.state.settings.originY).toBe(originY);
    expect(app.store.history.hasUndo()).toBe(undo);

    closeExplorer(app.store);
    expect(viewport().width).toBe(1200);
  });

  it.each([
    [740, 260],
    [580, 260],
    [521, 201],
    [520, 200],
    [519, 0],
  ])(
    'leaves a root %i wide its least canvas and stands aside below its least width (AC-S6)',
    (width, expected) => {
      measureRoot(app.store, { width, height: 800 });
      openExplorer(app.store);

      expect(reach()).toBe(expected);
      expect(viewport().width).toBe(width - expected);
      expect(explorerViewOf(app.store).open).toBe(true);
    }
  );

  it('comes back once the root widens again, and follows a narrowing that leaves the viewport be (AC-S19)', () => {
    measureRoot(app.store, { width: 580, height: 800 });
    openExplorer(app.store);
    expect(reach()).toBe(260);

    measureRoot(app.store, { width: 320, height: 800 });
    expect(reach()).toBe(0);

    measureRoot(app.store, { width: 900, height: 800 });
    expect(reach()).toBe(260);
  });

  it('holds a width asked for between 200 and 480', () => {
    measureRoot(app.store, { width: 1400, height: 800 });
    openExplorer(app.store);

    setExplorerWidth(app.store, 100);
    expect(reach()).toBe(200);
    setExplorerWidth(app.store, 900);
    expect(reach()).toBe(480);
    setExplorerWidth(app.store, 333.6);
    expect(reach()).toBe(334);
  });

  it.each([
    [Open.diffViewer],
    [Open.timeTravel],
    [Open.automaticTablePlacement],
  ])(
    'stands aside while %s takes the canvas over, and comes back after (AC-S7)',
    key => {
      measureRoot(app.store, { width: 1200, height: 800 });
      openExplorer(app.store);

      app.store.dispatchSync(changeOpenMapAction({ [key]: true }));
      expect(reach()).toBe(0);
      expect(viewport().width).toBe(1200);

      app.store.dispatchSync(changeOpenMapAction({ [key]: false }));
      expect(reach()).toBe(260);
    }
  );

  it('stands aside off the ERD tab, where the other tab takes the whole root', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    openExplorer(app.store);

    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.schemaSQL })
    );

    expect(reach()).toBe(0);
    expect(viewport().width).toBe(1200);
    expect(explorerViewOf(app.store).open).toBe(true);
  });

  it('hides as zen mode comes on, and shows through it when opened there (AC-S21)', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    openExplorer(app.store);

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    expect(reach()).toBe(0);

    openExplorer(app.store);
    expect(app.store.state.editor.zenMode).toBe(true);
    expect(reach()).toBe(260);
    expect(viewport()).toEqual({ width: 940, height: 800 });

    app.store.dispatchSync(changeZenModeAction({ value: false }));
    expect(reach()).toBe(260);

    app.store.dispatchSync(changeZenModeAction({ value: true }));
    expect(reach()).toBe(0);
    expect(explorerViewOf(app.store).zenReveal).toBe(false);
  });

  it('closes under zen mode as anywhere else', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    app.store.dispatchSync(changeZenModeAction({ value: true }));
    openExplorer(app.store);

    closeExplorer(app.store);

    expect(explorerViewOf(app.store).open).toBe(false);
    expect(reach()).toBe(0);
  });
});

describe('insetPastExplorer', () => {
  it('stands a left-to-right picker past an open Explorer, and leaves it be otherwise (AC-S10)', () => {
    measureRoot(app.store, { width: 1200, height: 800 });
    expect(insetPastExplorer(app.store, 'ltr')).toEqual({});

    openExplorer(app.store);

    expect(insetPastExplorer(app.store, 'ltr')).toEqual({
      'inset-inline-start': '276px',
    });
    expect(insetPastExplorer(app.store, 'rtl')).toEqual({});
  });
});
