import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { CanvasType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  createSceneView,
  getActiveView,
  isViewShown,
} from '@/engine/modules/editor/view';
import {
  changeVisualizationModeAction,
  viewCloseAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { createStore, Store } from '@/engine/store';

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

/** Puts the reader on the visualization tab in Flow mode, the only place a Flow view counts. */
function showFlowTab() {
  store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.flow })
  );
}

describe('createSceneView', () => {
  it('opens a Flow view on name boxes with nothing placed and a neutral placement', () => {
    const view = createSceneView(ViewKind.flow);

    expect(view).toEqual({
      kind: ViewKind.flow,
      showMode: ShowMode.nameOnly,
      positions: {},
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      centerIds: [],
      hop: 1,
      history: { entries: [[]], cursor: 0 },
    });
  });

  it('opens a Focus view on the key rows, standing on its centers as its first history entry', () => {
    const view = createSceneView(ViewKind.focus, ['t1', 't2']);

    expect(view.showMode).toBe(ShowMode.keysOnly);
    expect(view.hop).toBe(1);
    expect(view.centerIds).toEqual(['t1', 't2']);
    expect(view.history).toEqual({ entries: [['t1', 't2']], cursor: 0 });
  });

  it('copies the centers it is given rather than sharing them', () => {
    const centers = ['t1'];
    const view = createSceneView(ViewKind.focus, centers);

    centers.push('t2');
    view.centerIds.push('t3');

    expect(view.centerIds).toEqual(['t1', 't3']);
    expect(view.history.entries[0]).toEqual(['t1']);
  });
});

describe('getActiveView', () => {
  it('is null in a fresh editor', () => {
    expect(getActiveView(store.state)).toBeNull();
  });

  it('returns the Focus view over any tab', () => {
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] })
    );

    expect(getActiveView(store.state)).toBe(store.state.editor.views.focus);

    store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.schemaSQL }));
    expect(getActiveView(store.state)).toBe(store.state.editor.views.focus);
  });

  it('returns the Flow view only while the visualization tab shows Flow', () => {
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    expect(getActiveView(store.state)).toBeNull();

    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization })
    );
    expect(getActiveView(store.state)).toBeNull();

    store.dispatchSync(
      changeVisualizationModeAction({ value: VisualizationMode.flow })
    );
    expect(getActiveView(store.state)).toBe(store.state.editor.views.flow);

    store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    expect(getActiveView(store.state)).toBeNull();

    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      changeVisualizationModeAction({ value: VisualizationMode.graph })
    );
    expect(getActiveView(store.state)).toBeNull();
  });

  it('is null on the Flow tab while no Flow view has been opened', () => {
    showFlowTab();

    expect(getActiveView(store.state)).toBeNull();
  });

  // AC-44
  it('hands Focus over Flow and Flow back when Focus closes, with the Flow placement kept', () => {
    showFlowTab();
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 10, y: 20 }, t2: { x: 300, y: 20 } },
      })
    );
    const flow = store.state.editor.views.flow;
    expect(getActiveView(store.state)).toBe(flow);

    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] })
    );
    expect(getActiveView(store.state)).toBe(store.state.editor.views.focus);
    expect(getActiveView(store.state)?.kind).toBe(ViewKind.focus);
    expect(store.state.editor.views.flow).toBe(flow);
    expect(store.state.editor.views.flow?.positions).toEqual({
      t1: { x: 10, y: 20 },
      t2: { x: 300, y: 20 },
    });

    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));
    expect(getActiveView(store.state)).toBe(flow);
    expect(flow?.positions).toEqual({
      t1: { x: 10, y: 20 },
      t2: { x: 300, y: 20 },
    });
  });

  it('reads the tab only while no Focus view is open', () => {
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow }),
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] })
    );
    const focus = store.state.editor.views.focus;

    expect(getActiveView(store.state)).toBe(focus);

    showFlowTab();
    expect(getActiveView(store.state)).toBe(focus);
  });
});

describe('isViewShown', () => {
  it('shows a Focus view wherever it is open, and no view while none is', () => {
    expect(isViewShown(store.state, ViewKind.focus)).toBe(false);
    expect(isViewShown(store.state, ViewKind.flow)).toBe(false);

    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] })
    );
    expect(isViewShown(store.state, ViewKind.focus)).toBe(true);

    showFlowTab();
    expect(isViewShown(store.state, ViewKind.focus)).toBe(true);

    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));
    expect(isViewShown(store.state, ViewKind.focus)).toBe(false);
  });

  it('shows an open Flow view only while the tab is on Flow, a Focus view over it or not', () => {
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    expect(isViewShown(store.state, ViewKind.flow)).toBe(false);

    showFlowTab();
    expect(isViewShown(store.state, ViewKind.flow)).toBe(true);

    // A Focus overlay takes the active slot and leaves the Flow scene under it mounted.
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] })
    );
    expect(getActiveView(store.state)?.kind).toBe(ViewKind.focus);
    expect(isViewShown(store.state, ViewKind.flow)).toBe(true);

    store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    expect(isViewShown(store.state, ViewKind.flow)).toBe(false);
    expect(store.state.editor.views.flow).not.toBeNull();

    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      changeVisualizationModeAction({ value: VisualizationMode.graph })
    );
    expect(isViewShown(store.state, ViewKind.flow)).toBe(false);
  });

  it('shows nothing on the Flow tab while no Flow view has been opened', () => {
    showFlowTab();

    expect(isViewShown(store.state, ViewKind.flow)).toBe(false);
  });
});
