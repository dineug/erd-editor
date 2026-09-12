import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CanvasType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  clearAction,
  initialClearAction,
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import { getActiveView } from '@/engine/modules/editor/view';
import {
  changeVisualizationModeAction,
  clearViews,
  viewChangeShowModeAction,
  viewChangeZoomLevelAction,
  viewCloseAction,
  viewMoveTableAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetCentersAction,
  viewSetLayoutAction,
  viewStreamScrollToAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { createStore, Store } from '@/engine/store';
import { createTable } from '@/utils/collection/table.entity';

let store: Store;

beforeEach(() => {
  store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
});

afterEach(() => {
  store.destroy();
});

function addTable(id: string, x = 200, y = 100) {
  const table = createTable({ id, name: id, ui: { x, y } });
  store.state.collections.tableEntities[id] = table;
  store.state.doc.tableIds.push(id);
  return table;
}

function showFlowTab() {
  store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.flow })
  );
}

/** A view standing on the centers given, on the tab that makes it the active one. */
function openFocused(centerIds: string[] = ['t1']) {
  showFlowTab();
  store.dispatchSync(viewOpenAction({ kind: ViewKind.flow, centerIds }));
  return store.state.editor.views.flow!;
}

/** The document placement as it stood before a view acted, to hold it against. */
function documentPlacement() {
  const { originX, originY, zoomLevel } = store.state.settings;
  const tables = Object.fromEntries(
    Object.values(store.state.collections.tableEntities).map(table => [
      table.id,
      { x: table.ui.x, y: table.ui.y },
    ])
  );
  return { originX, originY, zoomLevel, tables };
}

describe('editor.viewOpen / viewClose', () => {
  it('opens a fresh view on the centers given and closes it back to null', () => {
    const view = openFocused(['t1', 't2']);

    expect(view.kind).toBe(ViewKind.flow);
    expect(view.showMode).toBe(ShowMode.keysOnly);
    expect(view.centerIds).toEqual(['t1', 't2']);

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    expect(store.state.editor.views.flow).toBeNull();
  });

  it('opens a view without centers on name boxes', () => {
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    const { flow } = store.state.editor.views;
    expect(flow?.kind).toBe(ViewKind.flow);
    expect(flow?.showMode).toBe(ShowMode.nameOnly);
    expect(flow?.centerIds).toEqual([]);

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    expect(store.state.editor.views.flow).toBeNull();
  });

  // AC-63: nothing of the previous session survives a reopen on the same centers.
  it('reopening on the same centers starts from nothing placed, moved or zoomed', () => {
    const first = openFocused(['t1']);
    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 1, y: 2 } },
      }),
      viewScrollToAction({ originX: 40, originY: 50 }),
      viewChangeZoomLevelAction({ value: 0.5 }),
      viewChangeShowModeAction({ value: ShowMode.allFields }),
      viewSetCentersAction({ tableIds: ['t2'] })
    );
    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));

    const second = openFocused(['t1']);

    expect(second).not.toBe(first);
    expect(second.positions).toEqual({});
    expect(second).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      showMode: ShowMode.keysOnly,
      centerIds: ['t1'],
    });
  });

  it('closing a slot that is already empty is a no-op', () => {
    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));

    expect(store.state.editor.views).toEqual({ flow: null });
  });
});

