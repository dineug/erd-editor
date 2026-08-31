/** @jsxHost konva */

import type { DOMTemplateLiterals } from '@dineug/r-html';

import {
  HIT_FILL,
  ICON_STROKE_WIDTH,
  ICON_VIEW_SIZE,
  type SceneMouseEvent,
} from '@/components/erd/canvas/sceneTokens';
import {
  getIcon,
  type IconName,
  type IconNodeChild,
} from '@/components/primitives/icon/icons';

export type SceneIconOptions = {
  icon: IconName;
  name: string;
  kind: string;
  size: number;
  color: string;
  x: number;
  y: number;
  click?: (event: SceneMouseEvent) => void;
  mouseenter?: (event: SceneMouseEvent) => void;
  mouseleave?: (event: SceneMouseEvent) => void;
};

/**
 * One lucide child as a konva shape. The icons this scene draws are made of
 * paths and one filled dot, so a circle is the only special case and everything
 * else is path data handed over verbatim.
 */
const shape = ([tag, attrs]: IconNodeChild, color: string) =>
  tag === 'circle' ? (
    <k-circle
      x={Number(attrs.cx)}
      y={Number(attrs.cy)}
      radius={Number(attrs.r)}
      fill={color}
      stroke={color}
      strokeWidth={ICON_STROKE_WIDTH}
    />
  ) : (
    <k-path
      data={String(attrs.d)}
      stroke={color}
      strokeWidth={ICON_STROKE_WIDTH}
      lineCap="round"
      lineJoin="round"
    />
  );

/**
 * A lucide icon drawn at size, by scaling its own 24 unit box. The scale carries
 * the stroke with it, which is what keeps the weight the same as the svg the DOM
 * scene rendered at that size.
 */
export function sceneIcon({
  icon,
  name,
  kind,
  size,
  color,
  x,
  y,
  click,
  mouseenter,
  mouseleave,
}: SceneIconOptions): DOMTemplateLiterals | null {
  const definition = getIcon(icon);
  if (!definition || definition.type !== 'svg') return null;

  const scale = size / ICON_VIEW_SIZE;

  return (
    <k-group
      name={name}
      kind={kind}
      x={x}
      y={y}
      scaleX={scale}
      scaleY={scale}
      on:click={click}
      on:mouseenter={mouseenter}
      on:mouseleave={mouseleave}
    >
      <k-rect
        name="icon-hit"
        width={ICON_VIEW_SIZE}
        height={ICON_VIEW_SIZE}
        fill={HIT_FILL}
      />
      {definition.node.map(child => shape(child, color))}
    </k-group>
  );
}
