/** @jsxHost konva */

// P3-27 and P3-34: the scene's four layers, the transform that replaced the
// css one and the culling that keeps a table off screen out of the tree.

import { createRef } from '@dineug/r-html';
import type { Layer } from 'konva/lib/Layer';
import type { Node as KonvaNode } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import { RelationshipType, Show } from '@/constants/schema';
import {
  changeViewportAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeShowAction,
  changeZoomLevelAction,
  resizeAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';

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
};

async function mountScene(): Promise<Mounted> {
  const $root = document.createElement('div');
  const container = document.createElement('div');
  document.body.append($root, container);

  const app = createTestAppContext();
  app.store.dispatchSync(
    changeViewportAction({ width: VIEWPORT, height: VIEWPORT })
  );

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

  teardowns.push(() => {
    scene.destroy();
    container.remove();
    $root.remove();
  });

  return { app, stage: scene.stage };
}

const seedTable = (app: AppContext, id: string, x: number, zIndex = 2) => {
  app.store.dispatchSync(addTableAction({ id, ui: { x, y: 0, zIndex } }));
};

const tableIdsOf = (stage: Stage) =>
  stage.find('.table').map(node => node.getAttr('id'));

const backgroundLayerOf = (stage: Stage) =>
  stage.findOne<Layer>('.canvas-background')!;

/** The one child of the background layer, which carries no name of its own. */
const backgroundRectOf = (stage: Stage): KonvaNode =>
  backgroundLayerOf(stage).getChildren()[0];

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

  it('moves the scroll and the zoom onto the layers that hold the document', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -100, scrollTop: -50 })
    );
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    // The css transform scaled about the middle of the 2000px canvas box, so
    // half the shrink joins the scroll: -100 + 2000 * (1 - 0.5) / 2.
    for (const name of ['scene', 'presence']) {
      const layer = stage.findOne(`.${name}`)!;
      expect(layer.x()).toBe(400);
      expect(layer.y()).toBe(450);
      expect(layer.scaleX()).toBe(0.5);
      expect(layer.scaleY()).toBe(0.5);
    }
  });

  it('leaves the marquee layer in screen space', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -100, scrollTop: -50 })
    );
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    const layer = stage.findOne('.overlay-marquee')!;
    expect(layer.x()).toBe(0);
    expect(layer.y()).toBe(0);
    expect(layer.scaleX()).toBe(1);
  });

  it('gives a table off screen no node at all', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(resizeAction({ width: 20000, height: 20000 }));
    seedTable(app, 'near', 100);
    seedTable(app, 'far', 5000);
    await flush();

    // A screen of margin on every side: the culling rect spans -1000 to 2000.
    expect(tableIdsOf(stage)).toEqual(['table-near']);
  });

  /**
   * A big canvas at a low zoom, the pair the culling rect used to fall apart on.
   * The scene layer slides by half the shrink of the canvas box, so a rect that
   * reads only the scroll walks off the screen it is meant to describe.
   */
  describe('with the canvas box far larger than the screen', () => {
    const CANVAS = 8000;
    const ZOOM = 0.5;

    async function mountShrunkCanvas() {
      const mounted = await mountScene();

      mounted.app.store.dispatchSync(
        resizeAction({ width: CANVAS, height: CANVAS })
      );
      mounted.app.store.dispatchSync(changeZoomLevelAction({ value: ZOOM }));
      // Puts the scene origin on the stage origin, so screen equals scene
      // times the zoom and a table's screen box is its position halved.
      mounted.app.store.dispatchSync(
        scrollToAction({
          scrollLeft: -(CANVAS * (1 - ZOOM)) / 2,
          scrollTop: -(CANVAS * (1 - ZOOM)) / 2,
        })
      );
      await flush();

      return mounted;
    }

    const seedAt = (app: AppContext, id: string, x: number, y: number) => {
      app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
    };

    it('places the layer where half the canvas shrink cancels the scroll', async () => {
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

    app.store.dispatchSync(resizeAction({ width: 20000, height: 20000 }));
    seedTable(app, 'near', 100);
    seedTable(app, 'far', 5000);
    await flush();

    app.store.dispatchSync(scrollToAction({ scrollLeft: -4500, scrollTop: 0 }));
    await flush();

    expect(tableIdsOf(stage)).toEqual(['table-far']);
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
 * The dom scene painted the canvas colour on a document sized box and let the
 * boundary colour of the editor show around it. The stage container is the
 * screen now, so the document box is a rect the scene draws at its own origin.
 */
describe('the canvas background', () => {
  const CANVAS = 2000;

  it('covers the canvas box in the canvas colour of the live theme', async () => {
    const { stage } = await mountScene();
    const rect = backgroundRectOf(stage);

    expect(rect.className).toBe('Rect');
    expect(rect.getAttr('fill')).toBe(createTestTheme().canvasBackground);
    expect(rect.x()).toBe(0);
    expect(rect.y()).toBe(0);
    expect(rect.getAttr('width')).toBe(CANVAS);
    expect(rect.getAttr('height')).toBe(CANVAS);
  });

  it('is placed at the very origin the scene layer is placed at', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(
      scrollToAction({ scrollLeft: -100, scrollTop: -50 })
    );
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

  it('follows the canvas box when the document is resized', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(resizeAction({ width: 4000, height: 3000 }));
    await flush();

    const rect = backgroundRectOf(stage);
    expect(rect.getAttr('width')).toBe(4000);
    expect(rect.getAttr('height')).toBe(3000);
  });

  it('leaves the canvas box on the stage origin at a zoom of one', async () => {
    const { stage } = await mountScene();

    expect(backgroundRectOf(stage).getClientRect()).toEqual({
      x: 0,
      y: 0,
      width: CANVAS,
      height: CANVAS,
    });
  });

  /**
   * The whole point of the rect: zoomed out, the canvas box stops filling the
   * stage, and what the scene leaves unpainted there is where the boundary
   * colour of the element holding the editor shows through.
   */
  it('stops short of the stage once the zoom shrinks the canvas box', async () => {
    const { app, stage } = await mountScene();

    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await flush();

    // Half the shrink of the 2000px box travels with the scroll, so the box
    // lands at 500 and spans 1000 of the 1000px stage from there.
    const box = backgroundRectOf(stage).getClientRect();
    expect(box).toEqual({ x: 500, y: 500, width: 1000, height: 1000 });
    expect(box.x).toBeGreaterThan(0);
    expect(stage.width()).toBe(VIEWPORT);
  });
});
