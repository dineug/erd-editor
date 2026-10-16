/** @jsxHost konva */

import { DIFF_OUTLINE_WIDTH } from '@/components/erd/canvas/sceneTokens';

export type DiffOutlineOptions = {
  name: string;
  stroke: string | null;
  width: number;
  height: number;
  cornerRadius: number;
};

/**
 * The outline a diff pane draws round a box standing at its group's origin,
 * centred on the box's edge and taking no press; none while stroke is null.
 */
export const diffOutlineRect = ({
  name,
  stroke,
  width,
  height,
  cornerRadius,
}: DiffOutlineOptions) =>
  stroke ? (
    <k-rect
      name={name}
      x={-DIFF_OUTLINE_WIDTH / 2}
      y={-DIFF_OUTLINE_WIDTH / 2}
      width={width + DIFF_OUTLINE_WIDTH}
      height={height + DIFF_OUTLINE_WIDTH}
      cornerRadius={cornerRadius}
      stroke={stroke}
      strokeWidth={DIFF_OUTLINE_WIDTH}
      listening={false}
    />
  ) : null;
