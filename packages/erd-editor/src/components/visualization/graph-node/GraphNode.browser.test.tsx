/** @jsxHost konva */

import { observable, repeat } from '@dineug/r-html';
import type { Circle } from 'konva/lib/shapes/Circle';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  movePointer,
  releasePointer,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  createVisualization,
  type Visualization,
} from '@/components/visualization/createVisualization';
import GraphNode from '@/components/visualization/graph-node/GraphNode';
import {
  COLUMN_RADIUS,
  createVisualizationState,
  DIM_OPACITY,
  TABLE_RADIUS,
  type VisualizationState,
} from '@/components/visualization/visualizationView';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderKonva } from '@/konva/host';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';

type Fixture = {
  app: AppContext;
  graph: Visualization;
  state: VisualizationState;
  theme: Theme;
  stage: Stage;
  settle: () => Promise<void>;
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/** Every node of a graph as a dot on one layer, the named ones dimmed. */
function dots(
  graph: Visualization,
  state: VisualizationState,
  dimmedIds: string[] = []
) {
  return (
    <k-layer name="scene">
      {repeat(
        graph.nodes,
        node => node.id,
        node => (
          <GraphNode
            node={node}
            x={node.x}
            y={node.y}
            dimmed={dimmedIds.includes(node.id)}
            graph={graph}
            state={state}
          />
        )
      )}
    </k-layer>
  );
}

/**
 * A table with one column, laid out by d3 and then held still: the layout is
 * stopped as soon as it is built, so a position read here is the one drawn.
 */
async function setup(): Promise<Fixture> {
  const app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
    addColumnAction({ id: 'c1', tableId: 't1' })
  );

  const graph = createVisualization(app.store.state);
  graph.simulation.stop();
  const state = observable(createVisualizationState(900, 700), {
    shallow: true,
  });
  const theme = createTestTheme();
  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    scene: dots(graph, state),
    width: 900,
    height: 700,
    theme,
  });

  teardowns.push(() => {
    graph.simulation.stop();
    rendered.destroy();
    container.remove();
  });

  const settle = async () => {
    await flush();
    await whenDrawn();
  };

  await settle();

  return { app, graph, state, theme, stage: rendered.stage, settle };
}

const dotsOf = (stage: Stage) => stage.find<Circle>('.visualization-node');

const dotOf = (stage: Stage, id: string) =>
  stage.findOne<Circle>(`.${id}`) as Circle;

const mouse = (clientX: number, clientY: number): MouseEventInit => ({
  clientX,
  clientY,
});

