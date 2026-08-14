import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { createVisualization } from '@/components/visualization/createVisualization';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';

type Props = Parameters<typeof createVisualization>[1];

const contexts: AppContext[] = [];
const created: Array<ReturnType<typeof createVisualization>> = [];

function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  return app;
}

function createProps(): {
  [K in keyof Props]: Mock<Props[K]>;
} {
  return {
    onDragStart: vi.fn<Props['onDragStart']>(),
    onDragEnd: vi.fn<Props['onDragEnd']>(),
    onStartPreview: vi.fn<Props['onStartPreview']>(),
    onEndPreview: vi.fn<Props['onEndPreview']>(),
  };
}

function create(app: AppContext, props: Props) {
  const svg = createVisualization(app.store.state, props);
  created.push(svg);
  return svg;
}

function addTable(app: AppContext, id: string, name: string) {
  app.store.dispatchSync(
    addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } }),
    changeTableNameAction({ id, value: name })
  );
}

function addColumn(app: AppContext, tableId: string, id: string, name: string) {
  app.store.dispatchSync(
    addColumnAction({ id, tableId }),
    changeColumnNameAction({ id, tableId, value: name })
  );
}

const circlesOf = (svg: ReturnType<typeof createVisualization>) =>
  Array.from(
    (svg.node() as SVGSVGElement).querySelectorAll('circle')
  ) as SVGCircleElement[];

const linesOf = (svg: ReturnType<typeof createVisualization>) =>
  Array.from(
    (svg.node() as SVGSVGElement).querySelectorAll('line')
  ) as SVGLineElement[];

/** happy-dom never runs the d3 force timer eagerly, so wait for a real frame. */
async function waitForTick(svg: ReturnType<typeof createVisualization>) {
  for (let i = 0; i < 50; i++) {
    if (circlesOf(svg).every(circle => circle.hasAttribute('cx'))) return;
    await new Promise(resolve => setTimeout(resolve, 4));
  }
  throw new Error('the force simulation never ticked');
}

/**
 * happy-dom's `createSVGPoint()` has no `matrixTransform`, which is the branch
 * `d3-selection`'s `pointer()` takes for svg nodes. Give it just enough shape
 * for d3-drag to compute a position.
 */
let pointerAt: [number, number] = [0, 0];

function stubSvgGeometry() {
  const matrix = { inverse: () => matrix };
  // d3-drag only binds its touch listeners to `"ontouchstart" in node` elements.
  Object.defineProperty(SVGCircleElement.prototype, 'ontouchstart', {
    configurable: true,
    writable: true,
    value: null,
  });
  vi.spyOn(SVGSVGElement.prototype as any, 'createSVGPoint').mockImplementation(
    () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: pointerAt[0], y: pointerAt[1] }),
    })
  );
  vi.spyOn(SVGGElement.prototype as any, 'getScreenCTM').mockReturnValue(
    matrix
  );
}

const mouse = (
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number
) =>
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, view: window, clientX, clientY })
  );

type TouchLike = { identifier: number; clientX: number; clientY: number };

/** happy-dom has no TouchEvent; d3-drag only reads `changedTouches`. */
function touch(type: string, touches: TouchLike[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'changedTouches', { value: touches });
  return event;
}

afterEach(() => {
  created.splice(0).forEach(svg => svg.remove());
  contexts.splice(0).forEach(app => app.store.destroy());
  pointerAt = [0, 0];
  delete (SVGCircleElement.prototype as any).ontouchstart;
  vi.restoreAllMocks();
});

