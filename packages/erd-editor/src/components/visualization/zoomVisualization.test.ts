import { describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import {
  type GraphViewHandle,
  registerGraphView,
  unregisterGraphView,
} from '@/components/visualization/graphViewHandle';
import {
  createVisualizationState,
  zoomAt,
} from '@/components/visualization/visualizationView';
import { setVisualizationZoom } from '@/components/visualization/zoomVisualization';

describe('setVisualizationZoom in Graph mode', () => {
  it('moves the registered graph view to the level given, about the middle of the stage', () => {
    const app = createTestAppContext();
    const { id, viewport } = app.store.state.editor;
    const handle: GraphViewHandle = {
      state: createVisualizationState(viewport.width, viewport.height),
      nodes: () => [],
    };
    handle.state.scale = 2;
    handle.state.x = 50;
    handle.state.y = 40;
    registerGraphView(id, handle);

    const before = { x: handle.state.x, y: handle.state.y, scale: 2 };
    setVisualizationZoom(app, 1);

    const middle = { x: viewport.width / 2, y: viewport.height / 2 };
    const expected = zoomAt(before, middle, 1 / before.scale);

    expect(handle.state.x).toBeCloseTo(expected.x, 6);
    expect(handle.state.y).toBeCloseTo(expected.y, 6);
    expect(handle.state.scale).toBeCloseTo(expected.scale, 6);

    unregisterGraphView(id, handle);
  });

  it('does nothing while no graph is registered for this editor', () => {
    const app = createTestAppContext();

    expect(() => setVisualizationZoom(app, 1)).not.toThrow();
  });
});
