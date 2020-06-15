import { css } from "lit-element";
import { SIZE_FONT, SIZE_MEMO_PADDING } from "@src/core/Layout";

export const memo = css`
  /* =============== memo ============== */
  .vuerd-memo {
    position: absolute;
    opacity: 0.9;
    fill: #fff0;
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
    transition: border 0.1s;
  }
  .vuerd-memo:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-memo.active {
    border: solid
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active)) 1px;
    box-shadow: 0 1px 6px
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active));
  }
  .vuerd-memo > .vuerd-memo-header {
    padding: ${SIZE_MEMO_PADDING}px;
    cursor: move;
  }
  .vuerd-memo > .vuerd-memo-header .vuerd-button {
    float: right;
  }
  .vuerd-memo > .vuerd-memo-body .vuerd-memo-textarea {
    padding: ${SIZE_MEMO_PADDING}px;
    opacity: 0.9;
    border: none;
    resize: none;
    outline: none;
    font-size: ${SIZE_FONT}px;
    font-family: var(--vuerd-font-family);
    color: var(--vuerd-theme-font-active, var(--vuerd-color-font-active));
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }
`;
