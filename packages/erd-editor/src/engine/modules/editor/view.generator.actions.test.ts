// The one view generator the ERD entry handles dispatch: it brings the
// visualization tab up on Flow, opens a view if none is open, and stands what
// it shows on the tables it was given.

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { CanvasType, RelationshipType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { actions$ } from '@/engine/modules/editor/generator.actions';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeShowModeAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { focusFlowTableAction$ } from '@/engine/modules/editor/view.generator.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { createStore, Store } from '@/engine/store';

const VIEWPORT = { width: 1000, height: 600 };

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

const viewOf = () => store.state.editor.views.flow;
const tabOf = () => store.state.settings.canvasType;
const modeOf = () => store.state.editor.visualizationMode;

describe('focusFlowTableAction$', () => {
  /** AC-51. One dispatch answers the tab, the mode and what the view shows. */
  it('brings the visualization tab up on Flow, standing a new view on the centers given', () => {
    store.dispatchSync(focusFlowTableAction$(['t1', 't2']));

    expect(tabOf()).toBe(CanvasType.visualization);
    expect(modeOf()).toBe(VisualizationMode.flow);
    expect(viewOf()).toMatchObject({
      kind: ViewKind.flow,
      centerIds: ['t1', 't2'],
      showMode: ShowMode.keysOnly,
    });
  });

  it('opens nothing on no centers, which is what a shortcut with no selection asks', () => {
    store.dispatchSync(focusFlowTableAction$([]));

    expect(viewOf()).toBeNull();
    expect(tabOf()).toBe(CanvasType.ERD);
  });

  /** AC-59. The centers are the whole selection, in the order the handle gathered them. */
  it('stands the view on every table it is handed', () => {
    store.dispatchSync(focusFlowTableAction$(['t3', 't1']));

    expect(viewOf()!.centerIds).toEqual(['t3', 't1']);
  });

  it('re-centers a view already open, keeping its rows and its placement', () => {
    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      changeVisualizationModeAction({ value: VisualizationMode.flow }),
      viewOpenAction({ kind: ViewKind.flow }),
      viewChangeShowModeAction({
        value: ShowMode.allFields,
        kind: ViewKind.flow,
      }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t2: { x: 10, y: 20 } },
      })
    );
    const before = viewOf();

    store.dispatchSync(focusFlowTableAction$(['t2']));

    expect(viewOf()).toBe(before);
    expect(viewOf()).toMatchObject({
      centerIds: ['t2'],
      showMode: ShowMode.allFields,
    });
    expect(viewOf()!.positions.t2).toMatchObject({ x: 10, y: 20 });
  });

  it('leaves the centers it is asked for standing when they are the ones it holds', () => {
    store.dispatchSync(focusFlowTableAction$(['t1']));
    const before = viewOf();

    store.dispatchSync(focusFlowTableAction$(['t1']));

    expect(viewOf()).toBe(before);
    expect(viewOf()!.centerIds).toEqual(['t1']);
  });

  it('is reachable through the action registry', () => {
    expect(actions$.focusFlowTableAction$).toBe(focusFlowTableAction$);
  });
});
