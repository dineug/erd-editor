/** @jsxHost konva */

import {
  createRef,
  type FC,
  onMounted,
  onUnmounted,
  ref,
} from '@dineug/r-html';
import { onBeforeFlush, renderKonva, requestFlush } from '@dineug/r-html-konva';
import type { Layer } from 'konva/lib/Layer';
import type { Stage } from 'konva/lib/Stage';

import { scrollbars, THUMB_RADIUS } from '@/scene/draw/scrollbar';
import type { SceneRect } from '@/scene/layout';
import {
  ACTIVE_BORDER,
  activeBox,
  fillBoxes,
  type OverlayGeometry,
  RANGE_BORDER,
  rangeBox,
  regionView,
} from '@/scene/overlay';
import {
  bindScene,
  paintBody,
  paintColumnHeader,
  paintColumnHighlight,
  paintCorner,
  paintFrozenBody,
  paintFrozenHeader,
  paintFrozenHighlight,
  paintRowHeader,
  paintRowHighlight,
  type SceneFunc,
} from '@/scene/paint';
import type { SceneState } from '@/scene/state';

type GridSceneProps = {
  stage: Stage;
  scene: SceneState;
};

const hasArea = (rect: SceneRect) => rect.width > 0 && rect.height > 0;

/**
 * One region's shape on the body layer. It paints itself and clips itself, so
 * it only ever writes the region's place and size.
 */
const regionShape = (name: string, rect: SceneRect, sceneFunc: SceneFunc) => (
  <k-shape
    name={name}
    x={rect.x}
    y={rect.y}
    width={rect.width}
    height={rect.height}
    listening={false}
    sceneFunc={sceneFunc}
  />
);

/**
 * The fixed clip of a region's overlay. Konva clips a group in its own space,
 * so this one stays at the region's origin while a group inside it scrolls; a
 * group with no clip size draws unclipped, which is why an empty region hides.
 */
const clipGroup = (name: string, rect: SceneRect, children: unknown) => (
  <k-group
    name={name}
    x={rect.x}
    y={rect.y}
    clipX={0}
    clipY={0}
    clipWidth={rect.width}
    clipHeight={rect.height}
    visible={hasArea(rect)}
    listening={false}
  >
    {children}
  </k-group>
);

/** A scrollbar track or thumb, in stage coordinates. */
const barRect = (
  name: string,
  visible: boolean,
  rect: SceneRect,
  fill: string,
  cornerRadius = 0
) => (
  <k-rect
    name={name}
    visible={visible}
    x={rect.x}
    y={rect.y}
    width={rect.width}
    height={rect.height}
    cornerRadius={cornerRadius}
    fill={fill}
    listening={false}
  />
);

/**
 * The body layer, one self-painting shape per region, and the overlay of the
 * selection, header highlights and scrollbars. The shapes read the raw state;
 * this template reads the proxy, so a write updates the nodes bound to it.
 */
