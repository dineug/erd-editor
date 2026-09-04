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
  Group,
  type Visualization,
} from '@/components/visualization/createVisualization';
import VisualizationScene from '@/components/visualization/VisualizationScene';
import {
  COLUMN_RADIUS,
  createVisualizationState,
  LABEL_FADE,
  NAME_MAX_LENGTH,
  TABLE_RADIUS,
  type VisualizationState,
} from '@/components/visualization/visualizationView';
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
 * A long named table with a short named column and an unnamed one, laid out
 * by d3 and then held still, so a position read here is the one drawn.
 */
async function setup(): Promise<Fixture> {
  const app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id: 't1', value: LONG_NAME }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    changeColumnNameAction({ id: 'c1', tableId: 't1', value: 'id' }),
    addColumnAction({ id: 'c2', tableId: 't1' })
  );

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

const labelsOf = (stage: Stage, group: Group) =>
  stage.findOne<KonvaGroup>(`.visualization-${group}-labels`) as KonvaGroup;

const dotOf = (stage: Stage, id: string) =>
  stage.findOne<Circle>(`.${id}`) as Circle;

const linesOf = (stage: Stage) => stage.find<Line>('.visualization-link');

const textsOf = (stage: Stage) =>
  stage.find<Text>('.visualization-label').map(text => text.text());

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

    expect(stage.find('.visualization-node')).toHaveLength(3);
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
      'visualization-table-labels',
      'visualization-column-labels',
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
    it('writes one label per node, cut to fifteen characters', async () => {
      const { stage } = await setup();

      expect(textsOf(stage)).toEqual([
        LONG_NAME.slice(0, NAME_MAX_LENGTH) + '…',
        'id',
        'column',
      ]);
    });

    it('centres each label under its dot in the editor face', async () => {
      const { stage, graph } = await setup();
      const [table, id] = graph.nodes;
      const [tableLabel, idLabel] = stage.find<Text>('.visualization-label');

      expect(tableLabel.x() + tableLabel.width() / 2).toBe(table.x);
      expect(tableLabel.y()).toBe(table.y + TABLE_RADIUS + 3);
      expect(tableLabel.align()).toBe('center');
      expect(tableLabel.wrap()).toBe('none');
      expect(tableLabel.fontFamily()).toBe(TextFontFamily);
      expect(tableLabel.fontSize()).toBe(12);
      expect(idLabel.y()).toBe(id.y + COLUMN_RADIUS + 3);
    });

    it('sets a table name in bold and a column name in the regular face', async () => {
      const { stage } = await setup();
      const [tableLabel, idLabel] = stage.find<Text>('.visualization-label');

      expect(tableLabel.fontStyle()).toBe('bold');
      expect(idLabel.fontStyle()).toBe('normal');
    });

    it('paints a name in the foreground and a placeholder as one', async () => {
      const { stage, theme } = await setup();
      const [tableLabel, , placeholder] = stage.find<Text>(
        '.visualization-label'
      );

      expect(tableLabel.fill()).toBe(theme.foreground);
      expect(placeholder.fill()).toBe(theme.placeholder);
    });

    it('answers no hit test, so a press on a name falls through to the pan', async () => {
      const { stage } = await setup();

      expect(labelsOf(stage, Group.table).listening()).toBe(false);
      expect(labelsOf(stage, Group.column).listening()).toBe(false);
    });

    it('fades each kind of name with the scale, and drops it below its fade start', async () => {
      const { stage, state, settle } = await setup();

      for (const group of [Group.table, Group.column]) {
        const labels = labelsOf(stage, group);
        const { start, end } = LABEL_FADE[group];

        state.scale = end;
        await settle();
        expect(labels.opacity()).toBe(1);
        expect(labels.visible()).toBe(true);

        state.scale = (start + end) / 2;
        await settle();
        expect(labels.opacity()).toBeCloseTo(0.5, 10);
        expect(labels.visible()).toBe(true);

        state.scale = start;
        await settle();
        expect(labels.opacity()).toBe(0);
        expect(labels.visible()).toBe(false);
      }
    });

    it('shows the table names at rest and holds the column names back', async () => {
      const { stage, state, settle } = await setup();

      state.scale = 1;
      await settle();

      expect(labelsOf(stage, Group.table).opacity()).toBe(1);
      expect(labelsOf(stage, Group.column).opacity()).toBe(0);
      expect(labelsOf(stage, Group.column).visible()).toBe(false);
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
