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
import { isEntityDragActive } from '@/components/erd/canvas/entityDrag';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import {
  clearDrawTarget,
  getTouchDrawTargetId,
  setTouchDrawTarget,
} from '@/components/erd/draw-target/drawTargetState';
import {
  sceneSourceContext,
  useSceneSource,
} from '@/components/sceneSourceContext';
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
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  addTableAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
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
  type TapProbeOptions = { entityId: string; selectType: SelectType };

  let tapApi: Api;
  let tapMounted: Mounted | null = null;

  const TapProbe: FC<TapProbeOptions> = (props, ctx) => {
    tapApi = useMoveEntity(ctx, {
      entityId: () => props.entityId,
      selectType: props.selectType,
      blockedKinds: () => ['column'],
      source: useSceneSource(ctx),
    });

    return () => html`<div class="tap-probe"></div>`;
  };

  const mountTap = async (
    entityId = 't1',
    selectType: SelectType = SelectType.table,
    flow = false
  ) => {
    tapMounted?.unmount();
    const probe = html`<${TapProbe}
      .entityId=${entityId}
      .selectType=${selectType}
    />`;
    tapMounted = await mountAndFlush(
      flow
        ? html`<div><${ViewScope} .children=${probe} /></div>`
        : html`<div>${probe}</div>`,
      app
    );
  };

  /** A one finger tap the way the stage hands it on, reaching the window too. */
  const tap = (): ScenePointerEvent => {
    const evt = new TouchEvent('touchstart', {
      touches: [{ clientX: 0, clientY: 0 }] as any,
    });
    window.dispatchEvent(evt);
    return { target: sceneNode(), evt } as unknown as ScenePointerEvent;
  };

  /** A parent with a key the draw starts from, and the draw armed from it. */
  const armDraw = () => {
    seedMapTable(app.store, 'users', 'users', [
      { id: 'users.id', name: 'id', primaryKey: true },
    ]);
    app.store.dispatchSync(
      moveToTableAction({ id: 'users', x: 0, y: 600 }),
      drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN }),
      drawStartAddRelationshipAction({ tableId: 'users' })
    );
  };

  afterEach(() => {
    window.dispatchEvent(createTouch('touchend'));
    tapMounted?.unmount();
    tapMounted = null;
    clearDrawTarget(app.store.state);
  });

  it('names the table on the first tap and neither selects nor lifts it', async () => {
    armDraw();
    await mountTap();

    tapApi.onMoveStart(tap());
    await flush();

    expect(getTouchDrawTargetId(app.store.state)).toBe('t1');
    expect(selectedIds()).toEqual([]);
    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(app.store.state.doc.relationshipIds).toEqual([]);
  });

  it('draws as a press does on a second tap on the same table', async () => {
    armDraw();
    await mountTap();

    tapApi.onMoveStart(tap());
    tapApi.onMoveStart(tap());
    await flush();

    expect(app.store.state.doc.relationshipIds).toHaveLength(1);
    expect(app.store.state.editor.drawRelationship).toBeNull();
  });

  it('names another table instead on a tap on it', async () => {
    armDraw();
    await mountTap();
    setTouchDrawTarget(app.store.state, 'users');

    tapApi.onMoveStart(tap());
    await flush();

    expect(getTouchDrawTargetId(app.store.state)).toBe('t1');
    expect(app.store.state.doc.relationshipIds).toEqual([]);
  });

  it('selects as always while no draw has a table to start from', async () => {
    app.store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN })
    );
    await mountTap();

    tapApi.onMoveStart(tap());
    await flush();

    expect(getTouchDrawTargetId(app.store.state)).toBeNull();
    expect(selectedIds()).toEqual(['t1']);
  });

  it('draws at once for a mouse press, which has a hover to show the buttons', async () => {
    armDraw();
    await mountTap();

    tapApi.onMoveStart(press());
    await flush();

    expect(getTouchDrawTargetId(app.store.state)).toBeNull();
    expect(app.store.state.doc.relationshipIds).toHaveLength(1);
  });

  it('lets a memo take its tap as always, letting go of a named table', async () => {
    app.store.dispatchSync(
      addMemoAction({
        id: 'm1',
        ui: { x: 0, y: 0, width: 100, height: 100, zIndex: 2 },
      })
    );
    armDraw();
    await mountTap('m1', SelectType.memo);
    setTouchDrawTarget(app.store.state, 't1');

    tapApi.onMoveStart(tap());
    await flush();

    expect(getTouchDrawTargetId(app.store.state)).toBeNull();
    expect(selectedIds()).toEqual(['m1']);
  });

  it('takes the tap as always in a read-only editor, which shows no buttons', async () => {
    let readonly = false;
    app = createTestAppContext({ getReadonly: () => readonly });
    app.store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 300, y: 200, zIndex: 2 } })
    );
    armDraw();
    await mountTap();
    readonly = true;

    tapApi.onMoveStart(tap());
    await flush();

    expect(getTouchDrawTargetId(app.store.state)).toBeNull();
    expect(selectedIds()).toEqual(['t1']);
  });

  it("leaves a Flow view's tables to their own taps while a draw is armed", async () => {
    armDraw();
    app.store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { t1: { x: 10, y: 20 } },
      })
    );
    await mountTap('t1', SelectType.table, true);

    tapApi.onMoveStart(tap());
    await flush();

    expect(getTouchDrawTargetId(app.store.state)).toBeNull();
    expect(app.store.state.doc.relationshipIds).toHaveLength(1);
  });
});