const GridScene: FC<GridSceneProps> = props => {
  const { stage, scene } = props;
  const bodyRef = createRef<Layer>();
  const overlayRef = createRef<Layer>();
  const unbinds: Array<() => void> = [bindScene(stage, scene)];

  onMounted(() => {
    const body = bodyRef.value;
    const overlay = overlayRef.value;
    if (body && overlay) unbinds.push(scene.bindLayers(body, overlay));

    // Runs after the drain of the commit that redrew the templates, which a
    // resize of the stage must follow, since konva draws each layer at once;
    // arming the gate lets a size set before the mount reach the stage too.
    unbinds.push(
      onBeforeFlush(() => {
        const size = scene.takePendingSize();
        if (size) stage.size(size);
      })
    );
    requestFlush();
  });

  onUnmounted(() => {
    unbinds.splice(0).forEach(unbind => unbind());
  });

  return () => {
    const { layout, scrollTop, scrollLeft, selection, theme } = scene.observed;
    const geometry: OverlayGeometry = {
      offsets: scene.observed.offsets,
      rowHeight: scene.observed.rowHeight,
      rowCount: scene.observed.rowCount,
    };
    const bars = scrollbars(layout, scrollTop, scrollLeft);

    /** A cell region's ranges and active cell, in content coordinates. */
    const cellOverlay = (frozen: boolean) => {
      const view = regionView(layout, frozen, scrollTop, scrollLeft);
      const active = activeBox(
        selection.active,
        frozen,
        layout.frozenCount,
        view,
        geometry
      );

      // Each range draws its fill around the active cell, then its edge, so a
      // later range tints an earlier one's edge as it tints its cells.
      return (
        <k-group
          name={frozen ? 'grid-frozen-scroll' : 'grid-body-scroll'}
          x={frozen ? 0 : -view.left}
          y={-scrollTop}
          listening={false}
        >
          {selection.ranges.flatMap(range => {
            const edge = rangeBox(range, view, geometry);
            const fills = fillBoxes(range, selection.active, view, geometry);

            return [
              ...fills.map(box => (
                <k-rect
                  name="grid-range-fill"
                  visible={box.visible}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  fill={theme.selectionFill}
                  listening={false}
                />
              )),
              <k-rect
                name="grid-range"
                visible={edge.visible}
                x={edge.x}
                y={edge.y}
                width={edge.width}
                height={edge.height}
                stroke={theme.selectionBorder}
                strokeWidth={RANGE_BORDER}
                perfectDrawEnabled={false}
                listening={false}
              />,
            ];
          })}
          <k-rect
            name="grid-active-cell"
            visible={active.visible}
            x={active.x}
            y={active.y}
            width={active.width}
            height={active.height}
            stroke={theme.activeCellBorder}
            strokeWidth={ACTIVE_BORDER}
            perfectDrawEnabled={false}
            listening={false}
          />
        </k-group>
      );
    };

    /** A header region's highlight, in the region's own coordinates. */
    const highlight = (name: string, rect: SceneRect, sceneFunc: SceneFunc) =>
      clipGroup(
        `${name}-clip`,
        rect,
        <k-shape
          name={name}
          x={0}
          y={0}
          width={rect.width}
          height={rect.height}
          listening={false}
          sceneFunc={sceneFunc}
        />
      );

    return (
      <>
        <k-layer name="grid-body" listening={false} use:ref={ref(bodyRef)}>
          {regionShape('grid-body-cells', layout.body, paintBody)}
          {regionShape('grid-frozen-cells', layout.frozenBody, paintFrozenBody)}
          {regionShape(
            'grid-column-header',
            layout.columnHeader,
            paintColumnHeader
          )}
          {regionShape(
            'grid-frozen-header',
            layout.frozenHeader,
            paintFrozenHeader
          )}
          {regionShape('grid-row-header', layout.rowHeader, paintRowHeader)}
          {regionShape('grid-corner', layout.corner, paintCorner)}
        </k-layer>
        <k-layer
          name="grid-overlay"
          listening={false}
          use:ref={ref(overlayRef)}
        >
          {clipGroup('grid-body-clip', layout.body, cellOverlay(false))}
          {clipGroup('grid-frozen-clip', layout.frozenBody, cellOverlay(true))}
          {highlight(
            'grid-column-highlight',
            layout.columnHeader,
            paintColumnHighlight
          )}
          {highlight(
            'grid-frozen-highlight',
            layout.frozenHeader,
            paintFrozenHighlight
          )}
          {highlight('grid-row-highlight', layout.rowHeader, paintRowHighlight)}
          {barRect(
            'grid-vertical-track',
            bars.vertical.visible,
            bars.vertical.track,
            theme.scrollbarTrack
          )}
          {barRect(
            'grid-vertical-thumb',
            bars.vertical.visible,
            bars.vertical.thumb,
            theme.scrollbarThumb,
            THUMB_RADIUS
          )}
          {barRect(
            'grid-horizontal-track',
            bars.horizontal.visible,
            bars.horizontal.track,
            theme.scrollbarTrack
          )}
          {barRect(
            'grid-horizontal-thumb',
            bars.horizontal.visible,
            bars.horizontal.thumb,
            theme.scrollbarThumb,
            THUMB_RADIUS
          )}
        </k-layer>
      </>
    );
  };
};

/**
 * Renders a grid scene as the root of a Stage. Named in lower case on
 * purpose: the r-html refresh boundary treats an all upper case export list
 * as a component module and would self-accept this one.
 *
 * @example
 * const scene = createSceneState({ rowCount, columns, getCell, width, height });
 * renderGridScene(new Stage({ container, width, height }), scene);
 */
export function renderGridScene(stage: Stage, scene: SceneState): void {
  renderKonva(stage, <GridScene stage={stage} scene={scene} />);
}
