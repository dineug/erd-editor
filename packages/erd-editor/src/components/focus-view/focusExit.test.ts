// The way out of a Focus view: the close and the tab in one dispatch, the
// scroll to the last centers and their selection in the next, so the scroll
// reaches the document rather than the view it closes. AC-7 and AC-39, the store half.

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  leaveFocusView,
  returnToCentersAction$,
} from '@/components/focus-view/focusExit';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import { ChangeActionTypes } from '@/engine/actions';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ViewKind, VisualizationMode } from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewOpenAction,
  viewSetCentersAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { openFocusViewAction$ } from '@/engine/modules/editor/view.generator.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { unionRect } from '@/konva/scene/contentBounds';
import { getTableRect } from '@/konva/scene/metrics';
import { toScreenPoint } from '@/konva/scene/viewport';

const VIEWPORT = { width: 1000, height: 600 };

const apps: AppContext[] = [];

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
});

/** A chain t1 - t2 - t3 on a document zoomed out, so the zoom the way out keeps is one it could have moved; t2 alone is off screen. */
function seed(): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 1 } }),
    addTableAction({ id: 't2', ui: { x: 2700, y: 1100, zIndex: 2 } }),
    addTableAction({ id: 't3', ui: { x: 400, y: 400, zIndex: 3 } }),
    addRelationshipAction({
      id: 'r12',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't2', columnIds: [] },
    }),
    addRelationshipAction({
      id: 'r23',
      relationshipType: RelationshipType.ZeroN,
      start: { tableId: 't2', columnIds: [] },
      end: { tableId: 't3', columnIds: [] },
    }),
    changeZoomLevelAction({ value: 0.8 })
  );

  return app;
}

/** Every batch the store reduces from here on, by the types it carries. */
function recordBatches(app: AppContext): string[][] {
  const batches: string[][] = [];
  app.store.subscribe((actions: AnyAction[]) => {
    batches.push(actions.map(({ type }) => type));
  });

  return batches;
}

/** Where the middle of a table lands on the screen, through the document's own placement. */
const screenCentreOf = (app: AppContext, id: string) => {
  const { state } = app.store;
  const rect = getTableRect(state, state.collections.tableEntities[id]);

  return toScreenPoint(state.settings, {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  });
};

const selectedIds = (app: AppContext) =>
  Object.keys(app.store.state.editor.selectedMap).sort();

describe('leaveFocusView', () => {
  it('closes first and scrolls after, in two batches, so the scroll lands in the document and the zoom stands (AC-7, AC-39)', () => {
    const app = seed();
    app.store.dispatchSync(
      openFocusViewAction$(['t1']),
      viewSetCentersAction({ tableIds: ['t2'], push: true })
    );
    const batches = recordBatches(app);

    leaveFocusView(app.store);

    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual(['editor.viewClose']);
    expect(batches[1][0]).toBe('settings.scrollTo');

    const { state } = app.store;
    expect(state.editor.views.focus).toBeNull();
    expect(state.editor.openMap[Open.focus]).toBe(false);
    expect(state.settings.canvasType).toBe(CanvasType.ERD);
    expect(state.settings.zoomLevel).toBe(0.8);
    expect(selectedIds(app)).toEqual(['t2']);

    const centre = screenCentreOf(app, 't2');
    expect(centre.x).toBeCloseTo(VIEWPORT.width / 2, 3);
    expect(centre.y).toBeCloseTo(VIEWPORT.height / 2, 3);
  });

  it('stands the reader on the ERD tab from the Flow tab, leaving the Flow view where it was', () => {
    const app = seed();
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      changeVisualizationModeAction({ value: VisualizationMode.flow }),
      viewOpenAction({ kind: ViewKind.flow }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 0, y: 0 }, t2: { x: 500, y: 0 } },
      })
    );
    app.store.dispatchSync(openFocusViewAction$(['t2']));
    const batches = recordBatches(app);

    leaveFocusView(app.store);

    expect(batches[0]).toEqual([
      'editor.viewClose',
      'settings.changeCanvasType',
    ]);
    expect(batches[1][0]).toBe('settings.scrollTo');

    const { state } = app.store;
    expect(state.settings.canvasType).toBe(CanvasType.ERD);
    expect(state.editor.views.flow?.positions.t2).toMatchObject({
      x: 500,
      y: 0,
    });
    expect(selectedIds(app)).toEqual(['t2']);
    expect(screenCentreOf(app, 't2').x).toBeCloseTo(VIEWPORT.width / 2, 3);
  });

  it('selects every center of a view left on several, the box round them centred, at the zoom the document had (AC-74)', () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t2', 't1', 't3']));

    leaveFocusView(app.store);

    expect(selectedIds(app)).toEqual(['t1', 't2', 't3']);
    expect(app.store.state.settings.zoomLevel).toBe(0.8);

    const { state } = app.store;
    const box = ['t1', 't2', 't3']
      .map(id => getTableRect(state, state.collections.tableEntities[id]))
      .reduce(unionRect);
    const centre = toScreenPoint(state.settings, {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    });
    expect(centre.x).toBeCloseTo(VIEWPORT.width / 2, 3);
    expect(centre.y).toBeCloseTo(VIEWPORT.height / 2, 3);
  });

  it('makes the one change the host hears of the scroll alone, when a center stands off screen (AC-73)', () => {
    const app = seed();
    app.store.dispatchSync(openFocusViewAction$(['t2']));
    const batches = recordBatches(app);

    leaveFocusView(app.store);

    expect(
      batches.flat().filter(type => ChangeActionTypes.includes(type as any))
    ).toEqual(['settings.scrollTo']);
  });

  it('leaves a center already on screen whole where it stands, so the host hears no change (AC-40)', () => {
    const app = seed();
    const { originX, originY } = app.store.state.settings;
    app.store.dispatchSync(openFocusViewAction$(['t1']));
    const batches = recordBatches(app);

    leaveFocusView(app.store);

    expect(batches).toHaveLength(2);
    expect(batches[1]).not.toContain('settings.scrollTo');
    expect(
      batches.flat().filter(type => ChangeActionTypes.includes(type as any))
    ).toEqual([]);
    expect(app.store.state.settings).toMatchObject({ originX, originY });
    expect(selectedIds(app)).toEqual(['t1']);
  });

  it('does nothing with no view open', () => {
    const app = seed();
    const batches = recordBatches(app);

    leaveFocusView(app.store);

    expect(batches).toEqual([]);
  });
});

describe('returnToCentersAction$', () => {
  it('passes over a center that is gone and stands on the next', () => {
    const app = seed();

    app.store.dispatchSync(returnToCentersAction$(['gone', 't2']));

    expect(selectedIds(app)).toEqual(['t2']);
    expect(screenCentreOf(app, 't2').x).toBeCloseTo(VIEWPORT.width / 2, 3);
  });

  it('moves nothing when none of the centers is left', () => {
    const app = seed();
    const { originX, originY } = app.store.state.settings;

    app.store.dispatchSync(returnToCentersAction$(['gone']));

    expect(app.store.state.settings).toMatchObject({ originX, originY });
    expect(selectedIds(app)).toEqual([]);
  });
});
