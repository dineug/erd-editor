import {
  SIZE_FONT,
  SIZE_TABLE_BORDER,
  SIZE_TABLE_HEADER_BODY_HEIGHT,
  SIZE_TABLE_PADDING,
} from '@/core/layout';
import { css } from '@/core/tagged';

export const TableStyle = css`
  .vuerd-table {
    position: absolute;
    opacity: 0.9;
    padding: ${SIZE_TABLE_PADDING}px;
    font-size: ${SIZE_FONT}px;
    fill: #fff0;
    color: #fff0;
    background-color: var(--vuerd-color-table);
    border: solid #fff0 ${SIZE_TABLE_BORDER}px;
    border-radius: 5px;
  }

  .vuerd-table:hover {
    fill: var(--vuerd-color-font);
    color: var(--vuerd-color-font);
  }

  .vuerd-table.active {
    border: solid var(--vuerd-color-table-active) ${SIZE_TABLE_BORDER}px;
    box-shadow: 0 1px 6px var(--vuerd-color-table-active);
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

  .vuerd-table .vuerd-table-header-body > vuerd-input {
    float: left;
  }

  /* animation flip */
  .vuerd-column-move {
    transition: transform 0.3s;
  }

  .vuerd-table-default {
    transition: color 0.15s;
  }

  .vuerd-table-default:hover {
    color: var(--vuerd-color-font-active);
  }
`;
