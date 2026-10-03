/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { SCENE_CODE_FONT_FAMILY } from '@/components/erd/canvas/sceneTokens';
import { useSceneSource } from '@/components/sceneSourceContext';
import { useThemeContext } from '@/components/themeContext';
import { Direction, Show } from '@/constants/schema';
import { Relationship } from '@/internal-types';
import { getSceneTransform } from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';
import { type Anchor, getAnchors, LINE_SIZE } from '@/utils/draw-relationship';
import { referentialActionLabel } from '@/utils/referentialAction';
import { isHighLevelTable } from '@/utils/validation';

/** The size the referential action label is drawn at, in scene units. */
export const ACTION_LABEL_FONT_SIZE = 10;

/** The advance of one glyph of the code face, the ratio the alternate key marks are sized by. */
const ACTION_LABEL_CHAR_WIDTH = ACTION_LABEL_FONT_SIZE * 0.61;

/** The canvas-coloured margin the box keeps around the text. */
const ACTION_LABEL_PADDING = 2;

/** The room the box keeps from the anchor along the route and from the markers across it. */
const ACTION_LABEL_GAP = 3;

type LabelBox = { x: number; y: number; width: number; height: number };

/**
 * The box the label fills beside the child end: over a route leaving sideways,
 * reaching away from the table, and right of one leaving up or down. Across, it
 * clears the widest marker, so no stroke of a crow's foot runs under it.
 */
export function actionLabelBox(end: Anchor, text: string): LabelBox {
  const { x, y, direction } = end;
  const width =
    Math.ceil(text.length * ACTION_LABEL_CHAR_WIDTH) + ACTION_LABEL_PADDING * 2;
  const height = ACTION_LABEL_FONT_SIZE + ACTION_LABEL_PADDING * 2;
  const clear = LINE_SIZE + ACTION_LABEL_GAP;
  const size = { width, height };

  switch (direction) {
    case Direction.left:
      return {
        x: x - ACTION_LABEL_GAP - width,
        y: y - clear - height,
        ...size,
      };
    case Direction.right:
      return { x: x + ACTION_LABEL_GAP, y: y - clear - height, ...size };
    case Direction.top:
      return { x: x + clear, y: y - ACTION_LABEL_GAP - height, ...size };
    default:
      return { x: x + clear, y: y + ACTION_LABEL_GAP, ...size };
  }
}

export type RelationshipActionLabelProps = {
  relationship: Relationship;
  /** The connector the pointer rests on, whose label lights with it. */
  hovered?: { id: string };
};

/**
 * The ON DELETE and ON UPDATE a connector sets, at its child end, on a box of
 * the canvas colour. The group draws every label after every route, so another
 * connector crossing one runs under the box rather than through the text.
 */
const RelationshipActionLabel: FC<RelationshipActionLabelProps> = (
  props,
  ctx
) => {
  const app = useAppContext(ctx);
  const themeRef = useThemeContext(ctx);
  const sourceRef = useSceneSource(ctx);

  return () => {
    const { store } = app.value;
    const { editor, settings } = store.state;
    const { relationship } = props;
    const theme = themeRef.value;
    const source = sourceRef.value;
    const { zoomLevel } = getSceneTransform(store.state, source);
    // The document's own notation: a view draws no distinction by kind, and
    // a zoom that draws a table by its name alone draws no label either.
    const text =
      source !== 'document' ||
      isHighLevelTable(zoomLevel) ||
      bHas(settings.show, Show.hideReferentialAction)
        ? ''
        : referentialActionLabel(relationship);
    if (!text) return null;

    const hover =
      props.hovered?.id === relationship.id ||
      Boolean(editor.hoverRelationshipMap[relationship.id]);
    const base = relationship.identification ? theme.keyPFK : theme.keyFK;
    const box = actionLabelBox(getAnchors(relationship, source).end, text);

    return (
      <k-group
        name={`relationship-action-label ${relationship.id}`}
        x={box.x}
        y={box.y}
        listening={false}
      >
        <k-rect
          name="relationship-action-box"
          width={box.width}
          height={box.height}
          fill={theme.canvasBackground}
        />
        <k-text
          name="relationship-action-text"
          x={ACTION_LABEL_PADDING}
          y={ACTION_LABEL_PADDING}
          text={text}
          fill={hover ? theme.relationshipHover : base}
          fontFamily={SCENE_CODE_FONT_FAMILY}
          fontSize={ACTION_LABEL_FONT_SIZE}
          wrap="none"
        />
      </k-group>
    );
  };
};

export default RelationshipActionLabel;
