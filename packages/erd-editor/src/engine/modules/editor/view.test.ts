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
  /** AC-50. The exact field list: hop and a walk history are gone, and must not come back. */
  it('opens on name boxes with nothing placed and a neutral placement, and holds no more', () => {
    const view = createSceneView(ViewKind.flow);

    expect(view).toEqual({
      kind: ViewKind.flow,
      showMode: ShowMode.nameOnly,
      positions: {},
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      centerIds: [],
    });
    expect(Object.keys(view).sort()).toEqual([
      'centerIds',
      'kind',
      'originX',
      'originY',
      'positions',
      'showMode',
      'zoomLevel',
    ]);
  });

  /** Decision (h). The centers pick the first display: narrowed opens on the key rows. */
  it('opens on the key rows when it is given centers, and on name boxes when it is not', () => {
    const focused = createSceneView(ViewKind.flow, ['t1', 't2']);

    expect(focused.showMode).toBe(ShowMode.keysOnly);
    expect(focused.centerIds).toEqual(['t1', 't2']);
    expect(createSceneView(ViewKind.flow, []).showMode).toBe(ShowMode.nameOnly);
  });

  it('copies the centers it is given rather than sharing them', () => {
    const centers = ['t1'];
    const view = createSceneView(ViewKind.flow, centers);

    centers.push('t2');
    view.centerIds.push('t3');

    expect(view.centerIds).toEqual(['t1', 't3']);
    expect(centers).toEqual(['t1', 't2']);
  });
});

describe('getActiveView', () => {
  it('is null in a fresh editor', () => {
    expect(getActiveView(store.state)).toBeNull();
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

  // AC-56: the view and its placement outlive a trip to another tab.
  it('hands the Flow view back on the return to its tab, with its placement kept', () => {
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

    store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    expect(getActiveView(store.state)).toBeNull();
    expect(store.state.editor.views.flow).toBe(flow);

    showFlowTab();
    expect(getActiveView(store.state)).toBe(flow);
    expect(flow?.positions).toEqual({
      t1: { x: 10, y: 20 },
      t2: { x: 300, y: 20 },
    });
  });
});

describe('isViewShown', () => {
  /** AC-56. The one positive pin: an open view is shown exactly while its tab is on Flow. */
  it('shows an open Flow view only while the tab is on Flow', () => {
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    expect(isViewShown(store.state, ViewKind.flow)).toBe(false);

    showFlowTab();
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
