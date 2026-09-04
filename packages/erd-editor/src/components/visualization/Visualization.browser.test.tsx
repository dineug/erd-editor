import { useProvider } from '@dineug/r-html';
import type { Layer } from 'konva/lib/Layer';
import type { Circle } from 'konva/lib/shapes/Circle';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  mount,
  type Mounted,
  releasePointer,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { themeContext } from '@/components/themeContext';
import Visualization from '@/components/visualization/Visualization';
import {
  ZOOM_MAX,
  ZOOM_MIN,
} from '@/components/visualization/visualizationView';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';

/** How far right of the pointer the preview opens. */
const MARGIN = 20;

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

const stageOf = () => stageRegistry().visualization;

function seed(app: AppContext) {
  app.store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id: 't1', value: 'users' }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    changeColumnNameAction({ id: 'c1', tableId: 't1', value: 'id' }),
    addColumnAction({ id: 'c2', tableId: 't1' }),
    changeColumnNameAction({ id: 'c2', tableId: 't1', value: 'name' })
  );
}

async function mountVisualization(
  app = createTestAppContext()
): Promise<Mounted> {
  const mounted = mount(<Visualization />, app);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  await flush();
  await whenDrawn();

  teardowns.push(() => {
    mounted.unmount();
    themeProvider.destroy();
  });

  return mounted;
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const canvasOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(
    '[data-testid="visualization-canvas"]'
  )!;

const previewOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>('.table');

const sceneOf = () => stageOf().findOne<Layer>('.visualization-scene') as Layer;

const dotOf = (id: string) => stageOf().findOne<Circle>(`.${id}`) as Circle;

const hover = (id: string, clientX = 0, clientY = 0) =>
  fireScenePointer(dotOf(id), 'mouseenter', { clientX, clientY });

/** A wheel at a point of the canvas, as the browser delivers one to the shell. */
function wheel(
  mounted: Mounted,
  offsetX: number,
  offsetY: number,
  deltaY: number
) {
  const rect = canvasOf(mounted).getBoundingClientRect();
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + offsetX,
    clientY: rect.top + offsetY,
    deltaY,
  });

  canvasOf(mounted).dispatchEvent(event);
  return event;
}

/** The scene point a stage point stands over, read off the layer transform. */
const toScene = (x: number, y: number) => {
  const layer = sceneOf();
  return {
    x: (x - layer.x()) / layer.scaleX(),
    y: (y - layer.y()) / layer.scaleY(),
  };
};