describe('the view placement reducers', () => {
  it('do nothing while no view is active', () => {
    addTable('t1');
    const before = documentPlacement();

    store.dispatchSync(
      viewScrollToAction({ originX: 10, originY: 20 }),
      viewStreamScrollToAction({ movementX: 5, movementY: 5 }),
      viewChangeZoomLevelAction({ value: 0.5 }),
      viewStreamZoomLevelAction({ value: 0.1 }),
      viewMoveTableAction({ ids: ['t1'], movementX: 10, movementY: 10 }),
      viewChangeShowModeAction({ value: ShowMode.allFields })
    );

    expect(store.state.editor.views).toEqual({ flow: null });
    expect(documentPlacement()).toEqual(before);
  });

  it('viewScrollTo takes the placement as it stands, rounded to four decimals', () => {
    const view = openFocused();

    store.dispatchSync(
      viewScrollToAction({ originX: 40_000.12341, originY: -40_000.98769 })
    );

    expect(view.originX).toBe(40_000.1234);
    expect(view.originY).toBe(-40_000.9877);
  });

  it('viewStreamScrollTo adds the step, rounded to four decimals', () => {
    const view = openFocused();
    store.dispatchSync(viewScrollToAction({ originX: 10, originY: 20 }));

    store.dispatchSync(
      viewStreamScrollToAction({ movementX: 0.00004, movementY: -30.5 })
    );

    expect(view.originX).toBe(10);
    expect(view.originY).toBe(-10.5);
  });

  it('viewChangeZoomLevel and viewStreamZoomLevel clamp into the zoom range', () => {
    const view = openFocused();

    store.dispatchSync(viewChangeZoomLevelAction({ value: 0.456 }));
    expect(view.zoomLevel).toBe(0.46);

    store.dispatchSync(viewChangeZoomLevelAction({ value: 99 }));
    expect(view.zoomLevel).toBe(CANVAS_ZOOM_MAX);

    store.dispatchSync(viewStreamZoomLevelAction({ value: -99 }));
    expect(view.zoomLevel).toBe(CANVAS_ZOOM_MIN);

    store.dispatchSync(viewStreamZoomLevelAction({ value: 0.25 }));
    expect(view.zoomLevel).toBe(CANVAS_ZOOM_MIN + 0.25);
  });

  it('viewMoveTable moves the tables the view places and skips the ones it does not', () => {
    addTable('t1');
    addTable('t2');
    const view = openFocused();
    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 100, y: 100 } },
      })
    );

    store.dispatchSync(
      viewMoveTableAction({
        ids: ['t1', 't2'],
        movementX: 20.00004,
        movementY: -5,
      })
    );

    expect(view.positions).toEqual({ t1: { x: 120, y: 95 } });
  });

  it('viewSetLayout replaces the placement of the named view with a copy', () => {
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    const positions = { t1: { x: 1, y: 2 }, t2: { x: 3, y: 4 } };

    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t9: { x: 9, y: 9 } },
      })
    );
    store.dispatchSync(viewSetLayoutAction({ kind: ViewKind.flow, positions }));

    const { flow } = store.state.editor.views;
    expect(flow?.positions).toEqual(positions);
    expect(flow?.positions).not.toBe(positions);
    expect(flow?.positions.t1).not.toBe(positions.t1);
  });

  it('viewSetLayout on an empty slot is a no-op', () => {
    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 5, y: 6 } },
      })
    );

    expect(store.state.editor.views.flow).toBeNull();
  });

  it('viewChangeShowMode changes what the active view shows of each table', () => {
    const view = openFocused();

    store.dispatchSync(viewChangeShowModeAction({ value: ShowMode.allFields }));
    expect(view.showMode).toBe(ShowMode.allFields);

    store.dispatchSync(viewChangeShowModeAction({ value: ShowMode.keysOnly }));
    expect(view.showMode).toBe(ShowMode.keysOnly);
  });

  it('address the active view, and nothing at all once it closes', () => {
    const view = openFocused();

    store.dispatchSync(viewScrollToAction({ originX: 1, originY: 2 }));
    expect(view).toMatchObject({ originX: 1, originY: 2 });

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    store.dispatchSync(viewScrollToAction({ originX: 3, originY: 4 }));
    expect(view).toMatchObject({ originX: 1, originY: 2 });
    expect(store.state.editor.views.flow).toBeNull();
  });

  it('write the view named by kind, and skip a kind whose slot is empty', () => {
    addTable('t1', 200, 100);
    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.ERD }),
      viewOpenAction({ kind: ViewKind.flow }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 0, y: 0 } },
      })
    );
    const flow = store.state.editor.views.flow!;
    const kind = ViewKind.flow;

    store.dispatchSync(
      viewScrollToAction({ originX: 1, originY: 2, kind }),
      viewStreamScrollToAction({ movementX: 10, movementY: 20, kind }),
      viewChangeZoomLevelAction({ value: 0.5, kind }),
      viewStreamZoomLevelAction({ value: 0.1, kind }),
      viewMoveTableAction({ ids: ['t1'], movementX: 5, movementY: 6, kind }),
      viewChangeShowModeAction({ value: ShowMode.allFields, kind })
    );

    // The ERD tab is up, so no view is the active one and every write above
    // landed only because it named the kind.
    expect(getActiveView(store.state)).toBeNull();
    expect(flow).toMatchObject({
      originX: 11,
      originY: 22,
      zoomLevel: 0.6,
      showMode: ShowMode.allFields,
      positions: { t1: { x: 5, y: 6 } },
    });

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    store.dispatchSync(viewScrollToAction({ originX: 7, originY: 8, kind }));
    expect(flow).toMatchObject({ originX: 11, originY: 22 });
  });

  // AC-7: the document's own placement is never what a view action writes.
  it('leave settings.origin, settings.zoomLevel and table.ui where they were', () => {
    addTable('t1', 200, 100);
    addTable('t2', 600, 100);
    store.state.settings.originX = 33;
    store.state.settings.originY = 44;
    store.state.settings.zoomLevel = 0.8;
    const before = documentPlacement();
    openFocused(['t1']);
    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 0, y: 0 }, t2: { x: 400, y: 0 } },
      })
    );

    store.dispatchSync(
      viewStreamZoomLevelAction({ value: -0.3 }),
      viewChangeZoomLevelAction({ value: 0.5 }),
      viewStreamScrollToAction({ movementX: -120, movementY: 80 }),
      viewScrollToAction({ originX: 500, originY: -500 }),
      viewMoveTableAction({ ids: ['t1', 't2'], movementX: 50, movementY: 50 })
    );

    expect(documentPlacement()).toEqual(before);
    expect(store.state.editor.views.flow).toMatchObject({
      zoomLevel: 0.5,
      originX: 500,
      originY: -500,
      positions: { t1: { x: 50, y: 50 }, t2: { x: 450, y: 50 } },
    });
  });
});

