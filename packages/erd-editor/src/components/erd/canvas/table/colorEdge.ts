import { TABLE_CORNER_RADIUS } from '@/components/erd/canvas/sceneTokens';
import { TABLE_BORDER, TABLE_COLOR_WIDTH } from '@/constants/layout';

/**
 * The radius of the card's outer edge, which is the body's own corner grown by
 * the half of its stroke that lies outside the path.
 */
const OUTER_RADIUS = TABLE_CORNER_RADIUS + TABLE_BORDER / 2;

/**
 * The svg path of the colour a table wears along its left edge: the part of
 * the card's outline left of the strip's width, so it follows both rounded
 * corners where a rect that narrow could only round its own.
 *
 * @example
 * <k-path data={getColorEdgePath(rect.height)} fill={table.ui.color} />
 */
export function getColorEdgePath(height: number): string {
  const radius = Math.min(OUTER_RADIUS, height / 2);
  const width = Math.min(TABLE_COLOR_WIDTH, radius);
  // Where the strip's right side meets each corner arc, down from the top.
  const inset = radius - Math.sqrt(radius ** 2 - (radius - width) ** 2);

  return [
    `M ${width} ${inset}`,
    `A ${radius} ${radius} 0 0 0 0 ${radius}`,
    `L 0 ${height - radius}`,
    `A ${radius} ${radius} 0 0 0 ${width} ${height - inset}`,
    'Z',
  ].join(' ');
}
