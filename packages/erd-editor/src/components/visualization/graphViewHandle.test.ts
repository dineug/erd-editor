import { describe, expect, it } from 'vite-plus/test';

import type { VisualizationNode } from '@/components/visualization/createVisualization';
import {
  getGraphView,
  type GraphViewHandle,
  registerGraphView,
  unregisterGraphView,
  updateGraphView,
} from '@/components/visualization/graphViewHandle';
import {
  createView,
  createVisualizationState,
  zoomAt,
} from '@/components/visualization/visualizationView';

const handleOf = (nodes: VisualizationNode[] = []): GraphViewHandle => ({
  state: createVisualizationState(800, 600),
  nodes: () => nodes,
});

describe('graphViewHandle', () => {
  it('answers with a view at rest before any graph has registered', () => {
    const { state, nodes } = getGraphView('never-mounted');

    expect(state).toEqual(createVisualizationState(0, 0));
    expect(state.scale).toBe(createView(0, 0).scale);
    expect(nodes()).toEqual([]);
  });

  it('hands back the very object the graph registered, not a copy of it', () => {
    const handle = handleOf();
    registerGraphView('e1', handle);

    expect(getGraphView('e1')).toBe(handle);
    expect(getGraphView('e1').state).toBe(handle.state);

    handle.state.scale = 2;
    expect(getGraphView('e1').state.scale).toBe(2);

    unregisterGraphView('e1', handle);
  });

  it('keeps one editor clear of another on the same page', () => {
    const first = handleOf();
    const second = handleOf();
    registerGraphView('e1', first);
    registerGraphView('e2', second);

    expect(getGraphView('e1')).toBe(first);
    expect(getGraphView('e2')).toBe(second);

    unregisterGraphView('e1', first);
    unregisterGraphView('e2', second);
  });

  it('rests again once the graph unmounts', () => {
    const handle = handleOf();
    registerGraphView('e3', handle);
    unregisterGraphView('e3', handle);

    expect(getGraphView('e3').nodes()).toEqual([]);
    expect(getGraphView('e3')).not.toBe(handle);
  });

  it('moves the view of the graph that registered it', () => {
    const handle = handleOf();
    registerGraphView('e5', handle);

    updateGraphView('e5', ({ state }) =>
      zoomAt(state, { x: 400, y: 300 }, 1.04)
    );

    expect(handle.state.scale).toBeCloseTo(1.04, 6);
    expect(getGraphView('e5').state).toBe(handle.state);

    unregisterGraphView('e5', handle);
  });

  /**
   * The resting handle is one object every editor that has not registered
   * reads, so a press in the frame before a mount must reach nothing: writing
   * it there would carry one editor's zoom into the next one's first frame.
   */
  it('writes nothing at all while no graph is registered', () => {
    let asked = false;

    updateGraphView('never-written', handle => {
      asked = true;
      return zoomAt(handle.state, { x: 400, y: 300 }, 2);
    });

    expect(asked).toBe(false);
    expect(getGraphView('never-written').state).toEqual(
      createVisualizationState(0, 0)
    );

    const handle = handleOf();
    registerGraphView('never-written', handle);
    expect(getGraphView('never-written').state).toEqual(
      createVisualizationState(800, 600)
    );

    unregisterGraphView('never-written', handle);
    expect(getGraphView('never-written').state).toEqual(
      createVisualizationState(0, 0)
    );
  });

  // A remount registers before the leaving mount tears down, and the slot
  // belongs to whoever registered last: the older teardown must not empty it.
  it('leaves the slot alone where another graph has taken it', () => {
    const first = handleOf();
    const second = handleOf();
    registerGraphView('e4', first);
    registerGraphView('e4', second);
    unregisterGraphView('e4', first);

    expect(getGraphView('e4')).toBe(second);

    unregisterGraphView('e4', second);
  });
});
