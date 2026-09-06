/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { getMinimapMarkRect } from '@/components/erd/minimap/minimapGeometry';
import { useThemeContext } from '@/components/themeContext';
import { MEMO_BORDER } from '@/constants/layout';
import type { Memo } from '@/internal-types';
import { getMemoRect } from '@/konva/scene/metrics';

/** The radius the memo stylesheet rounds a memo box with. */
const CORNER_RADIUS = 6;

export type MemoProps = {
  memo: Memo;
  /** Thumbnail pixels per scene unit, which is what the box is floored at. */
  ratio: number;
};

/**
 * A memo as the minimap draws it: the box and nothing in it, no smaller than a
 * mark however far the map is folded. The id rides in the name, the way a
 * relationship carries its own, as an id on a second stage would make an id scan ambiguous.
 */
const Memo: FC<MemoProps> = (props, ctx) => {
  const themeRef = useThemeContext(ctx);

  return () => {
    const { memo, ratio } = props;
    const theme = themeRef.value;
    const rect = getMinimapMarkRect(ratio, getMemoRect(memo));

    return (
      <k-rect
        name={`minimap-memo ${memo.id}`}
        kind="minimap-memo"
        x={rect.x + MEMO_BORDER / 2}
        y={rect.y + MEMO_BORDER / 2}
        width={rect.width - MEMO_BORDER}
        height={rect.height - MEMO_BORDER}
        cornerRadius={CORNER_RADIUS}
        fill={theme.memoBackground}
        stroke={theme.memoBorder}
        strokeWidth={MEMO_BORDER}
      />
    );
  };
};

export default Memo;
