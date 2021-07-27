import { SIZE_FONT, SIZE_MEMO_PADDING } from '@/core/layout';
import { css } from '@/core/tagged';

export const MemoStyle = css`
  .vuerd-memo {
    position: absolute;
    opacity: 0.9;
    fill: #fff0;
    background-color: var(--vuerd-color-table);
    border-radius: 5px;
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
    position: relative;
  }

  .vuerd-memo-header-color {
    position: absolute;
    width: 100%;
    height: 4px;
    top: 0;
    left: 0;
    border-radius: 5px 5px 0 0;
    opacity: 0.9;
    cursor: pointer;
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
