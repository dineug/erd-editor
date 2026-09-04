/** @jsxHost konva */

import { observable } from '@dineug/r-html';
import type { Group as KonvaGroup } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import type { Circle } from 'konva/lib/shapes/Circle';
import type { Line } from 'konva/lib/shapes/Line';
import type { Rect } from 'konva/lib/shapes/Rect';
import type { Text } from 'konva/lib/shapes/Text';
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
import VisualizationScene from '@/components/visualization/VisualizationScene';
import {
  createVisualizationState,
  DIM_OPACITY,
  LABEL_FADE_END,
  LABEL_FADE_START,
  NAME_MAX_LENGTH,
  TABLE_RADIUS,
  type VisualizationState,
} from '@/components/visualization/visualizationView';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import { TextFontFamily } from '@/styles/fonts.styles';
import type { Theme } from '@/themes/tokens';

type Fixture = {
  app: AppContext;
  graph: Visualization;
  state: VisualizationState;
  theme: Theme;
  stage: Stage;
  settle: () => Promise<void>;
};

const LONG_NAME = 'a_very_long_table_name_indeed';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/**
 * A long named table with a short named column and an unnamed one, plus an
 * unnamed table.
 */
function seedGraph(app: AppContext) {
  app.store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id: 't1', value: LONG_NAME }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    changeColumnNameAction({ id: 'c1', tableId: 't1', value: 'id' }),
    addColumnAction({ id: 'c2', tableId: 't1' }),
    addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 3 } })
  );
}

/**
 * The base graph plus a third table the first one's relationship joins, and a
 * fourth with a column of its own that nothing joins.
 */
function seedRelated(app: AppContext) {
  seedGraph(app);
  app.store.dispatchSync(
    addTableAction({ id: 't3', ui: { x: 0, y: 0, zIndex: 4 } }),
    addRelationshipAction({
      id: 'r1',
      relationshipType: 4,
      start: { tableId: 't1', columnIds: [] },
      end: { tableId: 't3', columnIds: [] },
    }),
    addTableAction({ id: 't4', ui: { x: 0, y: 0, zIndex: 5 } }),
    addColumnAction({ id: 'c3', tableId: 't4' })
  );
}

/**
 * The seeded document laid out by d3 and then held still, so a position read
 * here is the one drawn.
 */
