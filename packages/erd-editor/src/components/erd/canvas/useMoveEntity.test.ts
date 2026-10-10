import { FC, html, useProvider } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTouch,
  flush,
  mountAndFlush,
  Mounted,
  movePointer,
  releasePointer,
} from '@/__test-utils__/index';
import { seedMapTable } from '@/__test-utils__/mapColumnsSeed';
import { AppContext } from '@/components/appContext';
import {
  hasEntityDragTravelled,
  isEntityDragActive,
} from '@/components/erd/canvas/entityDrag';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import {
  sceneSourceContext,
  useSceneSource,
} from '@/components/sceneSourceContext';
import { CLICK_DRAG_MIN_MOVE } from '@/constants/layout';
import { RelationshipType } from '@/constants/schema';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType, ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeZoomLevelAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import {
  addTableAction,
  changeTableGroupAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { useUnmounted } from '@/hooks/useUnmounted';
import { getContentRect } from '@/konva/scene/contentBounds';
import {
  getViewContentRect,
  isViewFrozen,
  thawView,
} from '@/konva/scene/viewFreeze';

type Api = ReturnType<typeof useMoveEntity>;

let api: Api;

const Probe: FC<{}> = (props, ctx) => {
  api = useMoveEntity(ctx, {
    entityId: () => 't1',
    selectType: SelectType.table,
    blockedKinds: () => ['column'],
    source: useSceneSource(ctx),
  });

  return () => html`<div class="probe"></div>`;
};

/** A view scene root the way an overlay mounts one: a wrapper of its own, the provider inside. */
const ViewScope: FC<{ children: any }> = (props, ctx) => {
  const provider = useProvider(ctx, sceneSourceContext, 'flow');
  const { addUnsubscribe } = useUnmounted();
  addUnsubscribe(() => provider.destroy());

  return () => html`${props.children}`;
};

/** A scene node an ancestor walk finds nothing blocked on. */
const sceneNode = (kind: string | null = null) => ({
  getAttr: (name: string) => (name === 'kind' ? kind : undefined),
  getParent: () => null,
});

/**
 * A press as the stage hands it on. The same mousedown reaches the window,
 * where the move stream anchors its deltas on it, so the first move below is
 * measured from this point and not from wherever the last spec left the pointer.
 */
const press = (kind: string | null = null): ScenePointerEvent => {
  const evt = new MouseEvent('mousedown', {
    bubbles: true,
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  window.dispatchEvent(evt);

  return { target: sceneNode(kind), evt } as unknown as ScenePointerEvent;
};

let mounted: Mounted | null = null;
let app: AppContext;

beforeEach(async () => {
  app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 300, y: 200, zIndex: 2 } })
  );
  mounted = await mountAndFlush(html`<${Probe} />`, app);
});

afterEach(() => {
  releasePointer();
  mounted?.unmount();
  mounted = null;
  thawView(app.store.state);
  thawView(app.store.state, 'flow');
});

/** A second table beside the pressed one, and both of them selected. */
const selectBoth = () => {
  app.store.dispatchSync(
    addTableAction({ id: 't2', ui: { x: 900, y: 200, zIndex: 3 } })
  );
  app.store.dispatchSync(
    selectAction({ t1: SelectType.table, t2: SelectType.table })
  );
};

const selectedIds = () =>
  Object.keys(app.store.state.editor.selectedMap).sort();

const pointOf = (id: string) => {
  const { ui } = app.store.state.collections.tableEntities[id];
  return { x: ui.x, y: ui.y };
};

