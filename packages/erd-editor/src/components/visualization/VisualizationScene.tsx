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
  hasName,
  labelOf,
  labelOpacity,
  nodeRadius,
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

const LINK_OPACITY = 0.6;

/**
 * The graph on two layers: a stage sized box that takes a pan, and the scene
 * itself under the view transform, links below dots below labels. Each kind
 * of label fades with the scale as one group, and the column names come last.
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
    const { x, y, scale } = state;

    // Read for the subscription alone: d3 moves every node behind the proxy,
    // and this one field is what brings each step of the layout to the scene.
    void state.tick;

    const labels = (group: Group) => {
      const opacity = labelOpacity(scale, group);

      return (
        <k-group
          name={`visualization-${group}-labels`}
          listening={false}
          opacity={opacity}
          visible={opacity > 0}
        >
          {repeat(
            graph.nodes.filter(node => node.group === group),
            node => node.id,
            node => (
              <k-text
                name="visualization-label"
                x={node.x - LABEL_WIDTH / 2}
                y={node.y + nodeRadius(group) + LABEL_GAP}
                width={LABEL_WIDTH}
                text={labelOf(node)}
                fill={hasName(node) ? theme.foreground : theme.placeholder}
                fontFamily={TextFontFamily}
                fontSize={LABEL_FONT_SIZE}
                fontStyle={group === Group.table ? 'bold' : 'normal'}
                align="center"
                wrap="none"
                listening={false}
              />
            )
          )}
        </k-group>
      );
    };

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

                return (
                  <k-line
                    name="visualization-link"
                    points={[source.x, source.y, target.x, target.y]}
                    stroke={theme.grayColor7}
                    strokeWidth={LINK_STROKE_WIDTH}
                    opacity={LINK_OPACITY}
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
                  graph={graph}
                  state={state}
                />
              )
            )}
          </k-group>
          {labels(Group.table)}
          {labels(Group.column)}
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
