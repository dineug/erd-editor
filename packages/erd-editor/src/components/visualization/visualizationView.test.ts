import { describe, expect, it } from 'vite-plus/test';

import {
  Group,
  LinkKind,
  type VisualizationLink,
  type VisualizationNode,
} from '@/components/visualization/createVisualization';
import {
  centerGraphView,
  COLUMN_RADIUS,
  createView,
  createVisualizationState,
  DIM_OPACITY,
  fitGraphView,
  graphCompass,
  hasName,
  type Highlight,
  highlightOf,
  LABEL_FADE_END,
  LABEL_FADE_START,
  labelOf,
  labelOpacity,
  NAME_MAX_LENGTH,
  nodeRadius,
  TABLE_RADIUS,
  truncateName,
  type VisualizationView,
  wheelZoomFactor,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomAt,
} from '@/components/visualization/visualizationView';

/** The scene point a stage point stands over, the view read backwards. */
const toScene = (view: VisualizationView, x: number, y: number) => ({
  x: (x - view.x) / view.scale,
  y: (y - view.y) / view.scale,
});

describe('truncateName', () => {
  it('keeps a name of the limit or shorter as it is', () => {
    expect(truncateName('')).toBe('');
    expect(truncateName('users')).toBe('users');
    expect(truncateName('a'.repeat(NAME_MAX_LENGTH))).toBe(
      'a'.repeat(NAME_MAX_LENGTH)
    );
  });

  it('cuts a longer name to the limit and marks the cut', () => {
    expect(truncateName('a_very_long_column_name')).toBe('a_very_long_col…');
    expect(Array.from(truncateName('b'.repeat(40)))).toHaveLength(
      NAME_MAX_LENGTH + 1
    );
  });

  it('counts code points, so a surrogate pair is never split', () => {
    const name = '😀'.repeat(NAME_MAX_LENGTH + 1);

    expect(truncateName(name)).toBe('😀'.repeat(NAME_MAX_LENGTH) + '…');
  });
});

describe('labelOf', () => {
  it('draws the cut name where there is one', () => {
    expect(labelOf({ name: 'users' })).toBe('users');
    expect(labelOf({ name: 'x'.repeat(20) })).toBe(
      'x'.repeat(NAME_MAX_LENGTH) + '…'
    );
  });

  it('falls back to the placeholder the preview input uses', () => {
    expect(labelOf({ name: '' })).toBe('table');
    expect(labelOf({ name: '   ' })).toBe('table');
  });

  it('tells a named table from a placeholder one', () => {
    expect(hasName({ name: 'users' })).toBe(true);
    expect(hasName({ name: ' ' })).toBe(false);
  });
});

describe('nodeRadius', () => {
  it('draws a table larger than a column', () => {
    expect(nodeRadius(Group.table)).toBe(TABLE_RADIUS);
    expect(nodeRadius(Group.column)).toBe(COLUMN_RADIUS);
    expect(TABLE_RADIUS).toBeGreaterThan(COLUMN_RADIUS);
  });
});

describe('highlightOf', () => {
  const node = (
    id: string,
    group: Group,
    tableId: string | null = null
  ): VisualizationNode => ({
    id,
    group,
    name: id,
    tableId,
    x: 0,
    y: 0,
    fx: null,
    fy: null,
  });
  const link = (
    kind: LinkKind,
    source: VisualizationNode,
    target: VisualizationNode
  ): VisualizationLink => ({
    id: `${source.id}-${target.id}`,
    kind,
    source,
    target,
  });

  const t1 = node('t1', Group.table);
  const c1 = node('c1', Group.column, 't1');
  const t2 = node('t2', Group.table);
  const c2 = node('c2', Group.column, 't2');
  const t3 = node('t3', Group.table);

  /** t1 owns c1 and joins t2 and t3, one relationship each way round. */
  const links = [
    link(LinkKind.column, t1, c1),
    link(LinkKind.column, t2, c2),
    link(LinkKind.relationship, t1, t2),
    link(LinkKind.relationship, t3, t1),
  ];

  const sorted = ({ nodeIds, linkIds }: Highlight) => ({
    nodeIds: [...nodeIds].sort(),
    linkIds: [...linkIds].sort(),
  });

  it('lights the table, its columns and the tables its relationships join, either way round', () => {
    expect(sorted(highlightOf(links, 't1'))).toEqual({
      nodeIds: ['c1', 't1', 't2', 't3'],
      linkIds: ['t1-c1', 't1-t2', 't3-t1'],
    });
  });

  it('stops at a joined table, so its columns and its own links stay out', () => {
    expect(sorted(highlightOf(links, 't3'))).toEqual({
      nodeIds: ['t1', 't3'],
      linkIds: ['t3-t1'],
    });
  });

  it('lights a table joined to nothing on its own', () => {
    expect(sorted(highlightOf([link(LinkKind.column, t1, c1)], 't3'))).toEqual({
      nodeIds: ['t3'],
      linkIds: [],
    });
  });

  it('fades the rest to a fraction of their rest rather than to nothing', () => {
    expect(DIM_OPACITY).toBeGreaterThan(0);
    expect(DIM_OPACITY).toBeLessThan(1);
  });
});

