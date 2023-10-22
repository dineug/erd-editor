import {
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_PADDING,
} from '@/constants/layout';
import { Memo } from '@/internal-types';

export function calcMemoWidth(memo: Memo): number {
  return (
    MEMO_BORDER + MEMO_PADDING + memo.ui.width + MEMO_PADDING + MEMO_BORDER
  );
}

export function calcMemoHeight(memo: Memo): number {
  return (
    MEMO_BORDER +
    MEMO_PADDING +
    MEMO_HEADER_HEIGHT +
    memo.ui.height +
    MEMO_PADDING +
    MEMO_BORDER
  );
}
