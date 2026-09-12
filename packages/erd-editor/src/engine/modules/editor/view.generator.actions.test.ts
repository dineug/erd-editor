// The three Focus generators the overlay's bar and its stop chord dispatch:
// open stands a view on centers and raises the overlay, refit lands the shown
// tables in the middle of the screen, close takes both down. Focus slot only.

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { FOCUS_BAR_HEIGHT } from '@/constants/layout';
import { Open } from '@/constants/open';
import {
  CANVAS_ZOOM_MAX,
  CanvasType,
  RelationshipType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { actions$ } from '@/engine/modules/editor/generator.actions';
import { ShowMode, ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeHopAction,
  viewChangeShowModeAction,
  viewHistoryMoveAction,
  viewMoveTableAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetCentersAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import {
  closeFocusViewAction$,
  openFocusViewAction$,
  refitFocusViewAction$,
} from '@/engine/modules/editor/view.generator.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { createStore, Store } from '@/engine/store';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';
import { toScreenPoint } from '@/konva/scene/viewport';

const VIEWPORT = { width: 1000, height: 600 };

/** The screen a Focus fit has: the viewport less the bar drawn over its top. */
const SCREEN = {
  width: VIEWPORT.width,
  height: VIEWPORT.height - FOCUS_BAR_HEIGHT,
};

let store: Store;

beforeEach(() => {
  store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 1 } }),
    addTableAction({ id: 't2', ui: { x: 700, y: 100, zIndex: 2 } }),
    addTableAction({ id: 't3', ui: { x: 1300, y: 100, zIndex: 3 } }),
    addRelationshipAction({
      id: 'r12',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: [] },
    })
  );
});

afterEach(() => {
  store.destroy();
});

const focusOf = () => store.state.editor.views.focus;

/** The document's own placement, to hold against after a view acted. */
const documentPlacement = () => {
  const { originX, originY, zoomLevel } = store.state.settings;
  return { originX, originY, zoomLevel };
};

describe('openFocusViewAction$', () => {
  it('opens a Focus view on the centers given and raises the overlay', () => {
    store.dispatchSync(openFocusViewAction$(['t1', 't2']));

    expect(focusOf()).toMatchObject({
      kind: ViewKind.focus,
      centerIds: ['t1', 't2'],
      hop: 1,
      showMode: ShowMode.keysOnly,
      history: { entries: [['t1', 't2']], cursor: 0 },
    });
    expect(store.state.editor.openMap[Open.focus]).toBe(true);
  });

  it('opens nothing on no centers, which is what a shortcut with no selection asks', () => {
    store.dispatchSync(openFocusViewAction$([]));

    expect(focusOf()).toBeNull();
    expect(store.state.editor.openMap[Open.focus]).toBeUndefined();
  });

  it('stands where it is when asked for the centers it stands on, keeping its reach, its rows and its trail', () => {
    store.dispatchSync(
      openFocusViewAction$(['t1']),
      viewChangeHopAction({ value: 2 }),
      viewChangeShowModeAction({ value: ShowMode.allFields }),
      viewSetCentersAction({ tableIds: ['t2'], push: true }),
      viewSetLayoutAction({
        kind: ViewKind.focus,
        positions: { t2: { x: 10, y: 20 } },
      })
    );
    const before = focusOf();

    store.dispatchSync(openFocusViewAction$(['t2']));

    expect(focusOf()).toBe(before);
    expect(focusOf()).toMatchObject({
      centerIds: ['t2'],
      hop: 2,
      showMode: ShowMode.allFields,
      history: { entries: [['t1'], ['t2']], cursor: 1 },
    });
    expect(focusOf()!.positions.t2).toMatchObject({ x: 10, y: 20 });
  });

  // The entry handles reuse this on an open view, so a Focus asked for from
  // another table is a step on the trail rather than the loss of the one behind.
  it('walks an open view to new centers as a step on the trail, dropping the steps ahead', () => {
    store.dispatchSync(
      openFocusViewAction$(['t1']),
      viewSetCentersAction({ tableIds: ['t2'], push: true }),
      viewSetCentersAction({ tableIds: ['t3'], push: true }),
      viewHistoryMoveAction({ delta: -1 }),
      viewChangeHopAction({ value: 2 })
    );
    const before = focusOf();

    store.dispatchSync(openFocusViewAction$(['t1', 't2']));

    expect(focusOf()).toBe(before);
    expect(focusOf()).toMatchObject({
      centerIds: ['t1', 't2'],
      hop: 2,
      history: { entries: [['t1'], ['t2'], ['t1', 't2']], cursor: 2 },
    });
    expect(store.state.editor.openMap[Open.focus]).toBe(true);
  });

  it('is reachable through the action registry', () => {
    expect(actions$.openFocusViewAction$).toBe(openFocusViewAction$);
    expect(actions$.refitFocusViewAction$).toBe(refitFocusViewAction$);
    expect(actions$.closeFocusViewAction$).toBe(closeFocusViewAction$);
  });
});