describe('a graph node', () => {
  it('draws a table larger than a column, each in its own colour', async () => {
    const { stage, theme } = await setup();
    const table = dotOf(stage, 't1');
    const column = dotOf(stage, 'c1');

    expect(dotsOf(stage)).toHaveLength(2);
    expect(table.radius()).toBe(TABLE_RADIUS);
    expect(column.radius()).toBe(COLUMN_RADIUS);
    expect(table.fill()).toBe(theme.accentColor9);
    expect(column.fill()).toBe(theme.grayColor8);
    expect(table.getAttr('kind')).toBe('visualization-table');
    expect(column.getAttr('kind')).toBe('visualization-column');
  });

  it('rings every dot in the canvas colour so neighbours read apart', async () => {
    const { stage, theme } = await setup();

    for (const dot of dotsOf(stage)) {
      expect(dot.stroke()).toBe(theme.canvasBackground);
      expect(dot.strokeWidth()).toBe(1.5);
    }
  });

  it('names the table behind a dot, for a column as much as a table', async () => {
    const { stage } = await setup();

    expect(dotOf(stage, 't1').getAttr('tableId')).toBe('t1');
    expect(dotOf(stage, 'c1').getAttr('tableId')).toBe('t1');
  });

  it('sits where the props put it', async () => {
    const { stage, graph } = await setup();
    const [table] = graph.nodes;

    expect(dotOf(stage, 't1').x()).toBe(table.x);
    expect(dotOf(stage, 't1').y()).toBe(table.y);
  });

  it('carries no id, so an id scan over the live stages stays unambiguous', async () => {
    const { stage } = await setup();

    const written = dotsOf(stage).filter(dot => Object.hasOwn(dot.attrs, 'id'));

    expect(written).toEqual([]);
  });

  it('draws direct rather than through the buffer canvas, so a dimmed dot stays cheap', async () => {
    const { stage } = await setup();

    for (const dot of dotsOf(stage)) {
      expect(dot.perfectDrawEnabled()).toBe(false);
    }
  });

  it('draws whole until the scene dims it, and then at the dim opacity', async () => {
    const { stage, graph, state, settle } = await setup();

    expect(dotOf(stage, 't1').opacity()).toBe(1);
    expect(dotOf(stage, 'c1').opacity()).toBe(1);

    renderKonva(stage, dots(graph, state, ['c1']));
    await settle();

    expect(dotOf(stage, 't1').opacity()).toBe(1);
    expect(dotOf(stage, 'c1').opacity()).toBe(DIM_OPACITY);
  });

  describe('hover', () => {
    it('names a hovered table for the preview and the highlight, at the pointer', async () => {
      const { stage, state, theme, settle } = await setup();
      const table = dotOf(stage, 't1');

      fireScenePointer(table, 'mouseenter', mouse(300, 150));
      await settle();

      expect(state.hoveredId).toBe('t1');
      expect(state.hoveredTableId).toBe('t1');
      expect(state.previewX).toBe(300);
      expect(state.previewY).toBe(150);
      expect(table.stroke()).toBe(theme.focus);
      expect(stage.container().style.cursor).toBe('pointer');
    });

    it('rings a hovered column and names no table, so nothing opens or lights', async () => {
      const { stage, state, theme, settle } = await setup();
      const column = dotOf(stage, 'c1');

      fireScenePointer(column, 'mouseenter', mouse(10, 20));
      await settle();

      expect(state.hoveredId).toBe('c1');
      expect(state.hoveredTableId).toBeNull();
      expect(column.stroke()).toBe(theme.focus);
      expect(stage.container().style.cursor).toBe('pointer');
    });

    it('forgets the table and drops the ring on leave', async () => {
      const { stage, state, theme, settle } = await setup();
      const table = dotOf(stage, 't1');

      fireScenePointer(table, 'mouseenter', mouse(10, 20));
      await settle();
      fireScenePointer(table, 'mouseleave');
      await settle();

      expect(state.hoveredId).toBeNull();
      expect(state.hoveredTableId).toBeNull();
      expect(table.stroke()).toBe(theme.canvasBackground);
      expect(stage.container().style.cursor).toBe('');
    });
  });

  describe('drag', () => {
    it('pins the node under the pointer and reheats the layout on press', async () => {
      const { stage, graph, state, settle } = await setup();
      const [table] = graph.nodes;
      const { x, y } = table;

      fireScenePointer(dotOf(stage, 't1'), 'mousedown', mouse(10, 10));
      await settle();

      expect(table.fx).toBe(x);
      expect(table.fy).toBe(y);
      expect(state.drag).toBe(true);
      expect(graph.simulation.alphaTarget()).toBe(0.3);
    });

    it('moves the pin by the pointer delta, read in scene units', async () => {
      const { stage, graph, state, settle } = await setup();
      const [table] = graph.nodes;
      state.scale = 2;
      await settle();
      const { x, y } = table;

      fireScenePointer(dotOf(stage, 't1'), 'mousedown', mouse(10, 10));
      movePointer(30, 25);
      await settle();

      // Twenty and fifteen px of pointer travel are half that at scale two.
      expect(table.fx).toBeCloseTo(x + 10, 10);
      expect(table.fy).toBeCloseTo(y + 7.5, 10);
    });

    it('releases the pin and cools the layout on mouseup', async () => {
      const { stage, graph, state, settle } = await setup();
      const [table] = graph.nodes;

      fireScenePointer(dotOf(stage, 't1'), 'mousedown', mouse(10, 10));
      movePointer(20, 20);
      releasePointer();
      await settle();

      expect(table.fx).toBeNull();
      expect(table.fy).toBeNull();
      expect(state.drag).toBe(false);
      expect(graph.simulation.alphaTarget()).toBe(0);
    });

    it('follows a changed position prop onto the dot', async () => {
      const { stage, graph, state, settle } = await setup();
      const [table] = graph.nodes;

      // The scene hands a step down as props; a node moved and re-rendered
      // with them lands the dot where the node now is.
      table.x = 123;
      table.y = -45;
      renderKonva(stage, dots(graph, state));
      await settle();

      expect(dotOf(stage, 't1').x()).toBe(123);
      expect(dotOf(stage, 't1').y()).toBe(-45);
    });
  });
});
