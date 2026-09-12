import { toJson } from '@dineug/erd-editor-schema';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { Open } from '@/constants/open';
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
  VIEW_HOP_MAX,
  VIEW_HOP_MIN,
  viewChangeHopAction,
  viewChangeShowModeAction,
  viewChangeZoomLevelAction,
  viewCloseAction,
  viewHistoryMoveAction,
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

function openFocus(centerIds: string[] = ['t1']) {
  store.dispatchSync(viewOpenAction({ kind: ViewKind.focus, centerIds }));
  return store.state.editor.views.focus!;
}

function showFlowTab() {
  store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.flow })
  );
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
  it('opens a fresh Focus view in its slot and closes it back to null', () => {
    const view = openFocus(['t1', 't2']);

    expect(view.kind).toBe(ViewKind.focus);
    expect(view.showMode).toBe(ShowMode.keysOnly);
    expect(view.centerIds).toEqual(['t1', 't2']);
    expect(view.history).toEqual({ entries: [['t1', 't2']], cursor: 0 });
    expect(store.state.editor.views.flow).toBeNull();

    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));
    expect(store.state.editor.views.focus).toBeNull();
  });

  it('opens a Flow view without centers and leaves the other slot alone', () => {
    openFocus();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    const { flow, focus } = store.state.editor.views;
    expect(flow?.kind).toBe(ViewKind.flow);
    expect(flow?.showMode).toBe(ShowMode.nameOnly);
    expect(flow?.centerIds).toEqual([]);
    expect(focus?.centerIds).toEqual(['t1']);

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    expect(store.state.editor.views.flow).toBeNull();
    expect(store.state.editor.views.focus).toBe(focus);
  });

  // AC-63: nothing of the previous session survives a reopen on the same centers.
  it('reopening on the same centers starts from nothing placed, walked or zoomed', () => {
    const first = openFocus(['t1']);
    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.focus,
        positions: { t1: { x: 1, y: 2 } },
      }),
      viewScrollToAction({ originX: 40, originY: 50 }),
      viewChangeZoomLevelAction({ value: 0.5 }),
      viewChangeHopAction({ value: 2 }),
      viewChangeShowModeAction({ value: ShowMode.allFields }),
      viewSetCentersAction({ tableIds: ['t2'], push: true })
    );
    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));

    const second = openFocus(['t1']);

    expect(second).not.toBe(first);
    expect(second.positions).toEqual({});
    expect(second).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      hop: 1,
      showMode: ShowMode.keysOnly,
      centerIds: ['t1'],
      history: { entries: [['t1']], cursor: 0 },
    });
  });

  it('closing a slot that is already empty is a no-op', () => {
    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));

    expect(store.state.editor.views).toEqual({ flow: null, focus: null });
  });

  // AC-43: the gates the overlay closes on the ERD read this flag, so it is
  // written where the slot is, never apart from it.
  it('raises the overlay flag with the Focus slot and lowers it with it, and a Flow view touches it not at all', () => {
    const flagOf = () => store.state.editor.openMap[Open.focus];

    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    expect(flagOf()).toBeUndefined();

    openFocus();
    expect(flagOf()).toBe(true);

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    expect(flagOf()).toBe(true);

    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));
    expect(flagOf()).toBe(false);
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

    expect(store.state.editor.views).toEqual({ flow: null, focus: null });
    expect(documentPlacement()).toEqual(before);
  });

  it('viewScrollTo takes the placement as it stands, rounded to four decimals', () => {
    const view = openFocus();

    store.dispatchSync(
      viewScrollToAction({ originX: 40_000.12341, originY: -40_000.98769 })
    );

    expect(view.originX).toBe(40_000.1234);
    expect(view.originY).toBe(-40_000.9877);
  });

  it('viewStreamScrollTo adds the step, rounded to four decimals', () => {
    const view = openFocus();
    store.dispatchSync(viewScrollToAction({ originX: 10, originY: 20 }));

    store.dispatchSync(
      viewStreamScrollToAction({ movementX: 0.00004, movementY: -30.5 })
    );

    expect(view.originX).toBe(10);
    expect(view.originY).toBe(-10.5);
  });

  it('viewChangeZoomLevel and viewStreamZoomLevel clamp into the zoom range', () => {
    const view = openFocus();

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
    const view = openFocus();
    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.focus,
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
    openFocus();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    const positions = { t1: { x: 1, y: 2 }, t2: { x: 3, y: 4 } };

    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t9: { x: 9, y: 9 } },
      })
    );
    store.dispatchSync(viewSetLayoutAction({ kind: ViewKind.flow, positions }));

    const { flow, focus } = store.state.editor.views;
    expect(flow?.positions).toEqual(positions);
    expect(flow?.positions).not.toBe(positions);
    expect(flow?.positions.t1).not.toBe(positions.t1);
    expect(focus?.positions).toEqual({});
  });

  it('viewSetLayout lands in the named slot even while the other view is the active one', () => {
    showFlowTab();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    openFocus();

    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 5, y: 6 } },
      })
    );

    expect(store.state.editor.views.flow?.positions).toEqual({
      t1: { x: 5, y: 6 },
    });
    expect(store.state.editor.views.focus?.positions).toEqual({});
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
    const view = openFocus();

    store.dispatchSync(viewChangeShowModeAction({ value: ShowMode.allFields }));
    expect(view.showMode).toBe(ShowMode.allFields);

    store.dispatchSync(viewChangeShowModeAction({ value: ShowMode.keysOnly }));
    expect(view.showMode).toBe(ShowMode.keysOnly);
  });

  it('address the active view: Focus over Flow, Flow alone once Focus closes', () => {
    showFlowTab();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    const flow = store.state.editor.views.flow!;
    const focus = openFocus();

    store.dispatchSync(viewScrollToAction({ originX: 1, originY: 2 }));
    expect(focus).toMatchObject({ originX: 1, originY: 2 });
    expect(flow).toMatchObject({ originX: 0, originY: 0 });

    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));
    store.dispatchSync(viewScrollToAction({ originX: 3, originY: 4 }));
    expect(flow).toMatchObject({ originX: 3, originY: 4 });
  });

  it('write the view named by kind, whichever is active, and skip a kind whose slot is empty', () => {
    addTable('t1', 200, 100);
    showFlowTab();
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 0, y: 0 } },
      })
    );
    const flow = store.state.editor.views.flow!;
    const focus = openFocus();
    const kind = ViewKind.flow;

    store.dispatchSync(
      viewScrollToAction({ originX: 1, originY: 2, kind }),
      viewStreamScrollToAction({ movementX: 10, movementY: 20, kind }),
      viewChangeZoomLevelAction({ value: 0.5, kind }),
      viewStreamZoomLevelAction({ value: 0.1, kind }),
      viewMoveTableAction({ ids: ['t1'], movementX: 5, movementY: 6, kind }),
      viewChangeShowModeAction({ value: ShowMode.allFields, kind })
    );

    expect(getActiveView(store.state)).toBe(focus);
    expect(flow).toMatchObject({
      originX: 11,
      originY: 22,
      zoomLevel: 0.6,
      showMode: ShowMode.allFields,
      positions: { t1: { x: 5, y: 6 } },
    });
    expect(focus).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      showMode: ShowMode.keysOnly,
      positions: {},
    });

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    store.dispatchSync(viewScrollToAction({ originX: 7, originY: 8, kind }));
    expect(focus).toMatchObject({ originX: 0, originY: 0 });
  });

  // AC-7: the document's own placement is never what a view action writes.
  it('leave settings.origin, settings.zoomLevel and table.ui where they were', () => {
    addTable('t1', 200, 100);
    addTable('t2', 600, 100);
    store.state.settings.originX = 33;
    store.state.settings.originY = 44;
    store.state.settings.zoomLevel = 0.8;
    const before = documentPlacement();
    openFocus(['t1']);
    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.focus,
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
    expect(store.state.editor.views.focus).toMatchObject({
      zoomLevel: 0.5,
      originX: 500,
      originY: -500,
      positions: { t1: { x: 50, y: 50 }, t2: { x: 450, y: 50 } },
    });
  });
});