describe('useMoveEntity', () => {
  it('starts with no drag and no view held', () => {
    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
  });

  it('raises the drag flag and holds the content rect on a press', () => {
    const before = getContentRect(app.store.state);

    api.onMoveStart(press());

    expect(isEntityDragActive(app.store.state)).toBe(true);
    expect(isViewFrozen(app.store.state)).toBe(true);
    expect(getViewContentRect(app.store.state)).toEqual(before);
  });

  /**
   * A table dragged on a view overlay holds the view's origin, not the
   * document's: the ERD under the overlay keeps its own scroll ranges and
   * minimap live, and the drop releases the view alone.
   */
  it('holds the view a press landed in, and leaves the document live', async () => {
    mounted?.unmount();
    mounted = await mountAndFlush(
      html`<div><${ViewScope} .children=${html`<${Probe} />`} /></div>`,
      app
    );

    api.onMoveStart(press());

    expect(isEntityDragActive(app.store.state, 'flow')).toBe(true);
    expect(isViewFrozen(app.store.state, 'flow')).toBe(true);
    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);

    releasePointer();
    await flush();

    expect(isEntityDragActive(app.store.state, 'flow')).toBe(false);
    expect(isViewFrozen(app.store.state, 'flow')).toBe(false);
  });

  /**
   * What the freeze is for: the pointer moves the selection, the live content
   * rect follows it, and everything read through the view stands still until
   * the drop, when the two agree again.
   */
  it('serves the rect the drag began with until the drop', async () => {
    const before = getContentRect(app.store.state)!;

    api.onMoveStart(press());
    movePointer(400, 250);
    await flush();

    const live = getContentRect(app.store.state)!;
    expect(live.x).toBe(before.x + 400);
    expect(live.y).toBe(before.y + 250);
    expect(getViewContentRect(app.store.state)).toEqual(before);

    releasePointer();
    await flush();

    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
    expect(getViewContentRect(app.store.state)).toEqual(live);
  });

  /**
   * The press raises the entity's z-index and the scene destroys and rebuilds
   * the node it landed on, so the component is gone before the second move; a
   * drag torn down with it would move nothing at all.
   */
  it('holds the drag and the view past an unmount, and lets both go on the drop', async () => {
    api.onMoveStart(press());
    mounted!.unmount();
    mounted = null;

    expect(isEntityDragActive(app.store.state)).toBe(true);
    expect(isViewFrozen(app.store.state)).toBe(true);

    releasePointer();
    await flush();

    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
  });

  it('collapses a selection the pressed entity is no part of', async () => {
    app.store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 900, y: 200, zIndex: 3 } })
    );
    app.store.dispatchSync(selectAction({ t2: SelectType.table }));

    api.onMoveStart(press());
    await flush();

    expect(selectedIds()).toEqual(['t1']);
  });

  it('keeps a selection the pressed entity is part of, with no modifier held', async () => {
    selectBoth();

    api.onMoveStart(press());
    await flush();

    expect(selectedIds()).toEqual(['t1', 't2']);
  });

  /**
   * The point of keeping it: moveAll moves what is selected, so a group that
   * survives the press is a group the pointer carries as one.
   */
  it('carries every selected entity under a plain drag', async () => {
    selectBoth();
    const before = { t1: pointOf('t1'), t2: pointOf('t2') };

    api.onMoveStart(press());
    movePointer(120, 60);
    await flush();

    expect(pointOf('t1')).toEqual({
      x: before.t1.x + 120,
      y: before.t1.y + 60,
    });
    expect(pointOf('t2')).toEqual({
      x: before.t2.x + 120,
      y: before.t2.y + 60,
    });
  });

  /** The move lands where the press read: the view's own placement, by the view's zoom. */
  it('moves the view placement from a view scene, and leaves the document points where they were', async () => {
    mounted?.unmount();
    app.store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 10, y: 20 } },
      }),
      viewChangeZoomLevelAction({ value: 0.5, kind: ViewKind.flow })
    );
    mounted = await mountAndFlush(
      html`<div><${ViewScope} .children=${html`<${Probe} />`} /></div>`,
      app
    );
    const before = pointOf('t1');

    api.onMoveStart(press());
    movePointer(120, 60);
    await flush();

    expect(app.store.state.editor.views.flow!.positions.t1).toEqual({
      x: 10 + 240,
      y: 20 + 120,
    });
    expect(pointOf('t1')).toEqual(before);
  });

  /**
   * A peer can put a table in a selected group, or take one out, while the
   * drag runs: the drag carries the tables its first step did, so its buffered
   * steps sum under one table list, here, on every peer and in the undo.
   */
  it('carries the tables its first step carried to the drop, a table joining a selected group midway left standing', async () => {
    app.store.dispatchSync(
      addTableGroupAction({
        id: 'g1',
        ui: { x: 800, y: 100, width: 600, height: 400, zIndex: 1 },
      }),
      addTableAction({ id: 't2', ui: { x: 900, y: 200, zIndex: 3 } }),
      addTableAction({ id: 't3', ui: { x: 300, y: 700, zIndex: 4 } }),
      changeTableGroupAction({ id: 't2', value: 'g1' }),
      selectAction({ t1: SelectType.table, g1: SelectType.tableGroup })
    );
    const before = { t1: pointOf('t1'), t2: pointOf('t2'), t3: pointOf('t3') };

    api.onMoveStart(press());
    movePointer(100, 0);
    await flush();
    app.store.dispatchSync(changeTableGroupAction({ id: 't3', value: 'g1' }));
    movePointer(160, 0);
    await flush();

    expect(pointOf('t1').x).toBe(before.t1.x + 160);
    expect(pointOf('t2').x).toBe(before.t2.x + 160);
    expect(pointOf('t3')).toEqual(before.t3);
  });

  it('judges the drop of a drag past the click distance alone, a tremor of the hand putting no table in a group', async () => {
    app.store.dispatchSync(
      addTableGroupAction({
        id: 'g1',
        ui: { x: 0, y: 0, width: 1200, height: 900, zIndex: 1 },
      })
    );

    api.onMoveStart(press());
    movePointer(CLICK_DRAG_MIN_MOVE - 2, 1);
    await flush();
    expect(isEntityDragActive(app.store.state)).toBe(true);
    expect(hasEntityDragTravelled(app.store.state)).toBe(false);
    releasePointer();
    await flush();

    expect(app.store.state.collections.tableEntities.t1.groupId).toBe('');

    api.onMoveStart(press());
    movePointer(CLICK_DRAG_MIN_MOVE, 0);
    await flush();
    expect(hasEntityDragTravelled(app.store.state)).toBe(true);
    releasePointer();
    await flush();

    expect(app.store.state.collections.tableEntities.t1.groupId).toBe('g1');
    expect(hasEntityDragTravelled(app.store.state)).toBe(false);
  });

  it('leaves an entity the selection never held where it stands', async () => {
    app.store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 900, y: 200, zIndex: 3 } })
    );
    const before = pointOf('t2');

    api.onMoveStart(press());
    movePointer(120, 60);
    await flush();

    expect(pointOf('t2')).toEqual(before);
    expect(selectedIds()).toEqual(['t1']);
  });

  it('neither drags nor holds the view from a blocked kind', () => {
    api.onMoveStart(press('column'));

    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
  });

  it('neither selects nor lifts for the second finger of a pinch', async () => {
    app.store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 900, y: 200, zIndex: 3 } })
    );
    app.store.dispatchSync(selectAction({ t2: SelectType.table }));
    const evt = new TouchEvent('touchstart', {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 80, clientY: 0 },
      ] as any,
    });

    api.onMoveStart({ target: sceneNode(), evt } as ScenePointerEvent);
    await flush();

    expect(selectedIds()).toEqual(['t2']);
    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
  });
});

describe('useMoveEntity - a tap while a relationship is drawn', () => {
  afterEach(() => {
    window.dispatchEvent(createTouch('touchend'));
  });

  it('ends the draw on the tapped table at once with new key columns, as a press does', async () => {
    seedMapTable(app.store, 'users', 'users', [
      { id: 'users.id', name: 'id', primaryKey: true },
    ]);
    app.store.dispatchSync(
      moveToTableAction({ id: 'users', x: 0, y: 600 }),
      drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN }),
      drawStartAddRelationshipAction({ tableId: 'users' })
    );

    const evt = createTouch('touchstart');
    window.dispatchEvent(evt);
    api.onMoveStart({
      target: sceneNode(),
      evt,
    } as unknown as ScenePointerEvent);
    await flush();

    const { doc, collections, editor } = app.store.state;
    expect(doc.relationshipIds).toHaveLength(1);
    const [relationshipId] = doc.relationshipIds;
    const { end } = collections.relationshipEntities[relationshipId];
    expect(end.tableId).toBe('t1');
    expect(end.columnIds).toEqual(collections.tableEntities.t1.columnIds);
    expect(end.columnIds).toHaveLength(1);
    expect(editor.drawRelationship).toBeNull();
  });
});
