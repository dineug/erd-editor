/** @jsxHost konva */

import { FC } from '@dineug/r-html';
import type { KonvaEventObject } from 'konva/lib/Node';

import { useThemeContext } from '@/components/themeContext';
import {
  Group,
  type Visualization,
  type VisualizationNode,
} from '@/components/visualization/createVisualization';
import {
  nodeRadius,
  type VisualizationState,
} from '@/components/visualization/visualizationView';
import { drag$, type DragMove } from '@/utils/globalEventObservable';

export type GraphNodeProps = {
  node: VisualizationNode;
  /**
   * The node's place, handed down rather than read off the node, so a step of
   * the simulation the scene saw reaches this dot as a changed prop.
   */
  x: number;
  y: number;
  graph: Visualization;
  state: VisualizationState;
};

type NodeMouseEvent = KonvaEventObject<MouseEvent>;

/** How warm the layout runs while a node is held, d3's own figure for a drag. */
const DRAG_ALPHA_TARGET = 0.3;

/** The ring the svg dots wore, in the canvas colour so the dots read apart. */
const NODE_STROKE_WIDTH = 1.5;

const CURSOR_POINTER = 'pointer';

const CURSOR_INHERIT = '';

/** A konva node carries no cursor, so the stage container wears it. */
function setCursor(event: NodeMouseEvent, cursor: string): void {
  const container = event.target.getStage()?.container();
  if (container) container.style.cursor = cursor;
}

/**
 * One dot, owning its own hover and drag. Hovering opens the table preview at
 * the pointer, and a press pins the node under the pointer and reheats the
 * layout, so the rest of the graph settles around where it is put.
 */
const GraphNode: FC<GraphNodeProps> = (props, ctx) => {
  const themeRef = useThemeContext(ctx);

  const handleMouseenter = (event: NodeMouseEvent) => {
    const { node, state } = props;

    state.hoveredId = node.id;
    state.previewTableId = node.tableId ?? node.id;
    state.previewColumnId = node.group === Group.column ? node.id : null;
    state.previewX = event.evt.clientX;
    state.previewY = event.evt.clientY;
    setCursor(event, CURSOR_POINTER);
  };

  const handleMouseleave = (event: NodeMouseEvent) => {
    const { state } = props;

    state.hoveredId = null;
    state.previewTableId = null;
    state.previewColumnId = null;
    setCursor(event, CURSOR_INHERIT);
  };

  // The pointer moves in stage px and the node lives in scene units, so each
  // delta is divided by the scale before the pin takes it.
  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    const { node, state } = props;

    node.fx = (node.fx ?? node.x) + movementX / state.scale;
    node.fy = (node.fy ?? node.y) + movementY / state.scale;
  };

  const handleDragStart = () => {
    const { node, graph, state } = props;

    node.fx = node.x;
    node.fy = node.y;
    graph.simulation.alphaTarget(DRAG_ALPHA_TARGET).restart();
    state.drag = true;

    drag$.subscribe({
      next: handleMove,
      complete: () => {
        node.fx = null;
        node.fy = null;
        graph.simulation.alphaTarget(0);
        state.drag = false;
      },
    });
  };

  return () => {
    const { node, x, y, state } = props;
    const theme = themeRef.value;
    const isTable = node.group === Group.table;
    const hovered = state.hoveredId === node.id;

    return (
      <k-circle
        name={`visualization-node ${node.id}`}
        kind={`visualization-${node.group}`}
        tableId={node.tableId ?? node.id}
        x={x}
        y={y}
        radius={nodeRadius(node.group)}
        fill={isTable ? theme.accentColor9 : theme.grayColor8}
        stroke={hovered ? theme.focus : theme.canvasBackground}
        strokeWidth={NODE_STROKE_WIDTH}
        on:mouseenter={handleMouseenter}
        on:mouseleave={handleMouseleave}
        on:mousedown={handleDragStart}
        on:touchstart={handleDragStart}
      />
    );
  };
};

export default GraphNode;