async function setup(seed = seedGraph): Promise<Fixture> {
  const app = createTestAppContext();
  seed(app);

  const graph = createVisualization(app.store.state);
  graph.simulation.stop();
  const { viewport } = app.store.state.editor;
  const state = observable(
    createVisualizationState(viewport.width, viewport.height),
    { shallow: true }
  );
  const theme = createTestTheme();
  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    scene: <VisualizationScene graph={graph} state={state} />,
    width: viewport.width,
    height: viewport.height,
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

const sceneOf = (stage: Stage) =>
  stage.findOne<Layer>('.visualization-scene') as Layer;

const panOf = (stage: Stage) =>
  stage.findOne<Rect>('.visualization-pan') as Rect;

const labelsOf = (stage: Stage) =>
  stage.findOne<KonvaGroup>('.visualization-labels') as KonvaGroup;

const dotOf = (stage: Stage, id: string) =>
  stage.findOne<Circle>(`.${id}`) as Circle;

const linesOf = (stage: Stage) => stage.find<Line>('.visualization-link');

const textsOf = (stage: Stage) =>
  stage.find<Text>('.visualization-label').map(text => text.text());

/** The line between two dots, found by the ends it was built from. */
const lineOf = (
  stage: Stage,
  graph: Visualization,
  source: string,
  target: string
) => {
  const index = graph.links.findIndex(
    link => link.id === `${source}-${target}`
  );
  return linesOf(stage)[index];
};

/** The label under a table's dot, matched by position rather than text. */
const labelOf = (stage: Stage, graph: Visualization, id: string) => {
  const node = graph.nodes.find(node => node.id === id)!;
  return stage
    .find<Text>('.visualization-label')
    .find(text => text.y() === node.y + TABLE_RADIUS + 3)!;
};

describe('the visualization scene', () => {
  it('lays a stage sized background under the graph layer', async () => {
    const { app, stage, theme } = await setup();
    const { viewport } = app.store.state.editor;
    const pan = panOf(stage);

    expect(stage.getLayers().map(layer => layer.name())).toEqual([
      'visualization-background',
      'visualization-scene',
    ]);
    expect(pan.width()).toBe(viewport.width);
    expect(pan.height()).toBe(viewport.height);
    expect(pan.fill()).toBe(theme.canvasBackground);
  });

  it('grows the background with the viewport', async () => {
    const { app, stage, settle } = await setup();

    app.store.state.editor.viewport.width = 1600;
    app.store.state.editor.viewport.height = 900;
    await settle();

    expect(panOf(stage).width()).toBe(1600);
    expect(panOf(stage).height()).toBe(900);
  });

  it('carries the view on the graph layer and follows a change to it', async () => {
    const { stage, state, settle } = await setup();
    const layer = sceneOf(stage);

    expect(layer.x()).toBe(state.x);
    expect(layer.y()).toBe(state.y);
    expect(layer.scaleX()).toBe(1);
    expect(layer.scaleY()).toBe(1);

    state.x = 10;
    state.y = -20;
    state.scale = 2.5;
    await settle();

    expect(layer.x()).toBe(10);
    expect(layer.y()).toBe(-20);
    expect(layer.scaleX()).toBe(2.5);
    expect(layer.scaleY()).toBe(2.5);
  });

  it('draws a dot per node and a line per link between its ends', async () => {
    const { stage, graph, theme } = await setup();
    const [table, id, unnamed] = graph.nodes;
    const lines = linesOf(stage);

    expect(stage.find('.visualization-node')).toHaveLength(4);
    expect(lines).toHaveLength(2);
    expect(lines[0].points()).toEqual([table.x, table.y, id.x, id.y]);
    expect(lines[1].points()).toEqual([table.x, table.y, unnamed.x, unnamed.y]);
    expect(lines[0].stroke()).toBe(theme.grayColor7);
    expect(lines[0].opacity()).toBe(0.6);
    expect(lines[0].listening()).toBe(false);
  });

  it('paints links under dots under labels', async () => {
    const { stage } = await setup();

    expect(
      sceneOf(stage)
        .getChildren()
        .map(child => child.name())
    ).toEqual([
      'visualization-links',
      'visualization-nodes',
      'visualization-labels',
    ]);
  });

  it('moves the dots and the lines on a step of the layout', async () => {
    const { stage, graph, state, settle } = await setup();
    const [table, id] = graph.nodes;

    table.x = 100;
    table.y = 50;
    id.x = -40;
    id.y = 30;
    state.tick += 1;
    await settle();

    expect(dotOf(stage, 't1').x()).toBe(100);
    expect(dotOf(stage, 't1').y()).toBe(50);
    expect(dotOf(stage, 'c1').x()).toBe(-40);
    expect(linesOf(stage)[0].points()).toEqual([100, 50, -40, 30]);
  });

  describe('labels', () => {
    it('writes one label per table, cut to fifteen characters, and none for a column', async () => {
      const { stage } = await setup();

      expect(stage.find('.visualization-node')).toHaveLength(4);
      expect(textsOf(stage)).toEqual([
        LONG_NAME.slice(0, NAME_MAX_LENGTH) + '…',
        'table',
      ]);
    });

    it('centres each label under its table in the editor face, in bold', async () => {
      const { stage, graph } = await setup();
      const [table] = graph.nodes;
      const [label] = stage.find<Text>('.visualization-label');

      expect(label.x() + label.width() / 2).toBe(table.x);
      expect(label.y()).toBe(table.y + TABLE_RADIUS + 3);
      expect(label.align()).toBe('center');
      expect(label.wrap()).toBe('none');
      expect(label.fontFamily()).toBe(TextFontFamily);
      expect(label.fontSize()).toBe(12);
      expect(label.fontStyle()).toBe('bold');
    });

    it('paints a name in the foreground and a placeholder as one', async () => {
      const { stage, theme } = await setup();
      const [named, placeholder] = stage.find<Text>('.visualization-label');

      expect(named.fill()).toBe(theme.foreground);
      expect(placeholder.fill()).toBe(theme.placeholder);
    });

    it('answers no hit test, so a press on a name falls through to the pan', async () => {
      const { stage } = await setup();

      expect(labelsOf(stage).listening()).toBe(false);
    });

    it('is whole at rest, fades with the scale and goes below the fade start', async () => {
      const { stage, state, settle } = await setup();
      const labels = labelsOf(stage);

      expect(labels.opacity()).toBe(1);
      expect(labels.visible()).toBe(true);

      state.scale = (LABEL_FADE_START + LABEL_FADE_END) / 2;
      await settle();
      expect(labels.opacity()).toBeCloseTo(0.5, 10);
      expect(labels.visible()).toBe(true);

      state.scale = LABEL_FADE_START;
      await settle();
      expect(labels.opacity()).toBe(0);
      expect(labels.visible()).toBe(false);

      state.scale = LABEL_FADE_END * 2;
      await settle();
      expect(labels.opacity()).toBe(1);
      expect(labels.visible()).toBe(true);
    });

    it('gives a column no name however far the reader zooms in', async () => {
      const { stage, state, settle } = await setup();

      state.scale = 4;
      await settle();

      expect(stage.find('.visualization-label')).toHaveLength(2);
      expect(textsOf(stage)).not.toContain('id');
      expect(textsOf(stage)).not.toContain('column');
    });
  });

  describe('highlight', () => {
    it('draws every line at a hovered table whole and in the hover colour', async () => {
      const { stage, graph, state, theme, settle } = await setup(seedRelated);

      state.hoveredTableId = 't1';
      await settle();

      for (const line of [
        lineOf(stage, graph, 't1', 'c1'),
        lineOf(stage, graph, 't1', 'c2'),
        lineOf(stage, graph, 't1', 't3'),
      ]) {
        expect(line.stroke()).toBe(theme.relationshipHover);
        expect(line.opacity()).toBe(1);
      }
    });

    it('keeps the table, its columns and a joined table whole', async () => {
      const { stage, graph, state, settle } = await setup(seedRelated);

      state.hoveredTableId = 't1';
      await settle();

      for (const id of ['t1', 'c1', 'c2', 't3']) {
        expect(dotOf(stage, id).opacity()).toBe(1);
      }
      expect(labelOf(stage, graph, 't1').opacity()).toBe(1);
      expect(labelOf(stage, graph, 't3').opacity()).toBe(1);
    });

    it('fades every dot, line and name the hovered table does not reach', async () => {
      const { stage, graph, state, theme, settle } = await setup(seedRelated);

      state.hoveredTableId = 't1';
      await settle();

      expect(dotOf(stage, 't2').opacity()).toBe(DIM_OPACITY);
      expect(dotOf(stage, 't4').opacity()).toBe(DIM_OPACITY);
      expect(dotOf(stage, 'c3').opacity()).toBe(DIM_OPACITY);
      expect(labelOf(stage, graph, 't2').opacity()).toBe(DIM_OPACITY);
      expect(labelOf(stage, graph, 't4').opacity()).toBe(DIM_OPACITY);

      const unlit = lineOf(stage, graph, 't4', 'c3');
      expect(unlit.stroke()).toBe(theme.grayColor7);
      expect(unlit.opacity()).toBeCloseTo(0.6 * DIM_OPACITY, 10);
    });

    it('lights a joined table from its own end of the relationship too', async () => {
      const { stage, graph, state, settle } = await setup(seedRelated);

      state.hoveredTableId = 't3';
      await settle();

      expect(dotOf(stage, 't1').opacity()).toBe(1);
      expect(lineOf(stage, graph, 't1', 't3').opacity()).toBe(1);
      expect(dotOf(stage, 'c1').opacity()).toBe(DIM_OPACITY);
      expect(lineOf(stage, graph, 't1', 'c1').opacity()).toBeCloseTo(
        0.6 * DIM_OPACITY,
        10
      );
    });

    it('puts the whole graph back at rest once no table is hovered', async () => {
      const { stage, graph, state, theme, settle } = await setup(seedRelated);

      state.hoveredTableId = 't1';
      await settle();
      state.hoveredTableId = null;
      await settle();

      for (const dot of stage.find<Circle>('.visualization-node')) {
        expect(dot.opacity()).toBe(1);
      }
      for (const line of linesOf(stage)) {
        expect(line.stroke()).toBe(theme.grayColor7);
        expect(line.opacity()).toBe(0.6);
      }
      expect(labelOf(stage, graph, 't4').opacity()).toBe(1);
    });

    it('fades nothing for a hovered column, which names no table', async () => {
      const { stage, graph, state, settle } = await setup(seedRelated);

      state.hoveredId = 'c1';
      await settle();

      expect(dotOf(stage, 't4').opacity()).toBe(1);
      expect(lineOf(stage, graph, 't4', 'c3').opacity()).toBe(0.6);
    });

    it('fades a name inside the scale fade as a fraction of that fade', async () => {
      const { stage, graph, state, settle } = await setup(seedRelated);

      state.scale = (LABEL_FADE_START + LABEL_FADE_END) / 2;
      state.hoveredTableId = 't1';
      await settle();

      expect(labelOf(stage, graph, 't4').getAbsoluteOpacity()).toBeCloseTo(
        0.5 * DIM_OPACITY,
        10
      );
    });
  });

  describe('pan', () => {
    it('moves the view by the pointer delta on a background drag', async () => {
      const { stage, state, settle } = await setup();
      const { x, y } = state;

      fireScenePointer(panOf(stage), 'mousedown', { clientX: 0, clientY: 0 });
      await settle();
      expect(state.drag).toBe(true);

      movePointer(15, -5);
      await settle();

      expect(state.x).toBe(x + 15);
      expect(state.y).toBe(y - 5);
      expect(sceneOf(stage).x()).toBe(x + 15);

      releasePointer();
      await settle();
      expect(state.drag).toBe(false);
    });

    it('pans the same distance at any scale, since the view is in stage px', async () => {
      const { stage, state, settle } = await setup();
      state.scale = 0.25;
      await settle();
      const { x } = state;

      fireScenePointer(panOf(stage), 'mousedown', { clientX: 0, clientY: 0 });
      movePointer(40, 0);
      await settle();

      expect(state.x).toBe(x + 40);
    });
  });
});