describe('labelOpacity', () => {
  it('hides a name at the fade start and below', () => {
    expect(labelOpacity(LABEL_FADE_START)).toBe(0);
    expect(labelOpacity(ZOOM_MIN)).toBe(0);
  });

  it('shows a name whole at the fade end and above, which is the view at rest', () => {
    expect(labelOpacity(LABEL_FADE_END)).toBe(1);
    expect(labelOpacity(1)).toBe(1);
    expect(labelOpacity(ZOOM_MAX)).toBe(1);
  });

  it('fades linearly between the two', () => {
    const middle = (LABEL_FADE_START + LABEL_FADE_END) / 2;

    expect(labelOpacity(middle)).toBeCloseTo(0.5, 10);
  });
});

describe('createView', () => {
  it('puts the origin at the middle of the stage at scale one', () => {
    expect(createView(1200, 675)).toEqual({ x: 600, y: 337.5, scale: 1 });
  });
});

describe('zoomAt', () => {
  const view: VisualizationView = { x: 600, y: 337.5, scale: 1 };

  it('scales by the factor', () => {
    expect(zoomAt(view, { x: 600, y: 337.5 }, 2).scale).toBe(2);
    expect(zoomAt(view, { x: 600, y: 337.5 }, 0.5).scale).toBe(0.5);
  });

  it('holds the scene point under the pointer still', () => {
    const point = { x: 100, y: 50 };
    const before = toScene(view, point.x, point.y);

    const zoomed = zoomAt(view, point, 1.25);
    const after = toScene(zoomed, point.x, point.y);

    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
    expect(zoomed).not.toEqual(view);
  });

  it('leaves the view alone about its own origin', () => {
    expect(zoomAt(view, { x: view.x, y: view.y }, 3)).toEqual({
      x: view.x,
      y: view.y,
      scale: 3,
    });
  });

  it('clamps the scale and still anchors the pointer at the clamp', () => {
    const point = { x: 10, y: 20 };
    const before = toScene(view, point.x, point.y);

    const ceiling = zoomAt(view, point, 100);
    const floor = zoomAt(view, point, 0.001);

    expect(ceiling.scale).toBe(ZOOM_MAX);
    expect(floor.scale).toBe(ZOOM_MIN);
    expect(toScene(ceiling, point.x, point.y).x).toBeCloseTo(before.x, 10);
    expect(toScene(floor, point.x, point.y).y).toBeCloseTo(before.y, 10);
  });
});

describe('wheelZoomFactor', () => {
  it('grows on a wheel rolled away from the user and shrinks on one rolled toward', () => {
    expect(wheelZoomFactor(-100)).toBeGreaterThan(1);
    expect(wheelZoomFactor(100)).toBeLessThan(1);
    expect(wheelZoomFactor(0)).toBe(1);
  });

  it('undoes a notch with the opposite notch', () => {
    expect(wheelZoomFactor(-100) * wheelZoomFactor(100)).toBeCloseTo(1, 10);
  });

  it('zooms no faster past one notch of travel', () => {
    expect(wheelZoomFactor(1000)).toBe(wheelZoomFactor(100));
    expect(wheelZoomFactor(-1000)).toBe(wheelZoomFactor(-100));
  });

  it('reads a line or page delta as the px it stands for', () => {
    expect(wheelZoomFactor(3, 1)).toBe(wheelZoomFactor(48));
    expect(wheelZoomFactor(1, 2)).toBe(wheelZoomFactor(100));
  });
});

describe('createVisualizationState', () => {
  it('starts centred, unhovered and at rest', () => {
    expect(createVisualizationState(800, 600)).toEqual({
      x: 400,
      y: 300,
      scale: 1,
      tick: 0,
      drag: false,
      hoveredId: null,
      hoveredTableId: null,
      previewX: 0,
      previewY: 0,
    });
  });
});

/** A dot of the graph at the point given, sized by the group it is in. */
const node = (
  id: string,
  x: number,
  y: number,
  group: Group = Group.table
): VisualizationNode => ({
  id,
  group,
  name: id,
  tableId: group === Group.table ? null : 't',
  x,
  y,
  fx: null,
  fy: null,
});

const VIEWPORT = { width: 800, height: 600 };

