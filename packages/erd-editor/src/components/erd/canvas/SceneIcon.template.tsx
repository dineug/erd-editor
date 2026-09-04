/** @jsxHost konva */

import type { DOMTemplateLiterals } from '@dineug/r-html';

import { iconHit } from '@/components/erd/canvas/sceneHit';
import {
  ICON_VIEW_SIZE,
  type SceneMouseEvent,
} from '@/components/erd/canvas/sceneTokens';
import {
  getIcon,
  ICON_STROKE_WIDTH,
  type IconNodeChild,
  type LucideIconName,
} from '@/components/primitives/icon/icons';

// lucide only: the circle branch below paints a filled dot, which is what a
// lucide circle is and what a notation ring is not.
export type SceneIconOptions = {
  icon: LucideIconName;
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
 * One lucide child as a konva shape: one filled dot or path data handed over
 * verbatim. The first child also answers a press anywhere in the icon's box,
 * so no shape exists only to be hit.
 */
const shape = ([tag, attrs]: IconNodeChild, color: string, hit: boolean) =>
  tag === 'circle' ? (
    <k-circle
      x={Number(attrs.cx)}
      y={Number(attrs.cy)}
      radius={Number(attrs.r)}
      fill={color}
      stroke={color}
      strokeWidth={ICON_STROKE_WIDTH}
      listening={hit}
      hitFunc={hit ? iconHit : undefined}
    />
  ) : (
    <k-path
      data={String(attrs.d)}
      stroke={color}
      strokeWidth={ICON_STROKE_WIDTH}
      lineCap="round"
      lineJoin="round"
      listening={hit}
      hitFunc={hit ? iconHit : undefined}
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
  if (!definition) return null;

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
      {definition.node.map((child, index) => shape(child, color, index === 0))}
    </k-group>
  );
}
