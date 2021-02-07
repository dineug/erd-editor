import { css } from '@/core/tagged';
import { SIZE_MEMO_PADDING, SIZE_FONT } from '@/core/layout';
import { DefaultStyle } from '@/components/css';

export const MemoStyle = css`
  ${DefaultStyle}

  .vuerd-memo {
    position: absolute;
    opacity: 0.9;
    fill: #fff0;
    background-color: var(--vuerd-color-table);
  }

  .vuerd-memo:hover {
    fill: var(--vuerd-color-font);
  }

  .vuerd-memo.active {
    border: solid var(--vuerd-color-table-active) 1px;
    box-shadow: 0 1px 6px var(--vuerd-color-table-active);
  }

  .vuerd-memo-header {
    padding: ${SIZE_MEMO_PADDING}px;
    cursor: move;
  }

  .vuerd-memo-header .vuerd-button {
    float: right;
  }

  .vuerd-memo-textarea {
    padding: ${SIZE_MEMO_PADDING}px;
    opacity: 0.9;
    border: none;
    resize: none;
    outline: none;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-color-font-active);
    background-color: var(--vuerd-color-table);
  }
`;
