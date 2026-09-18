/** @jsxHost konva */

// P3-27 and P3-34: the scene's four layers, the transform that replaced the
// css one and the culling that keeps a table never seen out of the tree, and
// hides one that scrolled off rather than building it again on the way back.

import { createRef, useProvider } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import type { Layer } from 'konva/lib/Layer';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  moveScenePointer,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { RelationshipType, Show } from '@/constants/schema';
import {
  changeViewportAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeZoomLevelAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { Tag } from '@/engine/tag';
import type { Point } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { getViewHoverTable } from '@/konva/scene/viewLayout';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/** A square viewport, so the culling arithmetic below reads the same per axis. */
const VIEWPORT = 1000;

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

type Mounted = {
  app: AppContext;
  stage: Stage;
  /** Takes this scene down on its own, leaving a sibling mounted on one store. */
  destroy: () => void;
};

type MountOptions = {
  /** The store to draw, so two scenes can be mounted on one document. */
  app?: AppContext;
  /** Hung on the shell around the Stage, the way the editor mounts a scene. */
  source?: GeometrySource;
};

async function mountScene({
  app = createTestAppContext(),
  source,
}: MountOptions = {}): Promise<Mounted> {
  const $root = document.createElement('div');
  const shell = document.createElement('div');
  const container = document.createElement('div');
  shell.append(container);
  document.body.append($root, shell);

  app.store.dispatchSync(
    changeViewportAction({ width: VIEWPORT, height: VIEWPORT })
  );

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  const provider = source
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(shell as any, sceneSourceContext, source)
    : null;

  const scene = renderScene({
    app,
    container,
    scene: <CanvasScene root={createRef<HTMLDivElement>($root)} />,
    width: VIEWPORT,
    height: VIEWPORT,
    theme: createTestTheme(),
  });

  await flush();
  await whenDrawn();

  const teardown = () => {
    scene.destroy();
    provider?.destroy();
    shell.remove();
    $root.remove();
  };
  teardowns.push(teardown);

  const destroy = () => {
    const at = teardowns.indexOf(teardown);
    if (at !== -1) teardowns.splice(at, 1);

    teardown();
  };

  return { app, stage: scene.stage, destroy };
}

const seedTable = (app: AppContext, id: string, x: number, zIndex = 2) => {
  app.store.dispatchSync(addTableAction({ id, ui: { x, y: 0, zIndex } }));
};

const tableIdsOf = (stage: Stage) =>
  stage.find('.table').map(node => node.getAttr('id'));

/** The tables the scene is drawing, as opposed to keeping built and hidden. */
const drawnTableIdsOf = (stage: Stage) =>
  stage
    .find('.table')
    .filter(node => node.visible())
    .map(node => node.getAttr('id'));

const backgroundLayerOf = (stage: Stage) =>
  stage.findOne<Layer>('.canvas-background')!;

describe('the canvas scene', () => {
  it('roots four layers in the Stage, background first and presence last', async () => {
    const { stage } = await mountScene();

    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'canvas-background',
      'scene',
      'overlay-marquee',
      'presence',
    ]);
  });

  it('moves the origin and the zoom onto the layers that hold the document', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(scrollToAction({ originX: -100, originY: -50 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    // The layer sits at the origin the document stores, and a zoom on its own
    // leaves that origin where it is.
    const { originX, originY } = app.store.state.settings;
    expect([originX, originY]).toEqual([-100, -50]);
    for (const name of ['scene', 'presence']) {
      const layer = stage.findOne(`.${name}`)!;
      expect(layer.x()).toBe(originX);
      expect(layer.y()).toBe(originY);
      expect(layer.scaleX()).toBe(0.5);
      expect(layer.scaleY()).toBe(0.5);
    }
  });

  it('leaves the marquee layer in screen space', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(scrollToAction({ originX: -100, originY: -50 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    const layer = stage.findOne('.overlay-marquee')!;
    expect(layer.x()).toBe(0);
    expect(layer.y()).toBe(0);
    expect(layer.scaleX()).toBe(1);
  });

  it('gives a table off screen no node at all', async () => {
    const { app, stage } = await mountScene();

    seedTable(app, 'near', 100);
    seedTable(app, 'far', 5000);
    await flush();

    // A screen of margin on every side: the culling rect spans -1000 to 2000.
    expect(tableIdsOf(stage)).toEqual(['table-near']);
  });

  /**
   * Content spread far wider than the screen at a low zoom, the pair the
   * culling rect used to fall apart on when the scene layer slid by half the
   * shrink of the canvas box. The rect reads the document's own origin now.
   */
  describe('with the content far larger than the screen', () => {
    const ZOOM = 0.5;

    async function mountShrunkCanvas() {
      const mounted = await mountScene();

      mounted.app.store.dispatchSync(changeZoomLevelAction({ value: ZOOM }));
      // Puts the scene origin on the stage origin, so screen equals scene
      // times the zoom and a table's screen box is its position halved.
      mounted.app.store.dispatchSync(
        scrollToAction({ originX: 0, originY: 0 })
      );
      await flush();

      return mounted;
    }

    const seedAt = (app: AppContext, id: string, x: number, y: number) => {
      app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
    };

    it('places the layer on the stage origin for an origin of zero', async () => {
      const { stage } = await mountShrunkCanvas();
      const layer = stage.findOne('.scene')!;

      expect(layer.x()).toBe(0);
      expect(layer.y()).toBe(0);
      expect(layer.scaleX()).toBe(ZOOM);
    });

    it('draws every one of the tables the store holds on screen', async () => {
      const { app, stage } = await mountShrunkCanvas();
      const spread = [0, 700, 1400];
      const ids: string[] = [];

      for (const x of spread) {
        for (const y of spread) {
          const id = `t${x}-${y}`;
          ids.push(id);
          seedAt(app, id, x, y);
        }
      }
      await flush();

      const transform = stage.findOne('.scene')!.getAbsoluteTransform();
      const inside = ids.filter(id => {
        const { ui } = app.store.state.collections.tableEntities[id];
        const { x, y } = transform.point({ x: ui.x, y: ui.y });

        return x >= 0 && y >= 0 && x < stage.width() && y < stage.height();
      });

      expect(app.store.state.doc.tableIds).toHaveLength(ids.length);
      expect(inside).toEqual(ids);
      expect(stage.find('.high-level-table')).toHaveLength(ids.length);
    });

    it('brings the memos and the connectors back with the tables', async () => {
      const { app, stage } = await mountShrunkCanvas();

      seedAt(app, 'start', 200, 200);
      seedAt(app, 'end', 900, 900);
      app.store.dispatchSync(
        addMemoAction({ id: 'm1', ui: { x: 200, y: 900, zIndex: 1 } })
      );
      app.store.dispatchSync(
        addRelationshipAction({
          id: 'r1',
          relationshipType: RelationshipType.ZeroN,
          start: { tableId: 'start', columnIds: [] },
          end: { tableId: 'end', columnIds: [] },
        })
      );
      await flush();

      expect(stage.find('.high-level-table')).toHaveLength(2);
      expect(stage.find('.memo')).toHaveLength(1);
      expect(stage.find('.relationship')).toHaveLength(1);
    });

    it('agrees with the transform the layer is drawn with, table by table', async () => {
      const { app, stage } = await mountShrunkCanvas();

      seedAt(app, 'onscreen', 400, 400);
      seedAt(app, 'offscreen', 7000, 7000);
      await flush();

      const layer = stage.findOne('.scene')!;
      const transform = layer.getAbsoluteTransform();
      const onScreen = (id: string) => {
        const node = stage.findOne(`#table-${id}`);
        const table = app.store.state.collections.tableEntities[id];
        const start = transform.point({ x: table.ui.x, y: table.ui.y });

        return {
          drawn: Boolean(node),
          visible:
            start.x < stage.width() &&
            start.y < stage.height() &&
            start.x > -stage.width() &&
            start.y > -stage.height(),
        };
      };

      expect(onScreen('onscreen')).toEqual({ drawn: true, visible: true });
      expect(onScreen('offscreen')).toEqual({ drawn: false, visible: false });
    });
  });

  it('builds the node once a pan brings the table on screen', async () => {
    const { app, stage } = await mountScene();

    seedTable(app, 'near', 100);
    seedTable(app, 'far', 5000);
    await flush();

    app.store.dispatchSync(scrollToAction({ originX: -4500, originY: 0 }));
    await flush();

    expect(drawnTableIdsOf(stage)).toEqual(['table-far']);
    expect(tableIdsOf(stage)).toEqual(['table-near', 'table-far']);
  });

  describe('a table that scrolls off', () => {
    const scrollTo = async (app: AppContext, originX: number, originY = 0) => {
      app.store.dispatchSync(scrollToAction({ originX, originY }));
      await flush();
    };

    it('is hidden rather than destroyed, and shown again by the same node', async () => {
      const { app, stage } = await mountScene();
      seedTable(app, 'near', 100);
      await flush();
      const node = stage.findOne('#table-near')!;
      expect(node.visible()).toBe(true);

      await scrollTo(app, -8000);

      expect(stage.findOne('#table-near')).toBe(node);
      expect(node.visible()).toBe(false);
      expect(drawnTableIdsOf(stage)).toEqual([]);

      await scrollTo(app, 0);

      expect(stage.findOne('#table-near')).toBe(node);
      expect(node.visible()).toBe(true);
    });

    it('answers no hit while hidden', async () => {
      const { app, stage } = await mountScene();
      seedTable(app, 'near', 100);
      await flush();
      await whenPainted();
      const box = stage
        .findOne('#table-near')!
        .getClientRect({ skipShadow: true });
      const inside = { x: box.x + 10, y: box.y + 10 };

      expect(stage.getIntersection(inside)).toBeTruthy();

      await scrollTo(app, -8000);
      await whenPainted();

      // The scroll moved the layer, so the same stage point is bare canvas; the
      // hidden node must not be what answers there.
      const hit = stage.getIntersection(inside);
      expect(hit?.findAncestor('#table-near', true)).toBeFalsy();
    });

    it('is dropped once more have left than the bound keeps', async () => {
      const { app, stage } = await mountScene();
      // A grid three screens apart, one table per culling rect: each scroll
      // draws one and retires the one before, oldest first past the floor.
      const count = 20;
      const at = (i: number) => ({
        x: 100 + (i % 5) * 3000,
        y: 100 + Math.floor(i / 5) * 3000,
      });
      for (let i = 0; i < count; i++) {
        app.store.dispatchSync(
          addTableAction({ id: `t${i}`, ui: { ...at(i), zIndex: 2 } })
        );
      }
      await flush();

      for (let i = 0; i < count; i++) {
        await scrollTo(app, 100 - at(i).x, 100 - at(i).y);
      }

      expect(drawnTableIdsOf(stage)).toEqual(['table-t19']);
      const kept = tableIdsOf(stage);
      expect(kept).toHaveLength(17);
      expect(kept).not.toContain('table-t0');
      expect(kept).not.toContain('table-t2');
      expect(kept).toContain('table-t3');
    });
  });

  it('orders the tables by the z-index the dom scene wrote', async () => {
    const { app, stage } = await mountScene();

    seedTable(app, 'above', 100, 9);
    seedTable(app, 'below', 200, 3);
    await flush();

    expect(tableIdsOf(stage)).toEqual(['table-below', 'table-above']);
  });

  it('swaps to high level tables at or below a zoom level of 0.7', async () => {
    const { app, stage } = await mountScene();

    seedTable(app, 't1', 100);
    await flush();
    expect(stage.find('.high-level-table')).toHaveLength(0);
    expect(stage.find('.table-header')).toHaveLength(1);

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.7 }));
    await flush();

    expect(stage.find('.high-level-table')).toHaveLength(1);
    expect(stage.find('.table-header')).toHaveLength(0);
  });

  it('renders a memo per document memo id', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 5, y: 6, zIndex: 1 } })
    );
    await flush();

    const memos = stage.find('.memo');
    expect(memos).toHaveLength(1);
    expect(memos[0].x()).toBe(5);
    expect(memos[0].y()).toBe(6);
  });

  it('draws the connectors under the tables while the show bit is set', async () => {
    const { app, stage } = await mountScene();
    const scene = stage.findOne<Layer>('.scene')!;

    seedTable(app, 't1', 100);
    await flush();
    expect(scene.getChildren()[0].name()).toBe('relationship-group');

    app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: false })
    );
    await flush();
    expect(stage.find('.relationship-group')).toHaveLength(0);

    app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: true })
    );
    await flush();
    expect(stage.find('.relationship-group')).toHaveLength(1);
  });

  it('renders the draw relationship preview only once a start point exists', async () => {
    const { app, stage } = await mountScene();

    expect(stage.find('.draw-relationship')).toHaveLength(0);

    seedTable(app, 't1', 100);
    app.store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroOne,
      })
    );
    await flush();
    expect(stage.find('.draw-relationship')).toHaveLength(0);

    app.store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));
    await flush();
    expect(stage.find('.draw-relationship')).toHaveLength(1);
  });
});