describe('the Focus walk reducers', () => {
  it('viewChangeHop keeps the reach within its two values', () => {
    const view = openFocus();

    store.dispatchSync(viewChangeHopAction({ value: 2 }));
    expect(view.hop).toBe(2);

    store.dispatchSync(viewChangeHopAction({ value: 1 }));
    expect(view.hop).toBe(1);

    store.dispatchSync(viewChangeHopAction({ value: 7 }));
    expect(view.hop).toBe(VIEW_HOP_MAX);

    store.dispatchSync(viewChangeHopAction({ value: 0 }));
    expect(view.hop).toBe(VIEW_HOP_MIN);

    store.dispatchSync(viewChangeHopAction({ value: 1.9 }));
    expect(view.hop).toBe(1);
  });

  it('viewSetCenters with push opens a history entry and drops the forward ones', () => {
    const view = openFocus(['t1']);

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t2'], push: true }));
    store.dispatchSync(viewSetCentersAction({ tableIds: ['t3'], push: true }));
    expect(view.centerIds).toEqual(['t3']);
    expect(view.history).toEqual({
      entries: [['t1'], ['t2'], ['t3']],
      cursor: 2,
    });

    store.dispatchSync(viewHistoryMoveAction({ delta: -2 }));
    store.dispatchSync(viewSetCentersAction({ tableIds: ['t4'], push: true }));
    expect(view.centerIds).toEqual(['t4']);
    expect(view.history).toEqual({ entries: [['t1'], ['t4']], cursor: 1 });
  });

  it('viewSetCenters without push rewrites the entry the view stands on', () => {
    const view = openFocus(['t1', 't2']);
    store.dispatchSync(viewSetCentersAction({ tableIds: ['t3'], push: true }));

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t3', 't4'] }));

    expect(view.centerIds).toEqual(['t3', 't4']);
    expect(view.history).toEqual({
      entries: [
        ['t1', 't2'],
        ['t3', 't4'],
      ],
      cursor: 1,
    });
  });

  it('viewSetCenters copies the ids it is handed', () => {
    const view = openFocus();
    const tableIds = ['t2'];

    store.dispatchSync(viewSetCentersAction({ tableIds, push: true }));
    tableIds.push('t3');

    expect(view.centerIds).toEqual(['t2']);
    expect(view.history.entries[1]).toEqual(['t2']);
    expect(view.centerIds).not.toBe(view.history.entries[1]);
  });

  it('viewSetCenters with no kind stands the active view on them, Flow or Focus', () => {
    showFlowTab();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    const flow = store.state.editor.views.flow!;

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t1'] }));
    expect(flow.centerIds).toEqual(['t1']);

    const focus = openFocus(['t2']);
    store.dispatchSync(viewSetCentersAction({ tableIds: ['t3'] }));

    expect(focus.centerIds).toEqual(['t3']);
    expect(flow.centerIds).toEqual(['t1']);
  });

  it('viewSetCenters stands the slot the kind names on them, and not the active view', () => {
    const focus = openFocus(['t1']);
    showFlowTab();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    const flow = store.state.editor.views.flow!;

    store.dispatchSync(
      viewSetCentersAction({ tableIds: ['t2'], kind: ViewKind.flow })
    );

    expect(flow.centerIds).toEqual(['t2']);
    expect(getActiveView(store.state)).toBe(focus);
    expect(focus.centerIds).toEqual(['t1']);
  });

  // AC-46
  it('walking from three centers to one and back restores the three', () => {
    const view = openFocus(['t1', 't2', 't3']);

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t4'], push: true }));
    expect(view.centerIds).toEqual(['t4']);

    store.dispatchSync(viewHistoryMoveAction({ delta: -1 }));
    expect(view.centerIds).toEqual(['t1', 't2', 't3']);
    expect(view.history.cursor).toBe(0);

    store.dispatchSync(viewHistoryMoveAction({ delta: 1 }));
    expect(view.centerIds).toEqual(['t4']);
    expect(view.history.cursor).toBe(1);
  });

  it('viewHistoryMove refuses a step past either end and hands back a copy of the entry', () => {
    const view = openFocus(['t1']);
    store.dispatchSync(viewSetCentersAction({ tableIds: ['t2'], push: true }));

    store.dispatchSync(viewHistoryMoveAction({ delta: 1 }));
    expect(view.history.cursor).toBe(1);
    expect(view.centerIds).toEqual(['t2']);

    store.dispatchSync(viewHistoryMoveAction({ delta: -5 }));
    expect(view.history.cursor).toBe(1);

    store.dispatchSync(viewHistoryMoveAction({ delta: -1 }));
    expect(view.centerIds).toEqual(['t1']);
    expect(view.centerIds).not.toBe(view.history.entries[0]);

    store.dispatchSync(viewHistoryMoveAction({ delta: 0 }));
    expect(view.history.cursor).toBe(0);
  });

  it('the Focus half does nothing while no Focus view is open, and never lands on the Flow view instead', () => {
    showFlowTab();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    const flow = store.state.editor.views.flow!;

    store.dispatchSync(
      viewChangeHopAction({ value: 2 }),
      viewHistoryMoveAction({ delta: -1 }),
      viewSetCentersAction({ tableIds: ['t1'], kind: ViewKind.focus })
    );

    expect(flow.hop).toBe(1);
    expect(flow.centerIds).toEqual([]);
    expect(flow.history).toEqual({ entries: [[]], cursor: 0 });
    expect(getActiveView(store.state)).toBe(flow);
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

// AC-48: a replaced document takes both views with it.
describe('replacing the document', () => {
  const document = () => toJson(store.state);

  it.each([
    ['loadJson', () => loadJsonAction({ value: document() })],
    ['initialLoadJson', () => initialLoadJsonAction({ value: document() })],
    ['clear', () => clearAction()],
    ['initialClear', () => initialClearAction()],
  ])('%s drops both views', (_, replace) => {
    addTable('t1');
    showFlowTab();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    openFocus(['t1']);
    expect(getActiveView(store.state)).not.toBeNull();

    expect(store.state.editor.openMap[Open.focus]).toBe(true);

    store.dispatchSync(replace());

    expect(store.state.editor.views).toEqual({ flow: null, focus: null });
    expect(getActiveView(store.state)).toBeNull();
    // The overlay is drawn off the slot and the ERD gates read the flag, so
    // a flag left standing here would keep the ERD inert with no overlay in sight.
    expect(store.state.editor.openMap[Open.focus]).toBe(false);
  });

  it("keeps the visualization mode, which is the session's and not the document's", () => {
    showFlowTab();

    store.dispatchSync(clearAction());

    expect(store.state.editor.visualizationMode).toBe(VisualizationMode.flow);
  });

  it('clearViews empties both slots in place', () => {
    openFocus();
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    const { editor } = store.state;

    clearViews(editor);

    expect(editor.views).toEqual({ flow: null, focus: null });
    expect(editor.openMap[Open.focus]).toBe(false);
  });
});