describe('the visualization shell', () => {
  it('hangs one Stage of two layers in the canvas box, at the viewport size', async () => {
    const app = createTestAppContext();
    seed(app);
    const mounted = await mountVisualization(app);
    const { viewport } = app.store.state.editor;
    const stage = stageOf();

    expect(stage.container()).toBe(canvasOf(mounted));
    expect(stage.width()).toBe(viewport.width);
    expect(stage.height()).toBe(viewport.height);
    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'visualization-background',
      'visualization-scene',
    ]);
    expect(canvasOf(mounted).style.width).toBe(`${viewport.width}px`);
    expect(canvasOf(mounted).style.height).toBe(`${viewport.height}px`);
  });

  it('centres the view on the stage at scale one', async () => {
    const app = createTestAppContext();
    await mountVisualization(app);
    const { viewport } = app.store.state.editor;

    expect(sceneOf().x()).toBe(viewport.width / 2);
    expect(sceneOf().y()).toBe(viewport.height / 2);
    expect(sceneOf().scaleX()).toBe(1);
  });

  it('draws one dot per table and per column of the document', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountVisualization(app);

    expect(stageOf().find('.visualization-node')).toHaveLength(3);
    expect(stageOf().find('.visualization-link')).toHaveLength(2);
    expect(
      stageOf()
        .find('.visualization-label')
        .map(label => label.getAttr('text'))
    ).toEqual(['users']);
  });

  it('follows a viewport change on the box and the Stage', async () => {
    const app = createTestAppContext();
    const mounted = await mountVisualization(app);

    app.store.dispatchSync(changeViewportAction({ width: 800, height: 600 }));
    await settle();

    expect(stageOf().width()).toBe(800);
    expect(stageOf().height()).toBe(600);
    expect(canvasOf(mounted).style.width).toBe('800px');
    expect(canvasOf(mounted).style.height).toBe('600px');
  });

  describe('wheel', () => {
    it('zooms in about the pointer on a wheel rolled away from the user', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);
      const before = toScene(100, 50);

      const event = wheel(mounted, 100, 50, -100);
      await settle();

      expect(event.defaultPrevented).toBe(true);
      expect(sceneOf().scaleX()).toBeCloseTo(Math.exp(0.2), 10);
      expect(sceneOf().scaleY()).toBe(sceneOf().scaleX());
      expect(toScene(100, 50).x).toBeCloseTo(before.x, 8);
      expect(toScene(100, 50).y).toBeCloseTo(before.y, 8);
    });

    it('zooms out on a wheel rolled toward the user, and no further than the floor', async () => {
      const app = createTestAppContext();
      const mounted = await mountVisualization(app);

      wheel(mounted, 0, 0, 100);
      await settle();
      expect(sceneOf().scaleX()).toBeCloseTo(Math.exp(-0.2), 10);

      for (let i = 0; i < 40; i++) wheel(mounted, 0, 0, 100);
      await settle();
      expect(sceneOf().scaleX()).toBe(ZOOM_MIN);

      for (let i = 0; i < 40; i++) wheel(mounted, 0, 0, -100);
      await settle();
      expect(sceneOf().scaleX()).toBe(ZOOM_MAX);
    });

    it('leaves the view where it was when the wheel has no travel', async () => {
      const app = createTestAppContext();
      const mounted = await mountVisualization(app);
      const { x, y } = { x: sceneOf().x(), y: sceneOf().y() };

      wheel(mounted, 30, 40, 0);
      await settle();

      expect(sceneOf().scaleX()).toBe(1);
      expect(sceneOf().x()).toBe(x);
      expect(sceneOf().y()).toBe(y);
    });
  });

  describe('preview', () => {
    it('shows no preview before anything is hovered', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);

      expect(previewOf(mounted)).toBeNull();
    });

    it('opens the table preview at the pointer, offset by the margin', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);

      hover('t1', 300, 150);
      await settle();

      const preview = previewOf(mounted)!;
      expect(preview.getAttribute('data-id')).toBe('t1');
      expect(preview.style.left).toBe(`${300 + MARGIN}px`);
      expect(preview.style.top).toBe('150px');
    });

    it('highlights the hovered column inside the preview', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);

      hover('c2', 10, 10);
      await settle();

      const rows = Array.from(
        previewOf(mounted)!.querySelectorAll('.column-row')
      );
      expect(rows.map(row => row.getAttribute('data-id'))).toEqual([
        'c1',
        'c2',
      ]);
      expect(rows.map(row => row.hasAttribute('data-selected'))).toEqual([
        false,
        true,
      ]);
    });

    it('selects no column when the hovered dot is the table itself', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);

      hover('t1', 10, 10);
      await settle();

      const rows = Array.from(
        previewOf(mounted)!.querySelectorAll('.column-row')
      );
      expect(rows.some(row => row.hasAttribute('data-selected'))).toBe(false);
    });

    it('closes the preview on mouseleave', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);

      hover('t1', 10, 10);
      await settle();
      expect(previewOf(mounted)).toBeTruthy();

      fireScenePointer(dotOf('t1'), 'mouseleave');
      await settle();

      expect(previewOf(mounted)).toBeNull();
    });

    it('moves the preview to the newly hovered dot', async () => {
      const app = createTestAppContext();
      seed(app);
      app.store.dispatchSync(
        addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 3 } })
      );
      const mounted = await mountVisualization(app);

      hover('t1', 10, 10);
      await settle();
      expect(previewOf(mounted)?.getAttribute('data-id')).toBe('t1');

      hover('t2', 50, 60);
      await settle();

      expect(previewOf(mounted)?.getAttribute('data-id')).toBe('t2');
      expect(previewOf(mounted)?.style.left).toBe(`${50 + MARGIN}px`);
    });

    it('opens no preview for a dot whose table has left the document', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);

      app.store.dispatchSync(removeTableAction({ id: 't1' }));
      delete app.store.state.collections.tableEntities['t1'];
      hover('t1', 10, 10);
      await settle();

      expect(previewOf(mounted)).toBeNull();
    });

    it('hides the preview while a dot is being dragged and restores it after', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);

      hover('t1', 10, 10);
      await settle();
      expect(previewOf(mounted)).toBeTruthy();

      fireScenePointer(dotOf('t1'), 'mousedown', { clientX: 10, clientY: 10 });
      await settle();
      expect(previewOf(mounted)).toBeNull();

      releasePointer();
      await settle();
      expect(previewOf(mounted)).toBeTruthy();
    });

    it('keeps the preview closed through a pan that crosses no dot', async () => {
      const app = createTestAppContext();
      seed(app);
      const mounted = await mountVisualization(app);
      const pan = stageOf().findOne('.visualization-pan')!;

      fireScenePointer(pan, 'mousedown', { clientX: 0, clientY: 0 });
      releasePointer();
      await settle();

      expect(previewOf(mounted)).toBeNull();
    });
  });

  it('drops the Stage and its registry entry on unmount', async () => {
    const app = createTestAppContext();
    seed(app);
    await mountVisualization(app);
    const stage = stageOf();

    teardowns.splice(0).forEach(teardown => teardown());
    await whenDrawn();

    expect(stageOf()).toBeUndefined();
    expect(stage.getLayers()).toHaveLength(0);
  });
});
