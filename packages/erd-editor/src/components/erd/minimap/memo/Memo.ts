import { FC, html } from '@dineug/r-html';

import * as styles from '@/components/erd/canvas/memo/Memo.styles';
import { Memo } from '@/internal-types';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';

export type MemoProps = {
  memo: Memo;
};

const Memo: FC<MemoProps> = (props, ctx) => {
  return () => {
    const { memo } = props;
    const width = calcMemoWidth(memo);
    const height = calcMemoHeight(memo);

    return html`
      <div
        class=${['memo', styles.root]}
        style=${{
          top: `${memo.ui.y}px`,
          left: `${memo.ui.x}px`,
          'z-index': `${memo.ui.zIndex}`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      ></div>
    `;
  };
};

export default Memo;
