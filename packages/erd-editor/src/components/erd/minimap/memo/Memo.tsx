/** @jsxHost konva */

import { FC } from '@dineug/r-html';

import { useThemeContext } from '@/components/themeContext';
import { MEMO_BORDER } from '@/constants/layout';
import type { Memo } from '@/internal-types';
import { getMemoRect } from '@/konva/scene/metrics';

/** The radius the memo stylesheet rounds a memo box with. */
const CORNER_RADIUS = 6;

export type MemoProps = {
  memo: Memo;
};

/**
 * A memo as the minimap draws it: the box and nothing in it. The id rides in
 * the name, the way a relationship carries its own, because an id on a second
 * stage would make an id scan over the live stages ambiguous.
 */
const Memo: FC<MemoProps> = (props, ctx) => {
  const themeRef = useThemeContext(ctx);

  return () => {
    const { memo } = props;
    const theme = themeRef.value;
    const rect = getMemoRect(memo);

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