describe('editor.viewSetCenters', () => {
  it('copies the ids it is handed', () => {
    const view = openFocused();
    const tableIds = ['t2'];

    store.dispatchSync(viewSetCentersAction({ tableIds }));
    tableIds.push('t3');

    expect(view.centerIds).toEqual(['t2']);
  });

  it('stands the active view on them when no kind is named', () => {
    const view = openFocused(['t1']);

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t2', 't3'] }));

    expect(view.centerIds).toEqual(['t2', 't3']);
  });

  it('stands the slot the kind names on them, whether or not it is the active view', () => {
    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.ERD }),
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] })
    );
    const view = store.state.editor.views.flow!;

    store.dispatchSync(
      viewSetCentersAction({ tableIds: ['t2'], kind: ViewKind.flow })
    );

    expect(getActiveView(store.state)).toBeNull();
    expect(view.centerIds).toEqual(['t2']);
  });

  it('does nothing while no view is open', () => {
    showFlowTab();

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t1'] }));

    expect(store.state.editor.views.flow).toBeNull();
  });
});

describe('editor.changeVisualizationMode', () => {
  it('starts on Graph and remembers the mode it is set to', () => {
    expect(store.state.editor.visualizationMode).toBe(VisualizationMode.graph);

    store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.flow })
    );
    expect(store.state.editor.visualizationMode).toBe(VisualizationMode.flow);

    store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.graph })
    );
    expect(store.state.editor.visualizationMode).toBe(VisualizationMode.graph);
  });
});

// AC-48: a replaced document takes the view with it.
describe('replacing the document', () => {
  const document = () => toJson(store.state);

  it.each([
    ['loadJson', () => loadJsonAction({ value: document() })],
    ['initialLoadJson', () => initialLoadJsonAction({ value: document() })],
    ['clear', () => clearAction()],
    ['initialClear', () => initialClearAction()],
  ])('%s drops the view', (_, replace) => {
    addTable('t1');
    openFocused(['t1']);
    expect(getActiveView(store.state)).not.toBeNull();

    store.dispatchSync(replace());

    expect(store.state.editor.views).toEqual({ flow: null });
    expect(getActiveView(store.state)).toBeNull();
  });

  it("keeps the visualization mode, which is the session's and not the document's", () => {
    showFlowTab();

    store.dispatchSync(clearAction());

    expect(store.state.editor.visualizationMode).toBe(VisualizationMode.flow);
  });

  it('clearViews empties the slot in place', () => {
    openFocused();
    const { editor } = store.state;

    clearViews(editor);

    expect(editor.views).toEqual({ flow: null });
  });
});