describe('refitFocusViewAction$', () => {
  const positions = { t1: { x: 0, y: 0 }, t2: { x: 900, y: 300 } };

  it('lands the shown tables in the middle of the screen below the bar, at the zoom that fits them there', () => {
    store.dispatchSync(
      openFocusViewAction$(['t1']),
      viewSetLayoutAction({ kind: ViewKind.focus, positions }),
      viewScrollToAction({ originX: 333, originY: -222, kind: ViewKind.focus })
    );
    const document = documentPlacement();
    const content = getSceneContentRect(store.state, 'focus')!;

    store.dispatchSync(refitFocusViewAction$());

    const view = focusOf()!;
    const zoomLevel = previewZoomLevel(content, SCREEN, CANVAS_ZOOM_MAX);
    const centre = toScreenPoint(view, {
      x: content.x + content.width / 2,
      y: content.y + content.height / 2,
    });

    expect(view.zoomLevel).toBe(zoomLevel);
    expect(centre.x).toBeCloseTo(SCREEN.width / 2, 3);
    expect(centre.y).toBeCloseTo(FOCUS_BAR_HEIGHT + SCREEN.height / 2, 3);
    expect(documentPlacement()).toEqual(document);
  });

  it('keeps the top of what it fits clear of the bar', () => {
    store.dispatchSync(
      openFocusViewAction$(['t1']),
      viewSetLayoutAction({ kind: ViewKind.focus, positions })
    );

    store.dispatchSync(refitFocusViewAction$());

    const content = getSceneContentRect(store.state, 'focus')!;
    const top = toScreenPoint(focusOf()!, { x: content.x, y: content.y });
    expect(top.y).toBeGreaterThanOrEqual(FOCUS_BAR_HEIGHT);
  });

  it('opens closer than the preview ceiling on a hub the screen dwarfs', () => {
    store.dispatchSync(
      openFocusViewAction$(['t1']),
      viewSetLayoutAction({
        kind: ViewKind.focus,
        positions: { t1: { x: 0, y: 0 }, t2: { x: 0, y: 120 } },
      })
    );

    store.dispatchSync(refitFocusViewAction$());

    expect(focusOf()!.zoomLevel).toBeGreaterThan(
      previewZoomLevel(getSceneContentRect(store.state, 'focus')!, VIEWPORT)
    );
    expect(focusOf()!.zoomLevel).toBeLessThanOrEqual(CANVAS_ZOOM_MAX);
  });

  it('holds still with no view, no screen, or nothing shown', () => {
    store.dispatchSync(refitFocusViewAction$());
    expect(focusOf()).toBeNull();

    store.dispatchSync(
      openFocusViewAction$(['t1']),
      viewSetLayoutAction({ kind: ViewKind.focus, positions }),
      viewScrollToAction({ originX: 333, originY: -222, kind: ViewKind.focus }),
      changeViewportAction({ width: 0, height: 0 })
    );
    store.dispatchSync(refitFocusViewAction$());
    expect(focusOf()).toMatchObject({
      originX: 333,
      originY: -222,
      zoomLevel: 1,
    });

    store.dispatchSync(
      changeViewportAction(VIEWPORT),
      viewSetCentersAction({ tableIds: ['nowhere'] })
    );
    store.dispatchSync(refitFocusViewAction$());
    expect(focusOf()).toMatchObject({
      originX: 333,
      originY: -222,
      zoomLevel: 1,
    });
  });

  it('reads the Focus slot whatever is active, and moves the document not at all', () => {
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow }),
      viewSetLayoutAction({ kind: ViewKind.flow, positions }),
      openFocusViewAction$(['t1']),
      viewSetLayoutAction({ kind: ViewKind.focus, positions }),
      viewMoveTableAction({
        ids: ['t2'],
        movementX: 50,
        movementY: 50,
        kind: ViewKind.focus,
      })
    );
    const flow = { ...store.state.editor.views.flow! };
    const document = documentPlacement();

    store.dispatchSync(refitFocusViewAction$());

    expect(store.state.editor.views.flow).toMatchObject({
      originX: flow.originX,
      originY: flow.originY,
      zoomLevel: flow.zoomLevel,
    });
    expect(documentPlacement()).toEqual(document);
    expect(focusOf()!.zoomLevel).not.toBe(1);
  });
});

describe('closeFocusViewAction$', () => {
  it('drops the view and lowers the overlay', () => {
    store.dispatchSync(openFocusViewAction$(['t1']));
    store.dispatchSync(closeFocusViewAction$());

    expect(focusOf()).toBeNull();
    expect(store.state.editor.openMap[Open.focus]).toBe(false);
  });

  it('stands the reader on the ERD tab from any other, which is the way out the spec names', () => {
    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      openFocusViewAction$(['t1'])
    );
    store.dispatchSync(closeFocusViewAction$());

    expect(store.state.settings.canvasType).toBe(CanvasType.ERD);
    expect(focusOf()).toBeNull();
  });

  it('does nothing with no view open, and leaves a Flow view alone', () => {
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    store.dispatchSync(closeFocusViewAction$());

    expect(store.state.editor.views.flow).not.toBeNull();
    expect(store.state.editor.openMap[Open.focus]).toBeUndefined();
  });
});