/**
 * The bottom layer used to carry a document sized rect painted in the canvas
 * colour. The document has no edge any more, so the colour is on the stage
 * container and the layer is there for a drag's connectors alone.
 */
describe('the bottom layer', () => {
  it('draws no document box, leaving the container to paint the canvas', async () => {
    const { stage } = await mountScene();

    expect(backgroundLayerOf(stage).getChildren()).toHaveLength(0);
    expect(stage.find('Rect').map(node => node.getAttr('fill'))).not.toContain(
      createTestTheme().canvasBackground
    );
  });

  it('is placed at the very origin the scene layer is placed at', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(scrollToAction({ originX: -100, originY: -50 }));
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    const scene = stage.findOne<Layer>('.scene')!;
    const background = backgroundLayerOf(stage);

    expect([background.x(), background.y()]).toEqual([scene.x(), scene.y()]);
    expect([background.scaleX(), background.scaleY()]).toEqual([
      scene.scaleX(),
      scene.scaleY(),
    ]);
  });
});

/**
 * AC-11, AC-12 and the scene halves of AC-61 and AC-64, the minimap, bars and
 * compass of AC-61 being each in its own spec. The source the context names
 * picks what a scene shows and which points it stands them at.
 */
describe('a scene the context points at a view', () => {
  const DOC_POINTS: Record<string, Point> = {
    t1: { x: 100, y: 100 },
    t2: { x: 600, y: 100 },
    t3: { x: 1100, y: 100 },
  };

  /** Nowhere near the document's own points, so a mixed up scene is obvious. */
  const VIEW_POINTS: Record<string, Point> = {
    t1: { x: 200, y: 500 },
    t2: { x: 700, y: 500 },
    t3: { x: 1200, y: 500 },
  };

  const ROWS = ['c1', 'c2', 'c3'];

  /** A chain t1 - t2 - t3, one memo, and a primary key on the first row of t1. */
  function seedDocument(app: AppContext) {
    const link = (id: string, start: string, end: string) =>
      addRelationshipAction({
        id,
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: start, columnIds: [] },
        end: { tableId: end, columnIds: [] },
      });

    app.store.dispatchSync(
      ...Object.entries(DOC_POINTS).map(([id, point], index) =>
        addTableAction({ id, ui: { ...point, zIndex: index + 1 } })
      ),
      ...ROWS.map(id => addColumnAction({ id, tableId: 't1' })),
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true }),
      addMemoAction({ id: 'm1', ui: { x: 100, y: 700, zIndex: 1 } }),
      link('r1', 't1', 't2'),
      link('r2', 't2', 't3')
    );
  }

  /**
   * The display set a narrowing opens: t1 at the centre, its hop, key rows, and
   * the layout that set asks for landed, since a view draws what landed alone.
   */
  function narrowView(app: AppContext) {
    const { t1, t2 } = VIEW_POINTS;

    app.store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] }),
      viewSetLayoutAction({ kind: ViewKind.flow, positions: { t1, t2 } })
    );
  }

  async function mountNarrowedScene(): Promise<Mounted> {
    const app = createTestAppContext();
    seedDocument(app);
    narrowView(app);

    return mountScene({ app, source: 'flow' });
  }

  const tableOf = (stage: Stage, tableId: string) =>
    stage.findOne<Container>(`#table-${tableId}`) as Container;

  const rowIdsOf = (stage: Stage, tableId: string) =>
    tableOf(stage, tableId)
      .find('.column-row')
      .map(node => node.getAttr('id'));

  const nameTextsOf = (stage: Stage, tableId: string) =>
    tableOf(stage, tableId)
      .find<Container>('.columnName')
      .map(node => (node.findOne('.cell-text') as Text).text());

  it('shows what the view reaches, where the view stands it, and no memo', async () => {
    const { stage } = await mountNarrowedScene();

    expect(tableIdsOf(stage)).toEqual(['table-t1', 'table-t2']);
    expect(tableOf(stage, 't1').x()).toBe(VIEW_POINTS.t1.x);
    expect(tableOf(stage, 't1').y()).toBe(VIEW_POINTS.t1.y);
    expect(stage.find('.memo')).toHaveLength(0);
    // The show mode a narrowed view opens on: the key rows alone, which here
    // is the one column carrying the primary key.
    expect(rowIdsOf(stage, 't1')).toEqual(['column-c1']);
  });

  it('keeps its own spelling at a zoom the document would go high level at', async () => {
    const { app, stage } = await mountNarrowedScene();

    app.store.dispatchSync(
      viewChangeZoomLevelAction({ value: 0.3, kind: ViewKind.flow })
    );
    await flush();

    expect(stage.findOne<Layer>('.scene')!.scaleX()).toBe(0.3);
    expect(stage.find('.high-level-table')).toHaveLength(0);
    expect(stage.find('.table-header')).toHaveLength(2);
  });

  it('follows a rename that reaches the document while it is open', async () => {
    const { app, stage } = await mountNarrowedScene();
    expect(nameTextsOf(stage, 't1')).toEqual(['column']);

    // The way an edit reaches a document under an open view: from a peer,
    // which is what the view gate lets through.
    app.store.dispatch({
      ...changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'order_id' }),
      tags: Tag.shared,
    });
    await flush();

    expect(nameTextsOf(stage, 't1')).toEqual(['order_id']);
  });

  it('leaves the scene under it drawing the whole document, document side up', async () => {
    const app = createTestAppContext();
    seedDocument(app);
    const erd = await mountScene({ app });
    narrowView(app);
    const focus = await mountScene({ app, source: 'flow' });
    await flush();

    expect(tableIdsOf(erd.stage)).toEqual(['table-t1', 'table-t2', 'table-t3']);
    expect(tableOf(erd.stage, 't1').x()).toBe(DOC_POINTS.t1.x);
    expect(erd.stage.find('.memo')).toHaveLength(1);
    expect(rowIdsOf(erd.stage, 't1')).toEqual(ROWS.map(id => `column-${id}`));
    expect(rowIdsOf(focus.stage, 't1')).toEqual(['column-c1']);
  });

  it('keeps that scene high level at a document zoom the overlay does not take', async () => {
    const app = createTestAppContext();
    seedDocument(app);
    // Set before the view opens, since a zoom dispatched while one is open is
    // redirected to the view and the document's own is left where it stands.
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.3 }));
    const erd = await mountScene({ app });
    expect(erd.stage.find('.high-level-table')).toHaveLength(3);

    narrowView(app);
    const focus = await mountScene({ app, source: 'flow' });
    await flush();

    expect(erd.stage.find('.high-level-table')).toHaveLength(3);
    expect(focus.stage.findOne<Layer>('.scene')!.scaleX()).toBe(1);
    expect(focus.stage.find('.high-level-table')).toHaveLength(0);
    expect(focus.stage.find('.table-header')).toHaveLength(2);
  });

  it('draws its links whatever the document hid its own connectors with', async () => {
    const app = createTestAppContext();
    seedDocument(app);
    app.store.dispatchSync(
      changeShowAction({ show: Show.relationship, value: false })
    );
    narrowView(app);
    const erd = await mountScene({ app });
    const focus = await mountScene({ app, source: 'flow' });
    await flush();

    // The bit is the document scene's setting, and the links are what the
    // view is read for, so hiding them in the ERD leaves the view alone.
    expect(erd.stage.find('.relationship-group')).toHaveLength(0);
    expect(focus.stage.find('.relationship-group')).toHaveLength(1);
    expect(focus.stage.find('.relationship')).toHaveLength(1);
  });

  /**
   * Under the scene, not over it: a card is opaque and hides the connectors
   * that pass behind it, so a particle riding one goes behind it too. No
   * presence layer, since a peer broadcasts document points.
   */
  it('roots a particle layer under the scene and no presence layer', async () => {
    const { stage } = await mountNarrowedScene();

    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'canvas-background',
      'view-particles',
      'scene',
      'overlay-marquee',
    ]);
  });

  it('draws no relationship preview, which is the document scene alone', async () => {
    const { app, stage } = await mountNarrowedScene();

    app.store.dispatchSync(
      drawStartRelationshipAction({
        relationshipType: RelationshipType.ZeroOne,
      }),
      drawStartAddRelationshipAction({ tableId: 't1' })
    );
    await flush();

    expect(app.store.state.editor.drawRelationship?.start).toBeTruthy();
    expect(stage.find('.draw-relationship')).toHaveLength(0);
  });

  it('keeps the hover a view holds when the scene under it goes away', async () => {
    const app = createTestAppContext();
    seedDocument(app);
    narrowView(app);
    const erd = await mountScene({ app });
    const focus = await mountScene({ app, source: 'flow' });
    await flush();
    await whenPainted();

    // Skipping the shadow: a view card casts one and the rect would otherwise
    // reach past the card, standing the pointer on ground no hit test answers.
    const box = tableOf(focus.stage, 't1').getClientRect({
      relativeTo: focus.stage,
      skipShadow: true,
    });
    moveScenePointer(focus.stage, box.x + box.width / 2, box.y + 4);
    await flush();
    await whenDrawn();
    expect(getViewHoverTable(app.store.state, 'flow')).toBe('t1');

    // Both scenes stand on one editor id, and the ERD going away unmounts a
    // t1 of its own that never held the hover; the pointer is still on the
    // view's, which no mouseleave has reached.
    erd.destroy();
    await flush();

    expect(getViewHoverTable(app.store.state, 'flow')).toBe('t1');
  });
});