describe('createVisualization', () => {
  it('creates a detached svg root with a link group and a node group', () => {
    const app = createApp();
    const svg = create(app, createProps());
    const node = svg.node() as SVGSVGElement;

    expect(node).toBeTruthy();
    expect(node.tagName.toLowerCase()).toBe('svg');
    expect(node.parentNode).toBeNull();

    const groups = Array.from(node.children);
    expect(groups).toHaveLength(2);
    expect(groups[0].getAttribute('stroke')).toBe('#999');
    expect(groups[0].getAttribute('stroke-opacity')).toBe('0.6');
    expect(groups[1].getAttribute('stroke')).toBe('#fff');
    expect(groups[1].getAttribute('stroke-width')).toBe('1.5');
  });

  it('renders nothing for an empty document', () => {
    const app = createApp();
    const svg = create(app, createProps());

    expect(circlesOf(svg)).toHaveLength(0);
    expect(linesOf(svg)).toHaveLength(0);
  });

  it('renders one circle per table and per column', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');
    addColumn(app, 't1', 'c2', 'name');

    const svg = create(app, createProps());

    expect(circlesOf(svg)).toHaveLength(3);
    circlesOf(svg).forEach(circle => {
      expect(circle.getAttribute('r')).toBe('5');
      expect(circle.getAttribute('fill')).toMatch(/^#/);
    });
  });

  it('colors tables and columns with two distinct ordinal scale values', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');

    const svg = create(app, createProps());
    const [table, column] = circlesOf(svg);

    expect(table.getAttribute('fill')).not.toBe(column.getAttribute('fill'));
  });

  it('links every column back to the table that owns it', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addColumn(app, 't1', 'c1', 'id');
    addColumn(app, 't1', 'c2', 'name');

    const svg = create(app, createProps());

    expect(linesOf(svg)).toHaveLength(2);
    linesOf(svg).forEach(line => {
      expect(line.getAttribute('stroke-width')).toBe(String(Math.sqrt(2)));
    });
  });

  it('adds one extra link per relationship between two different tables', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      })
    );

    const svg = create(app, createProps());

    expect(linesOf(svg)).toHaveLength(1);
  });

  it('deduplicates relationships that repeat the same ordered table pair', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      }),
      addRelationshipAction({
        id: 'r2',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      })
    );

    const svg = create(app, createProps());

    expect(linesOf(svg)).toHaveLength(1);
  });

  it('keeps both orientations because the dedupe key is order sensitive', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    addTable(app, 't2', 'posts');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      }),
      addRelationshipAction({
        id: 'r2',
        relationshipType: 4,
        start: { tableId: 't2', columnIds: [] },
        end: { tableId: 't1', columnIds: [] },
      })
    );

    const svg = create(app, createProps());

    expect(linesOf(svg)).toHaveLength(2);
  });

  it('ignores self referencing relationships', () => {
    const app = createApp();
    addTable(app, 't1', 'users');
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't1', columnIds: [] },
      })
    );

    const svg = create(app, createProps());

    expect(linesOf(svg)).toHaveLength(0);
  });

  describe('preview handlers', () => {
    it('reports only the table id when a table node is hovered', () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      addColumn(app, 't1', 'c1', 'id');
      const props = createProps();
      const svg = create(app, props);

      const [tableCircle] = circlesOf(svg);
      tableCircle.dispatchEvent(new MouseEvent('mouseenter'));

      expect(props.onStartPreview).toHaveBeenCalledTimes(1);
      const [event, tableId, columnId] = props.onStartPreview.mock.calls[0];
      expect(event).toBeInstanceOf(MouseEvent);
      expect(tableId).toBe('t1');
      expect(columnId).toBeNull();
    });

    it('reports both ids when a column node is hovered', () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      addColumn(app, 't1', 'c1', 'id');
      const props = createProps();
      const svg = create(app, props);

      const [, columnCircle] = circlesOf(svg);
      columnCircle.dispatchEvent(new MouseEvent('mouseenter'));

      const [, tableId, columnId] = props.onStartPreview.mock.calls[0];
      expect(tableId).toBe('t1');
      expect(columnId).toBe('c1');
    });

    it('ends the preview on mouseleave', () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      const props = createProps();
      const svg = create(app, props);

      circlesOf(svg)[0].dispatchEvent(new MouseEvent('mouseleave'));

      expect(props.onEndPreview).toHaveBeenCalledTimes(1);
      expect(props.onStartPreview).not.toHaveBeenCalled();
    });
  });

  describe('tick', () => {
    it('projects the simulated coordinates onto the circles and lines', async () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      addColumn(app, 't1', 'c1', 'id');
      const svg = create(app, createProps());

      await waitForTick(svg);

      const circles = circlesOf(svg);
      const lines = linesOf(svg);

      expect(Number(circles[0].getAttribute('cx'))).not.toBeNaN();
      expect(Number(circles[0].getAttribute('cy'))).not.toBeNaN();
      expect(circles[0].getAttribute('cx')).toBeTruthy();
      expect(circles[0].getAttribute('cy')).toBeTruthy();
      expect(lines[0].getAttribute('x1')).toBeTruthy();
      expect(lines[0].getAttribute('y1')).toBeTruthy();
      expect(lines[0].getAttribute('x2')).toBeTruthy();
      expect(lines[0].getAttribute('y2')).toBeTruthy();
    });

    it('anchors each link between the coordinates of its two endpoints', async () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      addColumn(app, 't1', 'c1', 'id');
      const svg = create(app, createProps());

      await waitForTick(svg);

      const [table, column] = circlesOf(svg);
      const [line] = linesOf(svg);

      expect(line.getAttribute('x1')).toBe(table.getAttribute('cx'));
      expect(line.getAttribute('y1')).toBe(table.getAttribute('cy'));
      expect(line.getAttribute('x2')).toBe(column.getAttribute('cx'));
      expect(line.getAttribute('y2')).toBe(column.getAttribute('cy'));
    });
  });

  describe('drag behaviour', () => {
    beforeEach(() => {
      stubSvgGeometry();
    });

    it('notifies drag start on mousedown and drag end on mouseup', () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      const props = createProps();
      const svg = create(app, props);
      const [circle] = circlesOf(svg);

      mouse(circle, 'mousedown', 10, 20);

      expect(props.onDragStart).toHaveBeenCalledTimes(1);
      expect(props.onDragEnd).not.toHaveBeenCalled();

      mouse(window, 'mousemove', 40, 60);
      mouse(window, 'mouseup', 40, 60);

      expect(props.onDragEnd).toHaveBeenCalledTimes(1);
    });

    it('pins the node while dragging and releases it on drag end', () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      const props = createProps();
      const svg = create(app, props);
      const [circle] = circlesOf(svg);
      const datum = (circle as any).__data__;
      const startX = datum.x;
      const startY = datum.y;

      mouse(circle, 'mousedown', 10, 20);
      expect(datum.fx).toBe(startX);
      expect(datum.fy).toBe(startY);

      // d3-drag keeps the grab offset, so the datum follows pointer + offset.
      pointerAt = [111, 222];
      mouse(window, 'mousemove', 40, 60);
      expect(datum.fx).toBeCloseTo(111 + startX, 10);
      expect(datum.fy).toBeCloseTo(222 + startY, 10);

      mouse(window, 'mouseup', 40, 60);
      expect(datum.fx).toBeNull();
      expect(datum.fy).toBeNull();
    });

    // Kept last: d3-drag guards mouse gestures for 500ms after any touch end.
    it('reports one drag start and one drag end per concurrent touch', () => {
      const app = createApp();
      addTable(app, 't1', 'users');
      const props = createProps();
      const svg = create(app, props);
      const [circle] = circlesOf(svg);

      circle.dispatchEvent(
        touch('touchstart', [
          { identifier: 1, clientX: 0, clientY: 0 },
          { identifier: 2, clientX: 5, clientY: 5 },
        ])
      );
      expect(props.onDragStart).toHaveBeenCalledTimes(2);

      circle.dispatchEvent(
        touch('touchend', [
          { identifier: 1, clientX: 0, clientY: 0 },
          { identifier: 2, clientX: 5, clientY: 5 },
        ])
      );
      expect(props.onDragEnd).toHaveBeenCalledTimes(2);
    });
  });
});
