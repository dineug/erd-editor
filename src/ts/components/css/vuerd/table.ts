import { css } from "lit-element";
import {
  SIZE_FONT,
  SIZE_TABLE_PADDING,
  SIZE_TABLE_HEADER_BODY_HEIGHT,
} from "@src/core/Layout";

export const table = css`
  /* =============== table ============== */
  .vuerd-table {
    position: absolute;
    opacity: 0.9;
    padding: ${SIZE_TABLE_PADDING}px;
    font-size: ${SIZE_FONT}px;
    fill: #fff0;
    background-color: var(--vuerd-theme-table, var(--vuerd-color-table));
  }
  .vuerd-table:hover {
    fill: var(--vuerd-theme-font, var(--vuerd-color-font));
  }
  .vuerd-table.active {
    border: solid
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active)) 1px;
    box-shadow: 0 1px 6px
      var(--vuerd-theme-table-active, var(--vuerd-color-table-active));
  }
  .vuerd-table .vuerd-table-header-top {
    overflow: hidden;
    cursor: move;
  }
  .vuerd-table .vuerd-table-header-top .vuerd-button {
    margin-left: 5px;
    float: right;
  }
  .vuerd-table .vuerd-table-header-body {
    height: ${SIZE_TABLE_HEADER_BODY_HEIGHT}px;
  }
`;
