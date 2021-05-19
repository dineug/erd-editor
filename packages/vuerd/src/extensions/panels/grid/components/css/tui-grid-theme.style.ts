import { css } from '@/core/tagged';

export const TuiGridThemeStyle = css`
  .tui-grid-border-line-top {
    border-top: 1px solid var(--vuerd-color-table);
  }
  .tui-grid-no-scroll-x .tui-grid-border-line-bottom {
    border-bottom: 1px solid var(--vuerd-color-table);
  }
  .tui-grid-frozen-border {
    background-color: var(--vuerd-color-table);
  }
  .tui-grid-container ::-webkit-scrollbar {
    background-color: #fff0;
  }
  .tui-grid-container ::-webkit-scrollbar-thumb {
    background-color: var(--vuerd-color-scrollbar-thumb);
  }
  .tui-grid-container ::-webkit-scrollbar-thumb:hover {
    background-color: var(--vuerd-color-scrollbar-thumb-active);
  }
  .tui-grid-container {
    scrollbar-3dlight-color: var(--vuerd-color-scrollbar-thumb);
    scrollbar-darkshadow-color: var(--vuerd-color-scrollbar-thumb);
    scrollbar-track-color: var(--vuerd-color-scrollbar-thumb);
    scrollbar-shadow-color: var(--vuerd-color-scrollbar-thumb);
    scrollbar-face-color: var(--vuerd-color-scrollbar-thumb);
    scrollbar-highlight-color: var(--vuerd-color-scrollbar-thumb);
    scrollbar-arrow-color: var(--vuerd-color-scrollbar-thumb);
  }
  .tui-grid-border-line-bottom {
    border-bottom: 1px solid var(--vuerd-color-table);
  }
  .tui-grid-content-area {
    border-color: var(--vuerd-color-table);
    background-color: var(--vuerd-color-table);
  }
  .tui-grid-scrollbar-y-inner-border {
    background-color: #fff0;
  }
  .tui-grid-scrollbar-y-outer-border {
    background-color: #fff0;
  }
  .tui-grid-scrollbar-right-top {
    background-color: #fff0;
    border-color: #fff0;
  }
  .tui-grid-scrollbar-right-bottom {
    background-color: #fff0;
    border-color: #fff0;
  }
  .tui-grid-scrollbar-left-bottom {
    background-color: #fff0;
    border-color: #fff0;
  }
  .tui-grid-scrollbar-frozen-border {
    background-color: #fff0;
    border-color: #fff0;
  }
  .tui-grid-height-resize-handle {
    background-color: #fff0;
    border-color: #fff0;
  }
  .tui-grid-pagination {
    background-color: transparent;
    border-color: transparent;
  }
  .tui-grid-layer-selection {
    background-color: var(--vuerd-color-focus);
    border-color: var(--vuerd-color-focus);
  }
  .tui-grid-header-area {
    background-color: var(--vuerd-color-table);
    border-color: var(--vuerd-color-table);
  }
  .tui-grid-body-area {
    background-color: var(--vuerd-color-table);
  }
  .tui-grid-summary-area {
    background-color: var(--vuerd-color-table);
    border-color: var(--vuerd-color-table);
  }
  .tui-grid-has-summary-top .tui-grid-body-area {
    border-color: var(--vuerd-color-table);
  }
  .tui-grid-cell {
    background-color: var(--vuerd-color-table);
    border-color: var(--vuerd-color-table);
    border-left-width: 0;
    border-right-width: 0;
    border-top-width: 1px;
    border-bottom-width: 1px;
    color: var(--vuerd-color-font);
  }
  .tui-grid-cell-editable {
    background-color: var(--vuerd-color-table);
    color: var(--vuerd-color-font);
  }
  .tui-grid-show-lside-area
    .tui-grid-lside-area
    .tui-grid-header-area
    .tui-grid-table {
    border-right-style: solid;
  }
  .tui-grid-cell-header {
    background-color: var(--vuerd-color-table);
    border-color: var(--vuerd-color-table);
    border-left-width: 1px;
    border-right-width: 1px;
    border-top-width: 1px;
    border-bottom-width: 1px;
    color: var(--vuerd-color-font);
  }
  .tui-grid-show-lside-area
    .tui-grid-lside-area
    .tui-grid-body-area
    .tui-grid-table {
    border-right-style: hidden;
  }
  .tui-grid-cell-row-header {
    background-color: #fff;
    border-color: #eee;
    border-left-width: 0;
    border-right-width: 0;
    border-top-width: 1px;
    border-bottom-width: 1px;
    color: #333;
  }
  .tui-grid-show-lside-area
    .tui-grid-lside-area
    .tui-grid-summary-area
    .tui-grid-table {
    border-right-style: hidden;
  }
  .tui-grid-cell-summary {
    background-color: #fff;
    border-color: #eee;
    border-left-width: 0;
    border-right-width: 0;
    color: #333;
  }
  .tui-grid-cell-required {
    background-color: #fffdeb;
  }
  .tui-grid-cell-disabled {
    background-color: #f9f9f9;
    color: #c1c1c1;
  }
  .tui-grid-cell-invalid.tui-grid-cell {
    background-color: #ffe5e5;
  }
  .tui-grid-cell-header.tui-grid-cell-selected {
    background-color: var(--vuerd-color-table);
    color: var(--vuerd-color-font);
  }
  .tui-grid-cell-row-header.tui-grid-cell-selected {
    background-color: #e5f6ff;
  }
  .tui-grid-layer-focus-border {
    background-color: var(--vuerd-color-focus);
  }
  .tui-grid-layer-editing {
    border-color: var(--vuerd-color-focus);
    background-color: var(--vuerd-color-table);
    padding: 0;
    border: none;
  }
  .tui-grid-layer-focus-deactive .tui-grid-layer-focus-border {
    background-color: #aaa;
  }
  .tui-grid-cell-dummy {
    background-color: #fff;
  }

  .tui-grid-layer-state {
    background-color: var(--vuerd-color-table) !important;
  }
  .tui-grid-layer-state p {
    color: var(--vuerd-color-font) !important;
  }
`;
