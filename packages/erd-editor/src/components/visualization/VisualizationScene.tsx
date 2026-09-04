/** @jsxHost konva */

import { FC, repeat } from '@dineug/r-html';
import type { Stage } from 'konva/lib/Stage';

import { useAppContext } from '@/components/appContext';
import { useThemeContext } from '@/components/themeContext';
import {
  Group,
  linkEnds,
  type Visualization,
} from '@/components/visualization/createVisualization';
import GraphNode from '@/components/visualization/graph-node/GraphNode';
import {
  DIM_OPACITY,
  hasName,
  highlightOf,
  labelOf,
  labelOpacity,
  TABLE_RADIUS,
  type VisualizationState,
} from '@/components/visualization/visualizationView';
import { renderKonva } from '@/konva/host';
import { TextFontFamily } from '@/styles/fonts.styles';
import { drag$, type DragMove } from '@/utils/globalEventObservable';

export type VisualizationSceneProps = {
  graph: Visualization;
  state: VisualizationState;
};

/** The px behind font-size-1, the size every other name in the editor draws at. */
const LABEL_FONT_SIZE = 12;

/**
 * The box a label is centred in. Wide enough that a cut name never wraps or
 * loses a glyph to the edge, even at sixteen full-width ones.
 */
const LABEL_WIDTH = 220;

/** The gap between a dot and the first line of its label. */
const LABEL_GAP = 3;

const LINK_STROKE_WIDTH = Math.sqrt(2);

/** A line at rest; one a hovered table lights draws whole, the others fade. */
const LINK_OPACITY = 0.6;

const DIMMED_LINK_OPACITY = LINK_OPACITY * DIM_OPACITY;

/**
 * The graph on two layers: a stage sized box that takes a pan, and the scene
 * itself under the view transform, links below dots below labels. Only a table
 * carries a name, and a hovered table lights its neighbourhood over the rest.
 */
const VisualizationScene: FC<VisualizationSceneProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);

  const handleMove = ({ event, movementX, movementY }: DragMove) => {
    event.type === 'mousemove' && event.preventDefault();
    props.state.x += movementX;
    props.state.y += movementY;
  };

  // A pan is a drag too: a dot the pointer crosses on the way would otherwise
  // open its preview under a hand that is busy moving the view.
  const handlePanStart = () => {
    const { state } = props;

    state.drag = true;
    drag$.subscribe({
      next: handleMove,
      complete: () => {
        state.drag = false;
      },
    });
  };

  return () => {
    const { graph, state } = props;
    const { store } = app.value;
    const { viewport } = store.state.editor;
    const theme = themeRef.value;
    const { x, y, scale, hoveredTableId } = state;
    const opacity = labelOpacity(scale);
    const tables = graph.nodes.filter(node => node.group === Group.table);
    const highlight = hoveredTableId
      ? highlightOf(graph.links, hoveredTableId)
      : null;
    const dimmed = (id: string) =>
      highlight !== null && !highlight.nodeIds.has(id);
    const unlitLinkOpacity = highlight ? DIMMED_LINK_OPACITY : LINK_OPACITY;

    // Read for the subscription alone: d3 moves every node behind the proxy,
    // and this one field is what brings each step of the layout to the scene.
    void state.tick;

    return (
      <>
        <k-layer name="visualization-background">
          <k-rect
            name="visualization-pan"
            x={0}
            y={0}
            width={viewport.width}
            height={viewport.height}
            fill={theme.canvasBackground}
            on:mousedown={handlePanStart}
            on:touchstart={handlePanStart}
          />
        </k-layer>
        <k-layer
          name="visualization-scene"
          x={x}
          y={y}
          scaleX={scale}
          scaleY={scale}
        >
          <k-group name="visualization-links" listening={false}>
            {repeat(
              graph.links,
              link => link.id,
              link => {
                const [source, target] = linkEnds(link);
                const lit = highlight?.linkIds.has(link.id) === true;

                return (
                  <k-line
                    name="visualization-link"
                    points={[source.x, source.y, target.x, target.y]}
                    stroke={lit ? theme.relationshipHover : theme.grayColor7}
                    strokeWidth={LINK_STROKE_WIDTH}
                    opacity={lit ? 1 : unlitLinkOpacity}
                    listening={false}
                  />
                );
              }
            )}
          </k-group>
          <k-group name="visualization-nodes">
            {repeat(
              graph.nodes,
              node => node.id,
              node => (
                <GraphNode
                  node={node}
                  x={node.x}
                  y={node.y}
                  dimmed={dimmed(node.id)}
                  graph={graph}
                  state={state}
                />
              )
            )}
          </k-group>
          <k-group
            name="visualization-labels"
            listening={false}
            opacity={opacity}
            visible={opacity > 0}
          >
            {repeat(
              tables,
              node => node.id,
              node => (
                <k-text
                  name="visualization-label"
                  x={node.x - LABEL_WIDTH / 2}
                  y={node.y + TABLE_RADIUS + LABEL_GAP}
                  width={LABEL_WIDTH}
                  text={labelOf(node)}
                  fill={hasName(node) ? theme.foreground : theme.placeholder}
                  fontFamily={TextFontFamily}
                  fontSize={LABEL_FONT_SIZE}
                  fontStyle="bold"
                  align="center"
                  wrap="none"
                  opacity={dimmed(node.id) ? DIM_OPACITY : 1}
                  listening={false}
                />
              )
            )}
          </k-group>
        </k-layer>
      </>
    );
  };
};

/**
 * Renders the graph as the root of its Stage. Named in lower case on purpose:
 * an all-upper-case export list makes r-html's refresh treat this as a
 * component module and self-accept it, which kills hmr for the whole scene.
 */
export function renderVisualizationScene(
  stage: Stage,
  props: VisualizationSceneProps
): void {
  renderKonva(
    stage,
    <VisualizationScene graph={props.graph} state={props.state} />
  );
}

export default VisualizationScene;