describe('fitGraphView', () => {
  it('centres the stage on a graph with nothing placed yet', () => {
    expect(fitGraphView([], VIEWPORT)).toEqual(createView(800, 600));
    expect(fitGraphView([node('a', NaN, NaN)], VIEWPORT)).toEqual(
      createView(800, 600)
    );
  });

  it('gives a stage with no size the view createView gives it', () => {
    expect(fitGraphView([node('a', 0, 0)], { width: 0, height: 0 })).toEqual(
      createView(0, 0)
    );
  });

  it('holds the middle of the graph over the middle of the stage', () => {
    const view = fitGraphView(
      [node('a', -400, -100), node('b', 600, 300)],
      VIEWPORT
    );
    const middle = { x: 100, y: 100 };

    expect(middle.x * view.scale + view.x).toBeCloseTo(400, 6);
    expect(middle.y * view.scale + view.y).toBeCloseTo(300, 6);
  });

  it('leaves the whole graph inside the stage, margin and all', () => {
    const nodes = [node('a', -1_000, -800), node('b', 1_000, 800)];
    const view = fitGraphView(nodes, VIEWPORT);

    for (const each of nodes) {
      const at = {
        x: each.x * view.scale + view.x,
        y: each.y * view.scale + view.y,
      };
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThanOrEqual(VIEWPORT.width);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeLessThanOrEqual(VIEWPORT.height);
    }
  });

  it('never zooms past the two ends the wheel is held to', () => {
    const tiny = fitGraphView([node('a', 0, 0), node('b', 1, 0)], VIEWPORT);
    const huge = fitGraphView(
      [node('a', -1e6, -1e6), node('b', 1e6, 1e6)],
      VIEWPORT
    );

    expect(tiny.scale).toBeLessThanOrEqual(ZOOM_MAX);
    expect(huge.scale).toBeGreaterThanOrEqual(ZOOM_MIN);
  });

  it('measures a dot by the circle its group draws, not by its centre', () => {
    const tables = fitGraphView(
      [node('a', 0, 0), node('b', 1_000, 0)],
      VIEWPORT
    );
    const columns = fitGraphView(
      [node('a', 0, 0, Group.column), node('b', 1_000, 0, Group.column)],
      VIEWPORT
    );

    // The same two centres span wider as tables than as columns, so the pair
    // of tables is the one that has to fit at the smaller scale.
    expect(tables.scale).toBeLessThan(columns.scale);
    expect(TABLE_RADIUS).toBeGreaterThan(COLUMN_RADIUS);
  });
});

describe('centerGraphView', () => {
  it('puts the scene point given under the middle of the stage, at the scale it stands at', () => {
    const view = { x: 10, y: 20, scale: 2 };
    const next = centerGraphView(view, { x: 100, y: 50 }, VIEWPORT);

    expect(next.scale).toBe(2);
    expect(100 * next.scale + next.x).toBeCloseTo(400, 6);
    expect(50 * next.scale + next.y).toBeCloseTo(300, 6);
  });
});

describe('graphCompass', () => {
  const centred = createView(VIEWPORT.width, VIEWPORT.height);

  it('reports nothing while a dot is on the stage', () => {
    expect(graphCompass(centred, [node('a', 0, 0)], VIEWPORT)).toBeNull();
  });

  it('reports nothing for a graph with no dot placed', () => {
    expect(graphCompass(centred, [], VIEWPORT)).toBeNull();
    expect(graphCompass(centred, [node('a', NaN, NaN)], VIEWPORT)).toBeNull();
  });

  it('reports nothing for a stage with no size', () => {
    expect(
      graphCompass(centred, [node('a', 9_000, 0)], { width: 0, height: 0 })
    ).toBeNull();
  });

  it('points at the nearest dot off the stage and names its middle', () => {
    const compass = graphCompass(
      centred,
      [node('a', 9_000, 0), node('b', 3_000, 0)],
      VIEWPORT
    );

    expect(compass?.angle).toBeCloseTo(0, 6);
    expect(compass?.target).toEqual({ x: 3_000, y: 0 });
    expect(compass?.distance).toBeCloseTo(3_000 - TABLE_RADIUS - 400, 6);
  });

  it('measures the gap in scene units, so a zoomed out stage reaches further', () => {
    const nodes = [node('a', 3_000, 0)];
    const near = graphCompass({ ...centred, scale: 0.5 }, nodes, VIEWPORT);
    const far = graphCompass(centred, nodes, VIEWPORT);

    expect(near!.distance).toBeLessThan(far!.distance);
  });

  it('holds still under the view a press on it lands', () => {
    const nodes = [node('a', 3_000, 400)];
    const compass = graphCompass(centred, nodes, VIEWPORT)!;
    const next = centerGraphView(centred, compass.target, VIEWPORT);

    expect(graphCompass(next, nodes, VIEWPORT)).toBeNull();
  });
});
